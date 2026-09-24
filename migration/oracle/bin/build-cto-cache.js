#!/usr/bin/env node
/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/**
 * CTO -> AST cache for the native (Rust) oracle harness (PORTING.md OD-9).
 *
 *   node bin/build-cto-cache.js [--fixtures <dir>] [--cache <dir>] [--manifest <file>]
 *   node bin/build-cto-cache.js --check [--fixtures <dir>] [--cache <dir>]
 *
 * CTO parsing stays in JS (concerto-cto is out of scope for the Rust port), so
 * a native harness cannot rebuild a model manager whose recipe reached the
 * CTO parser by itself. This script walks every fixture in the corpus (every
 * source directory under `fixtures/`, including the `lifted` and `gaps` ones
 * that P2-10/P2-11 add), resolves blobs, and collects every CTO text that any
 * of `ModelManager`'s five entry points into `ctoProcessFile` parses --
 * `addCTOModel`, `addModel`, `addModelFiles`, `updateModelFile` and
 * `validateModelFile` (the last is a query, never a step) -- each recorded
 * either as a step inside the owning `ModelManager` recipe, or as the
 * fixture's own recorded op (its `inputs.args` then carry the call's own
 * arguments directly, not a step list). `addModelFile` is excluded: it takes
 * an already-built `ModelFile`, never a CTO string, so it never reaches
 * `processFile`. A call is only collected when the owning model manager's
 * recipe `kind` is `ModelManager` -- `BaseModelManager` and `AstModelManager`
 * inherit the same methods but their `processFile` never runs `Parser.parse`,
 * so a string argument there is AST-shaped input, not CTO text.
 *
 * Each CTO text is parsed with the frozen reference `concerto-cto` 5.0.0 (the
 * one the oracle recorded with), exactly as `ModelManager`'s `ctoProcessFile`
 * does: `Parser.parse(cto, fileName ?? 'UNKNOWN', { skipLocationNodes })`.
 * The entry is written to a content-addressed cache: `cto-cache/<aa>/<sha
 * 256>.json`, holding `{ "ast": ... }` on success or
 * `{ "error": { "class", "message", "location" } }` when the reference
 * parser throws a `ParseException`.
 *
 * ## Cache key
 *
 * The key is the SHA-256 of `JSON.stringify([cto, fileName, skipLocationNodes])`.
 * `skipLocationNodes` is the only parser argument that changes the *shape* of
 * a successful AST (verified empirically: two parses of the same text with
 * the same `skipLocationNodes` but different `fileName`s are byte-identical,
 * because `fileName` is never written into a location node). `fileName` is
 * still part of the key, for two reasons: (1) it changes the *message* of a
 * `ParseException` (`parseexception.js` appends `" File " + fileName`), so
 * excluding it would let two fixtures with the same invalid CTO text and
 * different file names collide on one cache entry and silently give one of
 * them the wrong recorded message; (2) it matches the keying the P0-04b
 * trial (`bin/cto-cache.js`, kept as-is, not touched by this task) already
 * used, so a cache built here is a superset-safe drop-in.
 *
 * ## Regeneration
 *
 * The cache is a generated artefact, like the corpus itself (`fixtures/` is
 * git-ignored -- see `.gitignore`), so `cto-cache/` is git-ignored too and is
 * never part of a PR diff. What *is* committed is this generator, the format
 * documentation above and in README.md, and a small evidence manifest
 * (`results/cto-cache.json`) carrying a content hash so a stale or corrupt
 * cache can be detected without diffing 13k files.
 */

const fs = require('fs');
const path = require('path');
const { sha256 } = require('../lib/canon');
const { blobStore } = require('../lib/store');

const ORACLE_DIR = path.resolve(__dirname, '..');

/**
 * @param {string[]} argv arguments
 * @returns {object} options
 */
function parseArgs(argv) {
    const o = {
        fixtures: path.join(ORACLE_DIR, 'fixtures'),
        cache: path.join(ORACLE_DIR, 'cto-cache'),
        manifest: path.join(ORACLE_DIR, 'results', 'cto-cache.json'),
        check: false,
        verify: false,
        force: false,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--fixtures') {
            o.fixtures = path.resolve(argv[++i]);
        } else if (a === '--cache') {
            o.cache = path.resolve(argv[++i]);
        } else if (a === '--manifest') {
            o.manifest = path.resolve(argv[++i]);
        } else if (a === '--check') {
            o.check = true;
        } else if (a === '--verify') {
            o.verify = true;
        } else if (a === '--force') {
            o.force = true;
        } else {
            throw new Error('unknown argument ' + a);
        }
    }
    return o;
}

