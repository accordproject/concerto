#!/usr/bin/env node
// P5-15 (accordproject/concerto-rust#309): derives the extra inputs the
// profiling sweep needs from the committed model sets, once, with the TS
// reference concerto-core 5.0.0 (migration/oracle/reference), so every
// engine is measured on byte-identical inputs:
//
//   fixtures/p515/<set>.json = {
//     models:    [{ name, ast, cto }]   the set's ASTs plus Printer.toCTO text
//     instances: [{ fqn, id, json }]      one sample instance per concrete
//                                       class declaration (seeded PRNG),
//                                       kept only when fromJSON/toJSON
//                                       round-trips on 5.0.0
//     dcs:       DecoratorCommandSet    @Form on every StringProperty, plus
//                                       @Term and @Bench on every declaration
//     pairs:     [[fqn, superFqn]]      derivesFrom/isAssignableTo inputs
//   }
//
//   node migration/bench/p515-prepare.mjs
//
// Measure only: nothing here is used by concerto-core or its tests.

import fs from 'fs';
import path from 'path';
import url from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const REF = path.resolve(__dirname, '..', 'oracle', 'reference', 'node_modules', '@accordproject');
const SETS = ['concerto-core-test-data', 'conformance', 'synthetic-large'];
const OUT = path.join(__dirname, 'fixtures', 'p515');

// mulberry32: the sample generator draws from Math.random.
function seeded(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
Math.random = seeded(20260928);
// Sample DateTime values and $timestamps read the clock; freeze it.
process.env.TZ = 'UTC';
const FIXED_NOW = Date.UTC(2026, 0, 1);
const RealDate = Date;
globalThis.Date = class extends RealDate {
    constructor(...args) {
        super(...(args.length ? args : [FIXED_NOW]));
    }
    static now() {
        return FIXED_NOW;
    }
};

const core = require(path.join(REF, 'concerto-core'));
const { Printer } = require(path.join(REF, 'concerto-cto'));
const { ModelManager, ModelFile, Factory, Serializer } = core;

const SYSTEM = new Set(['concerto@1.0.0', 'concerto']);
const DCS_NS = 'org.accordproject.decoratorcommands@0.4.0';

function decorator(name, value) {
    return {
        $class: 'concerto.metamodel@1.0.0.Decorator',
        name,
        arguments: value === undefined ? [] : [{ $class: 'concerto.metamodel@1.0.0.DecoratorString', value }],
    };
}

// Transactions and events carry a wall-clock $timestamp; pin it.
function fixTimestamps(v) {
    if (Array.isArray(v)) {
        v.forEach(fixTimestamps);
    } else if (v && typeof v === 'object') {
        for (const k of Object.keys(v)) {
            if (k === '$timestamp') {
                v[k] = '2026-01-01T00:00:00.000Z';
            } else {
                fixTimestamps(v[k]);
            }
        }
    }
    return v;
}

function command(target, dec) {
    return {
        $class: `${DCS_NS}.Command`,
        type: 'UPSERT',
        target: { $class: `${DCS_NS}.CommandTarget`, ...target },
        decorator: dec,
    };
}

function prepare(set) {
    const dir = path.join(__dirname, 'fixtures', 'model-sets', set);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
    const models = files.map((name) => {
        const ast = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
        return { name, ast, cto: Printer.toCTO(ast) };
    });

    const mm = new ModelManager();
    for (const { name, ast } of models) {
        mm.addModelFile(new ModelFile(mm, ast, undefined, name));
    }
    // The CTO text must load too, or addCTOModel measures an error path.
    const check = new ModelManager();
    for (const { name, cto } of models) {
        check.addCTOModel(cto, name);
    }

    const factory = new Factory(mm);
    const serializer = new Serializer(factory, mm);
    const instances = [];
    const pairs = [];
    const commands = [
        command({ type: 'concerto.metamodel@1.0.0.StringProperty' }, decorator('Form', 'text')),
    ];
    let skipped = 0;
    for (const mf of mm.getModelFiles()) {
        const ns = mf.getNamespace();
        if (SYSTEM.has(ns) || mf.isSystemModelFile?.()) {
            continue;
        }
        for (const decl of mf.getAllDeclarations()) {
            const name = decl.getName();
            const fqn = decl.getFullyQualifiedName();
            commands.push(command({ namespace: ns, declaration: name }, decorator('Term', `${name} term`)));
            commands.push(command({ namespace: ns, declaration: name }, decorator('Bench')));
            if (typeof decl.getSuperType === 'function' && decl.isClassDeclaration?.()) {
                const sup = decl.getSuperType();
                pairs.push([fqn, sup || fqn]);
            }
            if (!decl.isClassDeclaration?.() || decl.isAbstract() || decl.isEnum?.() || decl.isMapDeclaration?.()) {
                continue;
            }
            try {
                const idField = decl.getIdentifierFieldName();
                const id = idField ? `id-${instances.length}` : undefined;
                const r = factory.newResource(ns, name, id, { generate: 'sample', includeOptionalFields: true });
                const json = fixTimestamps(serializer.toJSON(r));
                serializer.toJSON(serializer.fromJSON(json));
                instances.push({ fqn, id: id ?? null, json });
            } catch (e) {
                skipped++;
            }
        }
    }
    const dcs = {
        $class: `${DCS_NS}.DecoratorCommandSet`,
        name: `p515-${set}`,
        version: '1.0.0',
        commands,
    };
    // The DecoratorManager ops run over the models whose metamodel
    // resolution succeeds on 5.0.0 (org.acme in core-test-data names an
    // undeclared decorator type reference, which decorateModels rejects).
    const dcsModels = models.filter(({ name, ast }) => {
        const one = new ModelManager();
        try {
            one.addModelFile(new ModelFile(one, ast, undefined, name));
            core.DecoratorManager.decorateModels(one, { ...dcs, commands: dcs.commands.slice(0, 1) }, { validate: true });
            return true;
        } catch (e) {
            return false;
        }
    }).map(({ name }) => name);
    const dmm = new ModelManager();
    for (const { name, ast } of models.filter((m) => dcsModels.includes(m.name))) {
        dmm.addModelFile(new ModelFile(dmm, ast, undefined, name));
    }
    const dmmNs = new Set(dmm.getNamespaces());
    dcs.commands = dcs.commands.filter((c) => !c.target.namespace || dmmNs.has(c.target.namespace));
    // The DCS must apply cleanly on 5.0.0.
    core.DecoratorManager.decorateModels(dmm, dcs, { validate: true, validateCommands: true });
    return { set, models, instances, dcs, dcsModels, pairs, skippedInstances: skipped };
}

fs.mkdirSync(OUT, { recursive: true });
for (const set of SETS) {
    const out = prepare(set);
    fs.writeFileSync(path.join(OUT, `${set}.json`), JSON.stringify(out));
    console.log(
        `${set}: ${out.models.length} models, ${out.instances.length} instances ` +
        `(${out.skippedInstances} skipped), ${out.dcs.commands.length} DCS commands over ${out.dcsModels.length} models, ${out.pairs.length} pairs`,
    );
}
