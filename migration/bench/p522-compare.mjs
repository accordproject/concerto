#!/usr/bin/env node
// P5-22 (accordproject/concerto-rust#326): the P5-15 sweep (#309) repeated
// after F1-F4, as a before/now table. Measure only.
//
//   node migration/bench/p522-compare.mjs <before.json> <now.json> [--json]
//
// Both inputs are `p515-report.mjs <out dir> --json` outputs: <before> of the
// P5-15 sweep's out dir, <now> of this sweep's. Each timed figure there is
// the median over the rounds of each round's median per item. "x TS" is
// always against the TS 5.0.0 reference timed in the same sweep, so machine
// drift between the two sweeps cancels out of the ratios.

import fs from 'fs';

const [beforeFile, nowFile, ...rest] = process.argv.slice(2);
if (!beforeFile || !nowFile) {
    console.error('usage: p522-compare.mjs <before.json> <now.json> [--json]');
    process.exit(2);
}
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const before = read(beforeFile);
const now = read(nowFile);
const key = (r) => `${r.op}/${r.set}`;
const beforeBy = new Map(before.rows.map((r) => [key(r), r]));

// Module family of each op (the report's crossings file names most, not the
// ops without a crossing count).
const FAMILY = {
    mm_new: 'load', modelfile_new: 'load', add_model_file: 'load', add_cto_model: 'load',
    from_json: 'serializer', to_json: 'serializer', new_resource: 'serializer',
    dcs_decorate: 'decorator', dcs_validate: 'decorator', extract_decorators: 'decorator', extract_vocabularies: 'decorator',
    get_type: 'introspect', resolve_type: 'introspect', get_decorators: 'introspect', get_namespaces: 'introspect',
    derives_from: 'introspect', is_assignable_to: 'introspect',
    validate: 'instance', set_property_value: 'instance', add_array_value: 'instance',
};

const rows = now.rows.map((n) => {
    const b = beforeBy.get(key(n));
    return {
        op: n.op, set: n.set, family: FAMILY[n.op] || n.family,
        tsRefUsBefore: b?.tsRefUs, tsRefUsNow: n.tsRefUs,
        crateUsBefore: b?.crateUs, crateUsNow: n.crateUs,
        crateVsTsBefore: b?.crateVsTs, crateVsTsNow: n.crateVsTs,
        crateRebuildVsTsBefore: b?.crateRebuildVsTs, crateRebuildVsTsNow: n.crateRebuildVsTs,
        apiUsBefore: b?.rustApiUs, apiUsNow: n.rustApiUs,
        apiVsTsBefore: b?.apiVsTs, apiVsTsNow: n.apiVsTs,
        // Same-sweep ratio change: < 1 = the Rust engine gained on TS.
        apiGain: b ? n.apiVsTs / b.apiVsTs : NaN,
        crateGain: b ? n.crateVsTs / b.crateVsTs : NaN,
        crossingsBefore: b?.crossingsPerItem, crossingsNow: n.crossingsPerItem,
        inEngineNow: n.inEngineShare,
        stagesNow: n.stages,
        nativeNow: n.native,
        topBindingsNow: n.topBindings,
        errors: n.errors,
    };
});
rows.sort((a, b) => (b.apiVsTsNow || 0) - (a.apiVsTsNow || 0));

if (rest.includes('--json')) {
    console.log(JSON.stringify({ beforeRounds: before.rounds, nowRounds: now.rounds, rows }, null, 2));
    process.exit(0);
}

const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const us = (x) => (Number.isFinite(x) ? (x >= 1000 ? `${(x / 1000).toFixed(2)} ms` : `${x.toFixed(x < 10 ? 2 : 1)} us`) : '-');
const pct = (x) => (Number.isFinite(x) ? `${Math.round(x)}%` : '-');
const arrow = (b, n) => (Number.isFinite(b) ? `${f(b)} -> ${f(n)}` : `new: ${f(n)}`);

console.log(`Before: P5-15 rounds ${before.rounds.join(', ')}. Now: rounds ${now.rounds.join(', ')}. ` +
    'x TS = Rust / TS 5.0.0 timed in the same sweep (> 1 = slower than TS). Ranked by x TS API now.\n');
console.log('| op | set | family | TS 5.0.0 now | crate now | x TS crate before -> now | TS API now | x TS API before -> now | ratio change | crossings/item before -> now | TS-API stages now | crate alloc+free / clone / hash now |');
console.log('|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|');
for (const r of rows) {
    const stages = r.stagesNow ? Object.entries(r.stagesNow).slice(0, 3).map(([k, v]) => `${k} ${v}%`).join(', ') : '-';
    const nat = r.nativeNow ? `${pct(r.nativeNow.allocFree)} / ${pct(r.nativeNow.clone)} / ${pct(r.nativeNow.hash)}${r.nativeNow.set !== r.set ? ` (${r.nativeNow.set})` : ''}` : '-';
    const cx = Number.isFinite(r.crossingsBefore) ? `${f(r.crossingsBefore, 1)} -> ${f(r.crossingsNow, 1)}` : f(r.crossingsNow, 1);
    const change = Number.isFinite(r.apiGain) ? `${r.apiGain < 1 ? '-' : '+'}${Math.abs(100 * (r.apiGain - 1)).toFixed(0)}%` : '-';
    console.log(`| ${r.op} | ${r.set} | ${r.family} | ${us(r.tsRefUsNow)} | ${us(r.crateUsNow)} | ${arrow(r.crateVsTsBefore, r.crateVsTsNow)} | ${us(r.apiUsNow)} | ${arrow(r.apiVsTsBefore, r.apiVsTsNow)} | ${change} | ${cx} | ${stages} | ${nat} |`);
}
const errs = rows.filter((r) => r.errors?.length);
if (errs.length) {
    console.log('\nErrors:');
    for (const r of errs) {
        console.log(`- ${r.op}/${r.set}: ${[...new Set(r.errors)].join('; ')}`);
    }
}
