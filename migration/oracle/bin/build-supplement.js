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
 * Build the additive corpus supplement (task P2-11b) from the recorder's raw
 * output, next to the pinned canonical corpus, without changing any pinned
 * file.
 *
 *   node bin/build-supplement.js --raw <dir> [--raw <dir> ...] --blobs <staging blob dir>
 *       --pin <oracle-corpus-*.tgz> --pin-hash <sha256>
 *       [--fixtures <fixtures dir>] [--base <commit>] [--summary <SUPPLEMENT.md>]
 *
 * 1. Checks the pin first: every file the pinned tarball holds under
 *    migration/oracle/fixtures and migration/oracle/cto-cache is present
 *    in this checkout, and the content hash over them, computed as the pin's
 *    CORPUS.md defines it (the sha256 of `shasum -a 256` output, one
 *    "<sha256>  <path>" line per file, sorted by path, paths relative to the
 *    checkout root), equals --pin-hash. The cache files count because the
 *    pin's hash covers them; the cache builder only ever adds entries, so a
 *    rebuilt cache still matches.
 * 2. Deduplicates the raw records exactly as bin/build-corpus.js does (id =
 *    first 24 hex characters of the sha256 of {op, inputs, outcome, env}).
 *    A record whose id is a pinned fixture's id with identical content is an
 *    exact duplicate and is dropped; the same id with different content is
 *    a collision, and the build fails.
 * 3. Writes each fixture to <fixtures>/supplement/<op>/<id>.json with every
 *    blob reference resolved inline: both harnesses resolve blobs only from
 *    <fixtures>/blobs, which is pinned, so the supplement carries no blob of
 *    its own. <fixtures>/supplement/manifest.json holds the counts, the
 *    skipped calls and the supplement's own content hash.
 * 4. Checks the pin again after writing.
 *
 * <fixtures>/supplement/ is replaced as a whole; nothing else is written
 * (apart from the optional --summary file).
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { sha256, sortedStringify } = require('../lib/canon');

const ORACLE_DIR = path.resolve(__dirname, '..');
const REPO_DIR = path.resolve(ORACLE_DIR, '..', '..');
const SOURCE = 'supplement';
const BLOB_RE = /"@@oracle":"blob","sha256":"([0-9a-f]{64})"/;

/**
 * @param {string[]} argv arguments
 * @returns {object} options
 */
function parseArgs(argv) {
    const o = { raw: [], blobs: null, fixtures: path.join(ORACLE_DIR, 'fixtures'), pin: null, pinHash: null, base: null, summary: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const next = () => argv[++i];
        if (a === '--raw') {
            o.raw.push(next());
        } else if (a === '--blobs') {
            o.blobs = next();
        } else if (a === '--fixtures') {
            o.fixtures = path.resolve(next());
        } else if (a === '--pin') {
            o.pin = path.resolve(next());
        } else if (a === '--pin-hash') {
            o.pinHash = next();
        } else if (a === '--base') {
            o.base = next();
        } else if (a === '--summary') {
            o.summary = path.resolve(next());
        } else {
            throw new Error('unknown argument ' + a);
        }
    }
    if (o.raw.length === 0 || !o.blobs || !o.pin || !o.pinHash) {
        throw new Error('usage: build-supplement.js --raw <dir> [--raw <dir>] --blobs <dir> --pin <tgz> --pin-hash <sha256> [--fixtures <dir>] [--base <commit>] [--summary <file>]');
    }
    return o;
}

/**
 * @param {string} file path
 * @returns {string} sha256 hex of the file's bytes
 */
