#!/usr/bin/env node
// P5-75 (accordproject/concerto-rust#417): the tables for p575-run.sh's
// output. Each figure is the median over the rounds of each round's median
// (as p572-table.mjs), in microseconds per item, and "x TS" divides it by
// TS 5.0.0's figure from the same rounds.
//
//   node migration/bench/p575-table.mjs <out dir> [--json]

import fs from 'fs';
import path from 'path';

const dir = process.argv[2];
const asJson = process.argv.includes('--json');
const SIDES = ['ts', 'before', 'now'];
const OPS = ['get_namespaces_first', 'get_namespaces_after_change', 'get_namespaces', 'add_model_file', 'mm_new'];

const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// side -> "op|set" -> [round medians]
const data = {};
for (const side of SIDES) {
    data[side] = {};
    for (const f of fs.readdirSync(path.join(dir, side)).filter((x) => /^(sweep|change)-\d+\.json$/.test(x)).sort()) {
        for (const r of JSON.parse(fs.readFileSync(path.join(dir, side, f), 'utf8')).results) {
            if (r.medianUs === undefined) {
                continue;
            }
            const key = `${r.op}|${r.set}`;
            (data[side][key] = data[side][key] || []).push(r.medianUs);
        }
    }
}

const rows = [];
for (const op of OPS) {
    for (const key of Object.keys(data.ts).filter((k) => k.startsWith(`${op}|`)).sort()) {
        const set = key.split('|')[1];
        const [ts, before, now] = SIDES.map((s) => (data[s][key] ? median(data[s][key]) : null));
        rows.push({
            op, set, rounds: data.ts[key].length, tsUs: ts, beforeUs: before, nowUs: now,
            beforeXts: before === null ? null : before / ts, nowXts: now === null ? null : now / ts,
            nowXbefore: before === null || now === null ? null : now / before,
        });
    }
}

if (asJson) {
    console.log(JSON.stringify(rows, null, 2));
} else {
    const us = (x) => (x === null ? '-' : x >= 1000 ? `${(x / 1000).toFixed(2)} ms` : `${x.toFixed(2)} us`);
    const x = (v) => (v === null ? '-' : v.toFixed(2));
    console.log('| op | set | rounds | TS 5.0.0 | before | now | before x TS | **now x TS** | now / before |');
    console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|');
    for (const r of rows) {
        console.log(`| ${r.op} | ${r.op === 'mm_new' ? '(system models)' : r.set} | ${r.rounds} | ${us(r.tsUs)} | ${us(r.beforeUs)} | ${us(r.nowUs)} | ${x(r.beforeXts)} | **${x(r.nowXts)}** | ${x(r.nowXbefore)} |`);
    }
}
