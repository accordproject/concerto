#!/usr/bin/env node
// P5-108 (accordproject/concerto-rust#466): the tables of p5108-run.sh's
// results, in p597-table.mjs's format. Measure only.
//
//   node migration/bench/p5108-table.mjs [OUT]   (default migration/bench/results/P5-108)
//
// Writes OUT/tables.md and OUT/tables.json, and prints the markdown.

import fs from 'fs';
import path from 'path';
import { requireRawInputs } from './lib/raw-inputs.mjs';

const OUT = process.argv[2] || 'migration/bench/results/P5-108';
requireRawInputs(OUT);
const SETS = ['concerto-core-test-data', 'conformance', 'synthetic-large'];
const NS = [1, 16, 64];
const SIDES = [
    ['ts5', 'a', 'TS 5.0.0 (a)'],
    ['after', 'b', 'P5-108 (b) filter(keepUserModels)'],
    ['after', 'b-all', 'P5-108 (b) filter(() => true)'],
    ['after', 'c', 'P5-108 (c) fork'],
];

const read = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
const median = (xs) => {
    const v = xs.filter((x) => typeof x === 'number').sort((a, b) => a - b);
    if (v.length === 0) {
        return null;
    }
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const ms = (x) => (x === null ? '-' : x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2));
const ratio = (x, base) => (x === null || base === null ? '-' : (x / base).toFixed(2));
const kb = (x) => (x === null || x === undefined ? '-' : (x / 1024).toFixed(1));

const tables = { time: {}, memory: {} };
const lines = [];

for (const set of SETS) {
    lines.push(`#### ${set}`, '');
    lines.push('| N | side | p50 ms | p95 ms | req/s | p50 x TS (a) | req/s x TS (a) |');
    lines.push('|---:|---|---:|---:|---:|---:|---:|');
    for (const n of NS) {
        const row = {};
        for (const [side, ap, label] of SIDES) {
            const runs = [1, 2, 3].map((r) => read(path.join(OUT, 'time', `${side}-${ap}-${set}-n${n}-r${r}.json`))).filter(Boolean);
            row[`${side}-${ap}`] = {
                label,
                p50: median(runs.map((x) => x.p50Ms)),
                p95: median(runs.map((x) => x.p95Ms)),
                tput: median(runs.map((x) => x.throughputPerS)),
                rounds: runs.length,
            };
        }
        const base = row['ts5-a'];
        for (const [side, ap] of SIDES) {
            const x = row[`${side}-${ap}`];
            lines.push(`| ${n} | ${x.label} | ${ms(x.p50)} | ${ms(x.p95)} | ${x.tput === null ? '-' : x.tput.toFixed(0)} | ${ratio(x.p50, base.p50)} | ${ratio(x.tput, base.tput)} |`);
        }
        tables.time[`${set}/n${n}`] = row;
    }
    lines.push('');
}

lines.push('#### Memory per held manager (100 held, after a GC)', '');
lines.push('| set | side | WASM KB | RSS KB | JS heap KB |');
lines.push('|---|---|---:|---:|---:|');
for (const set of SETS) {
    for (const [side, ap, label] of SIDES) {
        const m = read(path.join(OUT, 'memory', `${side}-${ap}-${set}.json`));
        if (!m) {
            continue;
        }
        tables.memory[`${set}/${side}-${ap}`] = m;
        lines.push(`| ${set} | ${label} | ${m.wasmBytesPerManager === null || Number.isNaN(m.wasmBytesPerManager) ? '-' : kb(m.wasmBytesPerManager)} | ${kb(m.rssBytesPerManager)} | ${kb(m.heapBytesPerManager)} |`);
    }
}
lines.push('');

fs.writeFileSync(path.join(OUT, 'tables.md'), lines.join('\n'));
fs.writeFileSync(path.join(OUT, 'tables.json'), JSON.stringify(tables, null, 2) + '\n');
console.log(lines.join('\n'));
