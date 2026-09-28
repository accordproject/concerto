#!/usr/bin/env node
// P5-15 (accordproject/concerto-rust#309): fold the sweep outputs into the
// ranked table for the issue report. Measure only.
//
//   node migration/bench/p515-report.mjs <out dir> [--json]
//
// <out dir> is what `p515-run.sh` wrote: ts-reference-5.0.0-<r>.json,
// rust-engine-<r>.json and crate-<r>/ (criterion estimates + n.json) from
// the timed phase, summary/ (native `sample` buckets, V8 stage split,
// crossing counts) from the profiles phase. Every timed figure is the
// median over the rounds of each round's median per item.

import fs from 'fs';
import path from 'path';

const [outDir, ...rest] = process.argv.slice(2);
if (!outDir) {
    console.error('usage: p515-report.mjs <out dir> [--json]');
    process.exit(2);
}
const asJson = rest.includes('--json');
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const exists = (f) => fs.existsSync(f);
const median = (xs) => {
    const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
    if (!s.length) {
        return NaN;
    }
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const rounds = [1, 2, 3].filter((r) => exists(path.join(outDir, `rust-engine-${r}.json`)));

/**
 * TS-API medians (us per item) over the rounds, keyed op/set.
 * @param {string} prefix - output file prefix
 * @returns {object} op/set -> { us, errors }
 */
function tsApi(prefix) {
    const by = {};
    for (const r of rounds) {
        const f = path.join(outDir, `${prefix}-${r}.json`);
        if (!exists(f)) {
            continue;
        }
        for (const x of readJson(f).results) {
            const k = `${x.op}/${x.set}`;
            (by[k] = by[k] || { us: [], errors: [] });
            if (x.error) {
                by[k].errors.push(x.error);
            } else {
                by[k].us.push(x.medianUs);
            }
        }
    }
    return by;
}
const tsRef = tsApi('ts-reference-5.0.0');
const rustApi = tsApi('rust-engine');

// Crate medians (us per item), keyed bench id (op/set).
const crate = {};
for (const r of rounds) {
    const dir = path.join(outDir, `crate-${r}`);
    if (!exists(path.join(dir, 'n.json'))) {
        continue;
    }
    const n = readJson(path.join(dir, 'n.json'));
    for (const [id, items] of Object.entries(n)) {
        const e = path.join(dir, id, 'estimates.json');
        if (!exists(e)) {
            continue;
        }
        const ns = readJson(e).median.point_estimate;
        (crate[id] = crate[id] || []).push(ns / items / 1000);
    }
}

const summary = path.join(outDir, 'summary');
const crossings = exists(path.join(summary, 'crossings.json')) ? readJson(path.join(summary, 'crossings.json')).results : [];
const crossingsOf = (op, set) => crossings.find((x) => x.op === op && x.set === set);
const stagesOf = (op, set) => {
    const f = path.join(summary, `cpuprof-${op}-${set}.json`);
    return exists(f) ? readJson(f) : null;
};
const nativeOf = (op, set) => {
    for (const s of [set, 'conformance']) {
        const f = path.join(summary, `native-${op}_${s}.json`);
        if (exists(f)) {
            return { set: s, ...readJson(f) };
        }
    }
    return null;
};

// The crate row an op compares against, and the per-call rebuild row the
// binding pays for where one exists.
const CRATE_OF = { add_cto_model: 'add_model_file' };
const REBUILD = { dcs_decorate: 1, dcs_validate: 1, extract_decorators: 1, extract_vocabularies: 1 };

const keys = [...new Set([...Object.keys(tsRef), ...Object.keys(rustApi)])];
const rows = keys.map((k) => {
    const [op, set] = k.split('/');
    const ref = median(tsRef[k]?.us || []);
    const api = median(rustApi[k]?.us || []);
    const cOp = CRATE_OF[op] || op;
    const c = median(crate[`${cOp}/${set}`] || []);
    const cr = REBUILD[op] ? median(crate[`${cOp}_rebuild/${set}`] || []) : NaN;
    const cx = crossingsOf(op, set);
    const st = stagesOf(op, set);
    const nat = nativeOf(cOp, set);
    const b = nat?.buckets || {};
    return {
        op, set, family: cx?.family,
        tsRefUs: ref, rustApiUs: api, crateUs: c, crateRebuildUs: cr,
        // > 1 means slower than TS 5.0.0.
        apiVsTs: api / ref, crateVsTs: c / ref, crateRebuildVsTs: cr / ref,
        crossingsPerItem: cx?.crossings, inEngineShare: cx ? cx.inEngineUs / cx.wallUs : NaN,
        topBindings: cx?.bindings?.slice(0, 3).map((x) => `${x.name} x${x.perItem.toFixed(1)}`) || [],
        stages: st?.stages || null,
        native: nat ? { set: nat.set, allocFree: b['alloc/free'], clone: b.clone, drop: b.drop, hash: b['hash/map'], serde: b.serde_json, fmt: b.fmt } : null,
        errors: [...(tsRef[k]?.errors || []), ...(rustApi[k]?.errors || [])],
    };
});
rows.sort((a, b) => (b.apiVsTs || 0) - (a.apiVsTs || 0));

if (asJson) {
    console.log(JSON.stringify({ rounds, rows }, null, 2));
    process.exit(0);
}
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const us = (x) => (Number.isFinite(x) ? (x >= 1000 ? `${(x / 1000).toFixed(2)} ms` : `${x.toFixed(x < 10 ? 2 : 1)} us`) : '-');
const pct = (x) => (Number.isFinite(x) ? `${Math.round(x)}%` : '-');
console.log(`Rounds: ${rounds.join(', ') || 'none'}. Ratios are Rust / TS 5.0.0 (> 1 = slower than TS).\n`);
console.log('| op | set | TS 5.0.0 | crate | x TS crate | TS API | x TS API | crossings/item | in-engine | TS-API stages | crate alloc+free / clone / hash |');
console.log('|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|');
for (const r of rows) {
    const stages = r.stages ? Object.entries(r.stages).slice(0, 3).map(([k, v]) => `${k} ${v}%`).join(', ') : '-';
    const nat = r.native ? `${pct(r.native.allocFree)} / ${pct(r.native.clone)} / ${pct(r.native.hash)}${r.native.set !== r.set ? ` (${r.native.set})` : ''}` : '-';
    const crateCell = Number.isFinite(r.crateRebuildUs) ? `${us(r.crateUs)} (rebuild ${us(r.crateRebuildUs)})` : us(r.crateUs);
    const crateX = Number.isFinite(r.crateRebuildVsTs) ? `${f(r.crateVsTs)} (${f(r.crateRebuildVsTs)})` : f(r.crateVsTs);
    console.log(`| ${r.op} | ${r.set} | ${us(r.tsRefUs)} | ${crateCell} | ${crateX} | ${us(r.rustApiUs)} | ${f(r.apiVsTs)} | ${f(r.crossingsPerItem, 1)} | ${pct(100 * r.inEngineShare)} | ${stages} | ${nat} |`);
}
const errs = rows.filter((r) => r.errors.length);
if (errs.length) {
    console.log('\nErrors:');
    for (const r of errs) {
        console.log(`- ${r.op}/${r.set}: ${[...new Set(r.errors)].join('; ')}`);
    }
}