/**
 * @param {string} cacheDir cache root
 * @param {string} key sha-256 hex digest
 * @returns {string} entry file path
 */
function entryPath(cacheDir, key) {
    return path.join(cacheDir, key.slice(0, 2), key + '.json');
}

/**
 * The key for one (cto, fileName, skipLocationNodes) triple. See the "Cache
 * key" doc comment above for why fileName is included.
 * @param {string} cto CTO text
 * @param {string|null} fileName file name argument, or null when absent
 * @param {boolean|null} skipLocationNodes the effective parser option
 * @returns {string} sha-256 hex digest
 */
function keyFor(cto, fileName, skipLocationNodes) {
    return sha256(JSON.stringify([cto, fileName, skipLocationNodes]));
}

/**
 * One entry per `ModelManager` method that can reach `ctoProcessFile`
 * (`this.processFile(fileName, modelInput)` where `modelInput` is a CTO
 * string), keyed by the method's bare name -- which is how it appears both as
 * a step's `method` and, stripped of its `ModelManager.` prefix, as an op
 * field. Each extractor reads a call's `args` and returns every `{cto,
 * fileName}` pair it would hand to the parser; `addModelFile` has no entry
 * because it takes an already-built `ModelFile`, never a string, so it never
 * calls `processFile`.
 * @type {Object<string, function(*[]): {cto: string, fileName: (string|null)}[]>}
 */
const CTO_ENTRY_POINTS = {
    // addCTOModel(cto, fileName?, disableValidation?)
    addCTOModel: (args) => (Array.isArray(args) && typeof args[0] === 'string')
        ? [{ cto: args[0], fileName: typeof args[1] === 'string' ? args[1] : null }]
        : [],
    // addModel(modelInput, cto?, fileName?, disableValidation?) -- processFile parses
    // modelInput, not the optional cto convenience argument.
    addModel: (args) => (Array.isArray(args) && typeof args[0] === 'string')
        ? [{ cto: args[0], fileName: typeof args[2] === 'string' ? args[2] : null }]
        : [],
    // updateModelFile(modelFile, fileName?, disableValidation?) -- only when modelFile is a string.
    updateModelFile: (args) => (Array.isArray(args) && typeof args[0] === 'string')
        ? [{ cto: args[0], fileName: typeof args[1] === 'string' ? args[1] : null }]
        : [],
    // validateModelFile(modelFile, fileName?) -- a query, never a step; only when modelFile is a string.
    validateModelFile: (args) => (Array.isArray(args) && typeof args[0] === 'string')
        ? [{ cto: args[0], fileName: typeof args[1] === 'string' ? args[1] : null }]
        : [],
    // addModelFiles(modelFiles, fileNames?, disableValidation?) -- each string element of
    // modelFiles is parsed against the same-index element of fileNames.
    addModelFiles: (args) => {
        if (!Array.isArray(args) || !Array.isArray(args[0])) {
            return [];
        }
        const modelFiles = args[0];
        const fileNames = Array.isArray(args[1]) ? args[1] : null;
        const out = [];
        for (let i = 0; i < modelFiles.length; i++) {
            if (typeof modelFiles[i] === 'string') {
                out.push({ cto: modelFiles[i], fileName: fileNames && typeof fileNames[i] === 'string' ? fileNames[i] : null });
            }
        }
        return out;
    },
};

/**
 * Collect every (cto, fileName, skipLocationNodes) triple that the corpus'
 * calls into `ctoProcessFile` (any of `CTO_ENTRY_POINTS`) need parsed,
 * deduplicated by key. Also counts, per fixture file, whether it contributed
 * at least one triple (a "CTO-dependent fixture"), for the manifest's
 * coverage figure.
 * @param {string} fixturesDir fixtures root
 * @returns {{needed: Map<string,{cto:string,fileName:string|null,skipLocationNodes:boolean|null}>,
 *            fixturesScanned: number, fixturesWithCto: number}} the collected keys and counts
 */
