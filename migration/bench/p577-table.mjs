#!/usr/bin/env node
// P5-77 (accordproject/concerto-rust#419): the tables of p577-run.sh: for
// each op/set, TS 5.0.0 and the before and now sides through the TS API and
// at crate level (each the median over the rounds of each round's median,
// folded by p515-report.mjs), with x TS, now / before, the GC share of the
// V8 profile (the profiles phase, p515-cpuprof.mjs's `gc` stage) and the
// count run's crossings and in-engine time.
//
//   node migration/bench/p577-table.mjs <out dir> [--json]

import path from 'path';
import url from 'url';
import { execFileSync } from 'child_process';
import { requireRawInputs } from './lib/raw-inputs.mjs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const [outDir, ...rest] = process.argv.slice(2);
requireRawInputs(outDir);
if (!outDir) {
    console.error('usage: p577-table.mjs <out dir> [--json]');
    process.exit(2);
}
const report = (side) => JSON.parse(execFileSync(process.execPath, [path.join(__dirname, 'p515-report.mjs'), path.join(outDir, side), '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 }));
const key = (r) => `${r.op}/${r.set}`;
const by = (rep) => new Map(rep.rows.map((r) => [key(r), r]));
const NOW = by(report('now'));
const BEFORE = by(report('before'));

const OPS = ['extract_decorators', 'extract_vocabularies', 'extract_cold', 'extract_keep', 'dcs_decorate', 'dcs_validate'];
const TARGETS = new Set(['extract_decorators', 'extract_vocabularies', 'extract_cold', 'extract_keep']);
const SETS = ['concerto-core-test-data', 'conformance', 'synthetic-large'];
const SHORT = { 'concerto-core-test-data': 'core-test-data', conformance: 'conformance', 'synthetic-large': 'synthetic-large' };

const rows = [];
for (const op of OPS) {
    for (const set of SETS) {
        const n = NOW.get(`${op}/${set}`);
        const b = BEFORE.get(`${op}/${set}`);
        if (!n) {
            continue;
        }
        rows.push({
            op, set, target: TARGETS.has(op),
            tsRefUs: n.tsRefUs,
            beforeApiUs: b?.rustApiUs, nowApiUs: n.rustApiUs,
            beforeApiVsTs: b?.apiVsTs, nowApiVsTs: n.apiVsTs,
            nowOverBefore: b ? n.rustApiUs / b.rustApiUs : NaN,
            beforeGc: b?.stages ? (b.stages.gc ?? 0) : NaN, nowGc: n.stages ? (n.stages.gc ?? 0) : NaN,
            beforeStages: b?.stages || null, nowStages: n.stages || null,
            beforeCrateUs: b?.crateUs, nowCrateUs: n.crateUs,
            beforeCrateVsTs: b?.crateVsTs, nowCrateVsTs: n.crateVsTs,
            beforeCrateRebuildVsTs: b?.crateRebuildVsTs, nowCrateRebuildVsTs: n.crateRebuildVsTs,
            beforeCrossings: b?.crossingsPerItem, nowCrossings: n.crossingsPerItem,
            beforeInEngine: b?.inEngineShare, nowInEngine: n.inEngineShare,
        });
    }
}

if (rest.includes('--json')) {
    console.log(JSON.stringify(rows, null, 1));
    process.exit(0);
}

const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const us = (x) => (Number.isFinite(x) ? (x >= 1000 ? `${(x / 1000).toFixed(2)} ms` : `${x.toFixed(x < 10 ? 2 : 1)} us`) : '-');
const pct = (x) => (Number.isFinite(x) ? `${Math.round(x)}%` : '-');
const crate = (x, rb) => (Number.isFinite(rb) ? `${f(x)} (rebuild ${f(rb)})` : f(x));
const p = (s = '') => console.log(s);

const met = rows.filter((r) => r.target && r.nowApiVsTs <= 2).length;
const all = rows.filter((r) => r.target).length;
p(`Target (every extract* op at 2x TS or better through the TS API): ${met} of ${all} op/set rows meet it.`);
p();
p('| op | set | TS 5.0.0 | before | **now** | x TS before | **x TS now** | now / before | GC share before | **GC share now** |');
p('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const r of rows) {
    p(`| ${r.op} | ${SHORT[r.set]} | ${us(r.tsRefUs)} | ${us(r.beforeApiUs)} | **${us(r.nowApiUs)}** | ${f(r.beforeApiVsTs)} | **${f(r.nowApiVsTs)}** | ${f(r.nowOverBefore)} | ${pct(r.beforeGc)} | **${pct(r.nowGc)}** |`);
}
p();
p('Crate level (criterion, the same engine work natively), x TS 5.0.0; `rebuild` adds the per-call manager rebuild of the old per-call bindings. `extract_cold` and `extract_keep` have no crate row (TS-API scenarios).');
p();
p('| op | set | crate before | crate now | x TS crate before | x TS crate now |');
p('|---|---|---:|---:|---:|---:|');
for (const r of rows.filter((x) => Number.isFinite(x.nowCrateUs))) {
    p(`| ${r.op} | ${SHORT[r.set]} | ${us(r.beforeCrateUs)} | ${us(r.nowCrateUs)} | ${crate(r.beforeCrateVsTs, r.beforeCrateRebuildVsTs)} | ${crate(r.nowCrateVsTs, r.nowCrateRebuildVsTs)} |`);
}
p();
p('V8 stage split of the 6-second loop profiles (p515-cpuprof.mjs), and the count run (instrumented, so slower than the timed run).');
p();
p('| op | set | stages before | stages now | crossings/item before / now | in-engine before / now |');
p('|---|---|---|---|---:|---:|');
const st = (s) => (s ? Object.entries(s).slice(0, 4).map(([k, v]) => `${k} ${v}%`).join(', ') : '-');
for (const r of rows) {
    p(`| ${r.op} | ${SHORT[r.set]} | ${st(r.beforeStages)} | ${st(r.nowStages)} | ${f(r.beforeCrossings, 1)} / ${f(r.nowCrossings, 1)} | ${pct(100 * r.beforeInEngine)} / ${pct(100 * r.nowInEngine)} |`);
}
