#!/usr/bin/env node
// P5-60 (accordproject/concerto-rust#392): the tables of the consolidated
// re-measure, from what `p560-run.sh` wrote. Measure only.
//
//   node migration/bench/p560-table.mjs <out dir> [--json]
//
// Reads <out dir>/{now,before,now-mmvoff} through `p515-report.mjs --json`
// (every timed figure is the median over the rounds of each round's median
// per item; x TS is against the TS 5.0.0 rounds of the same run) and prints:
//   1. x TS per op at crate and TS-API level, before (pre-F1) and now,
//      grouped by the migration page's five categories;
//   2. the ranked remaining-gap list (now slower than TS through the TS
//      API), with the dominant cost split into engine work and
//      boundary/TS-layer cost;
//   3. BC-19's load-time cost: default on against metamodelValidation:false.

import fs from 'fs';
import path from 'path';
import url from 'url';
import { execFileSync } from 'child_process';
import { requireRawInputs } from './lib/raw-inputs.mjs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const [outDir, ...rest] = process.argv.slice(2);
requireRawInputs(outDir);
const report = (side) => JSON.parse(execFileSync(process.execPath, [path.join(__dirname, 'p515-report.mjs'), path.join(outDir, side), '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 }));
const now = report('now');
const before = report('before');
const off = fs.existsSync(path.join(outDir, 'now-mmvoff')) ? report('now-mmvoff') : { rows: [] };
const key = (r) => `${r.op}/${r.set}`;
const by = (rep) => new Map(rep.rows.map((r) => [key(r), r]));
const B = by(before);
const OFF = by(off);
const readCross = (side) => {
    const f = path.join(outDir, side, 'summary', 'crossings.json');
    return fs.existsSync(f) ? new Map(JSON.parse(fs.readFileSync(f, 'utf8')).results.map((r) => [key(r), r])) : new Map();
};
const XNOW = readCross('now');
const XOFF = readCross('now-mmvoff');

const CATEGORIES = [
    ['Model loading', ['mm_new', 'modelfile_new', 'add_model_file', 'add_cto_model']],
    ['Introspection (including decorators/DCS)', ['get_type', 'get_type_first', 'resolve_type', 'resolve_type_first', 'get_namespaces', 'get_namespaces_first', 'derives_from', 'is_assignable_to', 'get_decorators', 'dcs_decorate', 'dcs_validate', 'extract_decorators', 'extract_vocabularies', 'extract_cold', 'extract_keep']],
    ['Serialisation', ['from_json', 'to_json']],
    ['Instance creation', ['new_resource']],
    ['Validation', ['validate', 'set_property_value', 'add_array_value']],
];
const SETS = ['concerto-core-test-data', 'conformance', 'synthetic-large'];
const SHORT = { 'concerto-core-test-data': 'core-test-data', conformance: 'conformance', 'synthetic-large': 'synthetic-large' };
const categoryOf = (op) => CATEGORIES.find(([, ops]) => ops.includes(op))?.[0] || 'other';

const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const us = (x) => (Number.isFinite(x) ? (x >= 1000 ? `${(x / 1000).toFixed(2)} ms` : `${x.toFixed(x < 10 ? 2 : 1)} us`) : '-');
const pct = (x) => (Number.isFinite(x) ? `${Math.round(100 * x)}%` : '-');
const bold = (x) => (Number.isFinite(x) ? `**${f(x)}**` : '-');

const rowsOut = [];
const lines = [];
const p = (s = '') => lines.push(s);

p(`Rounds: now ${now.rounds.join(', ')}, before ${before.rounds.join(', ')}. x TS = Rust / TS 5.0.0 in the same run (> 1 = slower than TS).`);
for (const [cat, ops] of CATEGORIES) {
    p(`\n### ${cat}\n`);
    p('| op | set | TS 5.0.0 | x TS crate: pre-F1 | **now** | x TS API: pre-F1 | **now** | TS API now | crossings/item | in-engine |');
    p('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const op of ops) {
        for (const set of SETS) {
            const n = now.rows.find((r) => r.op === op && r.set === set);
            if (!n) {
                continue;
            }
            const b = B.get(key(n));
            const crateNow = Number.isFinite(n.crateRebuildVsTs) ? `${bold(n.crateVsTs)} (rebuild ${f(n.crateRebuildVsTs)})` : bold(n.crateVsTs);
            const crateBefore = b && Number.isFinite(b.crateRebuildVsTs) ? `${f(b.crateVsTs)} (rebuild ${f(b.crateRebuildVsTs)})` : f(b?.crateVsTs);
            p(`| ${op} | ${op === 'mm_new' ? '(system models)' : SHORT[set]} | ${us(n.tsRefUs)} | ${crateBefore} | ${crateNow} | ${f(b?.apiVsTs)} | ${bold(n.apiVsTs)} | ${us(n.rustApiUs)} | ${f(n.crossingsPerItem, 1)} | ${pct(n.inEngineShare)} |`);
            rowsOut.push({ category: cat, op, set, tsRefUs: n.tsRefUs, crateUs: n.crateUs, apiUs: n.rustApiUs, crateVsTs: n.crateVsTs, crateRebuildVsTs: n.crateRebuildVsTs, apiVsTs: n.apiVsTs,
                beforeCrateVsTs: b?.crateVsTs, beforeApiVsTs: b?.apiVsTs, beforeApiUs: b?.rustApiUs, crossingsPerItem: n.crossingsPerItem, inEngineShare: n.inEngineShare, stages: n.stages, topBindings: n.topBindings, errors: [...(n.errors || []), ...(b?.errors || [])] });
        }
    }
}

// 2. The remaining gaps: now slower than TS through the TS API.
const gaps = rowsOut.filter((r) => r.apiVsTs > 1).sort((a, b) => b.apiVsTs - a.apiVsTs);
p('\n## Remaining gaps (TS API slower than TS 5.0.0), ranked\n');
p('"engine" is the time inside engine calls (count mode: the wasm-bindgen glue and the WASM code), "boundary/TS" the rest of the wall time (TS views and logic, encode/decode, GC); "native" is the crate row (the same engine work, native). Stages are the V8 profile split of the TS-API loop.\n');
p('| # | op | set | category | x TS API | x TS crate | TS API | TS 5.0.0 | crossings/item | engine us/item (share) | boundary/TS us/item | native crate | top bindings | V8 stages |');
p('|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|---|');
gaps.forEach((r, i) => {
    const x = XNOW.get(`${r.op}/${r.set}`);
    const eng = x ? x.inEngineUs : NaN;
    const wall = x ? x.wallUs : NaN;
    const stages = r.stages ? Object.entries(r.stages).slice(0, 4).map(([k, v]) => `${k} ${v}%`).join(', ') : '-';
    p(`| ${i + 1} | ${r.op} | ${r.op === 'mm_new' ? '(system)' : SHORT[r.set]} | ${r.category.split(' ')[0]} | ${f(r.apiVsTs)} | ${f(r.crateVsTs)} | ${us(r.apiUs)} | ${us(r.tsRefUs)} | ${f(r.crossingsPerItem, 1)} | ${us(eng)} (${pct(eng / wall)}) | ${us(wall - eng)} | ${us(r.crateUs)} | ${(r.topBindings || []).join(', ')} | ${stages} |`);
});

// 3. BC-19 at load.
p('\n## BC-19: default on against metamodelValidation:false (TS API, same run)\n');
p('| op | set | TS 5.0.0 | on (default) | off | on - off | on / off | x TS on | x TS off | crossings on / off | checkAstShape us/item |');
p('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
const bc19 = [];
for (const op of CATEGORIES[0][1]) {
    for (const set of SETS) {
        const n = now.rows.find((r) => r.op === op && r.set === set);
        const o = OFF.get(`${op}/${set}`);
        if (!n || !o) {
            continue;
        }
        const xn = XNOW.get(`${op}/${set}`);
        const xo = XOFF.get(`${op}/${set}`);
        const shape = xn?.bindings?.find((b) => /checkAstShape/.test(b.name));
        const row = { op, set, tsRefUs: n.tsRefUs, onUs: n.rustApiUs, offUs: o.rustApiUs, deltaUs: n.rustApiUs - o.rustApiUs, ratio: n.rustApiUs / o.rustApiUs,
            onVsTs: n.apiVsTs, offVsTs: o.rustApiUs / n.tsRefUs, crossingsOn: xn?.crossings, crossingsOff: xo?.crossings, checkAstShapeUs: shape?.usPerItem, checkAstShapeCalls: shape?.perItem };
        bc19.push(row);
        p(`| ${op} | ${op === 'mm_new' ? '(system models)' : SHORT[set]} | ${us(row.tsRefUs)} | ${us(row.onUs)} | ${us(row.offUs)} | ${us(row.deltaUs)} | ${f(row.ratio)} | ${f(row.onVsTs)} | ${f(row.offVsTs)} | ${f(row.crossingsOn, 1)} / ${f(row.crossingsOff, 1)} | ${us(row.checkAstShapeUs)} |`);
    }
}

const errs = rowsOut.filter((r) => r.errors.length);
if (errs.length) {
    p('\nErrors:');
    for (const r of errs) {
        p(`- ${r.op}/${r.set}: ${[...new Set(r.errors)].join('; ')}`);
    }
}

if (rest.includes('--json')) {
    console.log(JSON.stringify({ nowRounds: now.rounds, beforeRounds: before.rounds, rows: rowsOut, gaps, bc19 }, null, 2));
} else {
    console.log(lines.join('\n'));
}