function collect(fixturesDir) {
    const store = blobStore(path.join(fixturesDir, 'blobs'));
    const needed = new Map();
    let fixturesScanned = 0;
    let fixturesWithCto = 0;

    /**
     * Record every CTO parse one call would make, if it is a call into
     * `ctoProcessFile` on a `ModelManager` (never `BaseModelManager` or
     * `AstModelManager`: they inherit the same methods, but their
     * `processFile` never runs `Parser.parse`, so a string argument there is
     * AST-shaped input, not CTO text).
     * @param {string} opName the op name (e.g. "ModelManager.addModelFiles" or a step's bare "method")
     * @param {*[]} args call arguments
     * @param {{options: object, kind: string}} mmCtx the owning model manager's recipe context
     * @returns {boolean} whether at least one triple was recorded
     */
    function record(opName, args, mmCtx) {
        // A step's method is the bare name ("addModelFiles"); an op field (fixture.op,
        // derived.op) is class-qualified ("ModelManager.addModelFiles"). Both key the same entry.
        const bareName = typeof opName === 'string' ? opName.slice(opName.lastIndexOf('.') + 1) : null;
        const extract = bareName && CTO_ENTRY_POINTS[bareName];
        if (!extract || !mmCtx || mmCtx.kind !== 'ModelManager') {
            return false;
        }
        const skipLocationNodes = mmCtx.options && mmCtx.options.skipLocationNodes !== undefined ? mmCtx.options.skipLocationNodes : null;
        let found = false;
        for (const { cto, fileName } of extract(args)) {
            const key = keyFor(cto, fileName, skipLocationNodes);
            if (!needed.has(key)) {
                needed.set(key, { cto, fileName, skipLocationNodes });
            }
            found = true;
        }
        return found;
    }

    /**
     * Walk a resolved (blob-free) fixture value for calls into
     * `ctoProcessFile`, both inside `mm` recipe steps and inside any `{op,
     * inputs}` shape (a `derived` spec, or the fixture root itself).
     * @param {*} v resolved value
     * @param {{options: object, kind: string}|null} ambientCtx the nearest enclosing model manager's recipe context
     * @returns {boolean} whether anything was recorded under this node
     */
    function walk(v, ambientCtx) {
        if (v === null || typeof v !== 'object') {
            return false;
        }
        let found = false;
        if (Array.isArray(v)) {
            for (const x of v) {
                if (walk(x, ambientCtx)) {
                    found = true;
                }
            }
            return found;
        }
        if (v['@@oracle'] === 'mm') {
            const mmCtx = { options: v.options || {}, kind: v.kind };
            for (const step of Array.isArray(v.steps) ? v.steps : []) {
                if (record(step.method, step.args, mmCtx)) {
                    found = true;
                }
                if (walk(step.args, mmCtx)) {
                    found = true;
                }
            }
            if (v.derived) {
                if (record(v.derived.op, v.derived.inputs && v.derived.inputs.args, mmCtx)) {
                    found = true;
                }
                if (walk(v.derived, mmCtx)) {
                    found = true;
                }
            }
            return found;
        }
        if (typeof v.op === 'string' && v.inputs && typeof v.inputs === 'object') {
            const target = v.inputs.target;
            const targetCtx = target && target['@@oracle'] === 'mm' ? { options: target.options || {}, kind: target.kind } : ambientCtx;
            if (record(v.op, v.inputs.args, targetCtx)) {
                found = true;
            }
        }
        for (const x of Object.values(v)) {
            if (walk(x, ambientCtx)) {
                found = true;
            }
        }
        return found;
    }

    for (const source of fs.readdirSync(fixturesDir)) {
        const sourceDir = path.join(fixturesDir, source);
        if (source === 'blobs' || source === 'manifest.json' || !fs.statSync(sourceDir).isDirectory()) {
            continue;
        }
        for (const op of fs.readdirSync(sourceDir)) {
            const opDir = path.join(sourceDir, op);
            if (!fs.statSync(opDir).isDirectory()) {
                continue;
            }
            for (const f of fs.readdirSync(opDir)) {
                if (!f.endsWith('.json')) {
                    continue;
                }
                fixturesScanned++;
                const fixture = JSON.parse(fs.readFileSync(path.join(opDir, f), 'utf8'));
                const resolvedInputs = store.unpack(fixture.inputs);
                let hit = walk({ op: fixture.op, inputs: resolvedInputs }, {});
                if (walk(resolvedInputs, {})) {
                    hit = true;
                }
                if (hit) {
                    fixturesWithCto++;
                }
            }
        }
    }

    return { needed, fixturesScanned, fixturesWithCto };
}

/**
 * @param {string} cacheDir cache root
 * @param {Map<string,object>} needed collected keys
 * @returns {{missing: string[]}} keys with no cache file, or a corrupt one
 */
