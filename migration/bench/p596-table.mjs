#!/usr/bin/env node
// P5-96 (accordproject/concerto-rust#446): the tables of the consolidated
// re-measure after P5-88..P5-95, from what `p596-run.sh` wrote. Measure
// only. P5-72's p572-table.mjs with the P5-72 head as the second
// before-side, P5-89's validateInstance rows as their own category (so the
// five P5-72 categories stay comparable), the GC share per op (V8 profile),
// mm_new's absolute times per round, and without the checkAstShape table
// (no op but dcs_decorate has called it since P5-72).
//
//   node migration/bench/p596-table.mjs <out dir> [--json]
//
// Reads <out dir>/{now,p572,before,now-mmvoff} through `p515-report.mjs
// --json` (every timed figure is the median over the rounds of each round's
// median per item; x TS is against the TS 5.0.0 rounds of the same run) and
// prints:
//   1. the headline counts (rows at or below TS) and the category geometric
//      means of x TS, crate and TS API, for pre-F1, P5-72 and now;
//   2. x TS per op at crate and TS-API level, pre-F1, P5-72 and now,
//      grouped by the migration page's five categories plus validateInstance;
//   3. the ranked remaining-gap list (now slower than TS through the TS
//      API), with the wall time split into engine work and boundary/TS cost,
//      and the GC share of the V8 profile;
//   4. mm_new's absolute times, per round;
//   5. BC-19's load-time cost: default on against metamodelValidation:false.

import fs from 'fs';
import path from 'path';
import url from 'url';
import { execFileSync } from 'child_process';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const [outDir, ...rest] = process.argv.slice(2);
const report = (side) => JSON.parse(execFileSync(process.execPath, [path.join(__dirname, 'p515-report.mjs'), path.join(outDir, side), '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 }));
const now = report('now');
const p572 = report('p572');
const before = report('before');
const off = fs.existsSync(path.join(outDir, 'now-mmvoff')) ? report('now-mmvoff') : { rows: [] };
const key = (r) => `${r.op}/${r.set}`;
const by = (rep) => new Map(rep.rows.map((r) => [key(r), r]));
const B = by(before);
const M = by(p572);
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
    // P5-96: P5-89's API, against TS 5.0.0's fromJSON + validate(). Kept as
    // its own category so the five above stay the P5-72 row set.
    ['Validation (validateInstance, P5-89)', ['validate_instance', 'validate_instance_or_throw']],
];
const NEW_CATEGORY = CATEGORIES[CATEGORIES.length - 1][0];
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
// The garbage collector's share of the V8 profile of the now TS-API loop
// (p515-cpuprof.mjs's `gc` stage), in percent.
const gcOf = (n) => (n?.stages && Number.isFinite(n.stages.gc) ? n.stages.gc / 100 : (n?.stages ? 0 : NaN));

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
                p572CrateVsTs: m?.crateVsTs, p572CrateRebuildVsTs: m?.crateRebuildVsTs, p572ApiVsTs: m?.apiVsTs, p572ApiUs: m?.rustApiUs,
                beforeCrateVsTs: b?.crateVsTs, beforeCrateRebuildVsTs: b?.crateRebuildVsTs, beforeApiVsTs: b?.apiVsTs, beforeApiUs: b?.rustApiUs,
                crossingsPerItem: n.crossingsPerItem, inEngineShare: n.inEngineShare, gcShare: gcOf(n), stages: n.stages, topBindings: n.topBindings,
                errors: [...(n.errors || []), ...(m?.errors || []), ...(b?.errors || [])], _n: n, _m: m, _b: b });
        }
    }
}

