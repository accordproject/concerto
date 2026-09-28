#!/usr/bin/env node
// P5-12b SPIKE (DO NOT MERGE; accordproject/concerto-rust#292): the cost of
// the error return. Times resource.validate() on invalid resources against
// the same resources made valid, and splits the invalid engine call into its
// parts, on run-ts.mjs workload 3's model (synthetic, 500).
//
//   CONCERTO_P512_VARIANT=B [CONCERTO_P512B_TRANSPORT=<t>] \
//     node migration/bench/p512b-error-profile.mjs [--out FILE]
//
// The `total` rows depend on the transport the env selects (unset = P5-12
// B's `validateResource`); the `engine` and `ts` rows call the bindings
// directly with precomputed inputs and are the same in every run. Each row
// is the median µs per resource over 30 samples of all 500 resources
// (5 warm-up). Every invalid call is caught with try/catch, as a caller
// would.
//
//   BENCH_CORE_DIST=<TS 5.0.0 dist> node migration/bench/p512b-error-profile.mjs
//
// runs only the `total` and `ts` rows, against that dist (the TS reference).

import fs from 'fs';
import os from 'os';
import path from 'path';
import url from 'url';
import { createRequire } from 'module';
import { timeit } from './lib/timeit.mjs';

process.env.CONCERTO_P512_VARIANT = process.env.CONCERTO_P512_VARIANT || 'B';
const REFERENCE = !!process.env.BENCH_CORE_DIST;
const TRANSPORT = REFERENCE ? 'ts-reference' : (process.env.CONCERTO_P512B_TRANSPORT || 'p512-B');
const require = createRequire(import.meta.url);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const DIST = process.env.BENCH_CORE_DIST || path.resolve(__dirname, '..', '..', 'packages', 'concerto-core', 'dist');
const load = (rel) => {
    const m = require(path.join(DIST, rel));
    return m.default ?? m;
};

const ModelManager = load('modelmanager.js');
const ValidationException = load('serializer/validationexception.js');
const engine = (rel) => (REFERENCE ? {} : require(path.join(DIST, 'engine', rel)));
const { handleFor } = engine('serializer.js');
const { encodeValue } = engine('serializer-codec.js');
const { rust } = engine('index.js');
const { p512bInternals: T } = engine('validate-transport.js');

const cto = `
namespace org.accordproject.bench.instance@1.0.0

concept Item identified by id {
  o String id
  o Integer sequence
  o Double weight optional
  o Boolean active
  o String[] labels optional
}
`;
const mm = new ModelManager();
mm.addCTOModel(cto, 'bench-instance.cto', true);
mm.validateModelFiles();
const serializer = mm.getSerializer();
const valid = [];
const invalid = [];
for (let i = 0; i < 500; i++) {
    const json = {
        $class: 'org.accordproject.bench.instance@1.0.0.Item',
        id: `item-${i}`,
        sequence: i,
        weight: i * 1.5,
        active: i % 2 === 0,
        labels: [`label-${i % 7}`, `tag-${i % 3}`],
    };
    valid.push(serializer.fromJSON(json));
    // The same resource with a string in the Integer field: a
    // ValidationException from the engine's validator.
    const bad = serializer.fromJSON(json);
    bad.sequence = `not-a-number-${i}`;
    invalid.push(bad);
}
const N = valid.length;
const opts = { warmup: 5, samples: 30, n: N };
const options = valid[0].$validator && valid[0].$validator.options;
const optsText = JSON.stringify(options ? {
    convertResourcesToRelationships: !!options.convertResourcesToRelationships,
    permitResourcesForRelationships: !!options.permitResourcesForRelationships,
} : null);

const rows = [];
function row(group, name, fn) {
    const r = timeit(() => {
        for (let i = 0; i < N; i++) {
            fn(i);
        }
    }, opts);
    rows.push({ group, name, us: Number((r.median_ms * 1000).toFixed(3)), cv: Number(r.cv.toFixed(3)) });
}
function expectThrow(fn) {
    try {
        fn();
    } catch (err) {
        return err;
    }
    throw new Error('expected a throw');
}

const sampleMessage = expectThrow(() => invalid[0].validate()).message;
valid.forEach((r) => r.validate());
invalid.forEach((r) => {
    const e = expectThrow(() => r.validate());
    if (!(e instanceof ValidationException)) {
        throw new Error(`not a ValidationException: ${e && e.constructor.name}`);
    }
});

// --- whole call, under this run's transport ---
row('total', `valid resource.validate() [${TRANSPORT}]`, (i) => valid[i].validate());
row('total', `invalid resource.validate(), caught [${TRANSPORT}]`, (i) => expectThrow(() => invalid[i].validate()));

if (!REFERENCE) {
    engineRows();
}

/**
 * The engine rows: direct binding calls with precomputed inputs.
 */