function findMissing(cacheDir, needed) {
    const missing = [];
    for (const key of needed.keys()) {
        const f = entryPath(cacheDir, key);
        if (!fs.existsSync(f)) {
            missing.push(key);
            continue;
        }
        try {
            const entry = JSON.parse(fs.readFileSync(f, 'utf8'));
            if (!('ast' in entry) && !('error' in entry)) {
                missing.push(key);
            }
        } catch (e) {
            missing.push(key);
        }
    }
    return { missing };
}

/**
 * A content hash over every collected key and its cache entry's exact bytes,
 * sorted by key. Detects a missing, corrupt or stale entry without diffing
 * the cache directory itself (which is git-ignored).
 * @param {string} cacheDir cache root
 * @param {Map<string,object>} needed collected keys
 * @returns {string} sha-256 hex digest, or null if any entry is missing
 */
function contentHash(cacheDir, needed) {
    const parts = [];
    for (const key of [...needed.keys()].sort()) {
        const f = entryPath(cacheDir, key);
        let bytes;
        try {
            bytes = fs.readFileSync(f, 'utf8');
        } catch (e) {
            return null;
        }
        parts.push(key + ':' + sha256(bytes));
    }
    return sha256(parts.join('\n'));
}

/**
 * @returns {{Parser: object, refDir: string, ctoParserVersion: string}} the frozen reference parser
 */
function loadReferenceParser() {
    // ORACLE_REFERENCE_DIR points at another checkout's installed reference.
    const refRoot = process.env.ORACLE_REFERENCE_DIR || path.join(ORACLE_DIR, 'reference');
    const refDir = path.join(refRoot, 'node_modules', '@accordproject', 'concerto-cto');
    const { Parser } = require(refDir);
    const ctoParserVersion = JSON.parse(fs.readFileSync(path.join(refDir, 'package.json'), 'utf8')).version;
    return { Parser, refDir, ctoParserVersion };
}

/**
 * Parse one triple exactly as ModelManager's ctoProcessFile does, and encode
 * the result the same way a cache entry is encoded.
 * @param {object} Parser the reference concerto-cto Parser
 * @param {string} cto CTO text
 * @param {string|null} fileName file name argument, or null when absent
 * @param {boolean|null} skipLocationNodes the effective parser option
 * @returns {object} `{ast}` or `{error: {class, message, location}}`
 */
function parseOne(Parser, cto, fileName, skipLocationNodes) {
    try {
        const ast = Parser.parse(cto, fileName ?? 'UNKNOWN', { skipLocationNodes: skipLocationNodes === null ? undefined : skipLocationNodes });
        return { ast };
    } catch (e) {
        return { error: { class: e.constructor.name, message: e.message, location: typeof e.getFileLocation === 'function' ? e.getFileLocation() : null } };
    }
}

/**
 * Re-parse every collected triple fresh and compare it, byte for byte, to
 * what is on disk in the cache. This is the exit condition "reading an AST
 * back from the cache gives exactly what the reference parser returns",
 * checked directly rather than assumed from the build step alone.
 * @param {string} cacheDir cache root
 * @param {Map<string,object>} needed collected keys
 * @param {object} Parser the reference concerto-cto Parser
 * @returns {{checked: number, mismatches: string[]}} verification result
 */
function verify(cacheDir, needed, Parser) {
    const mismatches = [];
    let checked = 0;
    for (const [key, { cto, fileName, skipLocationNodes }] of needed) {
        const f = entryPath(cacheDir, key);
        let cached;
        try {
            cached = JSON.parse(fs.readFileSync(f, 'utf8'));
        } catch (e) {
            mismatches.push(key);
            continue;
        }
        const fresh = parseOne(Parser, cto, fileName, skipLocationNodes);
        checked++;
        if (JSON.stringify(cached) !== JSON.stringify(fresh)) {
            mismatches.push(key);
        }
    }
    return { checked, mismatches };
}

/**
 * Main.
 */
