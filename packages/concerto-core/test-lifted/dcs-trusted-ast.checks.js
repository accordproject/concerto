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
 * P5-68 lifted checks (BC-19-a, accordproject/concerto-rust#407): the
 * DecoratorManager result managers (engine/views-staging.ts `adoptStagedModels`)
 * skip the BC-19 AST shape check for the ASTs the engine has just written
 * from models that all passed it (`dcsSourceShapeChecked`), and, for
 * `decorateModels`, only when every command's decorator and the imports
 * declared for it pass it too (`dcsCommandsShapeChecked`). Checked through
 * the public API against the frozen v5.0.0 reference. Run by
 * fallbacks.spec.js.
 *
 * - A ModelFile user code constructs is always checked by default, also
 *   over an AST object a result manager holds, after DCS calls.
 * - Commands that add what the metamodel rejects, and a source manager
 *   built with `metamodelValidation: false`, throw the same class as
 *   before (the result is then checked as before).
 * - Chained operations, on a result manager whose files skipped the check,
 *   give the same results.
 *
 * Each probe reports only the thrown class's name (error parity, P5-09).
 * `reference` is v5.0.0's outcome where BC-19 (R1) changes it.
 */

const MM = 'concerto.metamodel@1.0.0';
const DCS = 'org.accordproject.decoratorcommands@0.4.0';

const MODEL_A = 'namespace test.a@1.0.0\n@Term("A model")\n@Tag("a")\nconcept Person {\n  @Term("Name")\n  @Tag("n")\n  o String name\n}\n';
const MODEL_B = 'namespace test.b@1.0.0\nimport test.a@1.0.0.{Person}\n@Term("Staff")\nconcept Staff extends Person {\n  o Integer id\n}\n';

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
 * @param {object} [options] the ModelManager options
 * @returns {object} the ModelManager
 */
function managerOf(core, ctos, options) {
    const mm = new core.ModelManager(options);
    mm.addModelFiles(ctos, ctos.map((cto, i) => `m${i}.cto`));
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
 * A command set with one UPSERT of `decorator` on `target` (in
 * test.a@1.0.0; `Person` by default).
 * @param {object} decorator the decorator node
 * @param {object} [target] the target fields
 * @returns {object} the command set
 */
function commandSet(decorator, target) {
    return {
        $class: `${DCS}.DecoratorCommandSet`,
        name: 'p568',
        version: '1.0.0',
        commands: [{
            $class: `${DCS}.Command`,
            type: 'UPSERT',
            target: Object.assign({ $class: `${DCS}.CommandTarget`, namespace: 'test.a@1.0.0' }, target || { declaration: 'Person' }),
            decorator,
        }],
    };
}

/**
 * A well-formed decorator node.
 * @param {string} name the decorator name
 * @param {object} [extra] more fields
 * @returns {object} the decorator
 */
function decorator(name, extra = {}) {
    return Object.assign({ $class: `${MM}.Decorator`, name, arguments: [] }, extra);
}

/**
 * The decorator names on `test.a@1.0.0.Person` and its `name` property in
 * `mm`.
 * @param {object} mm the ModelManager
 * @returns {Array<string[]>} the names
 */
function personDecorators(mm) {
    const person = mm.getType('test.a@1.0.0.Person');
    return [person.getDecorators().map((d) => d.getName()),
        person.getProperty('name').getDecorators().map((d) => d.getName())];
}

module.exports = [
    {
        id: 'BC19A-001',
        covers: 'BC-19-a: a ModelFile user code constructs over a malformed AST is still rejected by default, also over an AST object a DCS result manager holds',
        run: (core) => {
            const mm = managerOf(core, [MODEL_A, MODEL_B]);
            const DM = core.DecoratorManager;
            const decorated = DM.decorateModels(mm, commandSet(decorator('Flag')));
            const extracted = DM.extractDecorators(mm, { removeDecoratorsFromModel: true, locale: 'en' }).modelManager;
            const construct = (ast) => probe(() => {
                new core.ModelFile(new core.ModelManager(), ast);
                return 'constructed';
            });
            const fresh = JSON.parse(JSON.stringify(mm.getModelFile('test.a@1.0.0').getAst()));
            fresh.declarations[0].superType = { $class: `${MM}.TypeIdentifier`, name: '' };
            const held = decorated.getModelFile('test.a@1.0.0').ast;
            held.declarations[0].superType = { $class: `${MM}.TypeIdentifier`, name: '' };
            const heldExtract = extracted.getModelFile('test.b@1.0.0').ast;
            heldExtract.declarations[0].identified = 'yes';
            return [construct(fresh), construct(held), construct(heldExtract),
                construct(JSON.parse(JSON.stringify(mm.getModelFile('test.a@1.0.0').getAst())))];
        },
        expect: { ok: ['IllegalModelException', 'IllegalModelException', 'IllegalModelException', 'constructed'] },
        reference: { ok: ['constructed', 'constructed', 'constructed', 'constructed'] },
    },
    {
        id: 'BC19A-002',
        covers: 'BC-19-a: decorateModels commands that add what the metamodel rejects throw the same class, and an unapplied one does not throw',
        run: (core) => {
            const mm = managerOf(core, [MODEL_A, MODEL_B]);
            const decorate = (set, options) => probe(() => namespacesOf(core.DecoratorManager.decorateModels(mm, set, options)));
            return {
                good: decorate(commandSet(decorator('Flag'))),
                undeclaredKey: decorate(commandSet(decorator('Flag', { bogus: 1 }))),
                undeclaredKeyOnProperty: decorate(commandSet(decorator('Flag', { bogus: 1 }), { declaration: 'Person', property: 'name' })),
                undeclaredKeyUnapplied: decorate(commandSet(decorator('Flag', { bogus: 1 }), { declaration: 'Nope' })),
                numericName: decorate(commandSet({ $class: `${MM}.Decorator`, name: 5 })),
                noClass: decorate(commandSet({ name: 'Flag' })),
                badArgument: decorate(commandSet(decorator('Flag', { arguments: [{ $class: `${MM}.DecoratorString`, value: 5 }] }))),
                numericDefaultNamespace: decorate(commandSet(decorator('Flag')), { defaultNamespace: 7 }),
                singleCommand: decorate(Object.assign(commandSet(decorator('Flag')), { commands: commandSet(decorator('Flag')).commands[0] })),
                typeArgument: decorate(commandSet(decorator('Flag', {
                    arguments: [{ $class: `${MM}.DecoratorTypeReference`, isArray: false, type: { $class: `${MM}.TypeIdentifier`, name: 'Person', namespace: 'test.a@1.0.0' } }],
                }))),
            };
        },
        expect: {
            ok: {
                good: ['test.a@1.0.0', 'test.b@1.0.0'],
                undeclaredKey: 'IllegalModelException',
                undeclaredKeyOnProperty: 'IllegalModelException',
                undeclaredKeyUnapplied: ['test.a@1.0.0', 'test.b@1.0.0'],
                numericName: 'IllegalModelException',
                noClass: 'IllegalModelException',
                badArgument: 'IllegalModelException',
                numericDefaultNamespace: 'IllegalModelException',
                singleCommand: ['test.a@1.0.0', 'test.b@1.0.0'],
                typeArgument: ['test.a@1.0.0', 'test.b@1.0.0'],
            },
        },
        reference: {
            ok: {
                good: ['test.a@1.0.0', 'test.b@1.0.0'],
                undeclaredKey: ['test.a@1.0.0', 'test.b@1.0.0'],
                undeclaredKeyOnProperty: ['test.a@1.0.0', 'test.b@1.0.0'],
                undeclaredKeyUnapplied: ['test.a@1.0.0', 'test.b@1.0.0'],
                numericName: ['test.a@1.0.0', 'test.b@1.0.0'],
                noClass: ['test.a@1.0.0', 'test.b@1.0.0'],
                badArgument: ['test.a@1.0.0', 'test.b@1.0.0'],
                numericDefaultNamespace: 'TypeError',
                singleCommand: ['test.a@1.0.0', 'test.b@1.0.0'],
                typeArgument: ['test.a@1.0.0', 'test.b@1.0.0'],
            },
        },
    },
    {
        id: 'BC19A-003',
        covers: 'BC-19-a: a source manager built with metamodelValidation: false, or with a model file whose getAst is its own, keeps the checked result path, with the same results',
        run: (core) => {
            const DM = core.DecoratorManager;
            const good = managerOf(core, [MODEL_A]);
            const ast = JSON.parse(JSON.stringify(good.getModelFile('test.a@1.0.0').getAst()));
            ast.declarations[0].superType = { $class: `${MM}.TypeIdentifier`, name: '' };
            const off = new core.ModelManager({ metamodelValidation: false });
            const loaded = probe(() => {
                off.addModelFile(new core.ModelFile(off, ast, undefined, 'a.json'), undefined, 'a.json', true);
                return 'loaded';
            });
            const opts = { removeDecoratorsFromModel: true, locale: 'en' };
            const offGood = managerOf(core, [MODEL_A, MODEL_B], { metamodelValidation: false });
            return {
                loaded,
                extractDecorators: probe(() => namespacesOf(DM.extractDecorators(off, opts).modelManager)),
                extractVocabularies: probe(() => namespacesOf(DM.extractVocabularies(off, opts).modelManager)),
                decorateModels: probe(() => namespacesOf(DM.decorateModels(off, commandSet(decorator('Flag'))))),
                wellFormed: [
                    probe(() => namespacesOf(DM.extractDecorators(offGood, opts).modelManager)),
                    probe(() => personDecorators(DM.decorateModels(offGood, commandSet(decorator('Flag'))))),
                ],
                ownGetAst: (() => {
                    const mm = managerOf(core, [MODEL_A, MODEL_B]);
                    const mf = mm.getModelFile('test.a@1.0.0');
                    mf.getAst = function () {
                        return this.ast;
                    };
                    return [
                        probe(() => namespacesOf(DM.extractVocabularies(mm, opts).modelManager)),
                        probe(() => personDecorators(DM.decorateModels(mm, commandSet(decorator('Flag'))))),
                    ];
                })(),
            };
        },
        expect: {
            ok: {
                loaded: 'loaded',
                extractDecorators: 'Error',
                extractVocabularies: 'Error',
                decorateModels: 'Error',
                wellFormed: [['test.a@1.0.0', 'test.b@1.0.0'], [['Term', 'Tag', 'Flag'], ['Term', 'Tag']]],
                ownGetAst: [['test.a@1.0.0', 'test.b@1.0.0'], [['Term', 'Tag', 'Flag'], ['Term', 'Tag']]],
            },
        },
    },
    {
        id: 'BC19A-004',
        covers: 'BC-19-a: chained DecoratorManager operations on result managers give the same results',
        run: (core) => {
            const DM = core.DecoratorManager;
            const mm = managerOf(core, [MODEL_A, MODEL_B]);
            const once = DM.decorateModels(mm, commandSet(decorator('Flag')));
            const twice = DM.decorateModels(once, commandSet(decorator('Mark'), { declaration: 'Person', property: 'name' }));
            const extracted = DM.extractNonVocabDecorators(twice, { removeDecoratorsFromModel: true, locale: 'en' });
            const vocab = DM.extractVocabularies(extracted.modelManager, { removeDecoratorsFromModel: true, locale: 'en' });
            const redecorated = DM.decorateModels(vocab.modelManager, extracted.decoratorCommandSet);
            return [
                personDecorators(once),
                personDecorators(twice),
                personDecorators(extracted.modelManager),
                personDecorators(vocab.modelManager),
                vocab.vocabularies.map((v) => v.split('\n').slice(0, 2).join(' | ')),
                personDecorators(redecorated),
                namespacesOf(redecorated),
            ];
        },
        expect: {
            ok: [
                [['Term', 'Tag', 'Flag'], ['Term', 'Tag']],
                [['Term', 'Tag', 'Flag'], ['Term', 'Tag', 'Mark']],
                [['Term'], ['Term']],
                [[], []],
                ['locale: en | namespace: test.a@1.0.0', 'locale: en | namespace: test.b@1.0.0'],
                [['Tag', 'Flag'], ['Tag', 'Mark']],
                ['test.a@1.0.0', 'test.b@1.0.0'],
            ],
        },
    },
];
