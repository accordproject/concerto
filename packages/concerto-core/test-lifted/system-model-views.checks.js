/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/**
 * P5-124 lifted checks (accordproject/concerto-rust#501): `new
 * ModelManager()`, `clearModelFiles()` and `fromAst` register the decorator
 * and root models (`concerto.decorator@1.0.0`, `concerto@1.0.0`) as views
 * of the copies the manager's engine handle loaded itself
 * (`BaseModelManager._adoptPreloadedModel`, `ModelFile._systemView`),
 * instead of building a ModelFile from each AST and adding it.
 *
 * The views answer as v5.0.0's ModelFiles did: the namespace, file name,
 * CTO text, AST (deep-equal, and the same key order), system flag,
 * version, imports, declarations and decorators, their manager, their
 * order in `getModelFiles(true)` and `getAst()`, and the instances of their
 * types the Serializer writes and reads. `expect` is v5.0.0's answer
 * (system-model-views.expect.json, as reference@5.0.0 gives it). The
 * manager's own `addDecoratorModel`/`addRootModel`, and a subclass's
 * `addModelFile`, are called as v5.0.0 called them. P5124-VIEW-007 (the
 * workspace only) checks that nothing is loaded, staged, dropped or
 * written in the engine for them, that they are not added as new files,
 * and that their declarations are read from the engine's copies. Run by fallbacks.spec.js.
 */

const EXPECT = require('./system-model-views.expect.json');

const SYSTEM = ['concerto.decorator@1.0.0', 'concerto@1.0.0'];

const USER_CTO = `namespace test@1.0.0

concept Address {
    o String city
}

asset Thing identified by id {
    o String id
    o Address address optional
}
`;

/**
 * Every key of `value`, depth first in insertion order, so two ASTs with
 * equal key lists have the same key order.
 * @param {*} value an AST node
 * @param {string[]} [out] the keys so far
 * @returns {string[]} the keys
 */
function keyOrder(value, out = []) {
    if (Array.isArray(value)) {
        value.forEach((v) => keyOrder(v, out));
    } else if (value !== null && typeof value === 'object') {
        for (const key of Object.keys(value)) {
            out.push(key);
            keyOrder(value[key], out);
        }
    }
    return out;
}

/**
 * What a manager's system model files answer, in `getModelFiles(true)`
 * order.
 * @param {object} mm the model manager
 * @returns {object[]} one record per system file
 */
function systemFiles(mm) {
    return mm.getModelFiles(true).filter((f) => SYSTEM.includes(f.getNamespace())).map((f) => ({
        namespace: f.getNamespace(),
        name: f.getName(),
        definitions: f.getDefinitions(),
        ast: f.getAst(),
        keys: keyOrder(f.getAst()),
        system: f.isSystemModelFile(),
        version: f.getVersion(),
        external: f.isExternal(),
        imports: f.getImports(),
        declarations: f.getAllDeclarations().map((d) => [
            d.getFullyQualifiedName(),
            d.isAbstract(),
            d.isIdentified(),
            d.getSuperType(),
            d.getProperties().map((p) => [p.getName(), p.getType()]),
        ]),
        decorators: f.getDecorators().map((d) => [d.getName(), d.getArguments()]),
        manager: f.getModelManager() === mm,
    }));
}

/**
 * The manager's namespace order, with and without the system files, and
 * its whole AST's text (which keeps the key order).
 * @param {object} mm the model manager
 * @returns {object} the order and the text
 */
function managerOrder(mm) {
    return {
        files: mm.getModelFiles(true).map((f) => f.getNamespace()),
        userFiles: mm.getModelFiles().map((f) => f.getNamespace()),
        namespaces: mm.getNamespaces(),
        ast: JSON.stringify(mm.getAst(false, true)),
    };
}

/**
 * A manager holding the user model.
 * @param {object} core the loaded core
 * @param {object} [options] the ModelManager options
 * @returns {object} the model manager
 */
function withUserModel(core, options) {
    const mm = new core.ModelManager(options);
    mm.addCTOModel(USER_CTO, 'test.cto');
    return mm;
}

