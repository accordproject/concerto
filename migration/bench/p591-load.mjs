#!/usr/bin/env node
// P5-91 (accordproject/concerto-rust#437): the JS-side bookkeeping of model
// loading, per item, for one concerto-core dist/. Measure only.
//
//   node --expose-gc --min-semi-space-size=128 --max-semi-space-size=128 \
//       migration/bench/p591-load.mjs --core-dist DIR --mode weak|alloc|ab \
//       [--before-dist DIR] [--ops a,b] [--sets a,b] [--items N] [--rounds N]
//
// --mode weak   WeakMap/WeakSet operations per item during the op (the
//               collections are counted from this script's own wrappers,
//               installed before concerto-core loads): lookups (get, has)
//               and writes (set, add, delete), and of the writes, the
//               inserts of a key the collection did not hold yet, which
//               are the ones that grow the ephemeron tables. Also counts
//               FinalizationRegistry.register calls.
// --mode ab     median us per item of --core-dist (now) against
//               --before-dist (before), in one process, one pass of each
//               in turn (the order swapped every round) for --rounds
//               rounds, so both sides see the same machine load. Both
//               dists share the one engine module. Run it with
//               --expose-gc: a collection between rounds lets the stages
//               of modelfile_new's never-added files be dropped.
// --mode alloc  JS heap bytes allocated per item: the young generation is
//               made large enough (the semi-space flags above) for a round
//               of --items items to run without a scavenge; a round that
//               saw a garbage collection is discarded. Median of --rounds.
//
// The ops are p515-sweep.mjs's modelfile_new and add_model_file, over the
// same fixtures (fixtures/p515/<set>.json, P5-56's enum isAbstract drop).
// The ops are timed one per process by p515-sweep.mjs --mode time too
// (p591-run.sh).

import fs from 'fs';
import path from 'path';
import url from 'url';
import { createRequire } from 'module';
import { PerformanceObserver, performance } from 'perf_hooks';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const args = { coreDist: path.join(REPO_ROOT, 'packages', 'concerto-core', 'dist'), mode: 'weak',
    ops: ['modelfile_new', 'add_model_file'], sets: ['concerto-core-test-data', 'conformance', 'synthetic-large'],
    items: 0, rounds: 15, beforeDist: null };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === '--core-dist') { args.coreDist = path.resolve(v()); }
    else if (k === '--mode') { args.mode = v(); }
    else if (k === '--ops') { args.ops = v().split(','); }
    else if (k === '--sets') { args.sets = v().split(','); }
    else if (k === '--items') { args.items = Number(v()); }
    else if (k === '--rounds') { args.rounds = Number(v()); }
    else if (k === '--before-dist') { args.beforeDist = path.resolve(v()); }
    else { throw new Error(`unknown argument: ${k}`); }
}

// ---- weak-collection counters (installed before concerto-core loads) ------
const counts = { lookups: 0, writes: 0, inserts: 0, finalizerRegisters: 0 };
let counting = false;
function countOps(proto, lookups, writes, insertOp) {
    const has = proto.has;
    for (const op of lookups) {
        const real = proto[op];
        proto[op] = function (key) {
            if (counting) { counts.lookups++; }
            return real.call(this, key);
        };
    }
    for (const op of writes) {
        const real = proto[op];
        proto[op] = function (key, value) {
            if (counting) {
                counts.writes++;
                if (op === insertOp && !has.call(this, key)) { counts.inserts++; }
            }
            return real.call(this, key, value);
        };
    }
}
if (args.mode === 'weak') {
    countOps(WeakMap.prototype, ['get', 'has'], ['set', 'delete'], 'set');
    countOps(WeakSet.prototype, ['has'], ['add', 'delete'], 'add');
    const register = FinalizationRegistry.prototype.register;
    FinalizationRegistry.prototype.register = function (...a) {
        if (counting) { counts.finalizerRegisters++; }
        return register.apply(this, a);
    };
}

const sides = [{ name: 'now', core: require(path.join(args.coreDist, 'index.js')) }];
if (args.mode === 'ab') {
    sides.push({ name: 'before', core: require(path.join(args.beforeDist, 'index.js')) });
}

