#!/usr/bin/env node
// P5-78 spike (accordproject/concerto-rust#420), item 6 (extended): the
// Concertino validator as a third runner over every recorded
// `Serializer.fromJSON` call of the oracle corpus (2,080 fixtures, the
// conformance driver's 36 among them), against R1 itself.
//
//   node migration/spikes/P5-78/bin/oracle-instances.mjs [--fixtures DIR] [--out FILE] [--source S]
//
// For each fixture: the recorded model manager and serializer are rebuilt
// with the R1 concerto-core (this checkout's packages/concerto-core/dist,
// the WASM engine underneath) through the oracle's own decoder. The
// reference outcome is R1's `fromJSON(json, options)` then `toJSON(result,
// options)`; R1 is the reference (not the recorded v5 outcome) because the
// prototype follows R1 semantics, BC rows included.
//
// The prototype runs twice:
//   A  model from R1: ModelManager.getAst(true) -> Concertino -> validate/normalise
//      (isolates the validator from the resolver);
//   B  browser pipeline: ModelManager.getAst(false) (the parser's ASTs) ->
//      resolveModels -> Concertino -> validate/normalise.
// Verdicts: same (both ok with the same canonical JSON, or both throw the
// same exception class), or the kind of difference. Generated identifiers
// (uuid) and generated timestamps are canonicalised, as the oracle judge does.
import fs from 'fs';
import path from 'path';
import url from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const SPIKE = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const REPO = path.resolve(SPIKE, '..', '..', '..');
const ORACLE = path.join(REPO, 'migration', 'oracle');
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const FIXTURES = path.resolve(opt('--fixtures', process.env.CONCERTO_ORACLE_FIXTURES || '/home/user/concerto/migration/oracle/fixtures'));
const OUT = opt('--out', path.join(SPIKE, 'results', 'oracle-instances.json'));
const ONLY = opt('--source', null);

const { loadCore, loadEntryPoint } = require(path.join(ORACLE, 'lib', 'core.js'));
const codec = require(path.join(ORACLE, 'lib', 'codec.js'));
const { opTable } = require(path.join(ORACLE, 'lib', 'ops.js'));
const { blobStore } = require(path.join(ORACLE, 'lib', 'store.js'));
const S = require(path.join(SPIKE, 'build', 'node-all.cjs'));

const core = loadCore(path.join(REPO, 'packages', 'concerto-core', 'dist'), 'R1 dist');
loadEntryPoint(core);
const ops = opTable(core);
const runDerived = (op, inputs) => {
    const spec = ops.get(op);
    const dctx = { mms: new Map() };
    const target = spec.kind === 'method' ? decode(inputs.target, dctx) : undefined;
    return spec.exec(core, target, inputs.args.map((a) => decode(a, dctx)));
};
const decode = codec.makeDecoder(core, runDerived);
const store = blobStore(path.join(FIXTURES, 'blobs'));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function canon(v, now) {
    if (Array.isArray(v)) {
        return v.map((x) => canon(x, now));
    }
    if (v && typeof v === 'object') {
        return Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k], now)]));
    }
    if (typeof v === 'string') {
        if (UUID.test(v)) {
            return '<uuid>';
        }
        const t = Date.parse(v);
        if (/^\d{4}-\d{2}-\d{2}T/.test(v) && Math.abs(t - now) < 120000) {
            return '<now>';
        }
    }
    return v;
}
const errClass = (e) => (e && (e.errorClass || (e.constructor && e.constructor.name !== 'Error' ? e.constructor.name : e.name))) || 'Error';
const msg = (e) => String(e && e.message).slice(0, 240);

function outcomeOf(f) {
    const now = Date.now();
    try {
        return { ok: canon(f(), now) };
    } catch (e) {
        return { error: errClass(e), message: msg(e) };
    }
}
const same = (a, b) => (a.ok && b.ok ? JSON.stringify(a.ok) === JSON.stringify(b.ok) : !!(a.error && b.error && a.error === b.error));
function verdict(ref, p) {
    if (same(ref, p)) {
        return 'same';
    }
    if (ref.ok && p.ok) {
        return 'value-differs';
    }
    if (ref.error && p.error) {
        return 'class-differs';
    }
    return ref.ok ? 'prototype-throws' : 'prototype-accepts';
}

