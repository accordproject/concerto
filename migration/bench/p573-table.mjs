// P5-73 (accordproject/concerto-rust#414): the table of p573-run.sh's
// timed rounds: for each op/set, TS 5.0.0 and the before, now and
// now-mmvoff sides through the TS API, each the median over the rounds of
// each round's median, with × TS and now / before; plus the count run's
// crossings and in-engine time per side.
//
//   node migration/bench/p573-table.mjs <out dir> [--json]
import fs from 'fs';
import path from 'path';
import { requireRawInputs } from './lib/raw-inputs.mjs';

const dir = path.resolve(process.argv[2]);
requireRawInputs(dir);
const json = process.argv.includes('--json');
const SIDES = ['before', 'now', 'now-mmvoff'];
const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const rounds = (side, prefix) => fs.readdirSync(path.join(dir, side))
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, side, f), 'utf8')));
const byKey = (runs) => {
    const out = new Map();
    for (const run of runs) {
        for (const r of run.results) {
            const key = `${r.op}|${r.set}`;
            if (!out.has(key)) {
                out.set(key, []);
            }
            out.get(key).push(r.medianUs);
        }
    }
    return out;
};
const ts = byKey(rounds('now', 'ts-reference-5.0.0-'));
const sides = Object.fromEntries(SIDES.map((s) => [s, byKey(rounds(s, 'rust-engine-'))]));
const counts = Object.fromEntries(SIDES.map((s) => [s, JSON.parse(fs.readFileSync(path.join(dir, s, 'crossings.json'), 'utf8'))]));
const rows = [];
for (const [key, tsUs] of ts) {
    const [op, set] = key.split('|');
    const row = { op, set, tsUs: median(tsUs), tsRounds: tsUs };
    for (const s of SIDES) {
        const us = sides[s].get(key);
        row[s] = us ? { us: median(us), rounds: us, xTs: median(us) / row.tsUs } : null;
        const c = counts[s].results.find((r) => r.op === op && r.set === set);
        if (c && row[s]) {
            row[s].crossings = c.crossings;
            row[s].inEngineUs = c.inEngineUs;
            row[s].bindings = c.bindings.slice(0, 4).map((b) => `${b.name} x${b.perItem}`);
        }
    }
    row.nowOverBefore = row.now && row.before ? row.now.us / row.before.us : null;
    rows.push(row);
}
if (json) {
    console.log(JSON.stringify(rows, null, 1));
    process.exit(0);
}
const us = (x) => (x >= 1000 ? `${(x / 1000).toFixed(2)} ms` : `${x.toFixed(1)} us`);
const f = (x) => (x === null || x === undefined ? '-' : x.toFixed(2));
console.log('| op | set | TS 5.0.0 | before | now | now (mmv off) | x TS before | x TS now | x TS now (off) | now / before |');
console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const r of rows) {
    console.log(`| ${r.op} | ${r.op === 'mm_new' ? '(system models)' : r.set} | ${us(r.tsUs)} | ${us(r.before.us)} | **${us(r.now.us)}** | ${us(r['now-mmvoff'].us)} | ${f(r.before.xTs)} | **${f(r.now.xTs)}** | ${f(r['now-mmvoff'].xTs)} | ${f(r.nowOverBefore)} |`);
}
console.log('');
console.log('Count run (instrumented, so slower than the timed run): crossings and in-engine time per item.');
console.log('');
console.log('| op | set | before: crossings / in-engine | now: crossings / in-engine | now top bindings |');
console.log('|---|---|---:|---:|---|');
for (const r of rows) {
    console.log(`| ${r.op} | ${r.op === 'mm_new' ? '(system models)' : r.set} | ${f(r.before.crossings)} / ${us(r.before.inEngineUs)} | ${f(r.now.crossings)} / ${us(r.now.inEngineUs)} | ${r.now.bindings.join(', ')} |`);
}
