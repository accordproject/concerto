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
 * Task P5-09 (accordproject/concerto-rust#253): re-classify the stage-2
 * residual divergences under the class-not-message parity rule
 * (lib/classify.js). Engines are not run: each cluster in
 * results/stage2/triage-clusters.json is judged by its recorded sample with
 * lib/classify.js's classifyCase(), and the cluster's whole count moves with
 * it. That is exact for the class and throw/no-throw parts of the rule (the
 * cluster signature, lib/signature.js, fixes both sides' outcome kind and
 * class); location and component are not in the signature, so a cluster is
 * taken as message-only when its sample is. The per-case raw divergences of
 * the stage-2 run were kept outside the repository and are not re-read.
 *
 * Usage: node migration/fuzz/bin/reclassify-class-not-message.js
 *          [--clusters results/stage2/triage-clusters.json]
 *          [--out results/stage2/reclassified-class-not-message.json]
 * Deterministic: re-running it over the same clusters reproduces the file.
 */

const fs = require('fs');
const path = require('path');
const { classifyCase } = require('../lib/classify');
const { expectedDivergence } = require('../lib/expected-divergences');

const FUZZ_DIR = path.resolve(__dirname, '..');

function parseArgs(argv) {
    const o = {
        clusters: path.join(FUZZ_DIR, 'results', 'stage2', 'triage-clusters.json'),
        out: path.join(FUZZ_DIR, 'results', 'stage2', 'reclassified-class-not-message.json'),
    };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--clusters') { o.clusters = path.resolve(argv[++i]); } else if (argv[i] === '--out') { o.out = path.resolve(argv[++i]); } else { throw new Error('unknown argument ' + argv[i]); }
    }
    return o;
}

function ownerKey(c) {
    const o = c.owner || {};
    return o.issue || (o.dv ? `DIVERGENCES.md ${o.dv}` : (o.theme || 'unowned'));
}

function main() {
    const o = parseArgs(process.argv.slice(2));
    const input = JSON.parse(fs.readFileSync(o.clusters, 'utf8'));
    const out = {
        _generatedBy: 'migration/fuzz/bin/reclassify-class-not-message.js (task P5-09) from ' + path.relative(FUZZ_DIR, o.clusters) + '; do not edit by hand',
        rule: 'maintainer decision 2026-09-27 (accordproject/concerto-rust#253): same throw/no-throw outcome and exception class; message text may differ',
        method: 'each cluster judged by its recorded sample with lib/classify.js classifyCase(); the cluster count moves with it (see the script header)',
        before: { clusters: 0, divergences: 0 },
        after: { clusters: 0, divergences: 0 },
        messageOnly: { clusters: 0, divergences: 0 },
        byOwner: {},
        byOp: {},
        messageOnlyClusters: [],
    };
    for (const c of input.clusters) {
        const s = c.sample;
        const cls = classifyCase({ op: s.op, seedFile: s.seedFile, mutationSeed: s.mutationSeed },
            { ok: true, canon: s.ts }, { ok: true, canon: s.rust }, expectedDivergence);
        const flips = cls.kind === 'agree' && cls.messageOnly === true;
        if (cls.kind !== 'divergence' && !flips) {
            throw new Error(`cluster ${c.sig}: sample classifies as ${cls.kind}, expected a divergence or a message-only agreement`);
        }
        out.before.clusters++;
        out.before.divergences += c.count;
        const owner = ownerKey(c);
        const ob = out.byOwner[owner] || (out.byOwner[owner] = { before: { clusters: 0, divergences: 0 }, after: { clusters: 0, divergences: 0 } });
        const pb = out.byOp[c.op] || (out.byOp[c.op] = { before: { clusters: 0, divergences: 0 }, after: { clusters: 0, divergences: 0 } });
        for (const b of [ob, pb]) { b.before.clusters++; b.before.divergences += c.count; }
        if (flips) {
            out.messageOnly.clusters++;
            out.messageOnly.divergences += c.count;
            out.messageOnlyClusters.push({ sig: c.sig, op: c.op, count: c.count, owner, ts: s.ts.error.message, rust: s.rust.error.message });
        } else {
            out.after.clusters++;
            out.after.divergences += c.count;
            for (const b of [ob, pb]) { b.after.clusters++; b.after.divergences += c.count; }
        }
    }
    out.messageOnlyClusters.sort((a, b) => b.count - a.count || (a.sig < b.sig ? -1 : a.sig > b.sig ? 1 : 0));
    fs.writeFileSync(o.out, JSON.stringify(out, null, 1) + '\n');
    console.log(`reclassify: ${out.before.divergences} divergences in ${out.before.clusters} clusters -> ${out.after.divergences} in ${out.after.clusters}; ` +
        `${out.messageOnly.divergences} in ${out.messageOnly.clusters} clusters were message-only and now agree`);
    for (const [k, v] of Object.entries(out.byOwner)) {
        console.log(`  ${k}: ${v.before.divergences} (${v.before.clusters} clusters) -> ${v.after.divergences} (${v.after.clusters} clusters)`);
    }
}

main();
