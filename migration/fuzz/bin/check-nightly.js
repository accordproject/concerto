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
 * Nightly fuzz safety net (task P2, accordproject/concerto-rust#307): decide
 * pass/fail for one shard.
 *
 * bin/fuzz.js's own `divergences` count already excludes every
 * maintainer-accepted, permanent divergence in lib/expected-divergences.js
 * (the DV-* rows). That alone is not enough to gate a *nightly* job on,
 * though: this migration's differential fuzzing has also found a long tail
 * of divergences that are real engine gaps, each already tracked by its own
 * issue (see migration/fuzz/results/stage2/triage-clusters.json's `owners`),
 * but not yet fixed and not a "permanent, accepted" divergence in the DV-*
 * sense — fixing them is other tasks' work, not this job's. Gating on
 * `divergences > 0` directly would make the job fail every single night for
 * already-known reasons, which defeats its purpose as a *safety net* for
 * something NEW breaking between tasks.
 *
 * So this script clusters tonight's unresolved divergences by signature
 * (lib/signature.js, the same function bin/triage.js uses) and fails only on
 * a cluster signature that is not already in the committed baseline
 * (results/nightly-baseline/known-clusters.json): a divergence *shape*
 * nobody has seen and attributed yet. A new *case* of an already-known
 * cluster (same signature, different seed/mutation) is not new and does not
 * fail the job.
 *
 * Usage:
 *   node migration/fuzz/bin/check-nightly.js \
 *     --divergences results/nightly/divergences.jsonl \
 *     --baseline results/nightly-baseline/known-clusters.json \
 *     --out results/nightly/triage-clusters.json
 *
 * Exits 0 and prints a one-line summary when every tonight's cluster is
 * already known; exits 1 and lists the new cluster(s) otherwise.
 */

const fs = require('fs');
const path = require('path');
const { signatureOf } = require('../lib/signature');
const { expectedDivergence } = require('../lib/expected-divergences');

function parseArgs(argv) {
    const o = { divergences: null, baseline: null, out: null };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const next = () => argv[++i];
        if (a === '--divergences') { o.divergences = path.resolve(next()); }
        else if (a === '--baseline') { o.baseline = path.resolve(next()); }
        else if (a === '--out') { o.out = path.resolve(next()); }
        else { throw new Error('unknown argument ' + a); }
    }
    if (!o.divergences || !o.baseline || !o.out) {
        throw new Error('--divergences, --baseline and --out are all required');
    }
    return o;
}

function loadDivergences(file) {
    if (!fs.existsSync(file)) { return []; }
    return fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
}

function main() {
    const o = parseArgs(process.argv.slice(2));
    const baseline = JSON.parse(fs.readFileSync(o.baseline, 'utf8'));
    const known = new Set(baseline.signatures);

    // bin/fuzz.js already excluded expected-divergences.js matches from
    // divergences.jsonl; re-checking here is cheap insurance against a stale
    // file from an older harness version that did not.
    const divergences = loadDivergences(o.divergences).filter((d) => !expectedDivergence(d));

    const clusters = new Map();
    for (const d of divergences) {
        const sig = signatureOf(d);
        if (!clusters.has(sig)) {
            clusters.set(sig, { sig, op: d.op, count: 0, isNew: !known.has(sig), sample: d });
        }
        clusters.get(sig).count++;
    }
    const sorted = [...clusters.values()].sort((a, b) => b.count - a.count);
    const newClusters = sorted.filter((c) => c.isNew);

    const report = {
        _generatedBy: 'migration/fuzz/bin/check-nightly.js; do not edit by hand',
        baselineFile: path.relative(process.cwd(), o.baseline),
        baselineClusterCount: known.size,
        totalDivergences: divergences.length,
        clusterCount: sorted.length,
        newClusterCount: newClusters.length,
        clusters: sorted,
    };
    fs.mkdirSync(path.dirname(o.out), { recursive: true });
    fs.writeFileSync(o.out, JSON.stringify(report, null, 2));

    console.log(`${divergences.length} unresolved divergence(s) in ${sorted.length} cluster(s); `
        + `${sorted.length - newClusters.length} already known (baseline: ${known.size} cluster signature(s)), `
        + `${newClusters.length} new.`);
    if (newClusters.length > 0) {
        console.log('\nNew cluster(s):');
        for (const c of newClusters) {
            console.log(`  [${c.count}x] ${c.sig}`);
        }
        console.error(`\n${newClusters.length} new divergence cluster(s) not in the baseline — see ${o.out}`);
        process.exit(1);
    }
}

main();
