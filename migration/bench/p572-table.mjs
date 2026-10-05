#!/usr/bin/env node
// P5-72 (accordproject/concerto-rust#413): the tables of the consolidated
// re-measure after BC-19-a/b, from what `p572-run.sh` wrote. Measure only.
// P5-60's p560-table.mjs with a second before-side (the P5-60 head).
//
//   node migration/bench/p572-table.mjs <out dir> [--json]
//
// Reads <out dir>/{now,p560,before,now-mmvoff} through `p515-report.mjs
// --json` (every timed figure is the median over the rounds of each round's
// median per item; x TS is against the TS 5.0.0 rounds of the same run) and
// prints:
//   1. the headline counts (rows at or below TS) and the category geometric
//      means of x TS, crate and TS API, for pre-F1, P5-60 and now;
//   2. x TS per op at crate and TS-API level, pre-F1, P5-60 and now,
//      grouped by the migration page's five categories;
//   3. the ranked remaining-gap list (now slower than TS through the TS
//      API), with the wall time split into engine work and boundary/TS cost;
//   4. the checkAstShape share of the wall time (count run), P5-60 and now;
//   5. BC-19's load-time cost: default on against metamodelValidation:false.

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
const p560 = report('p560');
const before = report('before');
const off = fs.existsSync(path.join(outDir, 'now-mmvoff')) ? report('now-mmvoff') : { rows: [] };
const key = (r) => `${r.op}/${r.set}`;
const by = (rep) => new Map(rep.rows.map((r) => [key(r), r]));
const B = by(before);
const M = by(p560);
const OFF = by(off);
const readCross = (side) => {
    const f = path.join(outDir, side, 'summary', 'crossings.json');
    return fs.existsSync(f) ? new Map(JSON.parse(fs.readFileSync(f, 'utf8')).results.map((r) => [key(r), r])) : new Map();
};
const XNOW = readCross('now');
const XP560 = readCross('p560');
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

const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const us = (x) => (Number.isFinite(x) ? (x >= 1000 ? `${(x / 1000).toFixed(2)} ms` : `${x.toFixed(x < 10 ? 2 : 1)} us`) : '-');
const pct = (x) => (Number.isFinite(x) ? `${Math.round(100 * x)}%` : '-');
const bold = (x) => (Number.isFinite(x) ? `**${f(x)}**` : '-');
const crateCell = (r, b) => (r && Number.isFinite(r.crateRebuildVsTs) ? `${b ? bold(r.crateVsTs) : f(r.crateVsTs)} (rebuild ${f(r.crateRebuildVsTs)})` : (b ? bold(r?.crateVsTs) : f(r?.crateVsTs)));
const geo = (xs) => {
    const v = xs.filter(Number.isFinite);
    return v.length ? Math.exp(v.reduce((s, x) => s + Math.log(x), 0) / v.length) : NaN;
};
const shapeOf = (x) => x?.bindings?.find((b) => /checkAstShape/.test(b.name));

const rowsOut = [];
const lines = [];
const p = (s = '') => lines.push(s);

for (const [cat, ops] of CATEGORIES) {
    for (const op of ops) {
        for (const set of SETS) {
            const n = now.rows.find((r) => r.op === op && r.set === set);
            if (!n) {
                continue;
            }
            const b = B.get(key(n));
            const m = M.get(key(n));
            rowsOut.push({ category: cat, op, set, tsRefUs: n.tsRefUs, crateUs: n.crateUs, apiUs: n.rustApiUs, crateVsTs: n.crateVsTs, crateRebuildVsTs: n.crateRebuildVsTs, apiVsTs: n.apiVsTs,
                p560CrateVsTs: m?.crateVsTs, p560CrateRebuildVsTs: m?.crateRebuildVsTs, p560ApiVsTs: m?.apiVsTs, p560ApiUs: m?.rustApiUs,
                beforeCrateVsTs: b?.crateVsTs, beforeCrateRebuildVsTs: b?.crateRebuildVsTs, beforeApiVsTs: b?.apiVsTs, beforeApiUs: b?.rustApiUs,
                crossingsPerItem: n.crossingsPerItem, inEngineShare: n.inEngineShare, stages: n.stages, topBindings: n.topBindings,
                errors: [...(n.errors || []), ...(m?.errors || []), ...(b?.errors || [])], _n: n, _m: m, _b: b });
        }
    }
}

