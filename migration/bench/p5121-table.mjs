#!/usr/bin/env node
// P5-121 (accordproject/concerto-rust#497): the tables of the consolidated
// re-measure after review 2's fixes (P5-110..P5-118), from what
// `p5121-run.sh` wrote. Measure only. P5-109's p5109-table.mjs with
// P5-109's now heads as the one before-side, validateInstance as its own
// series inside Validation (not blended, as the brief asks), P5-109's
// `p5109` rows (with P5-113's toJSON map rows), P5-121's `p5121` rows, and
// the introspection rows P5-110's indicative round flagged.
//
//   node migration/bench/p5121-table.mjs <sweep dir> [--json] [--p5109 <P5-109 tables.json>]
//       [--typedread <dir>] [--bundle <bundle-sizes.json>] [--p5109-bundle <bundle-sizes.json>]
//
// Reads <sweep dir>/{now,before,now-mmvoff} through `p515-report.mjs
// --json` (every timed figure is the median over the rounds of each round's
// median per item; x TS is against the TS 5.0.0 rounds of the same run) and
// prints:
//   1. the headline counts (rows at or below TS) and the category geometric
//      means of x TS, TS API and crate, before and now;
//   2. x TS per op at crate and TS-API level, before and now, by category;
//   3. the `p5109` and `p5121` pseudo-sets' rows, and the introspection
//      rows now against before (P5-110's flagged rows);
//   4. the ranked remaining-gap list (now slower than TS through the TS
//      API), with engine against boundary/TS cost and the GC share;
//   5. crossings per item of P5-109's gap rows, P5-109's run, before and now;
//   6. mm_new's absolute times per round;
//   7. BC-19's load-time cost (default on against metamodelValidation:false);
//   8. the typed-read allocation table and the web bundle size, when given.

import fs from 'fs';
import path from 'path';
import url from 'url';
import { execFileSync } from 'child_process';
import { requireRawInputs } from './lib/raw-inputs.mjs';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const outDir = argv[0];
const opt = (k) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : null;
};
const asJson = argv.includes('--json');
const P596 = opt('--p5109') || path.join(__dirname, 'results', 'P5-109', 'tables.json');
const TYPEDREAD = opt('--typedread');
const BUNDLE = opt('--bundle');
const P596_BUNDLE = opt('--p5109-bundle') || path.join(__dirname, 'results', 'P5-109', 'bundle', 'bundle-sizes.json');
requireRawInputs(outDir, P596, TYPEDREAD, BUNDLE, P596_BUNDLE);

