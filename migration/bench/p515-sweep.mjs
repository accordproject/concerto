#!/usr/bin/env node
// P5-15 (accordproject/concerto-rust#309): the TS-API half of the
// performance profiling sweep. Measure only.
//
//   node migration/bench/p515-sweep.mjs [--core-dist DIR] [--mode time|count|loop]
//       [--ops a,b] [--sets a,b] [--samples N] [--warmup N] [--seconds S] [--out FILE]
//
// --core-dist  a concerto-core dist/ (default: this checkout's, i.e. the
//              Rust engine through the TS API). The TS reference is
//              migration/oracle/reference/node_modules/@accordproject/concerto-core/dist.
// --mode time  median us per item for every op x set (default).
// --mode count TS->WASM crossings per item, by binding, with the time
//              spent inside them (loads lib/p515-engine-counter.cjs as
//              CONCERTO_ENGINE_MODULE; Rust engine only).
// --mm-options JSON  (P5-60) options for every ModelManager the ops build,
//              e.g. '{"metamodelValidation":false}' for BC-19's opt-out
//              (default: none, i.e. `new ModelManager()`).
// --mode loop  runs one op (--ops X --sets Y) in a loop for --seconds, for
//              `node --cpu-prof` (see p515-cpuprof.mjs for the stage split).
//
// Inputs: fixtures/p515/<set>.json from p515-prepare.mjs.

import fs from 'fs';
import os from 'os';
import path from 'path';
import url from 'url';
import { createRequire } from 'module';
import { execSync } from 'child_process';
import { timeit } from './lib/timeit.mjs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SETS = ['concerto-core-test-data', 'conformance', 'synthetic-large'];

function parseArgs(argv) {
    const a = {
        coreDist: path.join(REPO_ROOT, 'packages', 'concerto-core', 'dist'),
        mode: 'time', ops: null, sets: SETS, samples: 30, warmup: 5, seconds: 20, out: null, mmOptions: undefined,
    };
    for (let i = 0; i < argv.length; i++) {
        const k = argv[i];
        const v = () => argv[++i];
        if (k === '--core-dist') { a.coreDist = path.resolve(v()); }
        else if (k === '--mode') { a.mode = v(); }
        else if (k === '--ops') { a.ops = v().split(','); }
        else if (k === '--sets') { a.sets = v().split(','); }
        else if (k === '--samples') { a.samples = Number(v()); }
        else if (k === '--warmup') { a.warmup = Number(v()); }
        else if (k === '--seconds') { a.seconds = Number(v()); }
        else if (k === '--out') { a.out = v(); }
        else if (k === '--mm-options') { a.mmOptions = JSON.parse(v()); }
        else { throw new Error(`unknown argument: ${k}`); }
    }
    return a;
}

const args = parseArgs(process.argv.slice(2));

if (args.mode === 'count') {
    const coreRequire = createRequire(path.join(args.coreDist, 'index.js'));
    process.env.P515_REAL_ENGINE = process.env.CONCERTO_ENGINE_MODULE || coreRequire.resolve('@accordproject/concerto-engine');
    process.env.CONCERTO_ENGINE_MODULE = path.join(__dirname, 'lib', 'p515-engine-counter.cjs');
}

const core = require(path.join(args.coreDist, 'index.js'));
const { ModelManager, ModelFile, Factory, Serializer, DecoratorManager } = core;
const coreVersion = require(path.join(args.coreDist, '..', 'package.json')).version;

// P5-29 (accordproject/concerto-rust#334): the `*_first` ops time a read
// just after a model change. They move the model epoch
// (`engine/views` `invalidatePropertyLookups`, which every model change
// through a ModelManager calls) before each pass, so every read in the pass
// misses the getNamespaces/getType/resolveType memo, without timing a model
// load. The views built by the first pass are kept, as after a real change
// elsewhere. A dist without the module (TS 5.0.0) keeps nothing between
// reads, so the step is a no-op there. The epoch is per manager since
// P5-97 (accordproject/concerto-rust#448: `invalidatePropertyLookups(mm)`),
// and since P5-100 (accordproject/concerto-rust#454) it is the manager's own
// model version, `mm._engine.version`, which every model change moves.
const viewsPath = path.join(args.coreDist, 'engine', 'views.js');
const invalidatePropertyLookups = fs.existsSync(viewsPath) && typeof require(viewsPath).invalidatePropertyLookups === 'function'
    ? require(viewsPath).invalidatePropertyLookups
    : null;