/**
 * Wraps `handle`'s engine bindings named in `names`, counting their calls.
 * @param {object} handle a rustHandle
 * @param {string[]} names the bindings
 * @returns {object} the call counts, by name
 */
function countCalls(handle, names) {
    const counts = {};
    for (const name of names) {
        counts[name] = 0;
        const original = handle[name];
        if (typeof original !== 'function') {
            continue;
        }
        handle[name] = function (...args) {
            counts[name]++;
            return original.apply(this, args);
        };
    }
    return counts;
}

/** The handle bindings that load, stage, drop or write a model file. */
const WRITES = [
    'stageModelFileBytes',
    'dropStagedModelFile',
    'commitStagedModelFile',
    'commitStagedModelFiles',
    'validateAndCommitStagedModelFile',
    'addModelWithDefinitions',
];

const METAMODEL_NS = 'concerto.metamodel@1.0.0';

/**
 * The error class `fn` throws, or 'ok'.
 * @param {Function} fn the call
 * @returns {string} the outcome
 */
function outcome(fn) {
    try {
        fn();
        return 'ok';
    } catch (e) {
        return e.constructor.name;
    }
}

/**
 * What a manager's `metamodelModelFile` answers, and the property's shape.
 * @param {object} mm the model manager
 * @returns {object} the record
 */
function metamodelCopy(mm) {
    const enumerable = Object.keys(mm).includes('metamodelModelFile');
    const copy = mm.metamodelModelFile;
    const descriptor = Object.getOwnPropertyDescriptor(mm, 'metamodelModelFile');
    return {
        enumerable,
        own: descriptor !== undefined && descriptor.enumerable && 'value' in descriptor && descriptor.value === copy,
        stable: mm.metamodelModelFile === copy,
        isModelFile: copy.constructor === mm.getModelFile('concerto@1.0.0').constructor,
        manager: copy.getModelManager() === mm,
        namespace: copy.getNamespace(),
        name: copy.getName(),
        definitions: copy.getDefinitions(),
        version: copy.getVersion(),
        system: copy.isSystemModelFile(),
        keys: keyOrder(copy.getAst()).length,
        declarations: copy.getAllDeclarations().map((d) => d.getFullyQualifiedName()),
        decorators: copy.getDecorators().map((d) => [d.getName(), d.getArguments()]),
        registered: mm.getModelFile(METAMODEL_NS) === copy,
    };
}

/** Three models, the second importing the first, for `fromAst`. */
const FROM_AST_CTO = [
    'namespace org.p5124.a@1.0.0\nconcept A { o String a }\n',
    'namespace org.p5124.b@1.0.0\nimport org.p5124.a@1.0.0.{A}\nconcept B extends A { o String b }\n',
    'namespace org.p5124.c@1.0.0\nconcept C { o Integer c }\n',
];

/**
 * The `Models` AST of `FROM_AST_CTO`.
 * @param {object} core the loaded core
 * @returns {object} the AST, with the system models
 */
function fromAstSource(core) {
    const mm = new core.ModelManager();
    FROM_AST_CTO.forEach((cto, i) => mm.addCTOModel(cto, `m${i}.cto`));
    return mm.getAst(false, true);
}

/**
 * What `fromAst` leaves in `mm`, and the outcome of the call.
 * @param {object} mm the model manager
 * @param {object} ast the `Models` AST
 * @param {object} [options] fromAst's options
 * @returns {object} the record
 */
function loadFromAst(mm, ast, options) {
    const result = outcome(() => mm.fromAst(ast, options));
    return {
        result,
        namespaces: mm.getNamespaces(),
        ast: JSON.stringify(mm.getAst(false, true)),
        names: mm.getModelFiles().map((f) => f.getName()),
        types: mm.getModelFiles().map((f) => f.getAllDeclarations().map((d) => d.getFullyQualifiedName())),
    };
}

