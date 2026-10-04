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
];