function bumpModelEpoch(mm) {
    if (mm._engine && typeof mm._engine.version === 'number') {
        mm._engine.version++;
    } else if (invalidatePropertyLookups) {
        invalidatePropertyLookups(mm);
    }
}

// P5-56: the generated synthetic-large model gives its EnumDeclaration an
// `isAbstract: false`, a key the metamodel does not declare for enums. TS
// 5.0.0 ignores it, but the engine's strict AST shape at model load (P5-49,
// accordproject/concerto-rust#384) rejects it, so no Rust op could load that
// set. It is dropped here, for every engine alike.
function withoutEnumIsAbstract(ast) {
    for (const decl of ast.declarations || []) {
        if (decl.$class === 'concerto.metamodel@1.0.0.EnumDeclaration') {
            delete decl.isAbstract;
        }
    }
    return ast;
}

function loadSet(set) {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'p515', `${set}.json`), 'utf8'));
    for (const model of data.models || []) {
        withoutEnumIsAbstract(model.ast);
    }
    return data;
}

// P5-60 (accordproject/concerto-rust#392): every manager the ops build takes
// --mm-options; without it this is `new ModelManager()`, as before.
function newManager() {
    return args.mmOptions === undefined ? new ModelManager() : new ModelManager(args.mmOptions);
}

function managerOf(models) {
    const mm = newManager();
    for (const { name, ast } of models) {
        mm.addModelFile(new ModelFile(mm, ast, undefined, name));
    }
    return mm;
}

// P5-96 (accordproject/concerto-rust#446): P5-89's
// `ModelManager.validateInstance` / `validateInstanceOrThrow`, over the
// plain JSON documents of the same instances as `validate` (what fromJSON
// reads). Every document of the fixtures is valid; setup checks that. A dist
// without the method is timed on TS 5.0.0's path for the same check,
// `Serializer.fromJSON` and then `validate()` on the resource, but only when
// it is the TS reference (no engine views): an earlier Rust-engine head
// without the API has no row.
const isEngineDist = fs.existsSync(viewsPath);
/**
 * The op for one of P5-89's instance checks.
 * @param {string} method 'validateInstance' or 'validateInstanceOrThrow'
 * @return {object} the op: family, setup, n and run
 */
function instanceCheck(method) {
    return {
        family: 'instance',
        setup: (d) => {
            const mm = managerOf(d.models);
            const items = d.instances.map((i) => i.json);
            if (typeof mm[method] === 'function') {
                for (const json of items) {
                    const r = mm[method](json);
                    if (method === 'validateInstance' && !r.valid) {
                        throw new Error(`${json.$class}: ${JSON.stringify(r.errors).slice(0, 200)}`);
                    }
                }
                return { items, check: (json) => mm[method](json) };
            }
            if (isEngineDist) {
                throw new Error(`ModelManager.${method} is not in this dist`);
            }
            const serializer = new Serializer(new Factory(mm), mm);
            return { items, check: (json) => serializer.fromJSON(json).validate() };
        },
        n: (c) => c.items.length,
        run: (c) => {
            for (const json of c.items) {
                c.check(json);
            }
        },
    };
}