// 1. Headline: over the P5-72 row set, and the new rows apart.
const base = rowsOut.filter((r) => r.category !== NEW_CATEGORY);
const added = rowsOut.filter((r) => r.category === NEW_CATEGORY);
const atOrBelow = (R, pick) => R.filter((r) => Number.isFinite(pick(r)) && pick(r) <= 1).length;
const finite = (R, pick) => R.filter((r) => Number.isFinite(pick(r))).length;
p(`Rounds: now ${now.rounds.join(', ')}, P5-72 ${p572.rounds.join(', ')}, pre-F1 ${before.rounds.join(', ')}. x TS = Rust / TS 5.0.0 in the same run (> 1 = slower than TS).\n`);
p('## Rows at or below TS 5.0.0\n');
p('| level | pre-F1 | P5-72 | **now** |');
p('|---|---:|---:|---:|');
p(`| TS API (of the ${base.length} P5-72 rows) | ${atOrBelow(base, (r) => r.beforeApiVsTs)} | ${atOrBelow(base, (r) => r.p572ApiVsTs)} | **${atOrBelow(base, (r) => r.apiVsTs)}** |`);
p(`| crate (of ${finite(base, (r) => r.crateVsTs)}) | ${atOrBelow(base, (r) => r.beforeCrateVsTs)} | ${atOrBelow(base, (r) => r.p572CrateVsTs)} | **${atOrBelow(base, (r) => r.crateVsTs)}** |`);
p(`| TS API, validateInstance rows (of ${added.length}) | - | - | **${atOrBelow(added, (r) => r.apiVsTs)}** |`);
p(`| crate, validateInstance rows (of ${finite(added, (r) => r.crateVsTs)}) | - | - | **${atOrBelow(added, (r) => r.crateVsTs)}** |`);
p('\n## Geometric mean of x TS by category\n');
p('| category | rows | TS API: pre-F1 | P5-72 | **now** | crate: pre-F1 | P5-72 | **now** |');
p('|---|---:|---:|---:|---:|---:|---:|---:|');
const geomeans = [];
for (const [cat] of CATEGORIES) {
    const R = rowsOut.filter((r) => r.category === cat);
    const g = { category: cat, rows: R.length,
        apiBefore: geo(R.map((r) => r.beforeApiVsTs)), apiP572: geo(R.map((r) => r.p572ApiVsTs)), apiNow: geo(R.map((r) => r.apiVsTs)),
        crateBefore: geo(R.map((r) => r.beforeCrateVsTs)), crateP572: geo(R.map((r) => r.p572CrateVsTs)), crateNow: geo(R.map((r) => r.crateVsTs)) };
    geomeans.push(g);
    p(`| ${cat} | ${g.rows} | ${f(g.apiBefore)} | ${f(g.apiP572)} | ${bold(g.apiNow)} | ${f(g.crateBefore)} | ${f(g.crateP572)} | ${bold(g.crateNow)} |`);
}

// 2. Per op.
for (const [cat] of CATEGORIES) {
    p(`\n### ${cat}\n`);
    p('| op | set | TS 5.0.0 | x TS crate: pre-F1 | P5-72 | **now** | x TS API: pre-F1 | P5-72 | **now** | TS API now | crossings/item | in-engine | GC |');
    p('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const r of rowsOut.filter((x) => x.category === cat)) {
        p(`| ${r.op} | ${r.op === 'mm_new' ? '(system models)' : SHORT[r.set]} | ${us(r.tsRefUs)} | ${crateCell(r._b, false)} | ${crateCell(r._m, false)} | ${crateCell(r._n, true)} | ${f(r.beforeApiVsTs)} | ${f(r.p572ApiVsTs)} | ${bold(r.apiVsTs)} | ${us(r.apiUs)} | ${f(r.crossingsPerItem, 1)} | ${pct(r.inEngineShare)} | ${pct(r.gcShare)} |`);
    }
}

// 3. The remaining gaps: now slower than TS through the TS API.
const gaps = rowsOut.filter((r) => r.apiVsTs > 1).sort((a, b) => b.apiVsTs - a.apiVsTs);
p('\n## Remaining gaps (TS API slower than TS 5.0.0), ranked\n');
p('"engine" is the time inside engine calls (count mode: the wasm-bindgen glue and the WASM code), "boundary/TS" the rest of the wall time (TS views and logic, encode/decode, GC); "GC" is the garbage collector\'s share of the V8 profile of the TS-API loop; "native" is the crate row (the same engine work, native). Stages are the V8 profile split of the TS-API loop.\n');
p('| # | op | set | category | x TS API | P5-72 | x TS crate | TS API | TS 5.0.0 | crossings/item | engine us/item (share) | boundary/TS us/item | GC | native crate | top bindings | V8 stages |');
p('|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|');
gaps.forEach((r, i) => {
    const x = XNOW.get(`${r.op}/${r.set}`);
    const eng = x ? x.inEngineUs : NaN;
    const wall = x ? x.wallUs : NaN;
    r.engineUs = eng;
    r.countWallUs = wall;
    const stages = r.stages ? Object.entries(r.stages).slice(0, 4).map(([k, v]) => `${k} ${v}%`).join(', ') : '-';
    p(`| ${i + 1} | ${r.op} | ${r.op === 'mm_new' ? '(system)' : SHORT[r.set]} | ${r.category.split(' ')[0]} | ${f(r.apiVsTs)} | ${f(r.p572ApiVsTs)} | ${f(r.crateVsTs)} | ${us(r.apiUs)} | ${us(r.tsRefUs)} | ${f(r.crossingsPerItem, 1)} | ${us(eng)} (${pct(eng / wall)}) | ${us(wall - eng)} | ${pct(r.gcShare)} | ${us(r.crateUs)} | ${(r.topBindings || []).join(', ')} | ${stages} |`);
});