// 1. Headline.
const atOrBelow = (pick) => rowsOut.filter((r) => Number.isFinite(pick(r)) && pick(r) <= 1).length;
const finite = (pick) => rowsOut.filter((r) => Number.isFinite(pick(r))).length;
p(`Rounds: now ${now.rounds.join(', ')}, P5-60 ${p560.rounds.join(', ')}, pre-F1 ${before.rounds.join(', ')}. x TS = Rust / TS 5.0.0 in the same run (> 1 = slower than TS).\n`);
p('## Rows at or below TS 5.0.0\n');
p('| level | pre-F1 | P5-60 | **now** |');
p('|---|---:|---:|---:|');
p(`| TS API (of ${rowsOut.length}) | ${atOrBelow((r) => r.beforeApiVsTs)} | ${atOrBelow((r) => r.p560ApiVsTs)} | **${atOrBelow((r) => r.apiVsTs)}** |`);
p(`| crate (of ${finite((r) => r.crateVsTs)}) | ${atOrBelow((r) => r.beforeCrateVsTs)} | ${atOrBelow((r) => r.p560CrateVsTs)} | **${atOrBelow((r) => r.crateVsTs)}** |`);
p('\n## Geometric mean of x TS by category\n');
p('| category | rows | TS API: pre-F1 | P5-60 | **now** | crate: pre-F1 | P5-60 | **now** |');
p('|---|---:|---:|---:|---:|---:|---:|---:|');
const geomeans = [];
for (const [cat] of CATEGORIES) {
    const R = rowsOut.filter((r) => r.category === cat);
    const g = { category: cat, rows: R.length,
        apiBefore: geo(R.map((r) => r.beforeApiVsTs)), apiP560: geo(R.map((r) => r.p560ApiVsTs)), apiNow: geo(R.map((r) => r.apiVsTs)),
        crateBefore: geo(R.map((r) => r.beforeCrateVsTs)), crateP560: geo(R.map((r) => r.p560CrateVsTs)), crateNow: geo(R.map((r) => r.crateVsTs)) };
    geomeans.push(g);
    p(`| ${cat} | ${g.rows} | ${f(g.apiBefore)} | ${f(g.apiP560)} | ${bold(g.apiNow)} | ${f(g.crateBefore)} | ${f(g.crateP560)} | ${bold(g.crateNow)} |`);
}

// 2. Per op.
for (const [cat] of CATEGORIES) {
    p(`\n### ${cat}\n`);
    p('| op | set | TS 5.0.0 | x TS crate: pre-F1 | P5-60 | **now** | x TS API: pre-F1 | P5-60 | **now** | TS API now | crossings/item | in-engine |');
    p('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const r of rowsOut.filter((x) => x.category === cat)) {
        p(`| ${r.op} | ${r.op === 'mm_new' ? '(system models)' : SHORT[r.set]} | ${us(r.tsRefUs)} | ${crateCell(r._b, false)} | ${crateCell(r._m, false)} | ${crateCell(r._n, true)} | ${f(r.beforeApiVsTs)} | ${f(r.p560ApiVsTs)} | ${bold(r.apiVsTs)} | ${us(r.apiUs)} | ${f(r.crossingsPerItem, 1)} | ${pct(r.inEngineShare)} |`);
    }
}

// 3. The remaining gaps: now slower than TS through the TS API.
const gaps = rowsOut.filter((r) => r.apiVsTs > 1).sort((a, b) => b.apiVsTs - a.apiVsTs);
p('\n## Remaining gaps (TS API slower than TS 5.0.0), ranked\n');
p('"engine" is the time inside engine calls (count mode: the wasm-bindgen glue and the WASM code), "boundary/TS" the rest of the wall time (TS views and logic, encode/decode, GC); "native" is the crate row (the same engine work, native). Stages are the V8 profile split of the TS-API loop.\n');
p('| # | op | set | category | x TS API | P5-60 | x TS crate | TS API | TS 5.0.0 | crossings/item | engine us/item (share) | boundary/TS us/item | native crate | top bindings | V8 stages |');
p('|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|');
gaps.forEach((r, i) => {
    const x = XNOW.get(`${r.op}/${r.set}`);
    const eng = x ? x.inEngineUs : NaN;
    const wall = x ? x.wallUs : NaN;
    r.engineUs = eng;
    r.countWallUs = wall;
    const stages = r.stages ? Object.entries(r.stages).slice(0, 4).map(([k, v]) => `${k} ${v}%`).join(', ') : '-';
    p(`| ${i + 1} | ${r.op} | ${r.op === 'mm_new' ? '(system)' : SHORT[r.set]} | ${r.category.split(' ')[0]} | ${f(r.apiVsTs)} | ${f(r.p560ApiVsTs)} | ${f(r.crateVsTs)} | ${us(r.apiUs)} | ${us(r.tsRefUs)} | ${f(r.crossingsPerItem, 1)} | ${us(eng)} (${pct(eng / wall)}) | ${us(wall - eng)} | ${us(r.crateUs)} | ${(r.topBindings || []).join(', ')} | ${stages} |`);
});

