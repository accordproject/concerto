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
 * Turn raw recorder output into the fixture corpus.
 *
 *   node bin/build-corpus.js --raw <dir> [--raw <dir> ...] --blobs <staging blob dir> --out <fixtures dir>
 *
 * Records are deduplicated by content hash of {op, inputs, outcome, env}
 * across all sources; a record seen in several sources is kept under the
 * first source in the order unit, data, conformance, gaps, lifted. Each fixture is written
 * to <out>/<source>/<op>/<id>.json, and every blob a fixture references
 * (directly or through another blob) is copied from the recorder's staging
 * blob store to <out>/blobs. <out>/manifest.json holds the counts per
 * source and op, the recorder's skip counts, and tainted-state counts.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { sha256, sortedStringify } = require('../lib/canon');

const SOURCE_ORDER = ['unit', 'data', 'conformance', 'gaps', 'lifted'];

/**
 * @param {string[]} argv arguments
 * @returns {object} options
 */
function parseArgs(argv) {
    const o = { raw: [], out: null, blobs: null };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--raw') {
            o.raw.push(argv[++i]);
        } else if (argv[i] === '--blobs') {
            o.blobs = argv[++i];
        } else if (argv[i] === '--out') {
            o.out = argv[++i];
        }
    }
    if (o.raw.length === 0 || !o.out || !o.blobs) {
        throw new Error('usage: build-corpus.js --raw <dir> [--raw <dir>] --blobs <dir> --out <fixtures dir>');
    }
    return o;
}

/**
 * @param {string} s op or source name
 * @returns {string} file-system safe name
 */
const safeName = (s) => s.replace(/[^A-Za-z0-9._-]/g, '_');

/**
 * Main.
 */
