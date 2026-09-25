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
 * Write results/divergence-summary.json from results/divergences.jsonl and
 * results/expected-divergences.jsonl (task P5-05): counts by (op, TS outcome
 * class, Rust outcome class). Deterministic — re-running it over the same
 * inputs reproduces the committed file byte for byte.
 *
 * Usage: node migration/fuzz/bin/summarize.js [--results-dir <dir>]
 */

const fs = require('fs');
const path = require('path');
const { outcomeKind } = require('../lib/signature');

function readJsonl(file) {
    if (!fs.existsSync(file)) { return []; }
    return fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
}

function side(canon) {
    const k = outcomeKind(canon);
    return k.verdict === 'error' ? k.cls : k.verdict;
}

function sortedCounts(map) {
    return Object.fromEntries([...map.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)));
}

function main() {
    const argv = process.argv.slice(2);
    const i = argv.indexOf('--results-dir');
    const dir = i >= 0 ? path.resolve(argv[i + 1]) : path.join(__dirname, '..', 'results');
    const unresolved = readJsonl(path.join(dir, 'divergences.jsonl'));
    const expected = readJsonl(path.join(dir, 'expected-divergences.jsonl'));

    const byPair = new Map();
    const byOp = new Map();
    for (const d of unresolved) {
        const key = `${d.op} | ts=${side(d.ts)} rust=${side(d.rust)}`;
        byPair.set(key, (byPair.get(key) || 0) + 1);
        byOp.set(d.op, (byOp.get(d.op) || 0) + 1);
    }
    const byDv = new Map();
    for (const d of expected) {
        const key = `${d.dv} (${d.issue}) | ${d.op} | ts=${side(d.ts)} rust=${side(d.rust)}`;
        byDv.set(key, (byDv.get(key) || 0) + 1);
    }
    const summary = {
        _generatedBy: 'migration/fuzz/bin/summarize.js from results/divergences.jsonl (unresolved) and results/expected-divergences.jsonl (maintainer-accepted, documented); do not edit by hand',
        total_divergences: unresolved.length,
        expected_divergences: expected.length,
        by_op: sortedCounts(byOp),
        by_class_pair: sortedCounts(byPair),
        expected_by_dv: sortedCounts(byDv),
    };
    fs.writeFileSync(path.join(dir, 'divergence-summary.json'), JSON.stringify(summary, null, 2) + '\n');
    console.log(`summarize: ${unresolved.length} unresolved, ${expected.length} expected divergence(s)`);
}

main();
