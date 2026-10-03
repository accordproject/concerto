#!/usr/bin/env node
// P5-97 (accordproject/concerto-rust#448): a long-running server that keeps
// one base ModelManager of platform models and serves concurrent async
// requests, each with its own small user model. Measure only.
//
//   node --expose-gc migration/bench/p597-server.mjs --approach a|b|c --set S
//       [--core-dist DIR] [--mode time|memory|soak] [--concurrency N]
//       [--requests R] [--warmup W] [--held K] [--seconds S] [--out FILE]
//
// Approaches (one request = make a manager, add the user model, validate a
// user instance and a platform instance):
//   a  `new ModelManager()` and every platform model loaded, per request
//      (TS 5.0.0's way, and the baseline);
//   b  `base.filter(keepUserModels)` per request, the usual workaround
//      (`filter(() => true)` throws on every engine: the decorator model is
//      added twice);
//   c  `base.fork()` per request (P5-97).
//
// --mode time    N concurrent requests (N async workers, each yielding to
//                the event loop between a request's steps), R requests in
//                all after W warm-up ones: per-request latency p50/p95 (from
//                the request's start to its end, interleaving included),
//                throughput, and the engine's WASM memory and RSS at the end.
// --mode memory  K managers made and held (each with its user model), after
//                a GC: the growth of the engine's WASM memory
//                (memory.buffer.byteLength) and of RSS, per manager.
// --mode soak    approach c at N for S seconds; every second, WASM memory,
//                RSS, JS heap, the requests done and the managers made but
//                not yet finalized by the garbage collector, as a timeline.
//
// Inputs: fixtures/p515/<set>.json from p515-prepare.mjs, the P5-72 sets,
// whose models are the platform models and whose instances are the platform
// instances. The engine's WASM memory is read from the instance the loader
// creates (`WebAssembly.Instance` is wrapped before the engine loads).

import fs from 'fs';
import path from 'path';
import url from 'url';
import { createRequire } from 'module';
import { performance } from 'perf_hooks';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

function parseArgs(argv) {
    const a = {
        coreDist: path.join(REPO_ROOT, 'packages', 'concerto-core', 'dist'),
        approach: 'c', set: 'conformance', mode: 'time', concurrency: 1, requests: 500, warmup: 50,
        held: 100, seconds: 60, out: null,
    };
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i];
        const v = () => argv[++i];
        if (k === '--core-dist') { a.coreDist = path.resolve(v()); }
        else if (k === '--approach') { a.approach = v(); }
        else if (k === '--set') { a.set = v(); }
        else if (k === '--mode') { a.mode = v(); }
        else if (k === '--concurrency') { a.concurrency = Number(v()); }
        else if (k === '--requests') { a.requests = Number(v()); }
        else if (k === '--warmup') { a.warmup = Number(v()); }
        else if (k === '--held') { a.held = Number(v()); }
        else if (k === '--seconds') { a.seconds = Number(v()); }
        else if (k === '--out') { a.out = v(); }
        else { throw new Error(`unknown argument: ${k}`); }
    }
    return a;
}

const args = parseArgs(process.argv.slice(2));

// The engine's linear memory, from the instance its loader creates.
let engineMemory = null;
const OriginalInstance = WebAssembly.Instance;
function CapturingInstance(module, imports) {
    const instance = new OriginalInstance(module, imports);
    if (instance.exports && instance.exports.memory instanceof WebAssembly.Memory) {
        engineMemory = instance.exports.memory;
    }
    return instance;
}
CapturingInstance.prototype = OriginalInstance.prototype;
WebAssembly.Instance = CapturingInstance;

const core = require(path.join(args.coreDist, 'index.js'));
const { ModelManager, ModelFile } = core;
const coreVersion = require(path.join(args.coreDist, '..', 'package.json')).version;
const hasFork = typeof ModelManager.prototype.fork === 'function';

// As p515-sweep.mjs: the generated synthetic-large model's EnumDeclaration
// carries `isAbstract`, which the engine's strict AST shape rejects.
function withoutEnumIsAbstract(ast) {
    for (const decl of ast.declarations || []) {
        if (decl.$class === 'concerto.metamodel@1.0.0.EnumDeclaration') {
            delete decl.isAbstract;
        }
    }
    return ast;
}

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'p515', `${args.set}.json`), 'utf8'));
for (const model of data.models) {
    withoutEnumIsAbstract(model.ast);
}
const platformInstances = data.instances.map((i) => i.json);