function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (!fs.existsSync(opts.fixtures)) {
        console.error(`build-cto-cache: no corpus at ${opts.fixtures} (see README.md "Record and build the corpus")`);
        process.exitCode = 1;
        return;
    }

    const { needed, fixturesScanned, fixturesWithCto } = collect(opts.fixtures);

    if (opts.check) {
        const { missing } = findMissing(opts.cache, needed);
        if (missing.length > 0) {
            console.error(`build-cto-cache --check: ${missing.length} of ${needed.size} CTO texts have no (or a corrupt) cache entry, e.g. ${missing.slice(0, 5).join(', ')}`);
            process.exitCode = 1;
            return;
        }
        console.log(`build-cto-cache --check: OK, all ${needed.size} CTO texts (from ${fixturesWithCto} of ${fixturesScanned} fixtures) have a cache entry under ${opts.cache}`);
        if (!opts.verify) {
            return;
        }
    }

    if (opts.verify) {
        const { Parser } = loadReferenceParser();
        const { checked, mismatches } = verify(opts.cache, needed, Parser);
        if (mismatches.length > 0) {
            console.error(`build-cto-cache --verify: ${mismatches.length} of ${checked} cache entries do not match a fresh parse, e.g. ${mismatches.slice(0, 5).join(', ')}`);
            process.exitCode = 1;
            return;
        }
        console.log(`build-cto-cache --verify: OK, all ${checked} cache entries match a fresh parse from the reference`);
        return;
    }

    const { Parser, ctoParserVersion } = loadReferenceParser();

    let written = 0;
    let reused = 0;
    let astCount = 0;
    let errorCount = 0;
    for (const [key, { cto, fileName, skipLocationNodes }] of needed) {
        const f = entryPath(opts.cache, key);
        if (!opts.force && fs.existsSync(f)) {
            reused++;
            const entry = JSON.parse(fs.readFileSync(f, 'utf8'));
            if (entry.ast) {
                astCount++;
            } else {
                errorCount++;
            }
            continue;
        }
        const entry = parseOne(Parser, cto, fileName, skipLocationNodes);
        if (entry.ast) {
            astCount++;
        } else {
            errorCount++;
        }
        fs.mkdirSync(path.dirname(f), { recursive: true });
        const tmp = f + '.' + process.pid + '.tmp';
        fs.writeFileSync(tmp, JSON.stringify(entry));
        fs.renameSync(tmp, f);
        written++;
    }

    const hash = contentHash(opts.cache, needed);
    const manifest = {
        generatedAt: new Date().toISOString(),
        fixturesDir: path.relative(ORACLE_DIR, opts.fixtures),
        cacheDir: path.relative(ORACLE_DIR, opts.cache),
        ctoParserVersion,
        fixturesScanned,
        fixturesWithCto,
        uniqueCtoTexts: needed.size,
        entries: { ast: astCount, error: errorCount, total: astCount + errorCount },
        written,
        reused,
        contentHash: hash,
    };
    // The issue's own figure (13,006) was fixtures reaching addCTOModel specifically, on the
    // canonical unit+data+conformance corpus (no fixtures/lifted or fixtures/gaps): this generator,
    // scoped to just that one entry point, reproduces exactly 13,006 on that corpus (see git history
    // for the check). The corrected figure is higher because ModelManager has four more entry points
    // into ctoProcessFile -- addModel, addModelFiles, updateModelFile, validateModelFile -- that also
    // parse CTO text and also need a cache entry; CTO_ENTRY_POINTS above covers all five.
    const issueFigure = 13006;
    if (fixturesWithCto !== issueFigure) {
        manifest.note = `fixturesWithCto (${fixturesWithCto}) differs from the ${issueFigure} the issue and README's corpus snapshot record. `
            + `That figure counted only fixtures reaching addCTOModel; on the canonical unit+data+conformance corpus (fixtures/lifted and `
            + `fixtures/gaps excluded) this generator reproduces it exactly when scoped to that one entry point. The figure here also counts `
            + `fixtures reaching ModelManager's other four entry points into ctoProcessFile -- addModel, addModelFiles, updateModelFile and `
            + `validateModelFile -- which parse CTO text just as addCTOModel does and were previously missing from the cache (see git history). `
            + `It also moves with the corpus itself: a re-recording or a P2-10/P2-11 addition under fixtures/lifted or fixtures/gaps changes `
            + `both fixturesScanned and fixturesWithCto.`;
    }
    fs.mkdirSync(path.dirname(opts.manifest), { recursive: true });
    fs.writeFileSync(opts.manifest, JSON.stringify(manifest, null, 2) + '\n');

    console.log(`build-cto-cache: ${needed.size} CTO texts (${astCount} ast, ${errorCount} error) from ${fixturesWithCto} of ${fixturesScanned} fixtures -> ${opts.cache} (${written} written, ${reused} reused)`);
    console.log(`build-cto-cache: manifest -> ${opts.manifest} (contentHash ${hash})`);
}

if (require.main === module) {
    main();
}

module.exports = { collect, entryPath, keyFor, findMissing, contentHash, loadReferenceParser, parseOne, verify };