// Each op: setup(data) -> ctx, then run(ctx) does `n(ctx)` items.
const OPS = {
    // ---- Model load ------------------------------------------------------
    mm_new: {
        family: 'load', setOnly: 'conformance',
        setup: () => ({}), n: () => 1,
        run: () => newManager(),
    },
    modelfile_new: {
        family: 'load',
        setup: (d) => ({ mm: newManager(), models: d.models }),
        n: (c) => c.models.length,
        run: (c) => {
            for (const { name, ast } of c.models) {
                new ModelFile(c.mm, ast, undefined, name);
            }
        },
    },
    add_model_file: {
        family: 'load',
        setup: (d) => ({ models: d.models }),
        n: (c) => c.models.length,
        run: (c) => managerOf(c.models),
    },
    add_cto_model: {
        family: 'load',
        setup: (d) => ({ models: d.models }),
        n: (c) => c.models.length,
        run: (c) => {
            const mm = newManager();
            for (const { name, cto } of c.models) {
                mm.addCTOModel(cto, name);
            }
            return mm;
        },
    },
    // ---- Serializer and Factory -------------------------------------------
    from_json: {
        family: 'serializer',
        setup: (d) => {
            const mm = managerOf(d.models);
            const serializer = new Serializer(new Factory(mm), mm);
            return { serializer, items: d.instances.map((i) => i.json) };
        },
        n: (c) => c.items.length,
        run: (c) => {
            for (const json of c.items) {
                c.serializer.fromJSON(json);
            }
        },
    },
    to_json: {
        family: 'serializer',
        setup: (d) => {
            const mm = managerOf(d.models);
            const serializer = new Serializer(new Factory(mm), mm);
            return { serializer, items: d.instances.map((i) => serializer.fromJSON(i.json)) };
        },
        n: (c) => c.items.length,
        run: (c) => {
            for (const r of c.items) {
                c.serializer.toJSON(r);
            }
        },
    },
    new_resource: {
        family: 'serializer',
        setup: (d) => {
            const mm = managerOf(d.models);
            const factory = new Factory(mm);
            const items = d.instances.map(({ fqn, id }) => {
                const decl = mm.getType(fqn);
                return [decl.getNamespace(), decl.getName(), id ?? undefined];
            });
            return { factory, items };
        },
        n: (c) => c.items.length,
        run: (c) => {
            for (const [ns, name, id] of c.items) {
                c.factory.newResource(ns, name, id);
            }
        },
    },
    // ---- Instance validation (P5-22, accordproject/concerto-rust#326) -------
    // Over the resources fromJSON builds (ValidatedResources). The calls are
    // chosen from each instance's JSON keys (not `$`-prefixed), the same way
    // p515_sweep.rs chooses them: every non-array property for
    // setPropertyValue (set to its current value), and every non-empty array
    // property for addArrayValue (its first element, popped again after the
    // call so the array does not grow).
    validate: {
        family: 'instance',
        setup: (d) => {
            const mm = managerOf(d.models);
            const serializer = new Serializer(new Factory(mm), mm);
            return { items: d.instances.map((i) => serializer.fromJSON(i.json)) };
        },
        n: (c) => c.items.length,
        run: (c) => {
            for (const r of c.items) {
                r.validate();
            }
        },
    },
    set_property_value: {
        family: 'instance',
        setup: (d) => {
            const mm = managerOf(d.models);
            const serializer = new Serializer(new Factory(mm), mm);
            const items = [];
            for (const i of d.instances) {
                const r = serializer.fromJSON(i.json);
                for (const [k, v] of Object.entries(i.json)) {
                    if (!k.startsWith('$') && !Array.isArray(v)) {
                        items.push([r, k, r[k]]);
                    }
                }
            }
            return { items };
        },
        n: (c) => c.items.length,
        run: (c) => {
            for (const [r, k, v] of c.items) {
                r.setPropertyValue(k, v);
            }
        },
    },
    add_array_value: {
        family: 'instance',
        setup: (d) => {
            const mm = managerOf(d.models);
            const serializer = new Serializer(new Factory(mm), mm);
            const items = [];
            for (const i of d.instances) {
                const r = serializer.fromJSON(i.json);
                for (const [k, v] of Object.entries(i.json)) {
                    if (!k.startsWith('$') && Array.isArray(v) && v.length > 0) {
                        items.push([r, k, r[k][0]]);
                    }
                }
            }
            return { items };
        },
        n: (c) => c.items.length,
        run: (c) => {
            for (const [r, k, v] of c.items) {
                r.addArrayValue(k, v);
                r[k].pop();
            }
        },
    },
    validate_instance: instanceCheck('validateInstance'),
    validate_instance_or_throw: instanceCheck('validateInstanceOrThrow'),
    // ---- DecoratorManager ---------------------------------------------------
    dcs_decorate: {
        family: 'decorator',
        setup: (d) => ({ mm: managerOf(d.models.filter((m) => d.dcsModels.includes(m.name))), dcs: d.dcs }),
        n: () => 1,
        run: (c) => DecoratorManager.decorateModels(c.mm, c.dcs, { validate: true, validateCommands: true }),
    },
    dcs_validate: {
        family: 'decorator',
        setup: (d) => {
            const mm = managerOf(d.models.filter((m) => d.dcsModels.includes(m.name)));
            return { files: mm.getModelFiles(), dcs: d.dcs };
        },
        n: () => 1,
        run: (c) => DecoratorManager.validate(c.dcs, c.files),
    },
    extract_decorators: {
        family: 'decorator',
        setup: (d) => {
            const mm = managerOf(d.models.filter((m) => d.dcsModels.includes(m.name)));
            return { mm: DecoratorManager.decorateModels(mm, d.dcs, { validate: true }) };
        },
        n: () => 1,
        run: (c) => DecoratorManager.extractDecorators(c.mm, { removeDecoratorsFromModel: true, locale: 'en' }),
    },
    extract_vocabularies: {
        family: 'decorator',
        setup: (d) => {
            const mm = managerOf(d.models.filter((m) => d.dcsModels.includes(m.name)));
            return { mm: DecoratorManager.decorateModels(mm, d.dcs, { validate: true }) };
        },
        n: () => 1,
        run: (c) => DecoratorManager.extractVocabularies(c.mm, { removeDecoratorsFromModel: true, locale: 'en' }),
    },
    // P5-55 (T1, F-A1, accordproject/concerto-rust#376): the cold
    // extract, the first call on a manager whose models have just changed.
    // `extract_decorators` above times the warm call (the same manager every
    // time). Each call here takes a manager it has not extracted from yet,
    // built (untimed) in setup, one per call the harness makes; a call past
    // the pool (--mode loop) builds its own, and that build is timed.
    extract_cold: {
        family: 'decorator',
        setup: (d) => {
            const build = () => DecoratorManager.decorateModels(
                managerOf(d.models.filter((m) => d.dcsModels.includes(m.name))), d.dcs, { validate: true });
            const pool = [];
            for (let i = 0; i < args.samples + args.warmup + 1; i++) {
                pool.push(build());
            }
            return { pool, build };
        },
        n: () => 1,
        run: (c) => DecoratorManager.extractDecorators(c.pool.pop() || c.build(), { removeDecoratorsFromModel: true, locale: 'en' }),
    },
    // P5-56 (T2, F-A2, accordproject/concerto-rust#377): the repeated
    // extract with `removeDecoratorsFromModel: false`, the case the engine's
    // per-epoch result memo serves (filled on the second call on the same
    // unchanged manager, used from the third). The same manager every time,
    // as `extract_decorators`, whose `removeDecoratorsFromModel: true` never
    // reads the memo.
    extract_keep: {
        family: 'decorator',
        setup: (d) => {
            const mm = managerOf(d.models.filter((m) => d.dcsModels.includes(m.name)));
            return { mm: DecoratorManager.decorateModels(mm, d.dcs, { validate: true }) };
        },
        n: () => 1,
        run: (c) => DecoratorManager.extractDecorators(c.mm, { removeDecoratorsFromModel: false, locale: 'en' }),
    },
    // ---- Introspection ------------------------------------------------------
    get_type: {
        family: 'introspect',
        setup: (d) => ({ mm: managerOf(d.models), items: d.pairs.map((p) => p[0]) }),
        n: (c) => c.items.length,
        run: (c) => {
            for (const fqn of c.items) {
                c.mm.getType(fqn);
            }
        },
    },
    resolve_type: {
        family: 'introspect',
        setup: (d) => ({ mm: managerOf(d.models), items: d.pairs.map((p) => p[0]) }),
        n: (c) => c.items.length,
        run: (c) => {
            for (const fqn of c.items) {
                c.mm.resolveType('p515', fqn);
            }
        },
    },
    get_decorators: {
        family: 'introspect',
        setup: (d) => {
            const mm = managerOf(d.models.filter((m) => d.dcsModels.includes(m.name)));
            const dec = DecoratorManager.decorateModels(mm, d.dcs, { validate: true });
            const decls = [];
            for (const mf of dec.getModelFiles()) {
                if (!mf.isSystemModelFile()) {
                    decls.push(...mf.getAllDeclarations());
                }
            }
            return { decls };
        },
        n: (c) => c.decls.length,
        run: (c) => {
            for (const decl of c.decls) {
                decl.getDecorators();
                decl.getDecorator('Term');
            }
        },
    },
    get_namespaces: {
        family: 'introspect',
        setup: (d) => ({ mm: managerOf(d.models) }),
        n: () => 1,
        run: (c) => c.mm.getNamespaces(),
    },
    get_type_first: {
        family: 'introspect',
        setup: (d) => ({ mm: managerOf(d.models), items: d.pairs.map((p) => p[0]) }),
        n: (c) => c.items.length,
        run: (c) => {
            bumpModelEpoch(c.mm);
            for (const fqn of c.items) {
                c.mm.getType(fqn);
            }
        },
    },
    resolve_type_first: {
        family: 'introspect',
        setup: (d) => ({ mm: managerOf(d.models), items: d.pairs.map((p) => p[0]) }),
        n: (c) => c.items.length,
        run: (c) => {
            bumpModelEpoch(c.mm);
            for (const fqn of c.items) {
                c.mm.resolveType('p515', fqn);
            }
        },
    },
    get_namespaces_first: {
        family: 'introspect',
        setup: (d) => ({ mm: managerOf(d.models) }),
        n: () => 1,
        run: (c) => {
            bumpModelEpoch(c.mm);
            return c.mm.getNamespaces();
        },
    },
    derives_from: {
        family: 'introspect',
        setup: (d) => ({ mm: managerOf(d.models), items: d.pairs }),
        n: (c) => c.items.length,
        run: (c) => {
            for (const [a, b] of c.items) {
                c.mm.derivesFrom(a, b);
            }
        },
    },
    is_assignable_to: {
        family: 'introspect',
        setup: (d) => ({ mm: managerOf(d.models), items: d.pairs }),
        n: (c) => c.items.length,
        run: (c) => {
            for (const [a, b] of c.items) {
                c.mm.isAssignableTo(a, b);
            }
        },
    },
    // P5-106 (accordproject/concerto-rust#460, BC-52): the subclass queries,
    // over the class declarations the `pairs` name (each once).
    get_assignable_class_declarations: {
        family: 'introspect',
        setup: (d) => subclassQueryItems(d),
        n: (c) => c.items.length,
        run: (c) => {
            for (const decl of c.items) {
                decl.getAssignableClassDeclarations();
            }
        },
    },
    get_direct_subclasses: {
        family: 'introspect',
        setup: (d) => subclassQueryItems(d),
        n: (c) => c.items.length,
        run: (c) => {
            for (const decl of c.items) {
                decl.getDirectSubclasses();
            }
        },
    },
};

