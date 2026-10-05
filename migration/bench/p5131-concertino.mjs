#!/usr/bin/env node
// P5-131 (accordproject/concerto-rust#508): Concertino's speed rows (P5-127
// to P5-130, P5-133). Measure only.
//
//   node migration/bench/p5131-concertino.mjs --mode prep --docs DIR
//   node migration/bench/p5131-concertino.mjs --mode time --side concertino|now|ts5 --docs DIR --out FILE
//       [--core-dist DIR] [--concertino-dist DIR] [--samples N] [--warmup N]
//
// --mode prep  with this checkout's concerto-core (the Rust engine through
//              the TS API): for each p515 set, `ModelManager.toConcertino()`
//              of a manager of the set's models, written to DIR/<set>.json,
//              and the instances `@accordproject/concertino/validate`
//              accepts (DIR/<set>.instances.json: their indices), so every
//              side validates the same documents.
// --mode time  one side per process:
//   concertino  `./runtime` `load` of the document, then `./validate`
//               `validate(m, json)` (fromJSON with validation, R1 semantics)
//               over the instances, and `./runtime` getType, derivesFrom,
//               isAssignableTo and getProperties over the set's `pairs`;
//   now         this checkout's concerto-core over the engine: the same
//               instances through `Serializer.fromJSON` (which validates)
//               and `ModelManager.validateInstance`, the same reads
//               (getType, derivesFrom, isAssignableTo,
//               getType(fqn).getProperties()), and `toConcertino()` of the
//               set's manager;
//   ts5         published concerto-core 5.0.0, `Serializer.fromJSON` and
//               the same reads.
// Each figure is the median us per item over --samples timed passes (after
// --warmup), as p515-sweep.mjs; p5131-extras-run.sh runs three rounds and
// p5131-extras-table.mjs takes the median of the rounds.

import fs from 'fs';
import os from 'os';
import path from 'path';
import url from 'url';
import { createRequire } from 'module';
import { timeit } from './lib/timeit.mjs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SETS = ['concerto-core-test-data', 'conformance', 'synthetic-large'];
const REF = path.join(REPO_ROOT, 'migration', 'oracle', 'reference', 'node_modules', '@accordproject', 'concerto-core', 'dist');

const args = { mode: 'time', side: 'now', docs: null, out: null, samples: 30, warmup: 5,
    coreDist: path.join(REPO_ROOT, 'packages', 'concerto-core', 'dist'),
    concertinoDist: path.join(REPO_ROOT, 'packages', 'concertino', 'dist') };
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    const v = () => argv[++i];
    if (k === '--mode') { args.mode = v(); }
    else if (k === '--side') { args.side = v(); }
    else if (k === '--docs') { args.docs = path.resolve(v()); }
    else if (k === '--out') { args.out = path.resolve(v()); }
    else if (k === '--samples') { args.samples = Number(v()); }
    else if (k === '--warmup') { args.warmup = Number(v()); }
    else if (k === '--core-dist') { args.coreDist = path.resolve(v()); }
    else if (k === '--concertino-dist') { args.concertinoDist = path.resolve(v()); }
    else { throw new Error(`unknown argument: ${k}`); }
}
if (args.side === 'ts5' && !argv.includes('--core-dist')) {
    args.coreDist = REF;
}

// P5-56's enum isAbstract drop, as p515-sweep.mjs.
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

function managerOf(core, models) {
    const mm = new core.ModelManager();
    for (const { name, ast } of models) {
        mm.addModelFile(new core.ModelFile(mm, ast, undefined, name));
    }
    return mm;
}

const time = (run, n) => {
    const s = timeit(run, { samples: args.samples, warmup: args.warmup, n });
    return { n, medianUs: s.median_ms * 1000, cv: s.cv };
};

