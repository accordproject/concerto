#!/usr/bin/env node
// P5-12b SPIKE (DO NOT MERGE; accordproject/concerto-rust#292): the
// per-stage cost split of P5-12 variant B's `validateResource` call, and of
// each candidate transport, on run-ts.mjs workload 3 (synthetic, 500).
//
//   CONCERTO_P512_VARIANT=B node migration/bench/p512b-profile.mjs [--out FILE]
//
// Each row is the median µs per resource over 30 samples of all 500
// resources (5 warm-up), as run-ts.mjs times them. Stages are measured by
// running the engine's profiling bindings (concerto-wasm src/p512b.rs) with
// precomputed inputs, so a row costs only what it names.

import fs from 'fs';
import os from 'os';
import path from 'path';
import url from 'url';
import { createRequire } from 'module';
import { timeit } from './lib/timeit.mjs';

process.env.CONCERTO_P512_VARIANT = process.env.CONCERTO_P512_VARIANT || 'B';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const DIST = path.resolve(__dirname, '..', '..', 'packages', 'concerto-core', 'dist');

const mmMod = require(path.join(DIST, 'modelmanager.js'));
const ModelManager = mmMod.default ?? mmMod;
const { handleFor, syncIdentifiers } = require(path.join(DIST, 'engine', 'serializer.js'));
const { encodeValue } = require(path.join(DIST, 'engine', 'serializer-codec.js'));
const { p512bInternals: T } = require(path.join(DIST, 'engine', 'validate-transport.js'));

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
const resources = [];
for (let i = 0; i < 500; i++) {
    resources.push(serializer.fromJSON({
        $class: 'org.accordproject.bench.instance@1.0.0.Item',
        id: `item-${i}`,
        sequence: i,
        weight: i * 1.5,
        active: i % 2 === 0,
        labels: [`label-${i % 7}`, `tag-${i % 3}`],
    }));
}
const N = resources.length;
const opts = { warmup: 5, samples: 30, n: N };
const handle = handleFor(mm);
const options = resources[0].$validator && resources[0].$validator.options;
const encoder = new TextEncoder();

const rows = [];
function row(group, name, fn) {
    const r = timeit(() => {
        for (let i = 0; i < N; i++) {
            fn(i);
        }
    }, opts);
    const us = r.median_ms * 1000;
    rows.push({ group, name, us: Number(us.toFixed(3)), cv: Number(r.cv.toFixed(3)) });
}

// Precomputed inputs.
const wire = resources.map((r) => JSON.stringify(encodeValue(r)));
const optsText = JSON.stringify(options ? {
    convertResourcesToRelationships: !!options.convertResourcesToRelationships,
    permitResourcesForRelationships: !!options.permitResourcesForRelationships,
} : null);
const trees = resources.map((r) => T.toTree(r, new Set(), false));
const texts = trees.map((t) => JSON.stringify(t));
const ids = resources.map((r, i) => T.rootId(r, trees[i].$class));
const flags = T.flagsOf(options);
const binaries = resources.map((r) => {
    const { bytes, len } = T.encodeBinary(r, false);
    return bytes.slice(0, len);
});

// Sanity: every candidate accepts every resource.
resources.forEach((r, i) => {
    handle.validateResource(wire[i], optsText);
    handle.validateResourceJson(texts[i], ids[i], flags);
    handle.validateResourceObject(T.toTree(r, new Set(), true), ids[i], flags);
    handle.validateResourceBinary(binaries[i], ids[i], flags);
});

// --- whole call, as validate() runs it (CONCERTO_P512_VARIANT=B) ---
row('total', 'resource.validate() (P5-12 B, full)', (i) => resources[i].validate());

