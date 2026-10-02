#!/usr/bin/env node
// P5-90 (accordproject/concerto-rust#436), Phase 0, measure only: V8 CPU
// profiles of the four TS-API load ops, for p590-split.mjs. The ops are
// p515-sweep.mjs's (`modelfile_new`, `add_model_file`, `add_cto_model`,
// `extract_cold`), run the same way, but the profiler (node:inspector) is
// on only while the op runs: `extract_cold` needs a fresh decorated
// manager per call, and those are built between profiled stretches (a
// batch at a time), so neither their build nor most of its garbage is in
// the profile.
//
//   node --expose-gc migration/bench/p590-profile.mjs --op <op> --set <set> --out <dir>
//       [--core-dist DIR] [--seconds S] [--interval US] [--batch N]
//
// Writes <dir>/<op>-<set>-<k>.cpuprofile, one per profiled stretch, and
// prints the calls made. CONCERTO_ENGINE_MODULE picks the engine (a named
// build from p590-engine-build.sh, so the WASM frames have names).

import fs from 'fs';
import path from 'path';
import url from 'url';
import inspector from 'inspector';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const a = { coreDist: path.join(REPO_ROOT, 'packages', 'concerto-core', 'dist'), op: null, set: null, out: null, seconds: 15, interval: 50, batch: 20 };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === '--core-dist') { a.coreDist = path.resolve(v()); }
    else if (k === '--op') { a.op = v(); }
    else if (k === '--set') { a.set = v(); }
    else if (k === '--out') { a.out = path.resolve(v()); }
    else if (k === '--seconds') { a.seconds = Number(v()); }
    else if (k === '--interval') { a.interval = Number(v()); }
    else if (k === '--batch') { a.batch = Number(v()); }
    else { throw new Error(`unknown argument: ${k}`); }
}

const core = require(path.join(a.coreDist, 'index.js'));
const { ModelManager, ModelFile, DecoratorManager } = core;

// As p515-sweep.mjs `loadSet`: the enum `isAbstract` key dropped.
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'p515', `${a.set}.json`), 'utf8'));
for (const model of data.models || []) {
    for (const decl of model.ast.declarations || []) {
        if (decl.$class === 'concerto.metamodel@1.0.0.EnumDeclaration') {
            delete decl.isAbstract;
        }
    }
}

function managerOf(models) {
    const mm = new ModelManager();
    for (const { name, ast } of models) {
        mm.addModelFile(new ModelFile(mm, ast, undefined, name));
    }
    return mm;
}

// Each op: a batch of inputs (built unprofiled), then one call per input.
const OPS = {
    modelfile_new: {
        batch: () => [new ModelManager()],
        run: (mm) => {
            for (const { name, ast } of data.models) {
                new ModelFile(mm, ast, undefined, name);
            }
        },
        reuse: true,
    },
    add_model_file: { batch: () => [null], run: () => managerOf(data.models), reuse: true },
    add_cto_model: {
        batch: () => [null],
        run: () => {
            const mm = new ModelManager();
            for (const { name, cto } of data.models) {
                mm.addCTOModel(cto, name);
            }
            return mm;
        },
        reuse: true,
    },
    extract_cold: {
        batch: () => {
            const out = [];
            for (let i = 0; i < a.batch; i++) {
                out.push(DecoratorManager.decorateModels(managerOf(data.models.filter((m) => data.dcsModels.includes(m.name))), data.dcs, { validate: true }));
            }
            return out;
        },
        run: (mm) => DecoratorManager.extractDecorators(mm, { removeDecoratorsFromModel: true, locale: 'en' }),
        reuse: false,
    },
};
const def = OPS[a.op];
if (!def) {
    throw new Error(`unknown op ${a.op}`);
}

const session = new inspector.Session();
session.connect();
const post = (method, params) => {
    let result;
    let error;
    session.post(method, params || {}, (e, r) => {
        error = e;
        result = r;
    });
    if (error) {
        throw error;
    }
    return result;
};
post('Profiler.enable');
post('Profiler.setSamplingInterval', { interval: a.interval });
fs.mkdirSync(a.out, { recursive: true });

// Warm up unprofiled, as the sweep's warm-up does.
for (const input of def.batch().slice(0, 5)) {
    def.run(input);
}

// Named as p515-sweep.mjs names its loop, so the split keeps only the
// samples under it.
const p515MeasuredLoop = (inputs, until) => {
    let calls = 0;
    for (const input of inputs) {
        def.run(input);
        calls++;
        if (Date.now() >= until) {
            break;
        }
    }
    return calls;
};

let profiledMs = 0;
let calls = 0;
let k = 0;
let inputs = def.batch();
while (profiledMs < a.seconds * 1000) {
    if (!def.reuse) {
        inputs = def.batch();
        // The batch's own garbage, collected before the profiler starts
        // (node --expose-gc).
        if (typeof globalThis.gc === 'function') {
            globalThis.gc();
        }
    }
    const until = Date.now() + Math.min(2000, a.seconds * 1000 - profiledMs);
    post('Profiler.start');
    const t0 = Date.now();
    let n = 0;
    do {
        n += p515MeasuredLoop(def.reuse ? Array(50).fill(inputs[0]) : inputs, until);
    } while (def.reuse && Date.now() < until);
    profiledMs += Date.now() - t0;
    const { profile } = post('Profiler.stop');
    fs.writeFileSync(path.join(a.out, `${a.op}-${a.set}-${k++}.cpuprofile`), JSON.stringify(profile));
    calls += n;
}
console.log(`${a.op}/${a.set}: ${calls} calls in ${profiledMs} ms profiled, ${k} stretches`);