// The per-request user model: a few concepts, an enum and a scalar, in one
// namespace every request uses (each request's own copy, isolated).
const USER_NS = 'org.acme.request@1.0.0';
const USER_AST = {
    $class: 'concerto.metamodel@1.0.0.Model',
    namespace: USER_NS,
    imports: [],
    declarations: [
        { $class: 'concerto.metamodel@1.0.0.EnumDeclaration', name: 'Status', properties: [
            { $class: 'concerto.metamodel@1.0.0.EnumProperty', name: 'OPEN' },
            { $class: 'concerto.metamodel@1.0.0.EnumProperty', name: 'CLOSED' },
        ] },
        { $class: 'concerto.metamodel@1.0.0.StringScalar', name: 'Code',
            validator: { $class: 'concerto.metamodel@1.0.0.StringRegexValidator', pattern: '^[A-Z]{3}$', flags: '' } },
        { $class: 'concerto.metamodel@1.0.0.ConceptDeclaration', name: 'Line', isAbstract: false, properties: [
            { $class: 'concerto.metamodel@1.0.0.StringProperty', name: 'sku', isArray: false, isOptional: false },
            { $class: 'concerto.metamodel@1.0.0.IntegerProperty', name: 'quantity', isArray: false, isOptional: false },
        ] },
        { $class: 'concerto.metamodel@1.0.0.ConceptDeclaration', name: 'Order', isAbstract: false, properties: [
            { $class: 'concerto.metamodel@1.0.0.StringProperty', name: 'id', isArray: false, isOptional: false },
            { $class: 'concerto.metamodel@1.0.0.ObjectProperty', name: 'status', isArray: false, isOptional: false,
                type: { $class: 'concerto.metamodel@1.0.0.TypeIdentifier', name: 'Status' } },
            { $class: 'concerto.metamodel@1.0.0.ObjectProperty', name: 'code', isArray: false, isOptional: true,
                type: { $class: 'concerto.metamodel@1.0.0.TypeIdentifier', name: 'Code' } },
            { $class: 'concerto.metamodel@1.0.0.ObjectProperty', name: 'lines', isArray: true, isOptional: false,
                type: { $class: 'concerto.metamodel@1.0.0.TypeIdentifier', name: 'Line' } },
        ] },
    ],
};
const USER_INSTANCE = {
    $class: `${USER_NS}.Order`, id: 'o-1', status: 'OPEN', code: 'ABC',
    lines: [{ $class: `${USER_NS}.Line`, sku: 'x', quantity: 2 }, { $class: `${USER_NS}.Line`, sku: 'y', quantity: 1 }],
};

function keepUserModels(d) {
    return !d.getFullyQualifiedName().startsWith('concerto.decorator@');
}

function loadPlatform() {
    const mm = new ModelManager();
    for (const { name, ast } of data.models) {
        mm.addModelFile(new ModelFile(mm, ast, undefined, name));
    }
    return mm;
}

let base = null;
// Managers made and managers the garbage collector has finalized: their
// difference is the managers still awaiting collection (live or garbage),
// the "finalizer delay" term of the per-request WASM footprint.
let made = 0;
let finalized = 0;
const finalizations = new FinalizationRegistry(() => { finalized++; });
function makeManager() {
    let mm;
    if (args.approach === 'a') {
        mm = loadPlatform();
    } else if (args.approach === 'b') {
        mm = base.filter(keepUserModels);
    } else if (args.approach === 'c') {
        mm = base.fork();
    } else {
        throw new Error(`unknown approach ${args.approach}`);
    }
    made++;
    finalizations.register(mm, null);
    return mm;
}

function yieldNow() {
    return new Promise((resolve) => setImmediate(resolve));
}

// One request; returns its latency in ms.
async function request(i) {
    const t0 = performance.now();
    const mm = makeManager();
    await yieldNow();
    mm.addModelFile(new ModelFile(mm, USER_AST, undefined, 'user.cto'));
    await yieldNow();
    const serializer = mm.getSerializer();
    serializer.fromJSON(USER_INSTANCE);
    serializer.fromJSON(platformInstances[i % platformInstances.length]);
    return performance.now() - t0;
}

