#!/usr/bin/env node
// P5-97 (accordproject/concerto-rust#448): the tables of p597-run.sh's
// results. Measure only.
//
//   node migration/bench/p597-table.mjs [OUT]   (default migration/bench/results/P5-97)
//
// Writes OUT/tables.md and OUT/tables.json, and prints the markdown.

import fs from 'fs';
import path from 'path';

const OUT = process.argv[2] || 'migration/bench/results/P5-97';
const SETS = ['concerto-core-test-data', 'conformance', 'synthetic-large'];
const NS = [1, 16, 64];
const SIDES = [
    ['ts5', 'a', 'TS 5.0.0 (a)'],
    ['before', 'a', 'head (a) new + reload'],
    ['before', 'b', 'head (b) filter'],
    ['after', 'a', 'P5-97 (a) new + reload'],
    ['after', 'b', 'P5-97 (b) filter'],
    ['after', 'c', 'P5-97 (c) fork'],
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

const tables = { time: {}, memory: {}, gc: {}, soak: {} };
const lines = [];

// ---- time ------------------------------------------------------------------
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

// ---- memory ----------------------------------------------------------------
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

// ---- gc --------------------------------------------------------------------
lines.push('#### GC share of the V8 profile (TS-API loop, 6 s)', '');
lines.push('| op | set | head (before) | P5-97 (after) |');
lines.push('|---|---|---:|---:|');
for (const op of ['extract_cold', 'add_model_file']) {
    for (const set of SETS) {
        const share = (side) => {
            const g = read(path.join(OUT, 'gc', `${side}-${op}-${set}.json`));
            return g ? (g.stages.gc ?? 0) : null;
        };
        const before = share('before');
        const after = share('after');
        tables.gc[`${op}/${set}`] = { before, after };
        lines.push(`| ${op} | ${set} | ${before === null ? '-' : before + '%'} | ${after === null ? '-' : after + '%'} |`);
    }
}
lines.push('');

// ---- soak ------------------------------------------------------------------
lines.push('#### Soak: fork per request at N=64', '');
lines.push('| set | seconds | requests | WASM MB at 10% / 50% / end | RSS MB at 10% / 50% / end | RSS slope after warm-up (MB/min) | WASM growth after warm-up, 1st / 2nd half (MB) | unfinalized managers median / max | verdict |');
lines.push('|---|---:|---:|---|---|---:|---|---|---|');
for (const set of ['conformance', 'synthetic-large']) {
    const s = read(path.join(OUT, 'soak', `after-c-${set}-n64.json`));
    if (!s) {
        continue;
    }
    const tl = s.timeline;
    const at = (f) => tl[Math.min(tl.length - 1, Math.floor((tl.length - 1) * f))];
    const mb = (x) => (x / 1048576).toFixed(1);
    // Warm-up: the first 20% of the run. A linear fit of RSS over the rest,
    // and whether WASM memory grew at all after it.
    const warm = tl.filter((p) => p.t >= tl[tl.length - 1].t * 0.2);
    const n = warm.length;
    const mt = warm.reduce((a, p) => a + p.t, 0) / n;
    const mr = warm.reduce((a, p) => a + p.rss, 0) / n;
    const slope = warm.reduce((a, p) => a + (p.t - mt) * (p.rss - mr), 0) / warm.reduce((a, p) => a + (p.t - mt) ** 2, 0);
    const slopeMbPerMin = (slope * 60) / 1048576;
    const wasmGrows = warm[warm.length - 1].wasmBytes > warm[0].wasmBytes;
    // Second half against first half of the post-warm-up window.
    const half = Math.floor(n / 2);
    const maxRss = (xs) => Math.max(...xs.map((p) => p.rss));
    const rssHalves = [maxRss(warm.slice(0, half)), maxRss(warm.slice(half))];
    const plateau = !wasmGrows && rssHalves[1] <= rssHalves[0] * 1.05;
    const wasmHalves = [
        warm[half].wasmBytes - warm[0].wasmBytes,
        warm[n - 1].wasmBytes - warm[half].wasmBytes,
    ];
    const unfinalized = tl.map((p) => p.unfinalized).filter((x) => typeof x === 'number').sort((a, b) => a - b);
    const unfin = unfinalized.length ? `${unfinalized[Math.floor(unfinalized.length / 2)]} / ${unfinalized[unfinalized.length - 1]}` : '-';
    tables.soak[set] = {
        seconds: s.seconds, requests: s.requests, slopeMbPerMin, wasmGrows, rssHalves, wasmHalves, unfinalized: unfin,
        wasm: [at(0.1).wasmBytes, at(0.5).wasmBytes, at(1).wasmBytes], rss: [at(0.1).rss, at(0.5).rss, at(1).rss],
        plateau,
    };
    lines.push(`| ${set} | ${s.seconds} | ${s.requests} | ${mb(at(0.1).wasmBytes)} / ${mb(at(0.5).wasmBytes)} / ${mb(at(1).wasmBytes)} | ${mb(at(0.1).rss)} / ${mb(at(0.5).rss)} / ${mb(at(1).rss)} | ${slopeMbPerMin.toFixed(2)} | ${mb(wasmHalves[0])} / ${mb(wasmHalves[1])} | ${unfin} | ${plateau ? 'plateau (pass)' : 'growth (fail)'} |`);
}
lines.push('');

const md = lines.join('\n');
fs.writeFileSync(path.join(OUT, 'tables.md'), md);
fs.writeFileSync(path.join(OUT, 'tables.json'), JSON.stringify(tables, null, 2));
process.stdout.write(md + '\n');
