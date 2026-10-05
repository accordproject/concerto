#!/usr/bin/env node
// P5-131 (accordproject/concerto-rust#508): the tables of
// p5131-extras-run.sh's results: Concertino speed and toConcertino, the
// Concertino bundles, the engine's load time in Node, its shipped sizes and
// its browser cost. Measure only.
//
//   node migration/bench/p5131-extras-table.mjs [OUT] [--json]
//
// OUT defaults to migration/bench/results/P5-131. Every timed figure is the
// median of the rounds' medians (Concertino) or of the fresh processes /
// browser contexts (load, browser).

import fs from 'fs';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const OUT = argv[0] && !argv[0].startsWith('--') ? argv[0] : path.join(__dirname, 'results', 'P5-131');
const asJson = argv.includes('--json');
const SETS = ['concerto-core-test-data', 'conformance', 'synthetic-large'];
const SHORT = { 'concerto-core-test-data': 'core-test-data', conformance: 'conformance', 'synthetic-large': 'synthetic-large' };

const read = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null);
const median = (xs) => {
    const v = xs.filter(Number.isFinite).sort((a, b) => a - b);
    return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : NaN;
};
const f = (x, d = 2) => (Number.isFinite(x) ? x.toFixed(d) : '-');
const us = (x) => (Number.isFinite(x) ? (x >= 1000 ? `${(x / 1000).toFixed(2)} ms` : `${x.toFixed(x < 10 ? 2 : 1)} us`) : '-');
const kb = (x) => (Number.isFinite(x) ? (x / 1000).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '-');
const trip = (x) => (x ? `${kb(x.raw)} / ${kb(x.gzip)} / ${kb(x.brotli)}` : '-');
const lines = [];
const p = (s = '') => lines.push(s);
const json = {};

// 1. Concertino speed.
const C = path.join(OUT, 'concertino');
const sideRounds = (side) => [1, 2, 3].map((r) => read(path.join(C, `${side}-${r}.json`))).filter(Boolean);
const fig = (side, op, set) => median(sideRounds(side).map((x) => x.results.find((y) => y.op === op && y.set === set)?.medianUs));
const n = (side, op, set) => sideRounds(side).map((x) => x.results.find((y) => y.op === op && y.set === set)?.n).find(Number.isFinite);
if (sideRounds('concertino').length) {
    json.concertino = { validate: [], runtime: [], toConcertino: [] };
    p('## Concertino: `./validate` and `./runtime` against concerto-core');
    p('');
    p('us per item, the median of three rounds\' medians, each side in its own process. "engine" is this integration head\'s concerto-core over the Rust engine; TS 5.0.0 the published concerto-core. Validation reads the same documents everywhere: the p515 instances `./validate` accepts (the count below), populated and validated; `./validate` `validate(m, json)` against `Serializer.fromJSON` (which validates) and `ModelManager.validateInstance`.');
    p('');
    p('| set | instances | `./validate` | engine fromJSON | engine validateInstance | TS 5.0.0 fromJSON | `./validate` x engine fromJSON | `./validate` x TS 5.0.0 | engine fromJSON x TS 5.0.0 |');
    p('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
    for (const set of SETS) {
        const inst = read(path.join(C, `${set}.instances.json`));
        const c = fig('concertino', 'validate', set);
        const e = fig('now', 'validate', set);
        const vi = fig('now', 'validate_instance', set);
        const t = fig('ts5', 'validate', set);
        json.concertino.validate.push({ set, instances: inst?.ok.length, total: inst?.total, concertinoUs: c, engineFromJsonUs: e, engineValidateInstanceUs: vi, ts5Us: t });
        p(`| ${SHORT[set]} | ${inst ? `${inst.ok.length} of ${inst.total}` : '-'} | ${us(c)} | ${us(e)} | ${us(vi)} | ${us(t)} | ${f(c / e)} | ${f(c / t)} | ${f(e / t)} |`);
    }
    p('');
    p('Introspection over each set\'s `pairs` (P5-96\'s introspection items): `./runtime` getType, derivesFrom, isAssignableTo and getProperties on the loaded document, against `ModelManager.getType`, `derivesFrom`, `isAssignableTo` and `getType(fqn).getProperties()`.');
    p('');
    p('| op | set | items | `./runtime` | engine | TS 5.0.0 | `./runtime` x engine | `./runtime` x TS 5.0.0 | engine x TS 5.0.0 |');
    p('|---|---|---:|---:|---:|---:|---:|---:|---:|');
    for (const op of ['get_type', 'derives_from', 'is_assignable_to', 'get_properties']) {
        for (const set of SETS) {
            const c = fig('concertino', op, set);
            const e = fig('now', op, set);
            const t = fig('ts5', op, set);
            json.concertino.runtime.push({ op, set, n: n('concertino', op, set), concertinoUs: c, engineUs: e, ts5Us: t });
            p(`| ${op} | ${SHORT[set]} | ${n('concertino', op, set) ?? '-'} | ${us(c)} | ${us(e)} | ${us(t)} | ${f(c / e)} | ${f(c / t)} | ${f(e / t)} |`);
        }
    }
    p('');
    const prep = fs.existsSync(path.join(C, 'prep.txt')) ? fs.readFileSync(path.join(C, 'prep.txt'), 'utf8') : '';
    p('`ModelManager.toConcertino()` of a manager of each set\'s models (P5-129), and `./runtime` `load` of the document it gives:');
    p('');
    p('| set | model files | document bytes | declarations | toConcertino per set | per model file | `load` per document |');
    p('|---|---:|---:|---:|---:|---:|---:|');
    for (const set of SETS) {
        const m = new RegExp(`^${set}: document (\\d+) bytes, (\\d+) declarations`, 'm').exec(prep);
        const files = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'p515', `${set}.json`), 'utf8')).models.length;
        const tc = fig('now', 'to_concertino', set);
        const ld = fig('concertino', 'load', set);
        json.concertino.toConcertino.push({ set, files, docBytes: m ? Number(m[1]) : null, declarations: m ? Number(m[2]) : null, toConcertinoUs: tc, loadUs: ld });
        p(`| ${SHORT[set]} | ${files} | ${m ? Number(m[1]).toLocaleString('en-US') : '-'} | ${m ? m[2] : '-'} | ${us(tc)} | ${us(tc / files)} | ${us(ld)} |`);
    }
    p('');
}

