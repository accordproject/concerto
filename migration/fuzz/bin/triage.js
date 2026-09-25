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
 * Cluster migration/fuzz/results/divergences.jsonl by signature (op, TS
 * outcome kind, Rust outcome kind, message template) and print a markdown
 * table with one minimised seed per cluster (task P5-05 stage 1, coordinator
 * comment on accordproject/concerto-rust#76).
 *
 * A "message template" is the outcome's message with quoted identifiers,
 * numbers and paths blanked out, so two cases that differ only in *which*
 * field/type/value is involved still cluster together.
 *
 * Usage: node migration/fuzz/bin/triage.js [divergences.jsonl]
 */

const fs = require('fs');
const path = require('path');
const { signatureOf } = require('../lib/signature');
const { expectedDivergence } = require('../lib/expected-divergences');

const file = process.argv[2] || path.join(__dirname, '..', 'results', 'divergences.jsonl');

function main() {
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim());
    const clusters = new Map();
    // A divergences.jsonl generated before lib/expected-divergences.js
    // existed (or by a version of bin/fuzz.js that predates it) can still
    // contain cases that are now maintainer-accepted (accordproject/
    // concerto-rust#156). Filter them out here too, so re-triaging a stale
    // file doesn't re-report them as unresolved.
    let expectedCount = 0;
    for (const line of lines) {
        let d;
        try { d = JSON.parse(line); } catch (e) { continue; }
        if (expectedDivergence(d)) { expectedCount++; continue; }
        const sig = signatureOf(d);
        if (!clusters.has(sig)) {
            clusters.set(sig, { sig, op: d.op, count: 0, sample: d });
        }
        clusters.get(sig).count++;
    }
    const sorted = [...clusters.values()].sort((a, b) => b.count - a.count);
    console.log(JSON.stringify({
        totalDivergences: lines.length,
        excludedAsExpected: expectedCount,
        clusterCount: sorted.length,
        clusters: sorted,
    }, null, 2));
}

main();