// 4. checkAstShape's share of the wall time (count run), P5-60 against now.
p('\n## checkAstShape share of the TS-API wall time (count run)\n');
p('The `ModelManagerHandle.checkAstShape` binding per item and its share of the count run\'s wall time, at the P5-60 head and now. Rows where neither side calls it are left out.\n');
p('| op | set | P5-60 calls/item | P5-60 us/item | P5-60 share | now calls/item | now us/item | now share |');
p('|---|---|---:|---:|---:|---:|---:|---:|');
const shapeRows = [];
for (const r of rowsOut) {
    const xm = XP560.get(`${r.op}/${r.set}`);
    const xn = XNOW.get(`${r.op}/${r.set}`);
    const sm = shapeOf(xm);
    const sn = shapeOf(xn);
    if (!sm && !sn) {
        continue;
    }
    const row = { op: r.op, set: r.set, p560Calls: sm?.perItem ?? 0, p560Us: sm?.usPerItem ?? 0, p560Share: xm ? (sm?.usPerItem ?? 0) / xm.wallUs : NaN,
        nowCalls: sn?.perItem ?? 0, nowUs: sn?.usPerItem ?? 0, nowShare: xn ? (sn?.usPerItem ?? 0) / xn.wallUs : NaN };
    shapeRows.push(row);
    p(`| ${r.op} | ${r.op === 'mm_new' ? '(system)' : SHORT[r.set]} | ${f(row.p560Calls, 1)} | ${us(row.p560Us)} | ${pct(row.p560Share)} | ${f(row.nowCalls, 1)} | ${us(row.nowUs)} | ${pct(row.nowShare)} |`);
}

// 5. BC-19 at load.
p('\n## BC-19: default on against metamodelValidation:false (TS API, same run)\n');
p('| op | set | TS 5.0.0 | on (default) | off | on - off | on / off | x TS on | x TS off | P5-60 x TS on | crossings on / off | checkAstShape us/item |');
p('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
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
        const shape = shapeOf(xn);
        const m = M.get(`${op}/${set}`);
        const row = { op, set, tsRefUs: n.tsRefUs, onUs: n.rustApiUs, offUs: o.rustApiUs, deltaUs: n.rustApiUs - o.rustApiUs, ratio: n.rustApiUs / o.rustApiUs,
            onVsTs: n.apiVsTs, offVsTs: o.rustApiUs / n.tsRefUs, p560OnVsTs: m?.apiVsTs, crossingsOn: xn?.crossings, crossingsOff: xo?.crossings, checkAstShapeUs: shape?.usPerItem, checkAstShapeCalls: shape?.perItem };
        bc19.push(row);
        p(`| ${op} | ${op === 'mm_new' ? '(system models)' : SHORT[set]} | ${us(row.tsRefUs)} | ${us(row.onUs)} | ${us(row.offUs)} | ${us(row.deltaUs)} | ${f(row.ratio)} | ${f(row.onVsTs)} | ${f(row.offVsTs)} | ${f(row.p560OnVsTs)} | ${f(row.crossingsOn, 1)} / ${f(row.crossingsOff, 1)} | ${us(row.checkAstShapeUs)} |`);
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
    const strip = ({ _n, _m, _b, ...r }) => r;
    console.log(JSON.stringify({ nowRounds: now.rounds, p560Rounds: p560.rounds, beforeRounds: before.rounds, geomeans, rows: rowsOut.map(strip), gaps: gaps.map(strip), checkAstShape: shapeRows, bc19 }, null, 2));
} else {
    console.log(lines.join('\n'));
}