function loadSet(set) {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'p515', `${set}.json`), 'utf8'));
    for (const model of data.models || []) {
        for (const decl of model.ast.declarations || []) {
            if (decl.$class === 'concerto.metamodel@1.0.0.EnumDeclaration') {
                delete decl.isAbstract;
            }
        }
    }
    return data;
}

// Each op: one pass over the set's models; `items` per pass.
const OPS = {
    modelfile_new: (models, { ModelManager, ModelFile }) => {
        const mm = new ModelManager();
        return {
            items: models.length,
            run: () => {
                for (const { name, ast } of models) {
                    new ModelFile(mm, ast, undefined, name);
                }
            },
        };
    },
    add_model_file: (models, { ModelManager, ModelFile }) => ({
        items: models.length,
        run: () => {
            const mm = new ModelManager();
            for (const { name, ast } of models) {
                mm.addModelFile(new ModelFile(mm, ast, undefined, name));
            }
        },
    }),
};

const gcEntries = [];
new PerformanceObserver((list) => { gcEntries.push(...list.getEntries()); }).observe({ entryTypes: ['gc'] });
const tick = () => new Promise((resolve) => setImmediate(resolve));
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };

const rows = [];
for (const set of args.sets) {
    const data = loadSet(set);
    for (const op of args.ops) {
        const ctxs = sides.map((side) => OPS[op](data.models, side.core));
        const ctx = ctxs[0];
        // Warm up: every path compiled and every cache filled.
        for (const c of ctxs) {
            for (let i = 0; i < 5; i++) { c.run(); }
        }
        const passes = Math.max(1, args.items ? Math.ceil(args.items / ctx.items) : Math.ceil(200 / ctx.items));
        if (args.mode === 'ab') {
            const times = ctxs.map(() => []);
            for (let r = 0; r < args.rounds; r++) {
                // modelfile_new's files are never added, so their stages
                // wait for the FinalizationRegistry to drop them; a
                // collection between rounds lets it, before the engine's
                // memory fills (run with --expose-gc).
                if (global.gc) {
                    global.gc();
                    await tick();
                }
                const order = r % 2 === 0 ? [0, 1] : [1, 0];
                for (const i of order) {
                    const t0 = process.hrtime.bigint();
                    for (let p = 0; p < passes; p++) { ctxs[i].run(); }
                    times[i].push(Number(process.hrtime.bigint() - t0) / 1000 / (passes * ctx.items));
                }
            }
            const now = median(times[0]);
            const before = median(times[1]);
            rows.push({ op, set, items: passes * ctx.items, rounds: args.rounds, nowUs: now, beforeUs: before, change: now / before - 1 });
        } else if (args.mode === 'weak') {
            for (const k of Object.keys(counts)) { counts[k] = 0; }
            counting = true;
            for (let p = 0; p < passes; p++) { ctx.run(); }
            counting = false;
            const n = passes * ctx.items;
            rows.push({ op, set, items: n, lookups: counts.lookups / n, writes: counts.writes / n,
                inserts: counts.inserts / n, finalizerRegisters: counts.finalizerRegisters / n });
        } else {
            const perItem = [];
            let discarded = 0;
            for (let r = 0; r < args.rounds; r++) {
                global.gc();
                await tick();
                const start = performance.now();
                const before = process.memoryUsage().heapUsed;
                for (let p = 0; p < passes; p++) { ctx.run(); }
                const after = process.memoryUsage().heapUsed;
                const end = performance.now();
                await tick();
                // Only a collection that started inside the timed loop counts
                // (the forced one above may be reported late).
                const inLoop = gcEntries.filter((e) => e.startTime >= start && e.startTime <= end);
                gcEntries.length = 0;
                if (inLoop.length > 0) { discarded++; continue; }
                perItem.push((after - before) / (passes * ctx.items));
            }
            rows.push({ op, set, items: passes * ctx.items, bytesPerItem: median(perItem), rounds: perItem.length, discarded });
        }
    }
}
process.stdout.write(JSON.stringify({ coreDist: args.coreDist, mode: args.mode, rows }, null, 2) + '\n');
