#!/usr/bin/env node
// P5-100 (accordproject/concerto-rust#454): TS-API x TS 5.0.0 before and
// after, from bench results written by the P5-96 driver (p515-sweep.mjs):
// <dir>/{ts-reference,before,after}/time-<round>.json and
// <dir>/{before,after}/crossings.json. x TS = the side's median / TS
// 5.0.0's median in the same round; the table gives the median over rounds.
//
//   node migration/bench/p5100-table.mjs <dir> [--json]
import fs from 'node:fs';
import path from 'node:path';
import { requireRawInputs } from './lib/raw-inputs.mjs';

const dir = process.argv[2];
requireRawInputs(dir);
const asJson = process.argv.includes('--json');
const rounds = [1, 2, 3].filter((r) => fs.existsSync(path.join(dir, 'after', `time-${r}.json`)));
const read = (side, r) => {
    const p = path.join(dir, side, `time-${r}.json`);
    const m = new Map();
    if (!fs.existsSync(p)) {
        return m;
    }
    for (const row of JSON.parse(fs.readFileSync(p, 'utf8')).results) {
        if (typeof row.medianUs === 'number') {
            m.set(`${row.op}|${row.set}`, row.medianUs);
        }
    }
    return m;
};
const median = (xs) => {
    const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    if (s.length === 0) {
        return NaN;
    }
    return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const crossings = (side) => {
    const p = path.join(dir, side, 'crossings.json');
    const m = new Map();
    if (!fs.existsSync(p)) {
        return m;
    }
    for (const row of JSON.parse(fs.readFileSync(p, 'utf8')).results) {
        if (typeof row.crossings === 'number') {
            m.set(`${row.op}|${row.set}`, row.crossings);
        }
    }
    return m;
};
const data = Object.fromEntries(['ts-reference', 'before', 'after'].map((s) => [s, rounds.map((r) => read(s, r))]));
const cross = { before: crossings('before'), after: crossings('after') };
const keys = [...data['ts-reference'][0]?.keys() ?? []];
const rows = keys.map((k) => {
    const [op, set] = k.split('|');
    const ratio = (side) => median(rounds.map((_, i) => data[side][i].get(k) / data['ts-reference'][i].get(k)));
    return {
        op, set,
        tsUs: median(rounds.map((_, i) => data['ts-reference'][i].get(k))),
        beforeUs: median(rounds.map((_, i) => data.before[i].get(k))),
        afterUs: median(rounds.map((_, i) => data.after[i].get(k))),
        xBefore: ratio('before'),
        xAfter: ratio('after'),
        crossingsBefore: cross.before.get(k),
        crossingsAfter: cross.after.get(k),
    };
});
if (asJson) {
    console.log(JSON.stringify({ rounds, rows }, null, 2));
} else {
    const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
    const us = (x) => (!Number.isFinite(x) ? '-' : x >= 1000 ? `${(x / 1000).toFixed(2)} ms` : `${x.toFixed(2)} us`);
    console.log(`Rounds: ${rounds.join(', ')}. x TS = TS-API / TS 5.0.0 in the same round (> 1 = slower than TS), median over rounds.\n`);
    console.log('| op | set | TS 5.0.0 | x TS before | **x TS after** | before | after | crossings/item before | after |');
    console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|');
    for (const r of rows) {
        console.log(`| ${r.op} | ${r.set} | ${us(r.tsUs)} | ${f(r.xBefore)} | **${f(r.xAfter)}** | ${us(r.beforeUs)} | ${us(r.afterUs)} | ${f(r.crossingsBefore, 1)} | ${f(r.crossingsAfter, 1)} |`);
    }
}