const report = (side) => JSON.parse(execFileSync(process.execPath, [path.join(__dirname, 'p515-report.mjs'), path.join(outDir, side), '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 }));
const now = report('now');
const before = report('before');
const off = fs.existsSync(path.join(outDir, 'now-mmvoff')) ? report('now-mmvoff') : { rows: [] };
const key = (r) => `${r.op}/${r.set}`;
const by = (rep) => new Map(rep.rows.map((r) => [key(r), r]));
const N = by(now);
const B = by(before);
const OFF = by(off);
const readCross = (side) => {
    const f = path.join(outDir, side, 'summary', 'crossings.json');
    return fs.existsSync(f) ? new Map(JSON.parse(fs.readFileSync(f, 'utf8')).results.filter((r) => !r.error).map((r) => [key(r), r])) : new Map();
};
const XNOW = readCross('now');
const XBEFORE = readCross('before');
const XOFF = readCross('now-mmvoff');

const SUBCLASS = ['get_assignable_class_declarations', 'get_direct_subclasses'];
const CATEGORIES = [
    ['Model loading', ['mm_new', 'modelfile_new', 'add_model_file', 'add_cto_model']],
    ['Introspection (including decorators/DCS)', ['get_type', 'get_type_first', 'resolve_type', 'resolve_type_first', 'get_namespaces', 'get_namespaces_first', 'derives_from', 'is_assignable_to', 'get_decorators', 'dcs_decorate', 'dcs_validate', 'extract_decorators', 'extract_vocabularies', 'extract_cold', 'extract_keep', ...SUBCLASS]],
    ['Serialisation', ['from_json', 'to_json']],
    ['Instance creation', ['new_resource']],
    // P5-121: validateInstance is its own series inside Validation, not
    // blended (the brief).
    ['Validation', ['validate', 'set_property_value', 'add_array_value']],
    ['Validation: validateInstance', ['validate_instance', 'validate_instance_or_throw']],
];
const P5109_OPS = [
    ['from_json_map', 'fromJSON, 1,000-entry String map'],
    ['from_json_relmap', 'fromJSON, 1,000-entry relationship map'],
    ['to_json_map', 'toJSON, 1,000-entry String map'],
    ['to_json_relmap', 'toJSON, 1,000-entry relationship map'],
    ['validate_instance_collect_all', 'validateInstance, collectAll, 6 errors'],
    ['validate_instance_first_error', 'validateInstance, collectAll:false'],
    ['get_type_p5109', 'getType, nothing changed'],
    ['get_type_after_update', 'getType after updateModelFile of the supertype file'],
    ['get_type_other_mutated', 'getType while a second manager changes'],
    ['resolve_type_p5109', 'resolveType, nothing changed'],
    ['resolve_type_after_update', 'resolveType after updateModelFile of the supertype file'],
    ['resolve_type_other_mutated', 'resolveType while a second manager changes'],
];
const P5121_OPS = [
    ['from_json_numkeys', 'fromJSON, 100,000 numeric-string map keys (1 document)'],
    ['from_json_strkeys', 'fromJSON, 100,000 non-numeric map keys (1 document, reference)'],
    ['from_json_deep', 'fromJSON, 200-deep nested instance'],
    ['to_json_deep', 'toJSON, 200-deep nested instance'],
    ['validate_instance_deep', 'validateInstance, 200-deep nested instance'],
];
const SETS = ['concerto-core-test-data', 'conformance', 'synthetic-large'];
const SHORT = { 'concerto-core-test-data': 'core-test-data', conformance: 'conformance', 'synthetic-large': 'synthetic-large', p5109: 'p5109', p5121: 'p5121' };

const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const us = (x) => (Number.isFinite(x) ? (x >= 1000 ? `${(x / 1000).toFixed(2)} ms` : `${x.toFixed(x < 10 ? 2 : 1)} us`) : '-');
const pct = (x) => (Number.isFinite(x) ? `${Math.round(100 * x)}%` : '-');
const bold = (x) => (Number.isFinite(x) ? `**${f(x)}**` : '-');
const kb = (x) => (Number.isFinite(x) ? (x / 1000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '-');
const crateCell = (r, b) => (r && Number.isFinite(r.crateRebuildVsTs) ? `${b ? bold(r.crateVsTs) : f(r.crateVsTs)} (rebuild ${f(r.crateRebuildVsTs)})` : (b ? bold(r?.crateVsTs) : f(r?.crateVsTs)));
const geo = (xs) => {
    const v = xs.filter(Number.isFinite);
    return v.length ? Math.exp(v.reduce((s, x) => s + Math.log(x), 0) / v.length) : NaN;
};
const gcOf = (n) => (n?.stages && Number.isFinite(n.stages.gc) ? n.stages.gc / 100 : (n?.stages ? 0 : NaN));

const rowsOut = [];
const lines = [];
const p = (s = '') => lines.push(s);

for (const [cat, ops] of CATEGORIES) {
    for (const op of ops) {
        for (const set of SETS) {
            const n = N.get(`${op}/${set}`);
            if (!n) {
                continue;
            }
            const b = B.get(key(n));
            rowsOut.push({ category: cat, op, set, p596Row: !SUBCLASS.includes(op), tsRefUs: n.tsRefUs, crateUs: n.crateUs, apiUs: n.rustApiUs, crateVsTs: n.crateVsTs, crateRebuildVsTs: n.crateRebuildVsTs, apiVsTs: n.apiVsTs,
                beforeCrateVsTs: b?.crateVsTs, beforeCrateRebuildVsTs: b?.crateRebuildVsTs, beforeApiVsTs: b?.apiVsTs, beforeApiUs: b?.rustApiUs,
                crossingsPerItem: n.crossingsPerItem, beforeCrossingsPerItem: b?.crossingsPerItem, inEngineShare: n.inEngineShare, gcShare: gcOf(n), stages: n.stages, topBindings: n.topBindings,
                errors: [...(n.errors || []), ...(b?.errors || [])], _n: n, _b: b });
        }
    }
}
const addedRow = (set) => ([op, what]) => {
    const n = N.get(`${op}/${set}`);
    const b = B.get(`${op}/${set}`);
    return { op, what, set, tsRefUs: n?.tsRefUs, beforeApiUs: b?.rustApiUs, apiUs: n?.rustApiUs, beforeApiVsTs: b?.apiVsTs, apiVsTs: n?.apiVsTs,
        nowOverBefore: n?.rustApiUs / b?.rustApiUs, beforeCrossingsPerItem: b?.crossingsPerItem, crossingsPerItem: n?.crossingsPerItem,
        topBindings: n?.topBindings, beforeTopBindings: b?.topBindings, gcShare: gcOf(n), stages: n?.stages,
        errors: [...(n?.errors || []).map((e) => `now: ${e}`), ...(b?.errors || []).map((e) => `before: ${e}`)] };
};
const added = [...P5109_OPS.map(addedRow('p5109')), ...P5121_OPS.map(addedRow('p5121'))];

// 1. Headline.
const base = rowsOut.filter((r) => r.p596Row);
const sub = rowsOut.filter((r) => !r.p596Row);
const atOrBelow = (R, pick) => R.filter((r) => Number.isFinite(pick(r)) && pick(r) <= 1).length;
const finite = (R, pick) => R.filter((r) => Number.isFinite(pick(r))).length;
p(`Rounds: now ${now.rounds.join(', ')}, before ${before.rounds.join(', ')}. x TS = Rust / TS 5.0.0 in the same run (> 1 = slower than TS). "before" is P5-109's now heads.\n`);
p('## Rows at or below TS 5.0.0\n');
p('| level | before | **now** |');
p('|---|---:|---:|');
p(`| TS API, the ${base.length} P5-96 rows (73 + validateInstance) | ${atOrBelow(base, (r) => r.beforeApiVsTs)} | **${atOrBelow(base, (r) => r.apiVsTs)}** |`);
p(`| crate (of ${finite(base, (r) => r.crateVsTs)}) | ${atOrBelow(base, (r) => r.beforeCrateVsTs)} | **${atOrBelow(base, (r) => r.crateVsTs)}** |`);
p(`| TS API, P5-106's subclass queries (of ${sub.length}) | ${atOrBelow(sub, (r) => r.beforeApiVsTs)} | **${atOrBelow(sub, (r) => r.apiVsTs)}** |`);
p('\n## Geometric mean of x TS by category\n');
p('"P5-96 rows" leaves out the subclass queries, so it is the row set of P5-96\'s categories. validateInstance (validate_instance, validate_instance_or_throw) is its own series, not blended into Validation.\n');
p('| category | rows | TS API: before | **now** | crate: before | **now** | TS API, P5-96 rows: before | **now** |');
p('|---|---:|---:|---:|---:|---:|---:|---:|');
const geomeans = [];
for (const [cat] of CATEGORIES) {
    const R = rowsOut.filter((r) => r.category === cat);
    const R96 = R.filter((r) => r.p596Row);
    const g = { category: cat, rows: R.length,
        apiBefore: geo(R.map((r) => r.beforeApiVsTs)), apiNow: geo(R.map((r) => r.apiVsTs)),
        crateBefore: geo(R.map((r) => r.beforeCrateVsTs)), crateNow: geo(R.map((r) => r.crateVsTs)),
        api96Before: geo(R96.map((r) => r.beforeApiVsTs)), api96Now: geo(R96.map((r) => r.apiVsTs)) };
    geomeans.push(g);
    p(`| ${cat} | ${g.rows} | ${f(g.apiBefore)} | ${bold(g.apiNow)} | ${f(g.crateBefore)} | ${bold(g.crateNow)} | ${f(g.api96Before)} | ${bold(g.api96Now)} |`);
}

// 2. Per op.
for (const [cat] of CATEGORIES) {
    p(`\n### ${cat}\n`);
    p('| op | set | TS 5.0.0 | x TS crate: before | **now** | x TS API: before | **now** | TS API now | crossings/item before | now | in-engine | GC |');
    p('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const r of rowsOut.filter((x) => x.category === cat)) {
        p(`| ${r.op} | ${r.op === 'mm_new' ? '(system models)' : SHORT[r.set]} | ${us(r.tsRefUs)} | ${crateCell(r._b, false)} | ${crateCell(r._n, true)} | ${f(r.beforeApiVsTs)} | ${bold(r.apiVsTs)} | ${us(r.apiUs)} | ${f(r.beforeCrossingsPerItem, 1)} | ${f(r.crossingsPerItem, 1)} | ${pct(r.inEngineShare)} | ${pct(r.gcShare)} |`);
    }
}

// 3. The pseudo-sets' rows. Crossings are per document (per item).
for (const [set, title] of [['p5109', 'P5-109 rows (the `p5109` pseudo-set, TS API only)'], ['p5121', 'P5-121 rows (the `p5121` pseudo-set, TS API only)']]) {
    p(`\n## ${title}\n`);
    p('| op | what | TS 5.0.0 | before | **now** | now / before | x TS before | **x TS now** | crossings/item before | now | GC | top bindings now |');
    p('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|');
    for (const r of added.filter((x) => x.set === set)) {
        p(`| ${r.op} | ${r.what} | ${us(r.tsRefUs)} | ${us(r.beforeApiUs)} | **${us(r.apiUs)}** | ${f(r.nowOverBefore)} | ${f(r.beforeApiVsTs)} | ${bold(r.apiVsTs)} | ${f(r.beforeCrossingsPerItem, 2)} | ${f(r.crossingsPerItem, 2)} | ${pct(r.gcShare)} | ${(r.topBindings || []).join(', ') || '-'} |`);
    }
}

// 3b. Introspection, now against before (P5-110's indicative round flagged
// 5 of its 25 introspection rows more than 5% slower). Crate and TS API
// times, now / before; the rows over 1.05 at either level are marked.
const introspection = [];
p('\n## Introspection, now against before (P5-110\'s flagged rows)\n');
p('now / before of the median time per item (> 1 = now slower). `*` marks a ratio over 1.05.\n');
p('| op | set | crate before | crate now | **crate now / before** | TS API before | TS API now | **TS API now / before** |');
p('|---|---|---:|---:|---:|---:|---:|---:|');
for (const r of rowsOut.filter((x) => x.category === CATEGORIES[1][0])) {
    const crate = r._n?.crateUs / r._b?.crateUs;
    const api = r.apiUs / r.beforeApiUs;
    const mark = (x) => (Number.isFinite(x) ? (x > 1.05 ? `**${f(x)}** *` : `**${f(x)}**`) : '-');
    introspection.push({ op: r.op, set: r.set, crateBeforeUs: r._b?.crateUs, crateNowUs: r._n?.crateUs, crateNowOverBefore: crate, apiBeforeUs: r.beforeApiUs, apiNowUs: r.apiUs, apiNowOverBefore: api });
    p(`| ${r.op} | ${SHORT[r.set]} | ${us(r._b?.crateUs)} | ${us(r._n?.crateUs)} | ${mark(crate)} | ${us(r.beforeApiUs)} | ${us(r.apiUs)} | ${mark(api)} |`);
}

// 4. The remaining gaps.
const gaps = rowsOut.filter((r) => r.apiVsTs > 1).sort((a, b) => b.apiVsTs - a.apiVsTs);
p('\n## Remaining gaps (TS API slower than TS 5.0.0), ranked\n');
p('"engine" is the time inside engine calls (count mode: the wasm-bindgen glue and the WASM code), "boundary/TS" the rest of the wall time (TS views and logic, encode/decode, GC); "GC" is the garbage collector\'s share of the V8 profile of the TS-API loop; "native crate" is the crate row (the same engine work, native).\n');
p('| # | op | set | category | x TS API | before | x TS crate | TS API | TS 5.0.0 | crossings/item | engine us/item (share) | boundary/TS us/item | GC | native crate | top bindings | V8 stages |');
p('|---:|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|');
gaps.forEach((r, i) => {
    const x = XNOW.get(`${r.op}/${r.set}`);
    const eng = x ? x.inEngineUs : NaN;
    const wall = x ? x.wallUs : NaN;
    r.engineUs = eng;
    r.countWallUs = wall;
    const stages = r.stages ? Object.entries(r.stages).slice(0, 4).map(([k, v]) => `${k} ${v}%`).join(', ') : '-';
    p(`| ${i + 1} | ${r.op} | ${r.op === 'mm_new' ? '(system)' : SHORT[r.set]} | ${r.category.split(' ')[0]} | ${f(r.apiVsTs)} | ${f(r.beforeApiVsTs)} | ${f(r.crateVsTs)} | ${us(r.apiUs)} | ${us(r.tsRefUs)} | ${f(r.crossingsPerItem, 1)} | ${us(eng)} (${pct(eng / wall)}) | ${us(wall - eng)} | ${pct(r.gcShare)} | ${us(r.crateUs)} | ${(r.topBindings || []).join(', ')} | ${stages} |`);
});

// 5. Crossings per item of P5-109's gap rows.
const p596 = fs.existsSync(P596) ? JSON.parse(fs.readFileSync(P596, 'utf8')) : null;
const crossingsOfGaps = [];
if (p596) {
    p('\n## Crossings per item of P5-109\'s gap rows\n');
    p('P5-109\'s ranked gap rows (TS API slower than TS 5.0.0 in P5-109), with the crossings per item P5-109 recorded, this run\'s before-side (the same heads) and now, and the now x TS.\n');
    p('| op | set | P5-109 x TS API | P5-109 crossings/item | before | **now** | now - before | x TS API now | top bindings now |');
    p('|---|---|---:|---:|---:|---:|---:|---:|---|');
    for (const g of p596.gaps) {
        const xb = XBEFORE.get(`${g.op}/${g.set}`);
        const xn = XNOW.get(`${g.op}/${g.set}`);
        const n = N.get(`${g.op}/${g.set}`);
        const row = { op: g.op, set: g.set, p596ApiVsTs: g.apiVsTs, p596Crossings: g.crossingsPerItem, before: xb?.crossings, now: xn?.crossings, apiVsTs: n?.apiVsTs };
        crossingsOfGaps.push(row);
        p(`| ${g.op} | ${g.op === 'mm_new' ? '(system)' : SHORT[g.set]} | ${f(g.apiVsTs)} | ${f(g.crossingsPerItem, 2)} | ${f(row.before, 2)} | **${f(row.now, 2)}** | ${f(row.now - row.before, 2)} | ${f(row.apiVsTs)} | ${(n?.topBindings || []).join(', ')} |`);
    }
}

// 6. mm_new in absolute terms, per round.
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
for (const [label, side, prefix] of [['TS 5.0.0', 'now', 'ts-reference-5.0.0'], ['before (P5-109 now heads)', 'before', 'rust-engine'], ['now', 'now', 'rust-engine'], ['now, metamodelValidation:false', 'now-mmvoff', 'rust-engine']]) {
    const rs = roundsOf(side, prefix);
    mmNew.push({ side: label, rounds: rs, median: med(rs) });
    p(`| ${label} | ${rs.map((x) => f(x, 1)).join(' | ')} | ${f(med(rs), 1)} |`);
}

// 7. BC-19 at load.
p('\n## BC-19: default on against metamodelValidation:false (TS API, same run)\n');
p('| op | set | TS 5.0.0 | on (default) | off | on - off | on / off | x TS on | x TS off | before x TS on | crossings on / off |');
p('|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
const bc19 = [];
for (const op of CATEGORIES[0][1]) {
    for (const set of SETS) {
        const n = N.get(`${op}/${set}`);
        const o = OFF.get(`${op}/${set}`);
        if (!n || !o) {
            continue;
        }
        const xn = XNOW.get(`${op}/${set}`);
        const xo = XOFF.get(`${op}/${set}`);
        const b = B.get(`${op}/${set}`);
        const row = { op, set, tsRefUs: n.tsRefUs, onUs: n.rustApiUs, offUs: o.rustApiUs, deltaUs: n.rustApiUs - o.rustApiUs, ratio: n.rustApiUs / o.rustApiUs,
            onVsTs: n.apiVsTs, offVsTs: o.rustApiUs / n.tsRefUs, beforeOnVsTs: b?.apiVsTs, crossingsOn: xn?.crossings, crossingsOff: xo?.crossings };
        bc19.push(row);
        p(`| ${op} | ${op === 'mm_new' ? '(system models)' : SHORT[set]} | ${us(row.tsRefUs)} | ${us(row.onUs)} | ${us(row.offUs)} | ${us(row.deltaUs)} | ${f(row.ratio)} | ${f(row.onVsTs)} | ${f(row.offVsTs)} | ${f(row.beforeOnVsTs)} | ${f(row.crossingsOn, 1)} / ${f(row.crossingsOff, 1)} |`);
    }
}

// 8a. Typed read (P5-90 method).
const typedread = [];
if (TYPEDREAD && fs.existsSync(TYPEDREAD)) {
    const tsv = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => l.split('\t')) : []);
    const alloc = new Map(tsv(path.join(TYPEDREAD, 'native-alloc.tsv')).map((c) => [c[1], {
        allocs: Number(c[2].split(' ')[1]), reallocs: Number(c[3].split(' ')[1]), bytes: Number(c[4].split(' ')[1]), textBytes: Number(c[5].split(' ')[2]) }]));
    const times = {};
    const wasm = {};
    for (const r of [1, 2, 3]) {
        for (const c of tsv(path.join(TYPEDREAD, `native-time-${r}.tsv`))) {
            (times[c[1]] = times[c[1]] || []).push(Number(c[2]));
        }
        const j = path.join(TYPEDREAD, `typedread-${r}.json`);
        if (fs.existsSync(j)) {
            for (const x of JSON.parse(fs.readFileSync(j, 'utf8')).results) {
                (wasm[x.set] = wasm[x.set] || { stage: [], drop: [] });
                wasm[x.set].stage.push(x.stageUs);
                wasm[x.set].drop.push(x.dropUs);
            }
        }
    }
    const p596Alloc = { 'concerto-core-test-data': '34 / 18,593', conformance: '14 / 5,936', 'synthetic-large': '284 / 1,109,717' };
    p('\n## Typed read allocations (P5-90 method)\n');
    p('| set | input bytes | allocs | reallocs | bytes requested | P5-109 (allocs / bytes) | native read | WASM stage | WASM drop | WASM / native | TS 5.0.0 new ModelFile | native / TS |');
    p('|---|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|');
    for (const set of SETS) {
        const a = alloc.get(set) || {};
        const nat = med(times[set] || []);
        const st = med(wasm[set]?.stage || []);
        const dr = med(wasm[set]?.drop || []);
        const ts = N.get(`modelfile_new/${set}`)?.tsRefUs;
        const row = { set, ...a, nativeUs: nat, wasmStageUs: st, wasmDropUs: dr, tsModelFileUs: ts };
        typedread.push(row);
        p(`| ${set} | ${(a.textBytes ?? NaN).toLocaleString('en-US')} | ${a.allocs ?? '-'} | ${a.reallocs ?? '-'} | ${(a.bytes ?? NaN).toLocaleString('en-US')} | ${p596Alloc[set]} | ${f(nat)} us | ${f(st)} us | ${f(dr)} us | ${f(st / nat)} | ${f(ts, 1)} us | ${f(nat / ts)} |`);
    }
}

// 8b. Web bundle (P5-39 method).
let bundle = null;
if (BUNDLE && fs.existsSync(BUNDLE)) {
    bundle = JSON.parse(fs.readFileSync(BUNDLE, 'utf8'));
    const old = fs.existsSync(P596_BUNDLE) ? JSON.parse(fs.readFileSync(P596_BUNDLE, 'utf8')) : null;
    const trip = (x) => (x ? `${kb(x.raw)} / ${kb(x.gzip)} / ${kb(x.brotli)}` : '-');
    const res = (b, entry, keepNames, engine) => b?.results?.find((x) => x.entry === entry && x.keepNames === keepNames && x.engine === engine && !x.error);
    p('\n## Web bundle size (P5-39 method)\n');
    p('KB = 1000 B; gzip -9, brotli q11.\n');
    p('| entry | v5.0.0 raw / gz / br | engine raw / gz / br | engine x v5 (raw / gz / br) | P5-109 engine raw / gz / br |');
    p('|---|---|---|---|---|');
    const eng = bundle.results.map((x) => x.engine).find((e) => e !== 'v5.0.0');
    const engOld = old ? old.results.map((x) => x.engine).find((e) => e !== 'v5.0.0') : null;
    const combos = [...new Map(bundle.results.map((x) => [`${x.entry}|${x.keepNames}`, [x.entry, x.keepNames]])).values()]
        .sort((a, b) => Number(b[1]) - Number(a[1]) || a[0].localeCompare(b[0]));
    for (const [entry, keepNames] of combos) {
        const v5 = res(bundle, entry, keepNames, 'v5.0.0');
        const e = res(bundle, entry, keepNames, eng);
        const o = res(old, entry, keepNames, engOld);
        p(`| ${entry}${keepNames ? ', `keepNames`' : ', no `keepNames`'} | ${trip(v5)} | ${trip(e)} | ${e && v5 ? `${f(e.raw / v5.raw, 1)} / ${f(e.gzip / v5.gzip, 1)} / ${f(e.brotli / v5.brotli, 1)}` : '-'} | ${trip(o)} |`);
    }
    p('\n| part | raw / gz / br | P5-109 raw / gz / br |');
    p('|---|---|---|');
    for (const [label, k] of [['`.wasm`', 'wasm'], ['the same as base64', 'wasmBase64'], ['`concerto-engine.mjs` (glue + base64)', 'engineMjs']]) {
        p(`| ${label} | ${trip(bundle.parts[k])} | ${trip(old?.parts?.[k])} |`);
    }
    p(`| JS without the engine package (E1, keepNames) | ${trip(bundle.parts.jsWithoutEnginePkg['E1-keepnames'])} | ${trip(old?.parts?.jsWithoutEnginePkg?.['E1-keepnames'])} |`);
    p(`| \`concerto-engine.cjs\` (Node), raw | ${kb(bundle.parts.engineCjsRaw)} | ${kb(old?.parts?.engineCjsRaw)} |`);
}

const errs = [...rowsOut, ...added].filter((r) => r.errors.length);
if (errs.length) {
    p('\nErrors:');
    for (const r of errs) {
        p(`- ${r.op}/${r.set}: ${[...new Set(r.errors)].join('; ')}`);
    }
}

if (asJson) {
    const strip = ({ _n, _b, ...r }) => r;
    console.log(JSON.stringify({ nowRounds: now.rounds, beforeRounds: before.rounds, geomeans, rows: rowsOut.map(strip), added, introspection, gaps: gaps.map(strip), crossingsOfGaps, mmNew, bc19, typedread, bundle: bundle ? { parts: bundle.parts } : null }, null, 2));
} else {
    console.log(lines.join('\n'));
}
