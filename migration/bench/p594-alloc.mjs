#!/usr/bin/env node
// P5-94 (accordproject/concerto-rust#444), measure only: the JS allocation
// of the TS-API `add_model_file`, `extract_cold` and `mm_new` ops, from a
// V8 sampling heap profile that keeps the objects already collected
// (`includeObjectsCollectedByMajorGC`/`...MinorGC`), so it counts garbage
// too. Prints KiB allocated per call and the split by the first
// concerto-core or engine-glue frame on the stack (and by that frame and
// the leaf, with --pairs).
//
//   node --expose-gc migration/bench/p594-alloc.mjs --op <op> --set <set>
//       [--core-dist DIR] [--calls N] [--pairs] [--json]
//
// The ops are p590-profile.mjs's, built the same way: `extract_cold`'s
// decorated managers are built before the profile starts.

import fs from 'fs';
import path from 'path';
import url from 'url';
import inspector from 'inspector';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const a = { coreDist: path.join(REPO_ROOT, 'packages', 'concerto-core', 'dist'), op: null, set: null, calls: 0, pairs: false, json: false };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === '--core-dist') { a.coreDist = path.resolve(v()); }
    else if (k === '--op') { a.op = v(); }
    else if (k === '--set') { a.set = v(); }
    else if (k === '--calls') { a.calls = Number(v()); }
    else if (k === '--pairs') { a.pairs = true; }
    else if (k === '--json') { a.json = true; }
    else { throw new Error(`unknown argument: ${k}`); }
}
const calls = a.calls || (a.op === 'extract_cold' ? 40 : 200);

const { ModelManager, ModelFile, DecoratorManager } = require(path.join(a.coreDist, 'index.js'));

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

const decorated = () => DecoratorManager.decorateModels(managerOf(data.models.filter((m) => data.dcsModels.includes(m.name))), data.dcs, { validate: true });
const OPS = {
    mm_new: { input: () => null, run: () => new ModelManager() },
    add_model_file: { input: () => null, run: () => managerOf(data.models) },
    extract_cold: { input: decorated, run: (mm) => DecoratorManager.extractDecorators(mm, { removeDecoratorsFromModel: true, locale: 'en' }) },
};
const def = OPS[a.op];
if (!def) {
    throw new Error(`unknown op ${a.op}`);
}

for (let i = 0; i < 5; i++) {
    def.run(def.input());
}
const inputs = Array.from({ length: calls }, () => def.input());
globalThis.gc?.();

const session = new inspector.Session();
session.connect();
const post = (method, params) => new Promise((resolve, reject) => session.post(method, params || {}, (e, r) => (e ? reject(e) : resolve(r))));
await post('HeapProfiler.enable');
await post('HeapProfiler.startSampling', { samplingInterval: 256, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
const results = [];
for (const input of inputs) {
    results.push(def.run(input));
}
const { profile } = await post('HeapProfiler.stopSampling');

const OWN = /concerto-core\/(dist|src|\.bench[^/]*\/dist)\/|concerto-engine|concerto-wasm\/pkg/;
const nameOf = (f) => `${f.functionName || '(anonymous)'} ${path.basename(f.url || '')}:${f.lineNumber + 1}`;
const byFrame = new Map();
const byPair = new Map();
let total = 0;
function walk(node, stack) {
    stack.push(node.callFrame);
    if (node.selfSize) {
        total += node.selfSize;
        let owner = '(other)';
        for (let i = stack.length - 1; i >= 0; i--) {
            if (OWN.test(stack[i].url || '')) {
                owner = nameOf(stack[i]);
                break;
            }
        }
        byFrame.set(owner, (byFrame.get(owner) || 0) + node.selfSize);
        const pair = `${owner} <= ${nameOf(node.callFrame)}`;
        byPair.set(pair, (byPair.get(pair) || 0) + node.selfSize);
    }
    for (const child of node.children) {
        walk(child, stack);
    }
    stack.pop();
}
walk(profile.head, []);
const top = (m, n) => [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, n).map(([k, v]) => ({ frame: k, kibPerCall: v / calls / 1024, share: v / total }));
const out = { op: a.op, set: a.set, calls, kibPerCall: total / calls / 1024, byFrame: top(byFrame, 25), byPair: a.pairs ? top(byPair, 40) : undefined };
if (a.json) {
    console.log(JSON.stringify(out));
} else {
    console.log(`${a.op}/${a.set}: ${out.kibPerCall.toFixed(1)} KiB allocated per call (sampled), ${calls} calls`);
    for (const row of out.byFrame) {
        console.log(`${row.kibPerCall.toFixed(1).padStart(9)} KiB ${(100 * row.share).toFixed(1).padStart(5)}%  ${row.frame}`);
    }
    for (const row of out.byPair || []) {
        console.log(`${row.kibPerCall.toFixed(1).padStart(9)} KiB ${(100 * row.share).toFixed(1).padStart(5)}%  ${row.frame}`);
    }
}
results.length = 0;
