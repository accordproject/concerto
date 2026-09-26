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
 * P5-05 stage 2 (accordproject/concerto-rust#76): aggregate the shards that
 * bin/run-shards.js ran into compact, committed outputs under
 * results/stage2/:
 *
 *   run-summary.json      per-shard and total counts (ran = agree +
 *                         divergences + expectedDivergences +
 *                         harnessErrorCases), overall and per op, from each
 *                         shard's run.json.
 *   divergence-summary.json
 *                         bin/summarize.js's counts over all shards' raw
 *                         divergences and expected divergences.
 *   triage-clusters.json  bin/triage.js's clustering (lib/signature.js) over
 *                         all shards' unresolved divergences, re-checked
 *                         against lib/expected-divergences.js; each cluster
 *                         keeps its first sample (with the shard/run-seed it
 *                         came from) and its per-shard counts. bin/minimize-
 *                         clusters.js and bin/attribute-owners.js then add
 *                         `minimized` and `owner` (run by the caller).
 *
 * The raw per-case outputs stay in --raw-dir (not committed): every
 * divergence is reproducible from {seedFile, mutationSeed} alone (README.md).
 *
 *   node migration/fuzz/bin/aggregate-shards.js --state results/stage2/state.json \
 *     --raw-dir <dir> --out-dir results/stage2
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { signatureOf } = require('../lib/signature');
const { expectedDivergence } = require('../lib/expected-divergences');

function parseArgs(argv) {
    const o = { state: null, rawDir: null, outDir: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--state') { o.state = path.resolve(argv[++i]); }
        else if (a === '--raw-dir') { o.rawDir = path.resolve(argv[++i]); }
        else if (a === '--out-dir') { o.outDir = path.resolve(argv[++i]); }
        else { throw new Error('unknown argument ' + a); }
    }
    if (!o.state || !o.rawDir || !o.outDir) { throw new Error('--state, --raw-dir and --out-dir are required'); }
    return o;
}

function readJsonl(file) {
    if (!fs.existsSync(file)) { return []; }
    return fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
}

const COUNT_KEYS = ['ran', 'agree', 'divergences', 'expectedDivergences', 'harnessErrorCases', 'harnessErrorsTs', 'harnessErrorsRust'];

function addCounts(into, from) {
    for (const k of COUNT_KEYS) { into[k] = (into[k] || 0) + (from[k] || 0); }
}

function main() {
    const o = parseArgs(process.argv.slice(2));
    const state = JSON.parse(fs.readFileSync(o.state, 'utf8'));
    const notDone = state.shards.filter((s) => s.status !== 'done');
    if (notDone.length) {
        throw new Error(`shards not done: ${notDone.map((s) => s.shard).join(', ')} — aggregate only a finished run`);
    }
    fs.mkdirSync(o.outDir, { recursive: true });

    const total = { byOp: {} };
    const shards = [];
    const clusters = new Map();
    let reExcluded = 0;
    // Concatenated raw files for bin/summarize.js, in a scratch dir.
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'p5-05-stage2-'));
    const divOut = fs.openSync(path.join(tmp, 'divergences.jsonl'), 'w');
    const expOut = fs.openSync(path.join(tmp, 'expected-divergences.jsonl'), 'w');

    for (const s of state.shards) {
        const dir = path.join(o.rawDir, `shard-${String(s.shard).padStart(2, '0')}`);
        const run = JSON.parse(fs.readFileSync(path.join(dir, 'run.json'), 'utf8'));
        if (run.runSeed !== s.runSeed || run.planned !== s.count || run.ran !== s.count) {
            throw new Error(`shard ${s.shard}: run.json does not match the state file (runSeed ${run.runSeed}, planned ${run.planned}, ran ${run.ran})`);
        }
        const entry = { shard: s.shard, runSeed: s.runSeed, started: run.started, finished: run.finished, byOp: run.byOp };
        for (const k of COUNT_KEYS) { entry[k] = run[k] || 0; }
        shards.push(entry);
        addCounts(total, run);
        for (const [op, c] of Object.entries(run.byOp)) {
            total.byOp[op] = total.byOp[op] || {};
            addCounts(total.byOp[op], c);
        }
        for (const d of readJsonl(path.join(dir, 'divergences.jsonl'))) {
            // Re-check against the current matcher (it is the same matcher
            // fuzz.js applied; this only matters if it has since widened).
            if (expectedDivergence(d)) { reExcluded++; continue; }
            fs.writeSync(divOut, JSON.stringify(d) + '\n');
            const sig = signatureOf(d);
            if (!clusters.has(sig)) {
                clusters.set(sig, { sig, op: d.op, count: 0, byShard: {}, sample: { ...d, shard: s.shard, runSeed: s.runSeed } });
            }
            const c = clusters.get(sig);
            c.count++;
            c.byShard[s.shard] = (c.byShard[s.shard] || 0) + 1;
        }
        for (const d of readJsonl(path.join(dir, 'expected-divergences.jsonl'))) {
            fs.writeSync(expOut, JSON.stringify(d) + '\n');
        }
    }
    fs.closeSync(divOut);
    fs.closeSync(expOut);

    const summary = {
        _generatedBy: 'migration/fuzz/bin/aggregate-shards.js from results/stage2/state.json and each shard\'s run.json; do not edit by hand',
        fixturesDir: state.fixturesDir,
        engineModule: state.engineModule,
        batchSize: state.batchSize,
        seedsPerOp: state.seedsPerOp,
        commits: fs.existsSync(path.join(o.outDir, 'commits.json')) ? JSON.parse(fs.readFileSync(path.join(o.outDir, 'commits.json'), 'utf8')) : null,
        total,
        shards,
    };
    fs.writeFileSync(path.join(o.outDir, 'run-summary.json'), JSON.stringify(summary, null, 2) + '\n');

    execFileSync(process.execPath, [path.join(__dirname, 'summarize.js'), '--results-dir', tmp], { stdio: 'inherit' });
    const ds = JSON.parse(fs.readFileSync(path.join(tmp, 'divergence-summary.json'), 'utf8'));
    ds._generatedBy = 'migration/fuzz/bin/summarize.js over all stage-2 shards\' raw divergences.jsonl and expected-divergences.jsonl (via bin/aggregate-shards.js); do not edit by hand';
    fs.writeFileSync(path.join(o.outDir, 'divergence-summary.json'), JSON.stringify(ds, null, 2) + '\n');
    fs.rmSync(tmp, { recursive: true, force: true });

    const sorted = [...clusters.values()].sort((a, b) => b.count - a.count || (a.sig < b.sig ? -1 : 1));
    fs.writeFileSync(path.join(o.outDir, 'triage-clusters.json'), JSON.stringify({
        totalDivergences: total.divergences,
        excludedAsExpected: reExcluded,
        clusterCount: sorted.length,
        clusters: sorted,
    }, null, 2));
    console.log(`aggregate-shards: ${shards.length} shards, ran=${total.ran} agree=${total.agree} divergences=${total.divergences} expected=${total.expectedDivergences} harnessErrorCases=${total.harnessErrorCases}; ${sorted.length} clusters (${reExcluded} re-excluded as expected)`);
}

main();
