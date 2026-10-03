#!/usr/bin/env node
// P5-90 (accordproject/concerto-rust#436), Phase 0, measure only: the WASM
// typed read alone, the engine call `new ModelFile` makes
// (`ModelManagerHandle.stageModelFileCheckedUtf8`, since P5-103
// `stageModelFileBytes` with flag 1: BC-19's folded shape check and the
// typed load, from the AST's UTF-8 bytes), timed straight on
// an engine module, with no concerto-core around it. Used to compare the
// shipped engine with a throwaway build on another global allocator.
//
//   node migration/bench/p590-typedread.mjs --engine <concerto-engine.cjs>
//       [--sets a,b] [--samples N] [--warmup N] [--out FILE]
//
// The UTF-8 bytes are encoded once, before timing. Each sample is one pass
// over a set's files: every file staged (timed as one block), then every
// stage dropped (`dropStagedModelFile`, timed apart). Figures are the
// median µs per file over the samples. Inputs: fixtures/p515/<set>.json,
// with the enum `isAbstract` key dropped as p515-sweep.mjs drops it.

import fs from 'fs';
import os from 'os';
import path from 'path';
import url from 'url';
import { createRequire } from 'module';
import { performance } from 'perf_hooks';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const a = { engine: null, sets: ['concerto-core-test-data', 'conformance', 'synthetic-large'], samples: 300, warmup: 30, out: null };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === '--engine') { a.engine = path.resolve(v()); }
    else if (k === '--sets') { a.sets = v().split(','); }
    else if (k === '--samples') { a.samples = Number(v()); }
    else if (k === '--warmup') { a.warmup = Number(v()); }
    else if (k === '--out') { a.out = v(); }
    else { throw new Error(`unknown argument: ${k}`); }
}
if (!a.engine) {
    throw new Error('--engine is required');
}
const rust = require(a.engine);
const enc = new TextEncoder();

function files(set) {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'p515', `${set}.json`), 'utf8'));
    return data.models.map(({ name, ast }) => {
        for (const d of ast.declarations || []) {
            if (d.$class === 'concerto.metamodel@1.0.0.EnumDeclaration') {
                delete d.isAbstract;
            }
        }
        return { name, bytes: enc.encode(JSON.stringify(ast)) };
    });
}

const median = (v) => [...v].sort((x, y) => x - y)[Math.floor(v.length / 2)];
const results = [];
for (const set of a.sets) {
    const fl = files(set);
    const h = new rust.ModelManagerHandle();
    const ids = new Array(fl.length);
    const stage = [];
    const drop = [];
    for (let s = 0; s < a.warmup + a.samples; s++) {
        const t0 = performance.now();
        for (let i = 0; i < fl.length; i++) {
            // P5-103 removed `stageModelFileCheckedUtf8`: the one staging
            // binding, from UTF-8 text, checked (flag 1), runs the same load
            // and returns the stage in the flat layout (`[id, ...header]`).
            ids[i] = h.stageModelFileBytes(fl[i].bytes, undefined, fl[i].name, 1);
        }
        const t1 = performance.now();
        for (let i = 0; i < fl.length; i++) {
            ids[i] = JSON.parse(ids[i])[0];
        }
        const t2 = performance.now();
        for (let i = 0; i < fl.length; i++) {
            h.dropStagedModelFile(ids[i]);
        }
        const t3 = performance.now();
        if (s >= a.warmup) {
            stage.push(((t1 - t0) * 1000) / fl.length);
            drop.push(((t3 - t2) * 1000) / fl.length);
        }
    }
    h.free();
    const row = { set, files: fl.length, bytesPerFile: Math.round(fl.reduce((x, f) => x + f.bytes.length, 0) / fl.length), stageUs: median(stage), dropUs: median(drop) };
    results.push(row);
    console.log(`${set.padEnd(24)} n=${String(fl.length).padStart(3)} stage ${row.stageUs.toFixed(2).padStart(9)} us/file  drop ${row.dropUs.toFixed(2).padStart(7)} us/file`);
}
const out = { tool: 'p590-typedread', engine: a.engine, engineBytes: fs.statSync(path.join(path.dirname(a.engine), 'concerto_wasm.wasm')).size, node: process.version, cpu: os.cpus()[0].model, loadavgEnd: os.loadavg(), samples: a.samples, warmup: a.warmup, results };
if (a.out) {
    fs.mkdirSync(path.dirname(a.out), { recursive: true });
    fs.writeFileSync(a.out, JSON.stringify(out, null, 2));
}
