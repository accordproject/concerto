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

const file = process.argv[2] || path.join(__dirname, '..', 'results', 'divergences.jsonl');

function outcomeKind(canon) {
    if (canon && typeof canon === 'object' && 'error' in canon) {
        return { verdict: 'error', cls: canon.error && canon.error.class || 'unknown' };
    }
    if (canon && typeof canon === 'object' && 'ok' in canon) {
        return { verdict: 'ok', cls: null };
    }
    return { verdict: 'other:' + JSON.stringify(canon).slice(0, 40), cls: null };
}

function template(msg) {
    if (typeof msg !== 'string') { return ''; }
    return msg
        .replace(/'[^']*'/g, "'…'")
        .replace(/"[^"]*"/g, '"…"')
        .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>')
        .replace(/\b\d+\b/g, '<n>')
        .slice(0, 160);
}

function main() {
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim());
    const clusters = new Map();
    for (const line of lines) {
        let d;
        try { d = JSON.parse(line); } catch (e) { continue; }
        const t = outcomeKind(d.ts);
        const r = outcomeKind(d.rust);
        const tMsg = d.ts && d.ts.error ? template(d.ts.error.message) : '';
        const rMsg = d.rust && d.rust.error ? template(d.rust.error.message) : '';
        const sig = [d.op, `ts=${t.verdict}${t.cls ? '(' + t.cls + ')' : ''}`, `rust=${r.verdict}${r.cls ? '(' + r.cls + ')' : ''}`, tMsg && `ts:"${tMsg}"`, rMsg && `rust:"${rMsg}"`].filter(Boolean).join(' | ');
        if (!clusters.has(sig)) {
            clusters.set(sig, { sig, op: d.op, count: 0, sample: d });
        }
        clusters.get(sig).count++;
    }
    const sorted = [...clusters.values()].sort((a, b) => b.count - a.count);
    console.log(JSON.stringify({ totalDivergences: lines.length, clusterCount: sorted.length, clusters: sorted }, null, 2));
}

main();
