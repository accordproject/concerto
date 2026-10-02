#!/usr/bin/env node
// P5-81 (accordproject/concerto-rust#425): the tables of p581-run.sh. For
// each op/set: TS 5.0.0, the derived engine (`before`) and the table engine
// (`now`), through the TS API and at crate level. Each figure is the median
// over the three rounds of each round's median (p515-report.mjs's fold);
// table / derived is also given per round, so its spread shows the noise.
//
//   node migration/bench/p581-table.mjs <out dir> [--json]
import fs from 'fs';
import path from 'path';

const [outDir, ...rest] = process.argv.slice(2);
if (!outDir) {
    console.error('usage: p581-table.mjs <out dir> [--json]');
    process.exit(2);
}
const ROUNDS = [1, 2, 3];
const OPS = ['modelfile_new', 'add_model_file', 'add_cto_model', 'mm_new', 'dcs_decorate'];
const SETS = ['concerto-core-test-data', 'conformance', 'synthetic-large'];
const SHORT = { 'concerto-core-test-data': 'core-test-data', conformance: 'conformance', 'synthetic-large': 'synthetic-large' };
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const median = (xs) => {
    const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
    if (!s.length) return NaN;
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** { 'op/set': [us per round] } of a TS-API run file prefix. */
function api(side, prefix) {
    const by = {};
    for (const r of ROUNDS) {
        const f = path.join(outDir, side, `${prefix}-${r}.json`);
        if (!fs.existsSync(f)) continue;
        for (const x of readJson(f).results) {
            const k = `${x.op}/${x.set}`;
            (by[k] = by[k] || [])[r - 1] = x.error ? NaN : x.medianUs;
        }
    }
    return by;
}

/** { 'op/set': [us per item per round] } of the crate runs. */
function crate(side) {
    const by = {};
    for (const r of ROUNDS) {
        const dir = path.join(outDir, side, `crate-${r}`);
        if (!fs.existsSync(path.join(dir, 'n.json'))) continue;
        for (const [id, items] of Object.entries(readJson(path.join(dir, 'n.json')))) {
            const e = path.join(dir, id.replace(/\//g, '_'), 'estimates.json');
            if (!fs.existsSync(e)) continue;
            (by[id] = by[id] || [])[r - 1] = readJson(e).median.point_estimate / items / 1000;
        }
    }
    return by;
}

const ts = api('now', 'ts-reference-5.0.0');
const apiNow = api('now', 'rust-engine');
const apiBefore = api('before', 'rust-engine');
const crNow = crate('now');
const crBefore = crate('before');

const rows = [];
for (const op of OPS) {
    for (const set of SETS) {
        const k = `${op}/${set}`;
        if (!ts[k] && !crNow[k]) continue;
        const ratio = (a, b) => ROUNDS.map((r) => (a?.[r - 1] ?? NaN) / (b?.[r - 1] ?? NaN));
        rows.push({
            op, set,
            tsUs: median(ts[k] || []),
            derivedApiUs: median(apiBefore[k] || []), tableApiUs: median(apiNow[k] || []),
            apiRatioRounds: ratio(apiNow[k], apiBefore[k]),
            derivedCrateUs: median(crBefore[k] || []), tableCrateUs: median(crNow[k] || []),
            crateRatioRounds: ratio(crNow[k], crBefore[k]),
        });
    }
}
for (const r of rows) {
    r.derivedApiVsTs = r.derivedApiUs / r.tsUs;
    r.tableApiVsTs = r.tableApiUs / r.tsUs;
    r.apiRatio = r.tableApiUs / r.derivedApiUs;
    r.derivedCrateVsTs = r.derivedCrateUs / r.tsUs;
    r.tableCrateVsTs = r.tableCrateUs / r.tsUs;
    r.crateRatio = r.tableCrateUs / r.derivedCrateUs;
}
if (rest.includes('--json')) {
    console.log(JSON.stringify(rows, null, 1));
    process.exit(0);
}
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const us = (x) => (Number.isFinite(x) ? (x >= 1000 ? `${(x / 1000).toFixed(2)} ms` : `${x.toFixed(x < 10 ? 2 : 1)} us`) : '-');
const spread = (xs) => {
    const s = xs.filter(Number.isFinite);
    return s.length ? `${f(Math.min(...s))}-${f(Math.max(...s))}` : '-';
};
const p = (s = '') => console.log(s);
p('TS API (the TS views on the engine), median of the three rounds\' medians:');
p();
p('| op | set | TS 5.0.0 | derived | table | x TS derived | x TS table | table / derived | per-round range |');
p('|---|---|---:|---:|---:|---:|---:|---:|---|');
for (const r of rows) {
    p(`| ${r.op} | ${SHORT[r.set]} | ${us(r.tsUs)} | ${us(r.derivedApiUs)} | ${us(r.tableApiUs)} | ${f(r.derivedApiVsTs)} | ${f(r.tableApiVsTs)} | **${f(r.apiRatio)}** | ${spread(r.apiRatioRounds)} |`);
}
p();
p('Crate level (criterion, native), same rounds:');
p();
p('| op | set | derived | table | x TS derived | x TS table | table / derived | per-round range |');
p('|---|---|---:|---:|---:|---:|---:|---|');
for (const r of rows.filter((x) => Number.isFinite(x.tableCrateUs) || Number.isFinite(x.derivedCrateUs))) {
    p(`| ${r.op} | ${SHORT[r.set]} | ${us(r.derivedCrateUs)} | ${us(r.tableCrateUs)} | ${f(r.derivedCrateVsTs)} | ${f(r.tableCrateVsTs)} | **${f(r.crateRatio)}** | ${spread(r.crateRatioRounds)} |`);
}
