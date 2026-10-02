#!/usr/bin/env node
// P5-88 (accordproject/concerto-rust#434): the tables of p588-run.sh: for
// each instance op/set, TS 5.0.0 and the before (no plan) and now (the
// plan, always on) sides through the TS API and at crate level, each the
// median over the rounds of each round's median (folded by
// p515-report.mjs), with now / before set against the P5-80 spike's plan
// on / off (accordproject/concerto-rust#424, report 2026-10-02 10:27Z).
//
//   node migration/bench/p588-table.mjs <out dir> [--json]

import path from 'path';
import url from 'url';
import { execFileSync } from 'child_process';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const [outDir, ...rest] = process.argv.slice(2);
if (!outDir) {
    console.error('usage: p588-table.mjs <out dir> [--json]');
    process.exit(2);
}
const report = (side) => JSON.parse(execFileSync(process.execPath, [path.join(__dirname, 'p515-report.mjs'), path.join(outDir, side), '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 }));
const key = (r) => `${r.op}/${r.set}`;
const by = (rep) => new Map(rep.rows.map((r) => [key(r), r]));
const NOW = by(report('now'));
const BEFORE = by(report('before'));

const OPS = ['from_json', 'to_json', 'validate', 'new_resource', 'set_property_value', 'add_array_value'];
const SETS = ['concerto-core-test-data', 'conformance', 'synthetic-large'];
const SHORT = { 'concerto-core-test-data': 'core-test-data', conformance: 'conformance', 'synthetic-large': 'synthetic-large' };

// The P5-80 spike's plan on / off, in percent (crate, TS API), from its
// item 5 table.
const SPIKE = {
    'from_json/concerto-core-test-data': [-21.7, -11.2],
    'from_json/conformance': [-3.7, -4.5],
    'from_json/synthetic-large': [-22.4, -4.6],
    'to_json/concerto-core-test-data': [-10.7, -3.8],
    'to_json/conformance': [-8.4, -6.1],
    'to_json/synthetic-large': [-10.3, -18.7],
    'validate/concerto-core-test-data': [-17.3, -35.0],
    'validate/conformance': [-24.6, 1.5],
    'validate/synthetic-large': [-9.6, -29.1],
    'new_resource/concerto-core-test-data': [NaN, -43.8],
    'new_resource/conformance': [-7.1, -27.5],
    'new_resource/synthetic-large': [-7.7, -0.6],
    'set_property_value/concerto-core-test-data': [-14.9, -22.3],
    'set_property_value/conformance': [-23.4, 16.2],
    'set_property_value/synthetic-large': [-12.0, -9.0],
    'add_array_value/concerto-core-test-data': [-9.4, -4.9],
    'add_array_value/conformance': [6.0, -3.0],
    'add_array_value/synthetic-large': [4.5, -11.5],
};

const rows = [];
for (const op of OPS) {
    for (const set of SETS) {
        const n = NOW.get(`${op}/${set}`);
        const b = BEFORE.get(`${op}/${set}`);
        if (!n) {
            continue;
        }
        const [spikeCrate, spikeApi] = SPIKE[`${op}/${set}`] ?? [NaN, NaN];
        rows.push({
            op, set,
            tsRefUs: n.tsRefUs,
            beforeApiUs: b?.rustApiUs, nowApiUs: n.rustApiUs,
            apiChangePct: b ? 100 * (n.rustApiUs / b.rustApiUs - 1) : NaN,
            spikeApiPct: spikeApi,
            beforeCrateUs: b?.crateUs, nowCrateUs: n.crateUs,
            crateChangePct: b ? 100 * (n.crateUs / b.crateUs - 1) : NaN,
            spikeCratePct: spikeCrate,
            beforeApiVsTs: b?.apiVsTs, nowApiVsTs: n.apiVsTs,
        });
    }
}

if (rest.includes('--json')) {
    console.log(JSON.stringify(rows, null, 1));
    process.exit(0);
}

const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const us = (x) => (Number.isFinite(x) ? (x >= 1000 ? `${(x / 1000).toFixed(2)} ms` : `${x.toFixed(x < 10 ? 2 : 1)} us`) : '-');
const pc = (x) => (Number.isFinite(x) ? `${x > 0 ? '+' : ''}${x.toFixed(1)}%` : '-');
const p = (s = '') => console.log(s);

p('| op | set | TS 5.0.0 | crate before | crate now | crate now/before | spike crate on/off | TS-API before | TS-API now | TS-API now/before | spike TS-API on/off |');
p('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const r of rows) {
    p(`| ${r.op} | ${SHORT[r.set]} | ${us(r.tsRefUs)} | ${us(r.beforeCrateUs)} | ${us(r.nowCrateUs)} | ${pc(r.crateChangePct)} | ${pc(r.spikeCratePct)} | ${us(r.beforeApiUs)} | ${us(r.nowApiUs)} | ${pc(r.apiChangePct)} | ${pc(r.spikeApiPct)} |`);
}
p();
p('x TS 5.0.0 through the TS API (lower is better; 1.00 is parity).');
p();
p('| op | set | before | now |');
p('|---|---|---:|---:|');
for (const r of rows) {
    p(`| ${r.op} | ${SHORT[r.set]} | ${f(r.beforeApiVsTs)} | ${f(r.nowApiVsTs)} |`);
}