module.exports = [
    {
        id: 'P5124-VIEW-001',
        covers: 'P5-124: a new ModelManager\'s system model files answer as v5.0.0\'s: name, CTO text, AST and its key order, version, imports, declarations, decorators and manager',
        run: (core) => [undefined, { metamodelValidation: false }].map((options) => systemFiles(new core.ModelManager(options))),
        expect: { ok: [EXPECT.files, EXPECT.files] },
    },
    {
        id: 'P5124-VIEW-002',
        covers: 'P5-124: the system files keep v5.0.0\'s place in getModelFiles(true), getNamespaces() and getAst(false, true)',
        run: (core) => [new core.ModelManager(), withUserModel(core)].map(managerOrder),
        expect: { ok: [EXPECT.emptyOrder, EXPECT.userOrder] },
    },
    {
        id: 'P5124-VIEW-003',
        covers: 'P5-124: after clearModelFiles(), fromAst() and fork(), with and without the shape check and with a decorator factory, the system files answer as v5.0.0\'s',
        run: (core) => {
            const managers = [];
            for (const options of [undefined, { metamodelValidation: false }]) {
                const cleared = withUserModel(core, options);
                cleared.clearModelFiles();
                managers.push(cleared);
                const source = withUserModel(core, options);
                const loaded = new core.ModelManager(options);
                loaded.fromAst(source.getAst());
                managers.push(loaded);
                if (typeof source.fork === 'function') {
                    managers.push(source.fork());
                } else {
                    // v5.0.0 has no fork(): the manager itself answers.
                    managers.push(source);
                }
                const decorated = withUserModel(core, options);
                decorated.addDecoratorFactory({ newDecorator: () => null });
                decorated.clearModelFiles();
                managers.push(decorated);
            }
            return managers.map((mm) => [systemFiles(mm), managerOrder(mm).files]);
        },
        expect: { ok: [
            [EXPECT.files, EXPECT.emptyOrder.files],
            [EXPECT.files, EXPECT.userOrder.files],
            [EXPECT.files, EXPECT.userOrder.files],
            [EXPECT.files, EXPECT.emptyOrder.files],
            [EXPECT.files, EXPECT.emptyOrder.files],
            [EXPECT.files, EXPECT.userOrder.files],
            [EXPECT.files, EXPECT.userOrder.files],
            [EXPECT.files, EXPECT.emptyOrder.files],
        ] },
    },
    {
        id: 'P5124-VIEW-004',
        covers: 'P5-124: each manager has its own copy of the system ASTs, which getAst() returns itself, as in v5.0.0',
        run: (core) => {
            const first = new core.ModelManager();
            const ast = first.getModelFile('concerto@1.0.0').getAst();
            const same = ast === first.getModelFile('concerto@1.0.0').getAst();
            ast.extra = 'first';
            const second = new core.ModelManager();
            return [
                same,
                first.getModelFile('concerto@1.0.0').getAst().extra,
                second.getModelFile('concerto@1.0.0').getAst().extra,
                first.getModelFile('concerto.decorator@1.0.0').getAst() === second.getModelFile('concerto.decorator@1.0.0').getAst(),
            ];
        },
        expect: { ok: [true, 'first', '<undefined>', false] },
    },
    {
        id: 'P5124-VIEW-005',
        covers: 'P5-124: addRootModel() and addDecoratorModel() throw for a namespace already declared, and add the model again after it was deleted, as in v5.0.0',
        run: (core) => {
            const probe = (fn) => {
                try {
                    fn();
                    return 'ok';
                } catch (e) {
                    return e.constructor.name;
                }
            };
            const mm = new core.ModelManager();
            const again = [probe(() => mm.addRootModel()), probe(() => mm.addDecoratorModel())];
            const deleted = new core.ModelManager();
            const removed = [probe(() => deleted.deleteModelFile('concerto@1.0.0')), deleted.getNamespaces()];
            const readded = probe(() => deleted.addRootModel());
            return [again, removed, readded, systemFiles(deleted), mm.getNamespaces()];
        },
        expect: { ok: [
            ['Error', 'Error'],
            ['ok', ['concerto.decorator@1.0.0']],
            'ok',
            EXPECT.files,
            ['concerto.decorator@1.0.0', 'concerto@1.0.0'],
        ] },
    },
    {
        id: 'P5124-VIEW-006',
        covers: 'P5-124: a subclass\'s addModelFile is called for the system models, and a subclass\'s addRootModel replaces the root model\'s registration, as in v5.0.0',
        run: (core) => {
            const calls = [];
            /** A manager recording its addModelFile calls. */
            class Tracking extends core.ModelManager {
                /**
                 * Records the call, then adds the file.
                 * @param {object} modelFile the model file
                 * @param {string} [cto] the CTO text
                 * @param {string} [fileName] the file name
                 * @param {boolean} [disableValidation] whether validation is skipped
                 * @returns {object} the added file
                 */
                addModelFile(modelFile, cto, fileName, disableValidation) {
                    calls.push([modelFile.getNamespace(), cto === modelFile.getDefinitions(), fileName, disableValidation]);
                    return super.addModelFile(modelFile, cto, fileName, disableValidation);
                }
            }
            const tracking = new Tracking();
            const constructed = calls.splice(0);
            tracking.clearModelFiles();
            const cleared = calls.splice(0);
            /** A manager that does not register the root model. */
            class NoRoot extends core.ModelManager {
                /** Registers nothing. */
                addRootModel() {
                }
            }
            const noRoot = new NoRoot();
            return [constructed, cleared, systemFiles(tracking), noRoot.getNamespaces()];
        },
        expect: { ok: [
            [['concerto.decorator@1.0.0', true, 'concerto_decorator_1.0.0.cto', true], ['concerto@1.0.0', true, 'concerto_1.0.0.cto', true]],
            [['concerto.decorator@1.0.0', true, 'concerto_decorator_1.0.0.cto', true], ['concerto@1.0.0', true, 'concerto_1.0.0.cto', true]],
            EXPECT.files,
            ['concerto.decorator@1.0.0'],
        ] },
    },
    {
        id: 'P5124-VIEW-009',
        covers: 'P5-124: with the system model helpers replaced (here by wrappers returning the same models), the manager registers what they return, as in v5.0.0',
        run: (core) => {
            const helpers = [
                [core.req('rootmodelhelper').default, 'getRootModel'],
                [core.req('decoratormodelhelper').default, 'getDecoratorModel'],
            ];
            const originals = helpers.map(([module, name]) => module[name]);
            let calls = 0;
            helpers.forEach(([module, name], i) => {
                module[name] = (...args) => {
                    calls++;
                    return originals[i](...args);
                };
            });
            try {
                const mm = withUserModel(core);
                mm.clearModelFiles();
                return [calls, systemFiles(mm), managerOrder(mm).files];
            } finally {
                helpers.forEach(([module, name], i) => {
                    module[name] = originals[i];
                });
            }
        },
        expect: { ok: [4, EXPECT.files, EXPECT.emptyOrder.files] },
    },
    {
        id: 'P5124-VIEW-007',
        covers: 'P5-124: clearModelFiles() and fromAst() load, stage, drop and write nothing in the engine for the system models, add them as no new file, and their views read the engine\'s copies',
        run: (core) => [undefined, { metamodelValidation: false }].map((options) => {
            const mm = new core.ModelManager(options);
            if (typeof mm._newRustHandle !== 'function') {
                return 'no engine';
            }
            const all = [];
            const reads = [];
            const newRustHandle = mm._newRustHandle;
            mm._newRustHandle = function () {
                const handle = newRustHandle.call(this);
                all.push(countCalls(handle, WRITES));
                reads.push(countCalls(handle, ['modelFileViewSnapshotOf']));
                return handle;
            };
            // No system ModelFile is checked as a new file or mirrored.
            const adds = countCalls(mm, ['_checkModelFile', '_rustMirrorAdd']);
            mm.clearModelFiles();
            mm.fromAst({ $class: 'concerto.metamodel@1.0.0.Models', models: [] });
            // The views read the engine's own copies: one snapshot each.
            const declarations = SYSTEM.map((ns) => mm.getModelFile(ns).getAllDeclarations().length);
            return [all, adds, reads, declarations, mm.getNamespaces()];
        }),
        expect: { ok: Array(2).fill([
            Array(2).fill(Object.fromEntries(WRITES.map((name) => [name, 0]))),
            { _checkModelFile: 0, _rustMirrorAdd: 0 },
            [{ modelFileViewSnapshotOf: 0 }, { modelFileViewSnapshotOf: 2 }],
            [2, 5],
            SYSTEM,
        ]) },
        reference: { ok: ['no engine', 'no engine'] },
    },
    {
        id: 'P5124-VIEW-008',
        covers: 'P5-124: instances of the system models\' types and of user types extending them serialize and validate as in v5.0.0',
        run: (core) => {
            const mm = withUserModel(core);
            const factory = new core.Factory(mm);
            const serializer = new core.Serializer(factory, mm);
            const decorator = factory.newConcept('concerto.decorator@1.0.0', 'DotNetNamespace');
            decorator.namespace = 'AccordProject.Test';
            const thing = factory.newResource('test@1.0.0', 'Thing', 't1');
            thing.address = factory.newConcept('test@1.0.0', 'Address');
            thing.address.city = 'Paris';
            const written = [serializer.toJSON(decorator), serializer.toJSON(thing)];
            const read = written.map((json) => serializer.fromJSON(json).getFullyQualifiedType());
            const bad = (() => {
                try {
                    serializer.fromJSON({ $class: 'concerto.decorator@1.0.0.DotNetNamespace' });
                    return 'ok';
                } catch (e) {
                    return e.constructor.name;
                }
            })();
            return [
                written,
                read,
                bad,
                mm.getType('test@1.0.0.Thing').getSuperType(),
                mm.getType('concerto@1.0.0.Asset').isAbstract(),
                mm.getType('concerto.decorator@1.0.0.DotNetNamespace').getSuperType(),
            ];
        },
        expect: { ok: EXPECT.serialization },
    },

    {
        id: 'P5124-MM-001',
        covers: 'P5-124: a new ModelManager\'s metamodelModelFile, built on first read, is an enumerable own property holding a metamodel ModelFile of the manager, as v5.0.0\'s, with and without the shape check and under addMetamodel',
        run: (core) => [undefined, { metamodelValidation: false }, { metamodelValidation: true }, { addMetamodel: true }]
            .map((options) => metamodelCopy(new core.ModelManager(options))),
        expect: { ok: [
            EXPECT.metamodelCopy,
            EXPECT.metamodelCopy,
            EXPECT.metamodelCopy,
            { ...EXPECT.metamodelCopy, registered: true },
        ] },
    },
    {
        id: 'P5124-MM-002',
        covers: 'P5-124: metamodelModelFile is built with none of the decorator factories added after construction, keeps its value across clearModelFiles(), and can be assigned, as in v5.0.0',
        run: (core) => {
            let calls = 0;
            const mm = new core.ModelManager();
            mm.addDecoratorFactory({ newDecorator: () => {
                calls++;
                return null;
            } });
            const copy = mm.metamodelModelFile;
            const decorators = copy.getDecorators().map((d) => d.constructor.name);
            const copyCalls = calls;
            // The root model's decorator, registered again.
            mm.clearModelFiles();
            const kept = mm.metamodelModelFile === copy;
            const assigned = new core.ModelManager();
            assigned.metamodelModelFile = copy;
            return [copyCalls, decorators, calls, kept, assigned.metamodelModelFile === copy, Object.keys(assigned).includes('metamodelModelFile')];
        },
        expect: { ok: [0, ['Decorator'], 1, true, true, true] },
    },
    {
        id: 'P5124-MM-003',
        covers: 'P5-124: when the engine keeps its metamodel copy after a failed metamodel check, the manager registers its metamodelModelFile, built then, unstaged, with every declaration',
        run: (core) => {
            const mm = new core.ModelManager({ metamodelValidation: true });
            if (typeof mm._mirrorMetamodelLeak !== 'function') {
                return 'no engine';
            }
            // As rustHandle answers once a failed check left its copy
            // registered (no AST the loader reads fails the engine's check
            // after its version check, BC-19).
            const modelFileId = mm.rustHandle.modelFileId;
            mm.rustHandle.modelFileId = (namespace) => (namespace === METAMODEL_NS ? 0 : modelFileId.call(mm.rustHandle, namespace));
            const writes = countCalls(mm.rustHandle, WRITES);
            const built = Object.getOwnPropertyDescriptor(mm, 'metamodelModelFile').get !== undefined;
            mm._mirrorMetamodelLeak(false);
            const copy = mm.getModelFile(METAMODEL_NS);
            return [built, writes, copy === mm.metamodelModelFile, copy.getModelManager() === mm,
                copy.getAllDeclarations().length, mm.getNamespaces()];
        },
        expect: { ok: [
            true,
            Object.fromEntries(WRITES.map((name) => [name, 0])),
            true,
            true,
            62,
            ['concerto.decorator@1.0.0', 'concerto@1.0.0', METAMODEL_NS],
        ] },
        reference: { ok: 'no engine' },
    },
    {
        id: 'P5124-OPT-001',
        covers: 'P5-124: the decoratorValidation and dangerouslyAllowReservedSystemTypeNamesInUserModels options apply as in v5.0.0, at their defaults and set, before and after clearModelFiles()',
        run: (core) => {
            const UNDECLARED = 'namespace test.opt@1.0.0\n@Undeclared\nconcept Person { o String name }\n';
            const WRONG_ARGUMENT = 'namespace test.opt@1.0.0\nconcept Info { o String note }\n@Info(1)\nconcept Person { o String name }\n';
            const RESERVED = 'namespace test.opt@1.0.0\nconcept Concept { o String name }\n';
            const variants = [
                undefined,
                {},
                { decoratorValidation: {} },
                { decoratorValidation: { missingDecorator: undefined, invalidDecorator: '' } },
                { decoratorValidation: { missingDecorator: 'error' } },
                { decoratorValidation: { invalidDecorator: 'error' } },
                { decoratorValidation: { missingDecorator: 'warn', invalidDecorator: 'warn' } },
                { dangerouslyAllowReservedSystemTypeNamesInUserModels: false },
                { dangerouslyAllowReservedSystemTypeNamesInUserModels: true },
            ];
            return variants.map((options) => [false, true].map((clear) => [UNDECLARED, WRONG_ARGUMENT, RESERVED].map((cto) => {
                const mm = new core.ModelManager(options);
                if (clear) {
                    mm.clearModelFiles();
                }
                return outcome(() => mm.addCTOModel(cto, 'opt.cto'));
            })));
        },
        expect: { ok: EXPECT.options },
    },
    {
        id: 'P5124-OPT-002',
        covers: 'P5-124: a new or cleared engine handle is told only the validation options that differ from its defaults',
        run: (core) => {
            if (typeof new core.ModelManager()._newRustHandle !== 'function') {
                return 'no engine';
            }
            const proto = core.req('engineloader').rust.ModelManagerHandle.prototype;
            const SETTERS = ['setDangerouslyAllowReservedSystemTypeNamesInUserModels', 'setDecoratorValidation'];
            const originals = SETTERS.map((name) => proto[name]);
            const counts = countCalls(proto, SETTERS);
            try {
                return [
                    undefined,
                    { decoratorValidation: { missingDecorator: undefined, invalidDecorator: null } },
                    { decoratorValidation: { invalidDecorator: 'warn' } },
                    { dangerouslyAllowReservedSystemTypeNamesInUserModels: true },
                ].map((options) => {
                    SETTERS.forEach((name) => {
                        counts[name] = 0;
                    });
                    const mm = new core.ModelManager(options);
                    mm.clearModelFiles();
                    return { ...counts };
                });
            } finally {
                SETTERS.forEach((name, i) => {
                    proto[name] = originals[i];
                });
            }
        },
        expect: { ok: [
            { setDangerouslyAllowReservedSystemTypeNamesInUserModels: 0, setDecoratorValidation: 0 },
            { setDangerouslyAllowReservedSystemTypeNamesInUserModels: 0, setDecoratorValidation: 0 },
            { setDangerouslyAllowReservedSystemTypeNamesInUserModels: 0, setDecoratorValidation: 2 },
            { setDangerouslyAllowReservedSystemTypeNamesInUserModels: 2, setDecoratorValidation: 0 },
        ] },
        reference: { ok: 'no engine' },
    },
    {
        id: 'P5124-AST-001',
        covers: 'P5-124: fromAst() registers the files in order, with their names, declarations and AST, as v5.0.0 did, on a new manager, on one holding models, with validation off and with the shape check off',
        run: (core) => {
            const ast = fromAstSource(core);
            const used = withUserModel(core);
            return [
                loadFromAst(new core.ModelManager(), ast),
                loadFromAst(used, ast),
                loadFromAst(new core.ModelManager(), ast, { disableValidation: true }),
                loadFromAst(new core.ModelManager({ metamodelValidation: false }), ast),
                loadFromAst(new core.ModelManager(), { $class: 'concerto.metamodel@1.0.0.Models', models: [ast.models[2]] }),
            ];
        },
        expect: { ok: EXPECT.fromAst },
    },
    {
        id: 'P5124-AST-002',
        covers: 'P5-124: when fromAst() throws (a duplicate or unversioned namespace, a malformed model, an unresolved import), the files added before the failing one are registered, as in v5.0.0',
        run: (core) => {
            const ast = fromAstSource(core);
            const models = ast.models.filter((m) => !['concerto@1.0.0', 'concerto.decorator@1.0.0'].includes(m.namespace));
            const of = (list) => ({ $class: 'concerto.metamodel@1.0.0.Models', models: list });
            const unversioned = { ...models[2], namespace: 'org.p5124.unversioned' };
            const malformed = { ...models[2], namespace: 'org.p5124.bad@1.0.0', declarations: [{ $class: 'concerto.metamodel@1.0.0.ConceptDeclaration' }] };
            const missingImport = of([models[1], models[2]]);
            return [
                of([models[0], models[2], models[0]]),
                of([models[0], unversioned, models[2]]),
                of([models[0], models[2], malformed]),
                missingImport,
            ].map((input) => {
                const mm = new core.ModelManager();
                const record = loadFromAst(mm, input);
                delete record.ast;
                return record;
            });
        },
        expect: { ok: EXPECT.fromAstErrors },
    },
    {
        id: 'P5124-AST-003',
        covers: 'P5-124: a subclass\'s addModelFile is called by fromAst() for each file, in order, as in v5.0.0',
        run: (core) => {
            const calls = [];
            /** A manager recording its addModelFile calls. */
            class Tracking extends core.ModelManager {
                /**
                 * Records the call, then adds the file.
                 * @param {object} modelFile the model file
                 * @param {string} [cto] the CTO text
                 * @param {string} [fileName] the file name
                 * @param {boolean} [disableValidation] whether validation is skipped
                 * @returns {object} the added file
                 */
                addModelFile(modelFile, cto, fileName, disableValidation) {
                    calls.push([modelFile.getNamespace(), cto, fileName, disableValidation]);
                    return super.addModelFile(modelFile, cto, fileName, disableValidation);
                }
            }
            const mm = new Tracking();
            calls.splice(0);
            mm.fromAst(fromAstSource(core));
            return [calls, mm.getNamespaces()];
        },
        expect: { ok: EXPECT.fromAstSubclass },
    },
    {
        id: 'P5124-AST-004',
        covers: 'P5-124: fromAst() commits a run of files in one engine call',
        run: (core) => {
            const mm = new core.ModelManager();
            if (typeof mm._newRustHandle !== 'function') {
                return 'no engine';
            }
            const ast = fromAstSource(core);
            const newRustHandle = mm._newRustHandle;
            const counts = [];
            mm._newRustHandle = function () {
                const handle = newRustHandle.call(this);
                counts.push(countCalls(handle, WRITES));
                return handle;
            };
            mm.fromAst(ast);
            return [counts, mm.getNamespaces()];
        },
        expect: { ok: [
            [{
                stageModelFileBytes: 3,
                dropStagedModelFile: 0,
                commitStagedModelFile: 0,
                commitStagedModelFiles: 1,
                validateAndCommitStagedModelFile: 0,
                addModelWithDefinitions: 0,
            }],
            ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.p5124.a@1.0.0', 'org.p5124.b@1.0.0', 'org.p5124.c@1.0.0'],
        ] },
        reference: { ok: 'no engine' },
    },
];
