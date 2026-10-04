#!/usr/bin/env node
// P5-121 (accordproject/concerto-rust#497): the table of
// p5121-server-run.sh's results, in p5108-table.mjs's format (time only).
// Measure only.
//
//   node migration/bench/p5121-server-table.mjs [OUT]   (default migration/bench/results/P5-121/server)
//
// Writes OUT/tables.md and OUT/tables.json, and prints the markdown.

import fs from 'fs';
import path from 'path';

const OUT = process.argv[2] || 'migration/bench/results/P5-121/server';
const SETS = ['concerto-core-test-data', 'conformance', 'synthetic-large'];
const NS = [1, 16, 64];
const SIDES = [
    ['ts5', 'a', 'TS 5.0.0 (a)'],
    ['before', 'a', 'before (a) new ModelManager'],
    ['before', 'b-all', 'before (b) filter(() => true)'],
    ['before', 'c', 'before (c) fork'],
    ['now', 'a', 'now (a) new ModelManager'],
    ['now', 'b-all', 'now (b) filter(() => true)'],
    ['now', 'c', 'now (c) fork'],
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

const tables = { time: {} };
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

fs.writeFileSync(path.join(OUT, 'tables.md'), lines.join('\n'));
fs.writeFileSync(path.join(OUT, 'tables.json'), JSON.stringify(tables, null, 2) + '\n');
console.log(lines.join('\n'));
