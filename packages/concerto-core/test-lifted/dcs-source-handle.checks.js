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
 * P5-55 lifted checks (T1, F-A1, accordproject/concerto-rust#376): the
 * DecoratorManager operations run on the source ModelManager's own engine
 * handle (engine/views.ts `sourceDcsHandle`) instead of on a copy of its
 * models, checked through the public API against the frozen v5.0.0
 * reference. Run by fallbacks.spec.js.
 *
 * - Resolution errors: the engine now resolves the source models itself,
 *   where the view used to call `getAst(true, false)` (TS
 *   `resolveMetaModel`) first. Each probe reports only the thrown class's
 *   name (error parity, P5-09).
 * - The handle is read as it is now: a model added, updated or deleted
 *   after an earlier call is seen by the next one, in the manager's order.
 * - The operations never change the source manager.
 * - A manager whose `getAst` is overridden keeps the old path, which reads
 *   its override (the `dcsCacheable` guard).
 */

const MODEL_A = 'namespace test.a@1.0.0\n@Term("A model")\n@Tag("a")\nconcept Person {\n  @Term("Name")\n  @Tag("n")\n  o String name\n}\n';
const MODEL_B = 'namespace test.b@1.0.0\nimport test.a@1.0.0.{Person}\n@Term("Staff")\nconcept Staff extends Person {\n  o Integer id\n}\n';
const MODEL_B2 = 'namespace test.b@1.0.0\nimport test.a@1.0.0.{Person}\n@Term("Staff member")\nconcept Staff extends Person {\n  o Integer id\n  @Term("Grade")\n  @Tag("g")\n  o String grade\n}\n';
const MODEL_C = 'namespace test.c@1.0.0\n@Term("Thing")\n@Tag("c")\nconcept Thing {\n  o String id\n}\n';
/** Imports a namespace the manager does not hold. */
const UNRESOLVED_IMPORT = 'namespace test.u@1.0.0\nimport test.missing@1.0.0.{Other}\nconcept Uses {\n  o Other other\n}\n';
/** Uses a type it neither declares nor imports. */
const UNDECLARED_TYPE = 'namespace test.u@1.0.0\nconcept Uses {\n  o Missing other\n}\n';

/** A command set that applies `@Flag` to `test.a@1.0.0.Person`. */
const UPSERT_FLAG = {
    $class: 'org.accordproject.decoratorcommands@0.4.0.DecoratorCommandSet',
    name: 'p555',
    version: '1.0.0',
    commands: [{
        $class: 'org.accordproject.decoratorcommands@0.4.0.Command',
        type: 'UPSERT',
        target: {
            $class: 'org.accordproject.decoratorcommands@0.4.0.CommandTarget',
            namespace: 'test.a@1.0.0',
            declaration: 'Person',
        },
        decorator: { $class: 'concerto.metamodel@1.0.0.Decorator', name: 'Flag', arguments: [] },
    }],
};

/**
 * The outcome of `fn`: what it returns (`ok` for undefined), or the thrown
 * class's name.
 * @param {Function} fn the call
 * @returns {*} the outcome
 */
function probe(fn) {
    try {
        const out = fn();
        return out === undefined ? 'ok' : out;
    } catch (e) {
        return e.constructor.name;
    }
}

/**
 * A manager holding `ctos`, added in one batch.
 * @param {object} core a loaded core
 * @param {string[]} ctos the model texts
 * @param {boolean} [disableValidation] addModelFiles' option
 * @param {Function} [Manager] the ModelManager class to build
 * @returns {object} the ModelManager
 */
function managerOf(core, ctos, disableValidation, Manager) {
    const mm = new (Manager || core.ModelManager)();
    mm.addModelFiles(ctos, ctos.map((cto, i) => `m${i}.cto`), disableValidation);
    return mm;
}

/**
 * The namespaces of a manager's own (non-system) model files, in order.
 * @param {object} mm the ModelManager
 * @returns {string[]} the namespaces
 */
function namespacesOf(mm) {
    return mm.getModelFiles().filter((mf) => !mf.isSystemModelFile()).map((mf) => mf.getNamespace());
}

/**
 * What `extractDecorators` returns, reduced to plain data: the result
 * manager's namespaces, each command's target and decorator name, and the
 * vocabulary files' first lines.
 * @param {object} core a loaded core
 * @param {object} mm the source ModelManager
 * @param {object} [options] the extract options
 * @returns {object} the summary
 */
function extractSummary(core, mm, options) {
    const out = core.DecoratorManager.extractDecorators(mm, options || { removeDecoratorsFromModel: true, locale: 'en' });
    return {
        namespaces: namespacesOf(out.modelManager),
        commands: out.decoratorCommandSet.map((set) => set.commands.map((c) =>
            [c.target.namespace, c.target.declaration, c.target.property, c.decorator.name].filter((x) => x).join(' '))),
        vocabularies: out.vocabularies.map((v) => v.split('\n').slice(0, 3).join(' | ')),
    };
}

/**
 * The four DecoratorManager operations on `mm`, each reduced to its
 * outcome.
 * @param {object} core a loaded core
 * @param {object} mm the source ModelManager
 * @returns {object} the outcomes
 */
function allOperations(core, mm) {
    const DM = core.DecoratorManager;
    const opts = { removeDecoratorsFromModel: false, locale: 'en' };
    return {
        extractDecorators: probe(() => { DM.extractDecorators(mm, opts); }),
        extractVocabularies: probe(() => { DM.extractVocabularies(mm, opts); }),
        extractNonVocabDecorators: probe(() => { DM.extractNonVocabDecorators(mm, opts); }),
        decorateModels: probe(() => { DM.decorateModels(mm, JSON.parse(JSON.stringify(UPSERT_FLAG))); }),
    };
}

module.exports = [
    {
        id: 'DCS-SH-001',
        covers: 'decoratormanager.ts extract*/decorateModels: an import that does not resolve (manager loaded with validation disabled) throws the same class on every operation',
        run: (core) => allOperations(core, managerOf(core, [MODEL_A, UNRESOLVED_IMPORT], true)),
        expect: { ok: { extractDecorators: 'TypeError', extractVocabularies: 'TypeError', extractNonVocabDecorators: 'TypeError', decorateModels: 'TypeError' } },
    },
    {
        id: 'DCS-SH-002',
        covers: 'decoratormanager.ts extract*/decorateModels: a type name that does not resolve throws the same class on every operation',
        run: (core) => allOperations(core, managerOf(core, [MODEL_A, UNDECLARED_TYPE], true)),
        expect: { ok: { extractDecorators: 'Error', extractVocabularies: 'Error', extractNonVocabDecorators: 'Error', decorateModels: 'Error' } },
    },
    {
        id: 'DCS-SH-003',
        covers: 'decoratormanager.ts decorateModels: with resolution and validation disabled, an unresolvable model is decorated without a throw',
        run: (core) => {
            const mm = managerOf(core, [MODEL_A, UNRESOLVED_IMPORT], true);
            return probe(() => {
                const out = core.DecoratorManager.decorateModels(mm, JSON.parse(JSON.stringify(UPSERT_FLAG)),
                    { disableMetamodelResolution: true, disableMetamodelValidation: true });
                return [namespacesOf(out), !!out.getType('test.a@1.0.0.Person').getDecorator('Flag')];
            });
        },
        expect: { ok: [[ 'test.a@1.0.0', 'test.u@1.0.0' ], true] },
    },
    {
        id: 'DCS-SH-004',
        covers: 'decoratormanager.ts extractDecorators: a model added, updated or deleted after an earlier extract is seen by the next one, in the manager\'s order',
        run: (core) => {
            const mm = managerOf(core, [MODEL_C, MODEL_A]);
            const out = [extractSummary(core, mm)];
            mm.addCTOModel(MODEL_B, 'b.cto');
            out.push(extractSummary(core, mm));
            mm.updateModelFile(MODEL_B2, 'b.cto');
            out.push(extractSummary(core, mm));
            mm.deleteModelFile('test.c@1.0.0');
            out.push(extractSummary(core, mm));
            return out;
        },
        expect: {
            ok: [
                {
                    namespaces: [ 'test.c@1.0.0', 'test.a@1.0.0' ],
                    commands: [[ 'concerto@1.0.0 DotNetNamespace' ], [ 'test.c@1.0.0 Thing Tag' ], [ 'test.a@1.0.0 Person Tag', 'test.a@1.0.0 Person name Tag' ]],
                    vocabularies: [ 'locale: en | namespace: test.c@1.0.0 | declarations:', 'locale: en | namespace: test.a@1.0.0 | declarations:' ],
                },
                {
                    namespaces: [ 'test.c@1.0.0', 'test.a@1.0.0', 'test.b@1.0.0' ],
                    commands: [[ 'concerto@1.0.0 DotNetNamespace' ], [ 'test.c@1.0.0 Thing Tag' ], [ 'test.a@1.0.0 Person Tag', 'test.a@1.0.0 Person name Tag' ]],
                    vocabularies: [ 'locale: en | namespace: test.c@1.0.0 | declarations:', 'locale: en | namespace: test.a@1.0.0 | declarations:', 'locale: en | namespace: test.b@1.0.0 | declarations:' ],
                },
                {
                    namespaces: [ 'test.c@1.0.0', 'test.a@1.0.0', 'test.b@1.0.0' ],
                    commands: [[ 'concerto@1.0.0 DotNetNamespace' ], [ 'test.c@1.0.0 Thing Tag' ], [ 'test.a@1.0.0 Person Tag', 'test.a@1.0.0 Person name Tag' ], [ 'test.b@1.0.0 Staff grade Tag' ]],
                    vocabularies: [ 'locale: en | namespace: test.c@1.0.0 | declarations:', 'locale: en | namespace: test.a@1.0.0 | declarations:', 'locale: en | namespace: test.b@1.0.0 | declarations:' ],
                },
                {
                    namespaces: [ 'test.a@1.0.0', 'test.b@1.0.0' ],
                    commands: [[ 'concerto@1.0.0 DotNetNamespace' ], [ 'test.a@1.0.0 Person Tag', 'test.a@1.0.0 Person name Tag' ], [ 'test.b@1.0.0 Staff grade Tag' ]],
                    vocabularies: [ 'locale: en | namespace: test.a@1.0.0 | declarations:', 'locale: en | namespace: test.b@1.0.0 | declarations:' ],
                },
            ],
        },
    },
    {
        id: 'DCS-SH-005',
        covers: 'decoratormanager.ts extractDecorators and decorateModels: the source manager is not changed, and a repeated call gives the same result',
        run: (core) => {
            const mm = managerOf(core, [MODEL_A, MODEL_B]);
            const before = JSON.stringify(mm.getAst());
            const first = extractSummary(core, mm);
            core.DecoratorManager.decorateModels(mm, JSON.parse(JSON.stringify(UPSERT_FLAG)));
            const second = extractSummary(core, mm);
            return [JSON.stringify(mm.getAst()) === before, JSON.stringify(first) === JSON.stringify(second),
                !!mm.getType('test.a@1.0.0.Person').getDecorator('Term'), !mm.getType('test.a@1.0.0.Person').getDecorator('Flag')];
        },
        expect: { ok: [true, true, true, true] },
    },
    {
        id: 'DCS-SH-006',
        covers: 'decoratormanager.ts extract*/decorateModels: a ModelManager whose getAst is overridden is read through its override',
        run: (core) => {
            /** Leaves test.b@1.0.0 out of its AST. */
            class Filtered extends core.ModelManager {
                /**
                 * @param {boolean} [resolve] resolve names
                 * @param {boolean} [system] include the system namespaces
                 * @returns {object} the AST, without test.b@1.0.0
                 */
                getAst(resolve, system) {
                    const ast = super.getAst(resolve, system);
                    ast.models = ast.models.filter((m) => m.namespace !== 'test.b@1.0.0');
                    return ast;
                }
            }
            const mm = managerOf(core, [MODEL_A, MODEL_B], false, Filtered);
            const DM = core.DecoratorManager;
            const opts = { removeDecoratorsFromModel: true, locale: 'en' };
            return [
                extractSummary(core, mm).namespaces,
                namespacesOf(DM.extractVocabularies(mm, opts).modelManager),
                namespacesOf(DM.extractNonVocabDecorators(mm, opts).modelManager),
                namespacesOf(DM.decorateModels(mm, JSON.parse(JSON.stringify(UPSERT_FLAG)))),
            ];
        },
        expect: { ok: [[ 'test.a@1.0.0' ], [ 'test.a@1.0.0' ], [ 'test.a@1.0.0' ], [ 'test.a@1.0.0' ]] },
    },
];