// --- P5-12 variant B, per stage ---
row('B', 'handleFor(modelManager)', () => handleFor(mm));
row('B', 'TS encode: JSON.stringify(encodeValue(r)) + options', (i) => {
    JSON.stringify(encodeValue(resources[i]));
    JSON.stringify(options ? {
        convertResourcesToRelationships: !!options.convertResourcesToRelationships,
        permitResourcesForRelationships: !!options.permitResourcesForRelationships,
    } : null);
});
row('B', 'getFullyQualifiedType() (inside encode)', (i) => resources[i].getFullyQualifiedType());
for (const [stage, label] of [
    [0, 'call + JS->WASM copy of both strings'],
    [1, '+ serde_json parse to Value'],
    [2, '+ decode_wire to JsValue'],
    [3, '+ options decode + to_validator_value'],
    [4, '+ validate_instance_from (= validateResource)'],
]) {
    row('B', `engine stage ${stage}: ${label}`, (i) => handle.p512bStage(wire[i], optsText, stage));
}
row('B', 'syncIdentifiers(r)', (i) => syncIdentifiers(resources[i]));
row('B', 'wire text length (chars, not µs)', () => {});
rows[rows.length - 1].us = wire[0].length;

// --- floors ---
row('floor', 'empty engine call (p512bStageJson("", 0))', () => handle.p512bStageJson('', 0));
handle.p512bPrepare(texts[0]);
row('floor', 'validator alone in WASM (prepared Value) + call', () => handle.p512bValidatePrepared(ids[0], flags));

// --- (a) validator-shaped JSON ---
row('a', 'TS encode: toTree + JSON.stringify + rootId', (i) => {
    const t = T.toTree(resources[i], new Set(), false);
    JSON.stringify(t);
    T.rootId(resources[i], t.$class);
});
row('a', 'engine: call + copy', (i) => handle.p512bStageJson(texts[i], 0));
row('a', 'engine: + parse to Value', (i) => handle.p512bStageJson(texts[i], 1));
row('a', 'engine: parse to IgnoredAny instead ((d) floor)', (i) => handle.p512bStageJson(texts[i], 2));
row('a', 'engine: validateResourceJson (full)', (i) => handle.validateResourceJson(texts[i], ids[i], flags));
row('a', 'text length (chars, not µs)', () => {});
rows[rows.length - 1].us = texts[0].length;

// --- (a+e) JSON into the reused engine buffer ---
row('a+e', 'encodeInto scratch', (i) => {
    const view = T.scratchFor(texts[i].length * 3);
    encoder.encodeInto(texts[i], view);
});
row('a+e', 'engine: validateResourceJsonScratch (full)', (i) => {
    const view = T.scratchFor(texts[i].length * 3);
    const { written } = encoder.encodeInto(texts[i], view);
    handle.validateResourceJsonScratch(written, ids[i], flags);
});

// --- (b) serde-wasm-bindgen ---
const objTrees = resources.map((r) => T.toTree(r, new Set(), true));
row('b', 'TS encode: toTree (checkString on)', (i) => T.toTree(resources[i], new Set(), true));
row('b', 'engine: validateResourceObject (full)', (i) => handle.validateResourceObject(objTrees[i], ids[i], flags));

// --- (c) binary ---
row('c', 'TS encode: one-pass binary', (i) => T.encodeBinary(resources[i], false));
row('c', 'engine: validateResourceBinary (full, copy in)', (i) => handle.validateResourceBinary(binaries[i], ids[i], flags));
row('c+e', 'TS encode: one-pass binary into engine buffer', (i) => T.encodeBinary(resources[i], true));
row('c+e', 'engine: validateResourceBinaryScratch (full)', (i) => {
    const { len } = T.encodeBinary(resources[i], true);
    handle.validateResourceBinaryScratch(len, ids[i], flags);
});
row('c', 'binary length (bytes, not µs)', () => {});
rows[rows.length - 1].us = binaries[0].length;

const out = {
    harness: 'p512b-profile.mjs',
    recorded_at: new Date().toISOString(),
    node: process.version,
    cpus: os.cpus()?.[0]?.model,
    loadavg: os.loadavg(),
    rows,
};
for (const r of rows) {
    console.log(`| ${r.group} | ${r.name} | ${r.us} | ${(r.cv * 100).toFixed(1)}% |`);
}
const outArg = process.argv.indexOf('--out');
if (outArg > 0) {
    fs.writeFileSync(process.argv[outArg + 1], JSON.stringify(out, null, 2) + '\n');
}
