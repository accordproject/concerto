#!/usr/bin/env node
// P5-28 (N1, accordproject/concerto-rust#333): the before/after table of a
// p528-run.sh out dir. Measure only.
//
//   node migration/bench/p528-table.mjs <out dir> [--json]
//
// Each timed figure is the median over the rounds of each round's median
// per item. "x TS" is against the TS 5.0.0 reference timed in the same run.

import fs from 'fs';
import path from 'path';

const [dir, ...rest] = process.argv.slice(2);
if (!dir) {
    console.error('usage: p528-table.mjs <out dir> [--json]');
    process.exit(2);
}
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const rounds = (side) => fs.readdirSync(dir)
    .filter((f) => new RegExp(`^${side}-\\d+\\.json$`).test(f))
    .sort()
    .map(read);
const sides = { ts: rounds('ts-reference-5.0.0'), before: rounds('before'), now: rounds('now') };
const key = (r) => `${r.op}/${r.set}`;
const us = (side, k) => {
    const xs = sides[side].map((f) => f.results.find((r) => key(r) === k)).filter(Boolean).map((r) => r.median_ms * 1000);
    return xs.length ? { median: median(xs), rounds: xs } : null;
};
const crossings = (side) => {
    const file = path.join(dir, `${side}-crossings.json`);
    return fs.existsSync(file) ? new Map(read(`${side}-crossings.json`).results.map((r) => [key(r), r])) : new Map();
};
const cross = { before: crossings('before'), now: crossings('now') };
const rows = sides.now[0].results.map((r) => {
    const k = key(r);
    const ts = us('ts', k);
    const before = us('before', k);
    const now = us('now', k);
    const cb = cross.before.get(k);
    const cn = cross.now.get(k);
    return {
        op: r.op, set: r.set, n: r.n,
        tsUs: ts?.median, beforeUs: before?.median, nowUs: now?.median,
        xTsBefore: before && ts ? before.median / ts.median : null,
        xTsNow: now && ts ? now.median / ts.median : null,
        change: before && now ? now.median / before.median - 1 : null,
        crossingsBefore: cb?.crossings, crossingsNow: cn?.crossings,
        inEngineBefore: cb?.inEngineUs, inEngineNow: cn?.inEngineUs,
        rounds: { ts: ts?.rounds, before: before?.rounds, now: now?.rounds },
    };
});
if (rest.includes('--json')) {
    console.log(JSON.stringify({ rows }, null, 2));
    process.exit(0);
}
const t = (x) => x === undefined || x === null ? '-' : x >= 1000 ? `${(x / 1000).toFixed(2)} ms` : `${x.toPrecision(3)} us`;
const f = (x, d = 2) => x === undefined || x === null ? '-' : x.toFixed(d);
console.log('| op | set | TS 5.0.0 | before | now | x TS before -> now | change | crossings/item before -> now | in-engine us/item before -> now |');
console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|');
for (const r of rows) {
    const change = r.change === null ? '-' : `${r.change >= 0 ? '+' : ''}${(100 * r.change).toFixed(0)}%`;
    console.log(`| ${r.op} | ${r.set} | ${t(r.tsUs)} | ${t(r.beforeUs)} | ${t(r.nowUs)} | ${f(r.xTsBefore)} -> ${f(r.xTsNow)} | ${change} | ${f(r.crossingsBefore, 1)} -> ${f(r.crossingsNow, 1)} | ${f(r.inEngineBefore, 1)} -> ${f(r.inEngineNow, 1)} |`);
}