if (args.mode === 'prep') {
    const core = require(path.join(args.coreDist, 'index.js'));
    const { load } = require(path.join(args.concertinoDist, 'runtime.js'));
    const { validate } = require(path.join(args.concertinoDist, 'validate.js'));
    fs.mkdirSync(args.docs, { recursive: true });
    for (const set of SETS) {
        const d = loadSet(set);
        const mm = managerOf(core, d.models);
        let doc;
        try {
            doc = mm.toConcertino();
        } catch (e) {
            console.log(`${set}: toConcertino throws ${e.constructor.name}: ${e.message}`);
            continue;
        }
        fs.writeFileSync(path.join(args.docs, `${set}.json`), JSON.stringify(doc));
        const m = load(doc);
        const ok = [];
        const rejected = [];
        d.instances.forEach((inst, i) => {
            try {
                validate(m, inst.json);
                ok.push(i);
            } catch (e) {
                rejected.push({ i, fqn: inst.fqn, error: `${e.name}: ${e.message}`.slice(0, 200) });
            }
        });
        fs.writeFileSync(path.join(args.docs, `${set}.instances.json`), JSON.stringify({ ok, rejected, total: d.instances.length }, null, 2));
        console.log(`${set}: document ${JSON.stringify(doc).length} bytes, ${Object.keys(doc.declarations).length} declarations; ${ok.length} of ${d.instances.length} instances validate`);
    }
    process.exit(0);
}

const results = [];
const push = (op, set, r) => {
    results.push({ op, set, ...r });
    console.log(`${args.side.padEnd(10)} ${op.padEnd(18)} ${set.padEnd(24)} n=${String(r.n).padStart(4)} ${r.medianUs.toFixed(2).padStart(10)} us/item cv ${(r.cv * 100).toFixed(1)}%`);
};

for (const set of SETS) {
    const d = loadSet(set);
    const docFile = path.join(args.docs, `${set}.json`);
    if (!fs.existsSync(docFile)) {
        continue;
    }
    const subset = JSON.parse(fs.readFileSync(path.join(args.docs, `${set}.instances.json`), 'utf8')).ok;
    const items = subset.map((i) => d.instances[i].json);
    const types = d.pairs.map((p) => p[0]);
    if (args.side === 'concertino') {
        const runtime = require(path.join(args.concertinoDist, 'runtime.js'));
        const { validate } = require(path.join(args.concertinoDist, 'validate.js'));
        const doc = JSON.parse(fs.readFileSync(docFile, 'utf8'));
        push('load', set, time(() => runtime.load(doc), 1));
        const m = runtime.load(doc);
        push('validate', set, time(() => {
            for (const json of items) {
                validate(m, json);
            }
        }, items.length));
        push('get_type', set, time(() => {
            for (const fqn of types) {
                runtime.getType(m, fqn);
            }
        }, types.length));
        push('derives_from', set, time(() => {
            for (const [a, b] of d.pairs) {
                runtime.derivesFrom(m, a, b);
            }
        }, d.pairs.length));
        push('is_assignable_to', set, time(() => {
            for (const [a, b] of d.pairs) {
                runtime.isAssignableTo(m, a, b);
            }
        }, d.pairs.length));
        push('get_properties', set, time(() => {
            for (const fqn of types) {
                runtime.getProperties(m, fqn);
            }
        }, types.length));
    } else {
        const core = require(path.join(args.coreDist, 'index.js'));
        const mm = managerOf(core, d.models);
        const serializer = new core.Serializer(new core.Factory(mm), mm);
        push('validate', set, time(() => {
            for (const json of items) {
                serializer.fromJSON(json);
            }
        }, items.length));
        if (typeof mm.validateInstance === 'function') {
            push('validate_instance', set, time(() => {
                for (const json of items) {
                    mm.validateInstance(json);
                }
            }, items.length));
        }
        push('get_type', set, time(() => {
            for (const fqn of types) {
                mm.getType(fqn);
            }
        }, types.length));
        push('derives_from', set, time(() => {
            for (const [a, b] of d.pairs) {
                mm.derivesFrom(a, b);
            }
        }, d.pairs.length));
        push('is_assignable_to', set, time(() => {
            for (const [a, b] of d.pairs) {
                mm.isAssignableTo(a, b);
            }
        }, d.pairs.length));
        push('get_properties', set, time(() => {
            for (const fqn of types) {
                const decl = mm.getType(fqn);
                if (decl.getProperties) {
                    decl.getProperties();
                }
            }
        }, types.length));
        if (typeof mm.toConcertino === 'function') {
            push('to_concertino', set, time(() => mm.toConcertino(), 1));
        }
    }
}

const out = { tool: 'p5131-concertino', side: args.side, coreDist: args.side === 'concertino' ? null : args.coreDist,
    concertinoDist: args.side === 'concertino' ? args.concertinoDist : null, node: process.version, cpu: os.cpus()[0].model,
    loadavgEnd: os.loadavg(), samples: args.samples, warmup: args.warmup, results };
if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true });
    fs.writeFileSync(args.out, JSON.stringify(out, null, 2));
}