const sources = ['conformance', 'unit', 'data', 'gaps', 'lifted', 'supplement'].filter((s) => !ONLY || s === ONLY);
const rows = [];
const tally = {};
for (const source of sources) {
    const dir = path.join(FIXTURES, source, 'Serializer.fromJSON');
    if (!fs.existsSync(dir)) {
        continue;
    }
    for (const file of fs.readdirSync(dir).sort()) {
        const fx = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
        const inputs = store.unpack(fx.inputs);
        let serializer;
        let args;
        try {
            const dctx = { mms: new Map() };
            serializer = decode(inputs.target, dctx);
            args = inputs.args.map((a) => decode(a, dctx));
        } catch (e) {
            rows.push({ source, id: fx.id, route: 'setup', verdict: 'model-not-loadable', ref: { error: errClass(e), message: msg(e) } });
            tally[source] = tally[source] || {};
            tally[source]['model-not-loadable'] = (tally[source]['model-not-loadable'] || 0) + 1;
            continue;
        }
        const mm = serializer.modelManager;
        // A plain-JSON validator only takes what JSON can carry: an input holding a
        // Date, a Resource, undefined or a non-finite number is not applicable.
        const plainJson = (() => {
            const walk = (v) => v === null || ['string', 'boolean'].includes(typeof v) || (typeof v === 'number' && Number.isFinite(v))
                || (Array.isArray(v) && v.every(walk))
                || (typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype && Object.values(v).every(walk));
            return walk(args[0]);
        })();
        if (!plainJson) {
            rows.push({ source, id: fx.id, test: fx.source_test, route: 'setup', verdict: 'not-plain-json' });
            tally[source] = tally[source] || {};
            tally[source]['not-plain-json'] = (tally[source]['not-plain-json'] || 0) + 1;
            continue;
        }
        const options = { ...serializer.defaultOptions, ...(args[1] && typeof args[1] === 'object' ? args[1] : {}) };
        const ref = outcomeOf(() => serializer.toJSON(serializer.fromJSON(args[0], args[1]), args[1]));
        tally[source] = tally[source] || {};
        const refKey = ref.ok ? 'R1 accepts' : `R1 throws ${ref.error}`;
        tally[source][refKey] = (tally[source][refKey] || 0) + 1;
        const docs = {};
        try {
            docs.A = S.convertToConcertino(mm.getAst(true));
        } catch (e) {
            docs.A = e;
        }
        try {
            const r = S.resolver.resolveModels(mm.getAst(false));
            docs.B = r.diagnostics.length ? Object.assign(new Error('resolver: ' + r.diagnostics[0].message), { errorClass: 'Resolver' }) : S.convertToConcertino(r.models);
        } catch (e) {
            docs.B = e;
        }
        for (const route of ['A', 'B']) {
            const doc = docs[route];
            const p = doc instanceof Error
                ? { error: 'Converter', message: msg(doc) }
                : outcomeOf(() => S.validator.normalise(S.query.load(doc), args[0], options));
            const v = verdict(ref, p);
            tally[source] = tally[source] || {};
            const key = `${route}:${v}`;
            tally[source][key] = (tally[source][key] || 0) + 1;
            if (v !== 'same') {
                rows.push({ source, id: fx.id, test: fx.source_test, route, verdict: v, options, input: args[0], ref, prototype: p });
            }
        }
    }
}
const total = {};
for (const t of Object.values(tally)) {
    for (const [k, n] of Object.entries(t)) {
        total[k] = (total[k] || 0) + n;
    }
}
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ tool: 'oracle-instances', fixtures: FIXTURES, reference: 'R1 concerto-core dist + WASM engine', total, tally, differences: rows }, null, 1));
console.log(JSON.stringify({ total, tally }, null, 1));