async function runRequests(total, concurrency, onDone) {
    let next = 0;
    const latencies = [];
    const worker = async () => {
        while (next < total) {
            const i = next++;
            latencies.push(await request(i));
            if (onDone) {
                onDone();
            }
        }
    };
    const t0 = performance.now();
    await Promise.all(Array.from({ length: concurrency }, worker));
    return { latencies, wallMs: performance.now() - t0 };
}

function quantile(sorted, q) {
    if (sorted.length === 0) {
        return null;
    }
    const pos = (sorted.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

async function settle() {
    for (let i = 0; i < 4; i++) {
        if (global.gc) {
            global.gc();
        }
        await yieldNow();
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
}

function snapshot() {
    const m = process.memoryUsage();
    return {
        wasmBytes: engineMemory ? engineMemory.buffer.byteLength : null,
        unfinalized: made - finalized,
        rss: m.rss, heapUsed: m.heapUsed, external: m.external, arrayBuffers: m.arrayBuffers,
    };
}

async function main() {
    if (args.approach === 'c' && !hasFork) {
        throw new Error('this dist has no ModelManager.fork');
    }
    if (args.approach !== 'a') {
        base = loadPlatform();
        // Warm the base's caches once, as a server would.
        const serializer = base.getSerializer();
        for (const json of platformInstances) {
            serializer.fromJSON(json);
        }
    }
    const result = {
        set: args.set, approach: args.approach, mode: args.mode, coreVersion, coreDist: args.coreDist,
        engineModule: process.env.CONCERTO_ENGINE_MODULE || '@accordproject/concerto-engine', node: process.version,
        platformModels: data.models.length,
    };
    if (args.mode === 'time') {
        await runRequests(args.warmup, args.concurrency);
        await settle();
        const start = snapshot();
        const { latencies, wallMs } = await runRequests(args.requests, args.concurrency);
        const sorted = latencies.slice().sort((x, y) => x - y);
        Object.assign(result, {
            concurrency: args.concurrency, requests: args.requests, warmup: args.warmup,
            p50Ms: quantile(sorted, 0.5), p95Ms: quantile(sorted, 0.95), meanMs: latencies.reduce((s, x) => s + x, 0) / latencies.length,
            throughputPerS: args.requests / (wallMs / 1000), wallMs, start, end: snapshot(),
        });
    } else if (args.mode === 'memory') {
        // Warm up the engine's allocator and the base, then hold K managers.
        await runRequests(args.warmup, 1);
        await settle();
        const before = snapshot();
        const held = [];
        for (let i = 0; i < args.held; i++) {
            const mm = makeManager();
            mm.addModelFile(new ModelFile(mm, USER_AST, undefined, 'user.cto'));
            mm.getSerializer().fromJSON(USER_INSTANCE);
            held.push(mm);
        }
        await settle();
        const after = snapshot();
        Object.assign(result, {
            held: args.held, before, after,
            wasmBytesPerManager: (after.wasmBytes - before.wasmBytes) / args.held,
            rssBytesPerManager: (after.rss - before.rss) / args.held,
            heapBytesPerManager: (after.heapUsed - before.heapUsed) / args.held,
            heldCheck: held.length,
        });
    } else if (args.mode === 'soak') {
        const timeline = [];
        let done = 0;
        let stop = false;
        const t0 = performance.now();
        const sampler = setInterval(() => {
            timeline.push({ t: (performance.now() - t0) / 1000, done, ...snapshot() });
        }, 1000);
        const worker = async () => {
            let i = 0;
            while (!stop) {
                await request(i++);
                done++;
            }
        };
        const deadline = setTimeout(() => { stop = true; }, args.seconds * 1000);
        await Promise.all(Array.from({ length: args.concurrency }, worker));
        clearTimeout(deadline);
        clearInterval(sampler);
        timeline.push({ t: (performance.now() - t0) / 1000, done, ...snapshot() });
        Object.assign(result, { concurrency: args.concurrency, seconds: args.seconds, requests: done, timeline });
    } else {
        throw new Error(`unknown mode ${args.mode}`);
    }
    const text = JSON.stringify(result, null, 2);
    if (args.out) {
        fs.mkdirSync(path.dirname(args.out), { recursive: true });
        fs.writeFileSync(args.out, text);
    } else {
        process.stdout.write(text + '\n');
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