// 2. Concertino bundles.
const cb = read(path.join(C, 'bundle-sizes.json'));
if (cb) {
    json.concertinoBundles = cb;
    p('## Concertino browser bundles (packages/concertino/scripts/bundleSizes.js)');
    p('');
    p('Every export of the subpath\'s browser build, bundled with esbuild (ESM, browser, minified, es2022); KB = 1000 B, gzip -9. No engine and no concerto-core in any of them.');
    p('');
    p('| bundle | raw KB | gzip KB | `new Function` |');
    p('|---|---:|---:|---|');
    for (const r of cb) {
        p(`| \`${r.subpath}\` | ${kb(r.raw)} | ${kb(r.gzip)} | ${r.newFunction ? 'yes' : 'no'} |`);
    }
    p('');
}

// 3. Node load time.
const ln = read(path.join(OUT, 'load', 'node.json'));
if (ln) {
    json.load = ln.results.map(({ samples, ...r }) => r);
    const get = (side, kind) => ln.results.find((r) => r.side === side && r.kind === kind);
    p('## Engine load time in Node (P5-44: raw .wasm against the base64 inline)');
    p('');
    p(`Each figure is the median of ${ln.reps} fresh processes (the cases interleaved, the order rotated every repetition), from the first require/import to the first \`new ModelManager()\` (concerto-core) or \`new ModelManagerHandle()\` (the engine alone) returning; "load" stops when the require/import (and, for the ESM engine loader, \`init()\`) returns. Node ${ln.node}. Before is P5-121's now heads (the .wasm inlined as base64 in concerto-engine.cjs and .mjs).`);
    p('');
    p('| case | before: first (load) ms | **now: first (load) ms** | now / before | now min-max ms | TS 5.0.0 first (load) ms | now x TS 5.0.0 |');
    p('|---|---:|---:|---:|---|---:|---:|');
    const labels = { 'core-require': '`require` concerto-core, first ModelManager', 'core-import': '`import` concerto-core (ESM), first ModelManager', 'engine-require': '`require` concerto-engine.cjs, first handle', 'engine-import': '`import` the Node ESM loader, first handle' };
    for (const kind of ['core-require', 'core-import', 'engine-require', 'engine-import']) {
        const nw = get('now', kind);
        const b = get('before', kind);
        const t = get('ts5', kind);
        p(`| ${labels[kind]} | ${b ? `${f(b.firstMs, 1)} (${f(b.loadMs, 1)})` : '-'} | **${nw ? `${f(nw.firstMs, 1)} (${f(nw.loadMs, 1)})` : '-'}** | ${f(nw?.firstMs / b?.firstMs)} | ${nw ? `${f(nw.firstMsMin, 1)}-${f(nw.firstMsMax, 1)}` : '-'} | ${t ? `${f(t.firstMs, 1)} (${f(t.loadMs, 1)})` : '-'} | ${f(nw?.firstMs / t?.firstMs)} |`);
    }
    p('');
}

