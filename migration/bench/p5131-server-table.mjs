#!/usr/bin/env node
// P5-131 (accordproject/concerto-rust#508): the tables of
// p5131-server-run.sh's results: p5121-server-table.mjs's table (p50, p95,
// req/s, x TS (a)) with the WASM memory at the end of each run, then
// P5-123's call-out: approach (b), `filter(() => true)`, at N = 1/16/64 on
// every set, next to P5-109's and P5-121's (b) (their raw runs in
// results/P5-109/server and results/P5-121/server), and the files the
// filter shares per set (p5131-filter-shared.cjs's JSON, when given).
// Measure only.
//
//   node migration/bench/p5131-server-table.mjs [OUT] [--shared-now FILE] [--shared-before FILE]
//
// OUT defaults to migration/bench/results/P5-131/server. Writes
// OUT/tables.md and OUT/tables.json, and prints the markdown.

import fs from 'fs';
import path from 'path';
import url from 'url';
import { requireRawInputs } from './lib/raw-inputs.mjs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : null;
};
const OUT = argv[0] && !argv[0].startsWith('--') ? argv[0] : path.join(__dirname, 'results', 'P5-131', 'server');
requireRawInputs(OUT, path.join(__dirname, 'results', 'P5-109', 'server', 'time'), path.join(__dirname, 'results', 'P5-121', 'server', 'time'),
    opt('--shared-now'), opt('--shared-before'));
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
const MB = 1048576;

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
const mb = (x) => (x === null ? '-' : (x / MB).toFixed(1));

/**
 * The medians over a run directory's rounds of one side, set and N.
 * @param {string} dir the `time` directory
 * @param {string} side the side prefix
 * @param {string} ap the approach
 * @param {string} set the set
 * @param {number} n the concurrency
 * @return {object} p50, p95, tput, wasmEnd and the rounds found
 */
function cell(dir, side, ap, set, n) {
    const runs = [1, 2, 3].map((r) => read(path.join(dir, `${side}-${ap}-${set}-n${n}-r${r}.json`))).filter(Boolean);
    return {
        p50: median(runs.map((x) => x.p50Ms)),
        p95: median(runs.map((x) => x.p95Ms)),
        tput: median(runs.map((x) => x.throughputPerS)),
        wasmEnd: median(runs.map((x) => x.end?.wasmBytes)),
        rounds: runs.length,
    };
}

const tables = { time: {}, filter: {}, shared: {} };
const lines = [];

for (const set of SETS) {
    lines.push(`#### ${set}`, '');
    lines.push('| N | side | p50 ms | p95 ms | req/s | p50 x TS (a) | req/s x TS (a) | WASM MB at end |');
    lines.push('|---:|---|---:|---:|---:|---:|---:|---:|');
    for (const n of NS) {
        const row = {};
        for (const [side, ap, label] of SIDES) {
            row[`${side}-${ap}`] = { label, ...cell(path.join(OUT, 'time'), side, ap, set, n) };
        }
        const base = row['ts5-a'];
        for (const [side, ap] of SIDES) {
            const x = row[`${side}-${ap}`];
            lines.push(`| ${n} | ${x.label} | ${ms(x.p50)} | ${ms(x.p95)} | ${x.tput === null ? '-' : x.tput.toFixed(0)} | ${ratio(x.p50, base.p50)} | ${ratio(x.tput, base.tput)} | ${side === 'ts5' ? '-' : mb(x.wasmEnd)} |`);
        }
        tables.time[`${set}/n${n}`] = row;
    }
    lines.push('');
}

// P5-123's call-out: (b) against P5-109's and P5-121's.
const P5109 = path.join(__dirname, 'results', 'P5-109', 'server', 'time');
const P5121 = path.join(__dirname, 'results', 'P5-121', 'server', 'time');
lines.push('#### Approach (b), `filter(() => true)`: p50 ms (x TS 5.0.0 (a) of the same run)', '');
lines.push('P5-109 and P5-121 are those tasks\' own runs (their now heads; each against its own TS 5.0.0 rounds); before and now are this run\'s. WASM MB is the engine\'s linear memory at the end of the N = 64 run.', '');
lines.push('| set | N | P5-109 now | P5-121 now | P5-131 before | **P5-131 now** | now / P5-109 | WASM MB end N = 64: P5-109 / P5-121 / before / **now** |');
lines.push('|---|---:|---:|---:|---:|---:|---:|---|');
for (const set of SETS) {
    for (const n of NS) {
        const at = (dir, side) => {
            const b = cell(dir, side, 'b-all', set, n);
            const t = cell(dir, 'ts5', 'a', set, n);
            return { ...b, vsTs: b.p50 !== null && t.p50 !== null ? b.p50 / t.p50 : null };
        };
        const r = { p5109: at(P5109, 'now'), p5121: at(P5121, 'now'), before: at(path.join(OUT, 'time'), 'before'), now: at(path.join(OUT, 'time'), 'now') };
        tables.filter[`${set}/n${n}`] = r;
        const c = (x, b = false) => (x.p50 === null ? '-' : `${b ? '**' : ''}${ms(x.p50)} (${x.vsTs.toFixed(2)})${b ? '**' : ''}`);
        const wasmCol = n === 64 ? `${mb(r.p5109.wasmEnd)} / ${mb(r.p5121.wasmEnd)} / ${mb(r.before.wasmEnd)} / **${mb(r.now.wasmEnd)}**` : '';
        lines.push(`| ${set} | ${n} | ${c(r.p5109)} | ${c(r.p5121)} | ${c(r.before)} | ${c(r.now, true)} | ${ratio(r.now.p50, r.p5109.p50)} | ${wasmCol} |`);
    }
}
lines.push('');

const sharedNow = opt('--shared-now') ? read(opt('--shared-now')) : null;
const sharedBefore = opt('--shared-before') ? read(opt('--shared-before')) : null;
if (sharedNow || sharedBefore) {
    lines.push('#### Files one `filter(() => true)` shares, per set', '');
    lines.push('shared = the unchanged file shared into the new manager; engine-staged = a filtered file the engine staged (P5-125); re-staged = returned as an AST and rebuilt through `new ModelFile`.', '');
    lines.push('| set | files | before: shared / engine-staged / re-staged | **now: shared / engine-staged / re-staged** |');
    lines.push('|---|---:|---|---|');
    for (const set of SETS) {
        const b = sharedBefore?.results.find((x) => x.set === set);
        const n = sharedNow?.results.find((x) => x.set === set);
        tables.shared[set] = { before: b, now: n };
        const t = (x, bold = false) => (x ? `${bold ? '**' : ''}${x.stage} / ${x.staged} / ${x.ast}${bold ? '**' : ''}` : '-');
        lines.push(`| ${set} | ${(n || b)?.files ?? '-'} | ${t(b)} | ${t(n, true)} |`);
    }
    lines.push('');
}

fs.writeFileSync(path.join(OUT, 'tables.md'), lines.join('\n'));
fs.writeFileSync(path.join(OUT, 'tables.json'), JSON.stringify(tables, null, 2) + '\n');
console.log(lines.join('\n'));