async function main() {
    const opts = parseArgs(process.argv.slice(2));
    const files = [];
    const statsFiles = [];
    for (const dir of opts.raw) {
        for (const f of fs.readdirSync(dir)) {
            if (f.endsWith('.jsonl')) {
                files.push(path.join(dir, f));
            } else if (f.endsWith('.stats.json')) {
                statsFiles.push(path.join(dir, f));
            }
        }
    }
    const rank = (s) => {
        const i = SOURCE_ORDER.indexOf(s);
        return i < 0 ? SOURCE_ORDER.length : i;
    };
    files.sort((a, b) => rank(path.basename(a).split('-')[0]) - rank(path.basename(b).split('-')[0]) || a.localeCompare(b));

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
            const content = { op: rec.op, inputs: rec.inputs, outcome: rec.outcome, env: rec.env };
            const id = sha256(sortedStringify(content));
            const prev = seen.get(id);
            if (prev) {
                prev.occurrences++;
                // Which raw record "wins" (becomes the fixture's recorded
                // source_test) must not depend on the order the raw .jsonl
                // files were processed in: that order is only stable within
                // a source (SOURCE_ORDER, then filename), and raw filenames
                // embed the recording process's PID (accordproject/concerto-rust#113),
                // so a tie on source rank alone picked whichever process
                // happened to run first -- different on every recording. Once
                // source rank ties, break on source_test text, which is a
                // property of the test itself and so identical however the
                // recording was scheduled.
                const srcRank = rank(rec.source) - rank(prev.source);
                if (srcRank < 0 || (srcRank === 0 && rec.source_test < prev.source_test)) {
                    prev.source = rec.source;
                    prev.source_test = rec.source_test;
                }
                continue;
            }
            seen.set(id, {
                id,
                source: rec.source,
                source_test: rec.source_test,
                op: rec.op,
                inputs: rec.inputs,
                outcome: rec.outcome,
                env: rec.env,
                occurrences: 1,
            });
        }
    }

    for (const s of SOURCE_ORDER) {
        fs.rmSync(path.join(opts.out, s), { recursive: true, force: true });
    }
    const blobRe = /"@@oracle":"blob","sha256":"([0-9a-f]{64})"/g;
    const needed = new Set();
    const queue = [];
    const collect = (text) => {
        let m;
        blobRe.lastIndex = 0;
        while ((m = blobRe.exec(text)) !== null) {
            if (!needed.has(m[1])) {
                needed.add(m[1]);
                queue.push(m[1]);
            }
        }
    };
    const counts = {};
    for (const fx of seen.values()) {
        const dir = path.join(opts.out, safeName(fx.source), safeName(fx.op));
        fs.mkdirSync(dir, { recursive: true });
        const outFx = {
            id: fx.id.slice(0, 24),
            source: fx.source,
            source_test: fx.source_test,
            op: fx.op,
            inputs: fx.inputs,
            outcome: fx.outcome,
            env: fx.env,
            occurrences: fx.occurrences,
        };
        const fxText = JSON.stringify(outFx);
        collect(fxText);
        fs.writeFileSync(path.join(dir, outFx.id + '.json'), fxText + '\n');
        counts[fx.source] = counts[fx.source] || { total: 0, ops: {} };
        counts[fx.source].total++;
        counts[fx.source].ops[fx.op] = (counts[fx.source].ops[fx.op] || 0) + 1;
    }

    const blobOut = path.join(opts.out, 'blobs');
    fs.rmSync(blobOut, { recursive: true, force: true });
    while (queue.length > 0) {
        const h = queue.pop();
        const rel = path.join(h.slice(0, 2), h + '.json');
        const text = fs.readFileSync(path.join(opts.blobs, rel), 'utf8');
        collect(text);
        fs.mkdirSync(path.join(blobOut, h.slice(0, 2)), { recursive: true });
        fs.writeFileSync(path.join(blobOut, rel), text);
    }

    const skipped = {};
    const tainted = {};
    const recorded = {};
    const samples = {};
    for (const f of statsFiles) {
        const st = JSON.parse(fs.readFileSync(f, 'utf8'));
        const src = st.source;
        for (const [bucket, from] of [[skipped, st.skipped], [tainted, st.tainted]]) {
            bucket[src] = bucket[src] || {};
            for (const [op, reasons] of Object.entries(from || {})) {
                bucket[src][op] = bucket[src][op] || {};
                for (const [r, n] of Object.entries(reasons)) {
                    bucket[src][op][r] = (bucket[src][op][r] || 0) + n;
                }
            }
        }
        for (const [k, titles] of Object.entries(st.samples || {})) {
            const key = src + ' ' + k;
            samples[key] = samples[key] || [];
            for (const t of titles) {
                if (samples[key].length < 3 && !samples[key].includes(t)) {
                    samples[key].push(t);
                }
            }
        }
        recorded[src] = recorded[src] || {};
        for (const [op, n] of Object.entries(st.recorded || {})) {
            recorded[src][op] = (recorded[src][op] || 0) + n;
        }
    }
    const sumNested = (o) => Object.values(o || {}).reduce((a, reasons) => a + Object.values(reasons).reduce((x, y) => x + y, 0), 0);
    const manifest = {
        generated_at: new Date().toISOString(),
        raw_records: rawCount,
        fixtures: seen.size,
        blobs: needed.size,
        by_source: counts,
        recorded_calls: recorded,
        skipped_calls_total: Object.fromEntries(Object.entries(skipped).map(([s, o]) => [s, sumNested(o)])),
        skipped_calls: skipped,
        tainted_model_managers: tainted,
        skip_and_taint_samples: samples,
    };
    fs.writeFileSync(path.join(opts.out, 'manifest.json'), JSON.stringify(manifest, null, 1) + '\n');
    console.log(JSON.stringify({ raw_records: rawCount, fixtures: seen.size, blobs: needed.size, by_source: Object.fromEntries(Object.entries(counts).map(([s, c]) => [s, c.total])) }));
}

main().catch((e) => {
    console.error('ERROR build-corpus:', e.stack || e.message);
    process.exit(1);
});
