#!/usr/bin/env node
// P5-48 (accordproject/concerto-rust#369): the before/after table of a
// p548-run.sh out dir (p528-table.mjs, plus the crate-direct columns).
// Measure only.
//
//   node migration/bench/p548-table.mjs <out dir> [--json]
//
// Each timed figure is the median over the rounds of each round's median
// per item. "x TS" is against the TS 5.0.0 reference timed in the same run.
// The crate columns are concerto-core's `load_profile` example (`time`),
// built from each side; addCTOModel has no crate row (its CTO parse is TS).

import fs from 'fs';
import path from 'path';
import { requireRawInputs } from './lib/raw-inputs.mjs';

const [dir, ...rest] = process.argv.slice(2);
requireRawInputs(dir);
if (!dir) {
    console.error('usage: p548-table.mjs <out dir> [--json]');
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
// crate-<side>-<round>.tsv: `op<TAB>set<TAB>us per model file` (`mm_new`'s
// set is `-`: the sweep runs it on conformance).
const crateRounds = (side) => fs.readdirSync(dir)
    .filter((f) => new RegExp(`^crate-${side}-\\d+\\.tsv$`).test(f))
    .sort()
    .map((f) => new Map(fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n')
        .map((l) => l.split('\t'))
        .filter((c) => c.length === 3)
        .map(([op, set, v]) => [`${op}/${set === '-' ? 'conformance' : set}`, Number(v)])));
const crate = { before: crateRounds('before'), now: crateRounds('now') };
const crateUs = (side, k) => {
    const xs = crate[side].map((m) => m.get(k)).filter((x) => x !== undefined);
    return xs.length ? median(xs) : null;
};
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
        crateBeforeUs: crateUs('before', k), crateNowUs: crateUs('now', k),
        crateXTsBefore: crateUs('before', k) !== null && ts ? crateUs('before', k) / ts.median : null,
        crateXTsNow: crateUs('now', k) !== null && ts ? crateUs('now', k) / ts.median : null,
        rounds: { ts: ts?.rounds, before: before?.rounds, now: now?.rounds },
    };
});
if (rest.includes('--json')) {
    console.log(JSON.stringify({ rows }, null, 2));
    process.exit(0);
}
const t = (x) => x === undefined || x === null ? '-' : x >= 1000 ? `${(x / 1000).toFixed(2)} ms` : `${x.toPrecision(3)} us`;
const f = (x, d = 2) => x === undefined || x === null ? '-' : x.toFixed(d);
console.log('| op | set | TS 5.0.0 | TS API before | TS API now | x TS before -> now | change | crossings/item before -> now | in-engine us/item before -> now | crate before -> now | crate x TS before -> now |');
console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const r of rows) {
    const change = r.change === null ? '-' : `${r.change >= 0 ? '+' : ''}${(100 * r.change).toFixed(0)}%`;
    console.log(`| ${r.op} | ${r.set} | ${t(r.tsUs)} | ${t(r.beforeUs)} | ${t(r.nowUs)} | ${f(r.xTsBefore)} -> ${f(r.xTsNow)} | ${change} | ${f(r.crossingsBefore, 1)} -> ${f(r.crossingsNow, 1)} | ${f(r.inEngineBefore, 1)} -> ${f(r.inEngineNow, 1)} | ${t(r.crateBeforeUs ?? undefined)} -> ${t(r.crateNowUs ?? undefined)} | ${f(r.crateXTsBefore)} -> ${f(r.crateXTsNow)} |`);
}
