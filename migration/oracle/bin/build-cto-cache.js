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
 * a native harness cannot rebuild a model manager whose recipe has an
 * `addCTOModel` step by itself. This script walks every fixture in the
 * corpus (every source directory under `fixtures/`, including the `lifted`
 * and `gaps` ones that P2-10/P2-11 add), resolves blobs, and collects every
 * CTO text an `addCTOModel` call parses -- both where it is a step inside a
 * ModelManager recipe, and where the fixture's own recorded op *is*
 * `ModelManager.addCTOModel` (its `inputs.args` then carry the call's own
 * arguments directly, not a step list).
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
 * Collect every (cto, fileName, skipLocationNodes) triple that the corpus'
 * `addCTOModel` calls need parsed, deduplicated by key. Also counts, per
 * fixture file, whether it contributed at least one triple (a "CTO-dependent
 * fixture"), for the manifest's coverage figure.
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
     * Record one addCTOModel call if its arguments look like a CTO parse.
     * @param {string} opName the op name (e.g. "ModelManager.addCTOModel" or a step's "method")
     * @param {*[]} args call arguments: [cto, fileName?, ...]
     * @param {object} mmOptions the owning model manager's constructor options
     * @returns {boolean} whether a triple was recorded
     */
    function record(opName, args, mmOptions) {
        // A step's method is the bare name ("addCTOModel"); an op field (fixture.op,
        // derived.op) is class-qualified ("ModelManager.addCTOModel"). Both are addCTOModel calls.
        const isAddCTOModel = typeof opName === 'string' && (opName === 'addCTOModel' || opName.endsWith('.addCTOModel'));
        if (!isAddCTOModel) {
            return false;
        }
        if (!Array.isArray(args) || typeof args[0] !== 'string') {
            return false;
        }
        const cto = args[0];
        const fileName = typeof args[1] === 'string' ? args[1] : null;
        const skipLocationNodes = mmOptions && mmOptions.skipLocationNodes !== undefined ? mmOptions.skipLocationNodes : null;
        const key = keyFor(cto, fileName, skipLocationNodes);
        if (!needed.has(key)) {
            needed.set(key, { cto, fileName, skipLocationNodes });
        }
        return true;
    }

    /**
     * Walk a resolved (blob-free) fixture value for addCTOModel calls, both
     * inside `mm` recipe steps and inside any `{op, inputs}` shape (a
     * `derived` spec, or the fixture root itself).
     * @param {*} v resolved value
     * @param {object} ambientOptions the nearest enclosing model manager's options
     * @returns {boolean} whether anything was recorded under this node
     */
    function walk(v, ambientOptions) {
        if (v === null || typeof v !== 'object') {
            return false;
        }
        let found = false;
        if (Array.isArray(v)) {
            for (const x of v) {
                if (walk(x, ambientOptions)) {
                    found = true;
                }
            }
            return found;
        }
        if (v['@@oracle'] === 'mm') {
            const mmOptions = v.options || {};
            for (const step of Array.isArray(v.steps) ? v.steps : []) {
                if (record(step.method, step.args, mmOptions)) {
                    found = true;
                }
                if (walk(step.args, mmOptions)) {
                    found = true;
                }
            }
            if (v.derived) {
                if (record(v.derived.op, v.derived.inputs && v.derived.inputs.args, mmOptions)) {
                    found = true;
                }
                if (walk(v.derived, mmOptions)) {
                    found = true;
                }
            }
            return found;
        }
        if (typeof v.op === 'string' && v.inputs && typeof v.inputs === 'object') {
            const target = v.inputs.target;
            const targetOptions = target && target['@@oracle'] === 'mm' ? target.options || {} : ambientOptions;
            if (record(v.op, v.inputs.args, targetOptions)) {
                found = true;
            }
        }
        for (const x of Object.values(v)) {
            if (walk(x, ambientOptions)) {
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
    const expected = 13006;
    if (fixturesWithCto !== expected) {
        manifest.note = `fixturesWithCto (${fixturesWithCto}) differs from the ${expected} recorded in migration/oracle/README.md's corpus snapshot; `
            + 'this generator counts a fixture as CTO-dependent whenever its resolved inputs reach at least one addCTOModel call (step-level or '
            + 'as the fixture\'s own recorded op), so the figure tracks the corpus present at generation time -- it moves when the corpus is '
            + 're-recorded or topped up (P2-10/P2-11 add fixtures under fixtures/lifted and fixtures/gaps).';
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