// 4. Shipped sizes.
const sz = read(path.join(OUT, 'load', 'sizes.json'));
if (sz) {
    json.sizes = sz;
    p('## Shipped engine files (concerto-wasm/pkg)');
    p('');
    p('KB = 1000 B; gzip -9, brotli q11. Before is P5-121\'s now head.');
    p('');
    p('| file | before raw / gz / br | **now raw / gz / br** |');
    p('|---|---|---|');
    const names = [...new Set([...Object.keys(sz.before?.files || {}), ...Object.keys(sz.now?.files || {})])].sort();
    for (const name of names) {
        p(`| \`${name}\` | ${trip(sz.before?.files[name])} | **${trip(sz.now?.files[name])}** |`);
    }
    const sum = (files, pick) => {
        const xs = Object.entries(files || {}).filter(([k]) => pick(k)).map(([, v]) => v);
        return xs.length ? { raw: xs.reduce((a, x) => a + x.raw, 0), gzip: xs.reduce((a, x) => a + x.gzip, 0), brotli: xs.reduce((a, x) => a + x.brotli, 0) } : null;
    };
    const notTypes = (k) => !k.endsWith('.d.ts') && !k.endsWith('package.json');
    p(`| all files but .d.ts and package.json | ${trip(sum(sz.before?.files, notTypes))} | **${trip(sum(sz.now?.files, notTypes))}** |`);
    p(`| what Node loads (concerto-engine.cjs, plus the .wasm now) | ${trip(sum(sz.before?.files, (k) => k === 'concerto-engine.cjs'))} | **${trip(sum(sz.now?.files, (k) => k === 'concerto-engine.cjs' || k === 'concerto_wasm.wasm'))}** |`);
    p(`| what a browser fetches (before: concerto-engine.mjs; now: the loader, the glue and the .wasm) | ${trip(sum(sz.before?.files, (k) => k === 'concerto-engine.mjs'))} | **${trip(sum(sz.now?.files, (k) => k === 'concerto-engine.mjs' || k === 'web/concerto_wasm.js' || k === 'concerto_wasm.wasm'))}** |`);
    p('');
}

// 5. Browser.
const br = read(path.join(OUT, 'browser', 'browser.json'));
if (br) {
    json.browser = br.results.map(({ samples, ...r }) => r);
    const get = (c) => br.results.find((r) => r.case === c);
    p('## Browser engine load, headless Chromium (P5-45)');
    p('');
    p(`Chromium ${br.browser} (Playwright's headless shell), ${br.reps} fresh browser contexts per case (empty cache), the cases interleaved; ms, medians. Files served from 127.0.0.1 with no caching, so network time is near zero.`);
    p('');
    p('| case | import | init() | first handle / answer | total |');
    p('|---|---:|---:|---:|---:|');
    const mn = get('main-now');
    const mb = get('main-before');
    const wk = get('worker-now');
    if (mb) {
        p(`| main thread, before: \`import\` (base64 decode and synchronous compile inside it), first ModelManagerHandle | ${f(mb.importMs, 1)} | - | ${f(mb.firstMs - mb.importMs - mb.initMs, 1)} | ${f(mb.firstMs, 1)} |`);
    }
    if (mn) {
        p(`| main thread, now: \`import\` the loader, \`await init()\` (fetch and compile the raw .wasm), first ModelManagerHandle | ${f(mn.importMs, 1)} | ${f(mn.initMs, 1)} | ${f(mn.firstMs - mn.importMs - mn.initMs, 1)} | **${f(mn.firstMs, 1)}** |`);
    }
    if (wk) {
        p(`| the worker recipe, now (bundle ${kb(br.workerBundleBytes)} KB minified): \`new Worker\` to the first answer (init(), first ModelManager, addCTOModel, fromJSON) | - | ${f(wk.initMs, 1)} (first - second) | second answer ${f(wk.secondMs, 1)} | **${f(wk.firstMs, 1)}** |`);
    }
    p('');
}

if (asJson) {
    console.log(JSON.stringify(json, null, 2));
} else {
    console.log(lines.join('\n'));
}
