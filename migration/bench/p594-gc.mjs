#!/usr/bin/env node
// P5-94 (accordproject/concerto-rust#444), measure only: the garbage
// collections an `add_model_file` or `extract_cold` loop runs, by kind
// (perf_hooks `gc` entries: 1 minor, 4 major, 8 incremental), with their
// total time, run either as one synchronous loop (as p515-sweep.mjs and
// p590-profile.mjs run it) or with an event-loop turn (`setImmediate`)
// every --yield calls, which lets the FinalizationRegistry callbacks run
// that free each dropped manager's engine handle in WASM memory.
//
//   node --expose-gc migration/bench/p594-gc.mjs --op <op> --set <set>
//       [--core-dist DIR] [--seconds S] [--yield N]
//
// `extract_cold` builds its decorated managers ten at a time, outside the
// timed part, as p590-profile.mjs does; with --yield, the event loop turns
// once per batch. Run with --trace-incremental-marking to see why each
// major collection started.

import fs from 'fs';
import path from 'path';
import url from 'url';
import { createRequire } from 'module';
import { PerformanceObserver, performance } from 'perf_hooks';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const a = { coreDist: path.join(REPO_ROOT, 'packages', 'concerto-core', 'dist'), op: null, set: null, seconds: 5, yield: 0 };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === '--core-dist') { a.coreDist = path.resolve(v()); }
    else if (k === '--op') { a.op = v(); }
    else if (k === '--set') { a.set = v(); }
    else if (k === '--seconds') { a.seconds = Number(v()); }
    else if (k === '--yield') { a.yield = Number(v()); }
    else { throw new Error(`unknown argument: ${k}`); }
}

const { ModelManager, ModelFile, DecoratorManager } = require(path.join(a.coreDist, 'index.js'));
const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'p515', `${a.set}.json`), 'utf8'));
for (const model of data.models || []) {
    for (const decl of model.ast.declarations || []) {
        if (decl.$class === 'concerto.metamodel@1.0.0.EnumDeclaration') {
            delete decl.isAbstract;
        }
    }
}
const managerOf = (models) => {
    const mm = new ModelManager();
    for (const { name, ast } of models) {
        mm.addModelFile(new ModelFile(mm, ast, undefined, name));
    }
    return mm;
};
const dcsModels = data.models.filter((m) => data.dcsModels.includes(m.name));
const turn = () => new Promise((resolve) => setImmediate(resolve));

let gcMs = 0;
const kinds = {};
const observer = new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
        gcMs += e.duration;
        const kind = e.detail?.kind ?? e.kind;
        kinds[kind] = (kinds[kind] || 0) + 1;
    }
});
observer.observe({ entryTypes: ['gc'] });

let calls = 0;
let opMs = 0;
const start = performance.now();
const until = Date.now() + 1000 * a.seconds;
while (Date.now() < until) {
    if (a.op === 'extract_cold') {
        const inputs = [];
        for (let i = 0; i < 10; i++) {
            inputs.push(DecoratorManager.decorateModels(managerOf(dcsModels), data.dcs, { validate: true }));
        }
        globalThis.gc?.();
        if (a.yield) {
            await turn();
        }
        const t = performance.now();
        for (const mm of inputs) {
            DecoratorManager.extractDecorators(mm, { removeDecoratorsFromModel: true, locale: 'en' });
            calls++;
        }
        opMs += performance.now() - t;
    } else if (a.op === 'add_model_file') {
        const t = performance.now();
        managerOf(data.models);
        calls++;
        opMs += performance.now() - t;
        if (a.yield && calls % a.yield === 0) {
            await turn();
        }
    } else {
        throw new Error(`unknown op ${a.op}`);
    }
}
const wallMs = performance.now() - start;
// The observer's entries are delivered on later turns of the event loop.
await new Promise((resolve) => setTimeout(resolve, 100));
observer.disconnect();
console.log(JSON.stringify({ op: a.op, set: a.set, yield: a.yield, calls, usPerCall: +(1000 * opMs / calls).toFixed(1),
    gcMs: +gcMs.toFixed(1), gcShareOfWall: +(gcMs / wallMs).toFixed(3), gcKinds: kinds }));
