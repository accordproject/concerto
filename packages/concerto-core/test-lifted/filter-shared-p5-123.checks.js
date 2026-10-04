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
 * P5-123 lifted checks (accordproject/concerto-rust#500): a filter that
 * keeps a file whole shares the engine's file again, and the filtered
 * file's AST is TS 5.0.0's form (R2A-4) all the same, built on first read.
 *
 * TS 5.0.0's `ModelFile.filter` builds the filtered file from each kept
 * declaration's `ast`, so an asset, participant, transaction or event with
 * no super type has the default one (`TypeIdentified`) its view was given,
 * where the source file's AST has none. The engine now shares the source's
 * file (a staged share, not a new load), and the view's public `ast` and
 * `getAst()`, the manager's `getAst()` and what
 * `DecoratorManager.decorateModels` reads give that form.
 *
 * `shared` counts the files the engine filter staged shared; it is 'no
 * engine' for v5.0.0, so a check that reports it has a `reference` that
 * differs in that field only. v5.0.0's `ModelManager.filter` throws (BC-53),
 * so the checks over it have that `reference`. Only public members and the
 * manager's engine handle (to count) are used. Run by fallbacks.spec.js.
 */

const NO_ENGINE = 'no engine';
const MM = 'concerto.metamodel@1.0.0';

const ASSETS = `namespace a@1.0.0
asset A identified by id {
  o String id
}
participant P identified by id {
  o String id
}
transaction T {
}
event E {
}
concept C {
  o String s
}
`;

const CONCEPTS = `namespace b@1.0.0
concept D {
  o String s
}
`;

const DCS = {
    $class: 'org.accordproject.decoratorcommands@0.4.0.DecoratorCommandSet',
    name: 'p5123', version: '1.0.0',
    commands: [{
        $class: 'org.accordproject.decoratorcommands@0.4.0.Command',
        type: 'UPSERT',
        target: { $class: 'org.accordproject.decoratorcommands@0.4.0.CommandTarget', namespace: 'a@1.0.0', declaration: 'C' },
        decorator: { $class: `${MM}.Decorator`, name: 'Term', arguments: [] },
    }],
};

/** v5.0.0's `ModelManager.filter` re-adds the decorator model (BC-53). */
const REFERENCE_FILTER_THROWS = { throws: { name: 'Error', message: 'Namespace concerto.decorator@1.0.0 specified in file concerto_decorator_1.0.0.cto is already declared in file concerto_decorator_1.0.0.cto' } };

/**
 * The super types of a model file AST's declarations, by name.
 * @param {object} ast the model file AST
 * @returns {Array} `[name, superType]` pairs
 */
function superTypes(ast) {
    return ast.declarations.map((d) => [d.name, d.superType ? JSON.parse(JSON.stringify(d.superType)) : null]);
}

/**
 * The model of `namespace` in a manager's `getAst()` result.
 * @param {object} models the `Models` node
 * @param {string} namespace the namespace
 * @returns {object} the model AST
 */
function modelOf(models, namespace) {
    return models.models.find((m) => m.namespace === namespace);
}

/**
 * A manager with ASSETS and CONCEPTS.
 * @param {object} core the core
 * @returns {object} the manager
 */
function source(core) {
    const mm = new core.ModelManager();
    mm.addCTOModel(ASSETS, 'a.cto');
    mm.addCTOModel(CONCEPTS, 'b.cto');
    return mm;
}

/**
 * Counts the files `handle`'s `modelFileFilterStaged` stages shared.
 * @param {object} handle an engine handle (or undefined)
 * @returns {object} `{ shared }`, read after the calls
 */
function countShared(handle) {
    const counts = { shared: handle ? 0 : NO_ENGINE };
    if (handle && typeof handle.modelFileFilterStaged === 'function') {
        const original = handle.modelFileFilterStaged;
        handle.modelFileFilterStaged = function (...args) {
            const result = original.apply(this, args);
            if (typeof result === 'string' && JSON.parse(result).stage !== undefined) {
                counts.shared++;
            }
            return result;
        };
    }
    return counts;
}

const TAGGED = (name) => ({ $class: `${MM}.TypeIdentified`, name });

const ALL = [['A', TAGGED('Asset')], ['P', TAGGED('Participant')], ['T', TAGGED('Transaction')], ['E', TAGGED('Event')], ['C', null]];

/** P5123-005's result, the same for v5.0.0. */
const AST_005 = {
    before: ALL,
    sameBefore: true,
    after: ALL,
    sameAfter: true,
    added: ALL,
    addedSame: true,
    declAst: 'Asset',
    sourceAst: [['A', null], ['P', null], ['T', null], ['E', null], ['C', null]],
    sourceSame: true,
    assigned: true,
};

module.exports = [
    {
        id: 'P5123-001',
        covers: 'ModelFile.filter keeping a file whole: shared by the engine, its getAst() is TS 5.0.0\'s filtered form, the same object on each read, and the target manager reads it so once it is added',
        run: (core) => {
            const mm = source(core);
            const counts = countShared(mm.rustHandle);
            const target = new core.ModelManager();
            const a = mm.getModelFile('a@1.0.0');
            const b = mm.getModelFile('b@1.0.0');
            const all = a.filter(() => true, target);
            const allB = b.filter(() => true, target);
            const ast = all.getAst();
            target.addModelFiles([all, allB]);
            return {
                shared: counts.shared,
                source: superTypes(a.getAst()),
                all: superTypes(ast),
                stable: all.getAst() === ast,
                ownAst: ast !== a.getAst() && allB.getAst() !== b.getAst(),
                unchangedB: JSON.stringify(allB.getAst()) === JSON.stringify(b.getAst()),
                added: superTypes(target.getModelFile('a@1.0.0').getAst()),
                managerAst: superTypes(modelOf(target.getAst(), 'a@1.0.0')),
                sourceManagerAst: superTypes(modelOf(mm.getAst(), 'a@1.0.0')),
                superType: target.getType('a@1.0.0.A').getSuperType(),
            };
        },
        expect: { ok: {
            shared: 2,
            source: [['A', null], ['P', null], ['T', null], ['E', null], ['C', null]],
            all: ALL,
            stable: true,
            ownAst: true,
            unchangedB: true,
            added: ALL,
            managerAst: ALL,
            sourceManagerAst: [['A', null], ['P', null], ['T', null], ['E', null], ['C', null]],
            superType: 'concerto@1.0.0.Asset',
        } },
        reference: { ok: {
            shared: NO_ENGINE,
            source: [['A', null], ['P', null], ['T', null], ['E', null], ['C', null]],
            all: ALL,
            stable: true,
            ownAst: true,
            unchangedB: true,
            added: ALL,
            managerAst: ALL,
            sourceManagerAst: [['A', null], ['P', null], ['T', null], ['E', null], ['C', null]],
            superType: 'concerto@1.0.0.Asset',
        } },
    },
    {
        id: 'P5123-002',
        covers: 'DecoratorManager.decorateModels over a manager holding a filtered file reads its filtered form, resolved or not',
        run: (core) => {
            const mm = source(core);
            const target = new core.ModelManager();
            target.addModelFile(mm.getModelFile('a@1.0.0').filter(() => true, target));
            const resolved = core.DecoratorManager.decorateModels(target, [JSON.parse(JSON.stringify(DCS))]);
            const unresolved = core.DecoratorManager.decorateModels(target, [JSON.parse(JSON.stringify(DCS))],
                { disableMetamodelResolution: true });
            return {
                resolved: superTypes(resolved.getModelFile('a@1.0.0').getAst()),
                unresolved: superTypes(unresolved.getModelFile('a@1.0.0').getAst()),
                decorated: unresolved.getModelFile('a@1.0.0').getAst().declarations[4].decorators.map((d) => d.name),
            };
        },
        expect: { ok: {
            resolved: [
                ['A', { ...TAGGED('Asset'), namespace: 'concerto@1.0.0' }],
                ['P', { ...TAGGED('Participant'), namespace: 'concerto@1.0.0' }],
                ['T', { ...TAGGED('Transaction'), namespace: 'concerto@1.0.0' }],
                ['E', { ...TAGGED('Event'), namespace: 'concerto@1.0.0' }],
                ['C', null],
            ],
            unresolved: ALL,
            decorated: ['Term'],
        } },
    },
    {
        id: 'P5123-003',
        covers: 'ModelManager.filter keeping everything shares every file; each filtered file, a filter of the filtered manager and a fork of it read the filtered form; the source manager does not',
        run: (core) => {
            const mm = source(core);
            const counts = countShared(mm.rustHandle);
            const filtered = mm.filter(() => true);
            const shared = counts.shared;
            const mf = filtered.getModelFile('a@1.0.0');
            const again = filtered.filter(() => true);
            const fork = filtered.fork();
            filtered.validateModelFiles();
            return {
                shared,
                filtered: superTypes(mf.getAst()),
                filteredAst: mf.ast === mf.getAst(),
                managerAst: superTypes(modelOf(filtered.getAst(), 'a@1.0.0')),
                again: superTypes(again.getModelFile('a@1.0.0').getAst()),
                fork: superTypes(fork.getModelFile('a@1.0.0').getAst()),
                forkSharesAst: fork.getModelFile('a@1.0.0').getAst() === mf.getAst(),
                source: superTypes(mm.getModelFile('a@1.0.0').getAst()),
            };
        },
        expect: { ok: {
            shared: 2,
            filtered: ALL,
            filteredAst: true,
            managerAst: ALL,
            again: ALL,
            fork: ALL,
            forkSharesAst: true,
            source: [['A', null], ['P', null], ['T', null], ['E', null], ['C', null]],
        } },
        reference: REFERENCE_FILTER_THROWS,
    },
    {
        id: 'P5123-004',
        covers: 'a partial filter keeps the rebuilt file, with the default super types written in, not shared',
        run: (core) => {
            const mm = source(core);
            const counts = countShared(mm.rustHandle);
            const some = mm.getModelFile('a@1.0.0').filter((d) => d.getName() !== 'C', new core.ModelManager());
            return {
                shared: counts.shared,
                some: superTypes(some.getAst()),
            };
        },
        expect: { ok: {
            shared: 0,
            some: ALL.slice(0, 4),
        } },
        reference: { ok: {
            shared: NO_ENGINE,
            some: ALL.slice(0, 4),
        } },
    },
    {
        id: 'P5123-005',
        covers: 'the public ast of a file ModelFile.filter kept whole is TS 5.0.0\'s filtered form, the same object as getAst(), before and after it is added, and can be assigned; the source file\'s ast is not changed',
        run: (core) => {
            const mm = source(core);
            const target = new core.ModelManager();
            const a = mm.getModelFile('a@1.0.0');
            const f = a.filter(() => true, target);
            const before = superTypes(f.ast);
            const sameBefore = f.ast === f.getAst();
            target.addModelFile(f);
            const added = target.getModelFile('a@1.0.0');
            const g = a.filter(() => true, new core.ModelManager());
            const replaced = { ...a.getAst() };
            g.ast = replaced;
            return {
                before,
                sameBefore,
                after: superTypes(f.ast),
                sameAfter: f.ast === f.getAst(),
                added: superTypes(added.ast),
                addedSame: added.ast === added.getAst(),
                declAst: f.getLocalType('A').ast.superType ? f.getLocalType('A').ast.superType.name : null,
                sourceAst: superTypes(a.ast),
                sourceSame: a.ast === a.getAst(),
                assigned: g.ast === replaced && g.getAst() === replaced,
            };
        },
        expect: { ok: AST_005 },
        reference: { ok: AST_005 },
    },
];
