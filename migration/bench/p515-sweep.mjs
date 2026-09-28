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
        mode: 'time', ops: null, sets: SETS, samples: 30, warmup: 5, seconds: 20, out: null,
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

function loadSet(set) {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'p515', `${set}.json`), 'utf8'));
}

function managerOf(models) {
    const mm = new ModelManager();
    for (const { name, ast } of models) {
        mm.addModelFile(new ModelFile(mm, ast, undefined, name));
    }
    return mm;
}

// Each op: setup(data) -> ctx, then run(ctx) does `n(ctx)` items.
const OPS = {
    // ---- Model load ------------------------------------------------------
    mm_new: {
        family: 'load', setOnly: 'conformance',
        setup: () => ({}), n: () => 1,
        run: () => new ModelManager(),
    },
    modelfile_new: {
        family: 'load',
        setup: (d) => ({ mm: new ModelManager(), models: d.models }),
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
            const mm = new ModelManager();
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
};

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
    node: process.version, cpu: os.cpus()[0].model, loadavgEnd: loadavg(), samples: args.samples, warmup: args.warmup,
    results,
};
if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(out, null, 2));
}