/**
 * P5-106: the class declarations the set's `pairs` name, each once, in the
 * order first named, on a manager of the set's models.
 * @param {object} d the set's data
 * @return {object} the op context: the manager and the declarations
 */
function subclassQueryItems(d) {
    const mm = managerOf(d.models);
    const names = [...new Set(d.pairs.flat())];
    const items = names.map((fqn) => mm.getType(fqn)).filter((decl) => typeof decl.getAssignableClassDeclarations === 'function');
    return { mm, items };
}

function selected() {
    const ops = args.ops || Object.keys(OPS);
    const out = [];
    for (const op of ops) {
        if (!OPS[op]) {
            throw new Error(`unknown op ${op}`);
        }
        for (const set of args.sets) {
            if (OPS[op].setOnly && OPS[op].setOnly !== set) {
                continue;
            }
            out.push([op, set]);
        }
    }
    return out;
}

function loadavg() {
    return os.loadavg().map((x) => Number(x.toFixed(2)));
}

function commit() {
    try {
        return execSync('git rev-parse --short HEAD', { cwd: REPO_ROOT }).toString().trim();
    } catch (e) {
        return null;
    }
}

const data = {};
const get = (set) => (data[set] = data[set] || loadSet(set));
const results = [];

if (args.mode === 'loop') {
    const [[op, set]] = selected();
    const def = OPS[op];
    const ctx = def.setup(get(set));
    const end = Date.now() + args.seconds * 1000;
    // Named so p515-cpuprof.mjs can keep only the samples under it.
    const p515MeasuredLoop = () => {
        let calls = 0;
        while (Date.now() < end) {
            def.run(ctx);
            calls++;
        }
        return calls;
    };
    const calls = p515MeasuredLoop();
    console.error(`${op}/${set}: ${calls} calls, ${def.n(ctx)} items each`);
    process.exit(0);
}