function engineRows() {
    const handle = handleFor(mm);
    const flags = T.flagsOf(options);
    // Precomputed inputs.
    const wireOk = valid.map((r) => JSON.stringify(encodeValue(r)));
    const wireBad = invalid.map((r) => JSON.stringify(encodeValue(r)));
    const bin = (r) => {
        const { bytes, len } = T.encodeBinary(r, false);
        return bytes.slice(0, len);
    };
    const binOk = valid.map(bin);
    const binBad = invalid.map(bin);
    const idOk = valid.map((r) => r.getFullyQualifiedIdentifier());
    const idBad = invalid.map((r) => r.getFullyQualifiedIdentifier());

    // Sanity: every invalid resource throws the same class and message on every
    // path, and none falls back to the visitor.
    const counter = globalThis.__p512;
    const before = counter ? counter.resourceFallbacks : 0;
    invalid.forEach((r, i) => {
        const whole = expectThrow(() => r.validate());
        const b = expectThrow(() => handle.validateResource(wireBad[i], optsText));
        const c = expectThrow(() => handle.validateResourceBinary(binBad[i], idBad[i], flags));
        const code = handle.validateResourceBinaryCode(binBad[i], idBad[i], flags);
        const msg = rust.p512bLastErrorMessage();
        for (const e of [whole, b, c]) {
            if (!(e instanceof ValidationException) || e.message !== whole.message) {
                throw new Error(`mismatch at ${i}: ${e && e.constructor.name}: ${e && e.message}`);
            }
        }
        if (code !== 1 || new ValidationException(msg).message !== whole.message) {
            throw new Error(`code path mismatch at ${i}: ${code} ${msg}`);
        }
        valid[i].validate();
        handle.validateResource(wireOk[i], optsText);
        if (handle.validateResourceBinaryCode(binOk[i], idOk[i], flags) !== 0) {
            throw new Error(`valid ${i} gave a code`);
        }
    });
    if (counter && counter.resourceFallbacks !== before) {
        throw new Error('a resource fell back to the visitor');
}

// --- P5-12 B's engine call ---
row('B', 'validateResource, valid', (i) => handle.validateResource(wireOk[i], optsText));
row('B', 'validateResource, invalid, caught (run + factory)', (i) => expectThrow(() => handle.validateResource(wireBad[i], optsText)));

// --- (c) binary engine call, and the error return split ---
row('c', 'validateResourceBinary, valid', (i) => handle.validateResourceBinary(binOk[i], idOk[i], flags));
row('c', 'validateResourceBinary, invalid, caught (run + factory)', (i) => expectThrow(() => handle.validateResourceBinary(binBad[i], idBad[i], flags)));
row('c-code', 'validateResourceBinaryCode, valid', (i) => handle.validateResourceBinaryCode(binOk[i], idOk[i], flags));
row('c-code', 'validateResourceBinaryCode, invalid: code only (error kept in the engine)', (i) => handle.validateResourceBinaryCode(binBad[i], idBad[i], flags));
row('c-code', '+ p512bLastErrorMessage (message rendered, crosses as a string)', (i) => {
    handle.validateResourceBinaryCode(binBad[i], idBad[i], flags);
    rust.p512bLastErrorMessage();
});
row('c-code', '+ throw new ValidationException(message), caught', (i) => expectThrow(() => {
    handle.validateResourceBinaryCode(binBad[i], idBad[i], flags);
    throw new ValidationException(rust.p512bLastErrorMessage());
}));
row('c-code', 'code, then p512bTakeError (the full factory path, deferred), caught', (i) => expectThrow(() => {
    handle.validateResourceBinaryCode(binBad[i], idBad[i], flags);
    throw rust.p512bTakeError();
}));
}

// --- TS alone ---
row('ts', 'throw new ValidationException(message), caught', () => expectThrow(() => {
    throw new ValidationException(sampleMessage);
}));
row('ts', 'throw new Error(message), caught', () => expectThrow(() => {
    throw new Error(sampleMessage);
}));
row('ts', 'message length (chars, not µs)', () => {});
rows[rows.length - 1].us = sampleMessage.length;

const out = {
    harness: 'p512b-error-profile.mjs',
    transport: TRANSPORT,
    recorded_at: new Date().toISOString(),
    node: process.version,
    cpus: os.cpus()?.[0]?.model,
    loadavg: os.loadavg(),
    sample_message: sampleMessage,
    rows,
};
for (const r of rows) {
    console.log(`| ${r.group} | ${r.name} | ${r.us} | ${(r.cv * 100).toFixed(1)}% |`);
}
const outArg = process.argv.indexOf('--out');
if (outArg > 0) {
    fs.writeFileSync(process.argv[outArg + 1], JSON.stringify(out, null, 2) + '\n');
}