// 4. mm_new in absolute terms, per round (TS 5.0.0's mm_new moves with the
// sample count, P5-73).
p('\n## mm_new, absolute (us per manager, each round\'s median)\n');
p('| side | round 1 | round 2 | round 3 | median |');
p('|---|---:|---:|---:|---:|');
const mmNew = [];
const roundsOf = (side, prefix) => [1, 2, 3].map((r) => {
    const file = path.join(outDir, side, `${prefix}-${r}.json`);
    if (!fs.existsSync(file)) {
        return NaN;
    }
    const x = JSON.parse(fs.readFileSync(file, 'utf8')).results.find((y) => y.op === 'mm_new' && !y.error);
    return x ? x.medianUs : NaN;
});
const med = (xs) => {
    const v = xs.filter(Number.isFinite).sort((a, b) => a - b);
    return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : NaN;
};
for (const [label, side, prefix] of [['TS 5.0.0', 'now', 'ts-reference-5.0.0'], ['pre-F1', 'before', 'rust-engine'], ['P5-72 head', 'p572', 'rust-engine'], ['now', 'now', 'rust-engine'], ['now, metamodelValidation:false', 'now-mmvoff', 'rust-engine']]) {
    const rs = roundsOf(side, prefix);
    mmNew.push({ side: label, rounds: rs, median: med(rs) });
    p(`| ${label} | ${rs.map((x) => f(x, 1)).join(' | ')} | ${f(med(rs), 1)} |`);
}

// 5. BC-19 at load.
p('\n## BC-19: default on against metamodelValidation:false (TS API, same run)\n');
p('| op | set | TS 5.0.0 | on (default) | off | on - off | on / off | x TS on | x TS off | P5-72 x TS on | crossings on / off |');
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
        const m = M.get(`${op}/${set}`);
        const row = { op, set, tsRefUs: n.tsRefUs, onUs: n.rustApiUs, offUs: o.rustApiUs, deltaUs: n.rustApiUs - o.rustApiUs, ratio: n.rustApiUs / o.rustApiUs,
            onVsTs: n.apiVsTs, offVsTs: o.rustApiUs / n.tsRefUs, p572OnVsTs: m?.apiVsTs, crossingsOn: xn?.crossings, crossingsOff: xo?.crossings };
        bc19.push(row);
        p(`| ${op} | ${op === 'mm_new' ? '(system models)' : SHORT[set]} | ${us(row.tsRefUs)} | ${us(row.onUs)} | ${us(row.offUs)} | ${us(row.deltaUs)} | ${f(row.ratio)} | ${f(row.onVsTs)} | ${f(row.offVsTs)} | ${f(row.p572OnVsTs)} | ${f(row.crossingsOn, 1)} / ${f(row.crossingsOff, 1)} |`);
    }
}

const errs = rowsOut.filter((r) => r.errors.length);
if (errs.length) {
    p('\nErrors (the heads before P5-89 have no validateInstance):');
    for (const r of errs) {
        p(`- ${r.op}/${r.set}: ${[...new Set(r.errors)].join('; ')}`);
    }
}

if (rest.includes('--json')) {
    const strip = ({ _n, _m, _b, ...r }) => r;
    console.log(JSON.stringify({ nowRounds: now.rounds, p572Rounds: p572.rounds, beforeRounds: before.rounds, geomeans, rows: rowsOut.map(strip), gaps: gaps.map(strip), mmNew, bc19 }, null, 2));
} else {
    console.log(lines.join('\n'));
}