for (const [op, set] of selected()) {
    const def = OPS[op];
    let ctx;
    try {
        ctx = def.setup(get(set));
        def.run(ctx);
    } catch (e) {
        results.push({ op, family: def.family, set, error: `${e.constructor.name}: ${e.message}`.slice(0, 300) });
        console.error(`${op}/${set}: ERROR ${e.message}`);
        continue;
    }
    const n = def.n(ctx);
    if (args.mode === 'count') {
        for (let i = 0; i < args.warmup; i++) {
            def.run(ctx);
        }
        const stats = globalThis.__p515Crossings;
        for (const k of Object.keys(stats)) {
            delete stats[k];
        }
        const reps = Math.max(3, args.samples);
        const t0 = process.hrtime.bigint();
        for (let i = 0; i < reps; i++) {
            def.run(ctx);
        }
        const totalNs = Number(process.hrtime.bigint() - t0);
        const bindings = Object.entries(stats)
            .map(([name, s]) => ({ name, perItem: s.calls / reps / n, usPerItem: s.ns / reps / n / 1000 }))
            .sort((a, b) => b.usPerItem - a.usPerItem);
        const crossings = bindings.reduce((x, b) => x + b.perItem, 0);
        const inEngineUs = bindings.reduce((x, b) => x + b.usPerItem, 0);
        const wallUs = totalNs / reps / n / 1000;
        results.push({ op, family: def.family, set, n, wallUs, crossings, inEngineUs, bindings });
        console.log(
            `${op.padEnd(22)} ${set.padEnd(24)} n=${String(n).padStart(4)} wall ${wallUs.toFixed(2).padStart(10)} us/item` +
            `  crossings ${crossings.toFixed(1).padStart(7)}/item  in-engine ${inEngineUs.toFixed(2).padStart(9)} us` +
            ` (${((100 * inEngineUs) / wallUs).toFixed(0)}%)  top: ${bindings.slice(0, 3).map((b) => `${b.name} x${b.perItem.toFixed(1)}`).join(', ')}`,
        );
    } else {
        const s = timeit(() => def.run(ctx), { samples: args.samples, warmup: args.warmup, n });
        const medianUs = s.median_ms * 1000;
        results.push({ op, family: def.family, set, n, medianUs, ...s });
        console.log(`${op.padEnd(22)} ${set.padEnd(24)} n=${String(n).padStart(4)} ${medianUs.toFixed(2).padStart(10)} us/item cv ${(s.cv * 100).toFixed(1)}%`);
    }
}

const out = {
    tool: 'p515-sweep', mode: args.mode, coreDist: args.coreDist, coreVersion, commit: commit(),
    ...(args.mmOptions === undefined ? {} : { mmOptions: args.mmOptions }),
    node: process.version, cpu: os.cpus()[0].model, loadavgEnd: loadavg(), samples: args.samples, warmup: args.warmup,
    results,
};
if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(out, null, 2));
}
