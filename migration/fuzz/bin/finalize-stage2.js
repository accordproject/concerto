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
 * P5-05 stage 2 (accordproject/concerto-rust#76): regenerate every committed
 * stage-2 file under results/stage2/ from a finished shard run:
 *
 *   1. bin/aggregate-shards.js   run-summary.json, divergence-summary.json,
 *                                triage-clusters.json (clusters + samples)
 *   2. bin/minimize-clusters.js  each cluster's `minimized` edit list
 *   3. bin/attribute-owners.js --stage2
 *                                each cluster's `owner` and `status`
 *                                (`pending-rerun`, `documented` — a
 *                                DIVERGENCES.md row covers it — or
 *                                `unresolved`)
 *   4. compaction, so the committed file stays small: owner and
 *      pending-rerun details are stored once at the top level (keyed by
 *      issue) and referenced from each cluster; `minimized.doc` is dropped
 *      (it is exactly `applyEdits(<fixture doc>, minimized.edits)`, README.md
 *      "Reproducing a minimized cluster"); a sample's `ok` outcome payload
 *      (a whole canonical ModelFile/resource) is replaced by its size —
 *      only its verdict is part of the signature.
 *
 *   FIXTURES_DIR=<corpus> CONCERTO_ENGINE_MODULE=<concerto-engine.cjs> \
 *     node migration/fuzz/bin/finalize-stage2.js --raw-dir <dir> \
 *       [--state results/stage2/state.json] [--out-dir results/stage2]
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function parseArgs(argv) {
    const o = {
        state: path.join(__dirname, '..', 'results', 'stage2', 'state.json'),
        outDir: path.join(__dirname, '..', 'results', 'stage2'),
        rawDir: null,
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--state') { o.state = path.resolve(argv[++i]); }
        else if (a === '--raw-dir') { o.rawDir = path.resolve(argv[++i]); }
        else if (a === '--out-dir') { o.outDir = path.resolve(argv[++i]); }
        else { throw new Error('unknown argument ' + a); }
    }
    if (!o.rawDir) { throw new Error('--raw-dir is required'); }
    if (!process.env.FIXTURES_DIR || !process.env.CONCERTO_ENGINE_MODULE) {
        throw new Error('FIXTURES_DIR and CONCERTO_ENGINE_MODULE are required (the minimise step replays each cluster)');
    }
    return o;
}

function stripOk(canon) {
    if (canon && typeof canon === 'object' && 'ok' in canon) {
        return { ok: `<omitted: ${JSON.stringify(canon.ok).length} bytes of canonical output>` };
    }
    return canon;
}

function compact(file) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const owners = {};
    const pendingRerun = {};
    const counts = { 'pending-rerun': 0, documented: 0, unresolved: 0 };
    const pendingCases = {};
    for (const c of data.clusters) {
        const key = (c.owner && (c.owner.issue || c.owner.theme)) || 'none';
        if (c.owner && !owners[key]) { owners[key] = c.owner; }
        c.owner = c.owner ? { issue: c.owner.issue || null, dv: c.owner.dv || null, theme: c.owner.theme } : null;
        if (c.pendingRerun) {
            pendingRerun[c.pendingRerun.issue] = c.pendingRerun;
            pendingCases[c.pendingRerun.issue] = (pendingCases[c.pendingRerun.issue] || 0) + c.count;
            c.pendingRerun = c.pendingRerun.issue;
        }
        counts[c.status] = (counts[c.status] || 0) + 1;
        if (c.minimized) { delete c.minimized.doc; }
        c.sample = { ...c.sample, ts: stripOk(c.sample.ts), rust: stripOk(c.sample.rust) };
    }
    const out = {
        _generatedBy: 'migration/fuzz/bin/finalize-stage2.js (aggregate-shards.js, minimize-clusters.js, attribute-owners.js --stage2, then compaction); do not edit by hand',
        totalDivergences: data.totalDivergences,
        excludedAsExpected: data.excludedAsExpected,
        clusterCount: data.clusterCount,
        clustersByStatus: counts,
        pendingRerun: Object.fromEntries(Object.entries(pendingRerun).map(([k, v]) => [k, { ...v, cases: pendingCases[k] }])),
        owners,
        clusters: data.clusters,
    };
    fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
    return out;
}

function main() {
    const o = parseArgs(process.argv.slice(2));
    const node = (script, args) => execFileSync(process.execPath, [path.join(__dirname, script), ...args], { stdio: 'inherit' });
    node('aggregate-shards.js', ['--state', o.state, '--raw-dir', o.rawDir, '--out-dir', o.outDir]);
    const clusters = path.join(o.outDir, 'triage-clusters.json');
    node('minimize-clusters.js', [clusters]);
    let ownersFailed = false;
    try {
        node('attribute-owners.js', ['--stage2', clusters]);
    } catch (e) {
        ownersFailed = true;
    }
    const out = compact(clusters);
    console.log(`finalize-stage2: ${out.clusterCount} clusters: ${JSON.stringify(out.clustersByStatus)}`);
    if (ownersFailed) {
        console.error('finalize-stage2: some clusters have no owner or issue (see attribute-owners output above)');
        process.exitCode = 1;
    }
}

main();