function fileSha(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/**
 * The CORPUS.md content hash over a list of files.
 * @param {string} root directory the paths are relative to
 * @param {string[]} rels relative paths
 * @returns {string} sha256 hex
 */
function contentHash(root, rels) {
    const sorted = rels.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const h = crypto.createHash('sha256');
    for (const rel of sorted) {
        h.update(`${fileSha(path.join(root, rel))}  ${rel}\n`);
    }
    return h.digest('hex');
}

/**
 * Every file under a directory, relative to `root`.
 * @param {string} root base directory
 * @param {string} dir directory to list
 * @returns {string[]} relative paths
 */
function listFiles(root, dir) {
    const out = [];
    const walk = (d) => {
        for (const f of fs.readdirSync(d)) {
            const p = path.join(d, f);
            if (fs.statSync(p).isDirectory()) {
                walk(p);
            } else {
                out.push(path.relative(root, p).split(path.sep).join('/'));
            }
        }
    };
    walk(dir);
    return out;
}

/**
 * Check the pinned files against the pin's content hash.
 * @param {object} opts options
 * @param {string[]} pinned pinned file paths (checkout-relative)
 * @param {string} when label
 */
function checkPin(opts, pinned, when) {
    const missing = pinned.filter((rel) => !fs.existsSync(path.join(REPO_DIR, rel)));
    if (missing.length > 0) {
        throw new Error(`pin check (${when}): ${missing.length} pinned file(s) missing, e.g. ${missing[0]}`);
    }
    const h = contentHash(REPO_DIR, pinned);
    if (h !== opts.pinHash) {
        throw new Error(`pin check (${when}): content hash ${h} != pinned ${opts.pinHash}`);
    }
    console.log(`pin check (${when}): ${pinned.length} pinned files, content hash ${h} OK`);
}

/**
 * Pinned fixtures by id: {file, content} where content is the canonical
 * string of {op, inputs, outcome, env} as stored.
 * @param {string} fixturesDir fixtures root
 * @returns {Map<string, string>} id -> file
 */
function pinnedIds(fixturesDir) {
    const ids = new Map();
    const walk = (d, top) => {
        for (const f of fs.readdirSync(d)) {
            const p = path.join(d, f);
            if (fs.statSync(p).isDirectory()) {
                if (f === 'blobs' || (top && f === SOURCE)) {
                    continue;
                }
                walk(p, false);
            } else if (f.endsWith('.json') && f !== 'manifest.json') {
                ids.set(path.basename(f, '.json'), p);
            }
        }
    };
    walk(fixturesDir, true);
    return ids;
}

/**
 * Resolve every blob reference in a JSON value from a blob directory.
 * @param {*} v value
 * @param {string} blobDir staging blob store
 * @returns {*} value with no blob reference
 */
function inline(v, blobDir) {
    if (v === null || typeof v !== 'object') {
        return v;
    }
    if (Array.isArray(v)) {
        return v.map((x) => inline(x, blobDir));
    }
    if (v['@@oracle'] === 'blob') {
        const h = v.sha256;
        const text = fs.readFileSync(path.join(blobDir, h.slice(0, 2), h + '.json'), 'utf8');
        return inline(JSON.parse(text), blobDir);
    }
    const out = {};
    for (const k of Object.keys(v)) {
        out[k] = inline(v[k], blobDir);
    }
    return out;
}

/**
 * Main.
 */
async function main() {
    const opts = parseArgs(process.argv.slice(2));
    const oracleRel = path.relative(REPO_DIR, ORACLE_DIR).split(path.sep).join('/');
    const listing = execFileSync('tar', ['-tzf', opts.pin], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const pinned = listing.split('\n').map((l) => l.replace(/^\.\//, ''))
        .filter((l) => l && !l.endsWith('/') && (l.startsWith(oracleRel + '/fixtures/') || l.startsWith(oracleRel + '/cto-cache/')));
    const pinnedFixtureFiles = pinned.filter((l) => l.startsWith(oracleRel + '/fixtures/'));
    if (pinnedFixtureFiles.some((l) => l.startsWith(`${oracleRel}/fixtures/${SOURCE}/`))) {
        throw new Error('the pinned tarball already has a fixtures/supplement/ directory');
    }
    checkPin(opts, pinned, 'before');

    const files = [];
    const statsFiles = [];
    for (const dir of opts.raw) {
        for (const f of fs.readdirSync(dir).sort()) {
            if (f.endsWith('.jsonl')) {
                files.push(path.join(dir, f));
            } else if (f.endsWith('.stats.json')) {
                statsFiles.push(path.join(dir, f));
            }
        }
    }

    const seen = new Map();
    let rawCount = 0;
    for (const f of files) {
        const rl = readline.createInterface({ input: fs.createReadStream(f), crlfDelay: Infinity });
        for await (const line of rl) {
            if (!line.trim()) {
                continue;
            }
            rawCount++;
            const rec = JSON.parse(line);
            if (rec.source !== SOURCE) {
                throw new Error(`raw record from source ${rec.source}, expected ${SOURCE} (${f})`);
            }
            const content = { op: rec.op, inputs: rec.inputs, outcome: rec.outcome, env: rec.env };
            const id = sha256(sortedStringify(content));
            const prev = seen.get(id);
            if (prev) {
                prev.occurrences++;
                if (rec.source_test < prev.source_test) {
                    prev.source_test = rec.source_test;
                }
                continue;
            }
            seen.set(id, { id, source_test: rec.source_test, op: rec.op, inputs: rec.inputs, outcome: rec.outcome, env: rec.env, occurrences: 1 });
        }
    }

    const pinnedById = pinnedIds(opts.fixtures);
    const duplicates = [];
    const collisions = [];
    const keep = [];
    for (const fx of seen.values()) {
        const id = fx.id.slice(0, 24);
        const pinnedFile = pinnedById.get(id);
        if (!pinnedFile) {
            keep.push(fx);
            continue;
        }
        const p = JSON.parse(fs.readFileSync(pinnedFile, 'utf8'));
        const same = sortedStringify({ op: p.op, inputs: p.inputs, outcome: p.outcome, env: p.env }) ===
            sortedStringify({ op: fx.op, inputs: fx.inputs, outcome: fx.outcome, env: fx.env });
        (same ? duplicates : collisions).push({ id, op: fx.op, pinned: path.relative(opts.fixtures, pinnedFile) });
    }
    if (collisions.length > 0) {
        throw new Error(`${collisions.length} supplement fixture id(s) collide with a different pinned fixture: ` + JSON.stringify(collisions.slice(0, 5)));
    }

    const outDir = path.join(opts.fixtures, SOURCE);
    fs.rmSync(outDir, { recursive: true, force: true });
    const counts = {};
    for (const fx of keep) {
        const outFx = {
            id: fx.id.slice(0, 24),
            source: SOURCE,
            source_test: fx.source_test,
            op: fx.op,
            inputs: inline(fx.inputs, opts.blobs),
            outcome: inline(fx.outcome, opts.blobs),
            env: fx.env,
            occurrences: fx.occurrences,
        };
        const text = JSON.stringify(outFx);
        if (BLOB_RE.test(text)) {
            throw new Error('unresolved blob reference in supplement fixture ' + outFx.id);
        }
        const dir = path.join(outDir, fx.op.replace(/[^A-Za-z0-9._-]/g, '_'));
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, outFx.id + '.json'), text + '\n');
        counts[fx.op] = (counts[fx.op] || 0) + 1;
    }

    const skipped = {};
    const recorded = {};
    for (const f of statsFiles) {
        const st = JSON.parse(fs.readFileSync(f, 'utf8'));
        for (const [op, reasons] of Object.entries(st.skipped || {})) {
            skipped[op] = skipped[op] || {};
            for (const [r, n] of Object.entries(reasons)) {
                skipped[op][r] = (skipped[op][r] || 0) + n;
            }
        }
        for (const [op, n] of Object.entries(st.recorded || {})) {
            recorded[op] = (recorded[op] || 0) + n;
        }
    }

    const fixtureFiles = listFiles(REPO_DIR, outDir);
    const supplementHash = contentHash(REPO_DIR, fixtureFiles);
    const manifest = {
        source: SOURCE,
        base_commit: opts.base,
        pin: { tarball: path.basename(opts.pin), content_hash: opts.pinHash, files: pinned.length },
        raw_records: rawCount,
        unique_records: seen.size,
        exact_duplicates_of_pinned_dropped: duplicates.length,
        dropped: duplicates,
        fixtures: keep.length,
        by_op: Object.fromEntries(Object.entries(counts).sort()),
        recorded_calls: recorded,
        skipped_calls: skipped,
        content_hash: supplementHash,
        content_hash_note: 'sha256 of the sorted "<sha256>  <path>" lines of every fixture file under fixtures/supplement/ (not manifest.json), paths relative to the concerto checkout root, as CORPUS.md defines the pin\'s hash',
    };
    fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
    checkPin(opts, pinned, 'after');

    if (opts.summary) {
        const md = [
            '# Oracle corpus supplement (task P2-11b)',
            '',
            `- Additive to the pinned canonical corpus \`${path.basename(opts.pin, '.tgz')}\` (content hash \`${opts.pinHash}\`), which it does not change.`,
            `- Recorded from accordproject/concerto${opts.base ? '@' + opts.base : ''} by \`migration/oracle/drivers/supplement.spec.js\` under \`lib/recorder.js\` (frozen clock, seeded random and uuid), against the frozen reference's own source (concerto-core v5.0.0 \`src/\`).`,
            `- Built by \`migration/oracle/bin/build-supplement.js\`: ${keep.length} fixtures under \`${oracleRel}/fixtures/supplement/\`, blobs inlined, ${duplicates.length} exact duplicate(s) of pinned fixtures dropped, no id collision.`,
            `- Files: ${fixtureFiles.length} fixture files plus \`fixtures/supplement/manifest.json\`.`,
            `- Content hash (sha256 of the sorted per-file sha256 list, as CORPUS.md): ${supplementHash}`,
            '',
        ].join('\n');
        fs.writeFileSync(opts.summary, md);
    }
    console.log(JSON.stringify({ raw_records: rawCount, unique: seen.size, duplicates_dropped: duplicates.length, fixtures: keep.length, content_hash: supplementHash }));
}

main().catch((e) => {
    console.error('ERROR build-supplement:', e.stack || e.message);
    process.exit(1);
});
