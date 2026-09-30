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
 * P5-56 lifted checks (T2, F-A2, accordproject/concerto-rust#377): the
 * engine keeps a per-epoch memo of the extract result on the source
 * ModelManager's handle (concerto-wasm `ModelManagerHandle.dcsExtract*`),
 * used only with `removeDecoratorsFromModel: false`: filled on the second
 * call on unchanged models, read from the third. Checked through the public
 * API against the frozen v5.0.0 reference. Run by fallbacks.spec.js.
 *
 * - Repeated calls give what the first call gives, with every action and
 *   locale, interleaved.
 * - A model added, updated or deleted between repeated calls is seen by
 *   the next call.
 * - A returned result is the caller's own: changing it (its command sets,
 *   vocabularies or model manager) does not change the next call's.
 * - An error is never memoised: a repeated call throws the same class
 *   every time (error parity, P5-09: only the class is compared).
 */

const MODEL_A = 'namespace test.a@1.0.0\n@Term("A model")\n@Tag("a")\nconcept Person {\n  @Term("Name")\n  @Term_description("The name")\n  @Tag("n")\n  o String name\n}\n';
const MODEL_B = 'namespace test.b@1.0.0\nimport test.a@1.0.0.{Person}\n@Term("Staff")\n@Ref(Person)\nconcept Staff extends Person {\n  o Integer id\n}\n';
const MODEL_B2 = 'namespace test.b@1.0.0\nimport test.a@1.0.0.{Person}\n@Term("Staff member")\nconcept Staff extends Person {\n  o Integer id\n  @Term("Grade")\n  @Tag("g")\n  o String grade\n}\n';
const MODEL_C = 'namespace test.c@1.0.0\n@Term("Thing")\n@Tag("c")\nconcept Thing {\n  o String id\n}\n';
/** A declaration-level vocabulary key that is reserved. */
const RESERVED_KEY = 'namespace test.r@1.0.0\n@Term_properties("reserved")\nconcept Reserved {\n  o String id\n}\n';

const KEEP = { removeDecoratorsFromModel: false, locale: 'en' };

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
 * @returns {object} the ModelManager
 */
function managerOf(core, ctos) {
    const mm = new core.ModelManager();
    mm.addModelFiles(ctos, ctos.map((cto, i) => `m${i}.cto`));
    return mm;
}

/**
 * One extract operation's result on `mm`, reduced to plain data: the
 * result manager's own models (as their AST), and the command sets and
 * vocabularies as returned.
 * @param {object} core a loaded core
 * @param {object} mm the source ModelManager
 * @param {string} op the DecoratorManager method
 * @param {object} [options] the extract options
 * @returns {string} the result, as JSON text
 */
function extracted(core, mm, op, options) {
    const out = core.DecoratorManager[op](mm, Object.assign({}, options || KEEP));
    return JSON.stringify({
        models: out.modelManager.getAst(false, false).models,
        decoratorCommandSet: out.decoratorCommandSet,
        vocabularies: out.vocabularies,
    });
}

/**
 * `extracted`, `n` times: the first result, and whether every later one
 * is the same.
 * @param {object} core a loaded core
 * @param {object} mm the source ModelManager
 * @param {number} n the number of calls
 * @param {string} [op] the DecoratorManager method
 * @param {object} [options] the extract options
 * @returns {object[]} [the first result (parsed), all the same]
 */
function repeated(core, mm, n, op, options) {
    const first = extracted(core, mm, op || 'extractDecorators', options);
    let same = true;
    for (let i = 1; i < n; i++) {
        same = same && extracted(core, mm, op || 'extractDecorators', options) === first;
    }
    return [JSON.parse(first), same];
}

/**
 * A result's command targets and vocabulary heads, for a compact expect.
 * @param {object} result a parsed `extracted` result
 * @returns {object} the summary
 */
function summary(result) {
    return {
        namespaces: result.models.map((m) => m.namespace),
        commands: (result.decoratorCommandSet || []).map((set) => set.commands.map((c) =>
            [c.target.namespace, c.target.declaration, c.target.property, c.decorator.name].filter((x) => x).join(' '))),
        vocabularies: (result.vocabularies || []).map((v) => v.split('\n').slice(0, 2).join(' | ')),
    };
}

module.exports = [
    {
        id: 'DCS-MEMO-001',
        covers: 'decoratormanager.ts extract* (removeDecoratorsFromModel false): repeated calls on unchanged models give the first call\'s result, for every operation and locale, interleaved',
        run: (core) => {
            const mm = managerOf(core, [MODEL_A, MODEL_B]);
            const ops = ['extractDecorators', 'extractVocabularies', 'extractNonVocabDecorators'];
            const first = {};
            let same = true;
            for (let round = 0; round < 4; round++) {
                for (const op of ops) {
                    for (const locale of ['en', 'fr']) {
                        const key = `${op} ${locale}`;
                        const out = extracted(core, mm, op, { removeDecoratorsFromModel: false, locale });
                        if (round === 0) {
                            first[key] = out;
                        } else {
                            same = same && out === first[key];
                        }
                    }
                }
            }
            return [same, summary(JSON.parse(first['extractDecorators fr'])), JSON.parse(first['extractVocabularies fr']).vocabularies.length];
        },
        expect: {
            ok: [true, {
                namespaces: [ 'test.a@1.0.0', 'test.b@1.0.0' ],
                commands: [[ 'concerto@1.0.0 DotNetNamespace' ], [ 'test.a@1.0.0 Person Tag', 'test.a@1.0.0 Person name Tag' ], [ 'test.b@1.0.0 Staff Ref' ]],
                vocabularies: [ 'locale: fr | namespace: test.a@1.0.0', 'locale: fr | namespace: test.b@1.0.0' ],
            }, 2],
        },
    },
    {
        id: 'DCS-MEMO-002',
        covers: 'decoratormanager.ts extractDecorators (removeDecoratorsFromModel false): a model added, updated or deleted between repeated calls is seen by the next call',
        run: (core) => {
            const mm = managerOf(core, [MODEL_C, MODEL_A]);
            const out = [repeated(core, mm, 3)];
            mm.addCTOModel(MODEL_B, 'b.cto');
            out.push(repeated(core, mm, 3));
            mm.updateModelFile(MODEL_B2, 'b.cto');
            out.push(repeated(core, mm, 3));
            mm.deleteModelFile('test.c@1.0.0');
            out.push(repeated(core, mm, 3));
            return out.map(([result, same]) => [summary(result), same]);
        },
        expect: {
            ok: [
                [{
                    namespaces: [ 'test.c@1.0.0', 'test.a@1.0.0' ],
                    commands: [[ 'concerto@1.0.0 DotNetNamespace' ], [ 'test.c@1.0.0 Thing Tag' ], [ 'test.a@1.0.0 Person Tag', 'test.a@1.0.0 Person name Tag' ]],
                    vocabularies: [ 'locale: en | namespace: test.c@1.0.0', 'locale: en | namespace: test.a@1.0.0' ],
                }, true],
                [{
                    namespaces: [ 'test.c@1.0.0', 'test.a@1.0.0', 'test.b@1.0.0' ],
                    commands: [[ 'concerto@1.0.0 DotNetNamespace' ], [ 'test.c@1.0.0 Thing Tag' ], [ 'test.a@1.0.0 Person Tag', 'test.a@1.0.0 Person name Tag' ], [ 'test.b@1.0.0 Staff Ref' ]],
                    vocabularies: [ 'locale: en | namespace: test.c@1.0.0', 'locale: en | namespace: test.a@1.0.0', 'locale: en | namespace: test.b@1.0.0' ],
                }, true],
                [{
                    namespaces: [ 'test.c@1.0.0', 'test.a@1.0.0', 'test.b@1.0.0' ],
                    commands: [[ 'concerto@1.0.0 DotNetNamespace' ], [ 'test.c@1.0.0 Thing Tag' ], [ 'test.a@1.0.0 Person Tag', 'test.a@1.0.0 Person name Tag' ], [ 'test.b@1.0.0 Staff grade Tag' ]],
                    vocabularies: [ 'locale: en | namespace: test.c@1.0.0', 'locale: en | namespace: test.a@1.0.0', 'locale: en | namespace: test.b@1.0.0' ],
                }, true],
                [{
                    namespaces: [ 'test.a@1.0.0', 'test.b@1.0.0' ],
                    commands: [[ 'concerto@1.0.0 DotNetNamespace' ], [ 'test.a@1.0.0 Person Tag', 'test.a@1.0.0 Person name Tag' ], [ 'test.b@1.0.0 Staff grade Tag' ]],
                    vocabularies: [ 'locale: en | namespace: test.a@1.0.0', 'locale: en | namespace: test.b@1.0.0' ],
                }, true],
            ],
        },
    },
    {
        id: 'DCS-MEMO-003',
        covers: 'decoratormanager.ts extractDecorators (removeDecoratorsFromModel false): a repeated call\'s result is the caller\'s own; changing it changes neither the next call\'s result nor the source manager',
        run: (core) => {
            const mm = managerOf(core, [MODEL_A, MODEL_B]);
            const source = JSON.stringify(mm.getAst());
            const DM = core.DecoratorManager;
            const first = extracted(core, mm, 'extractDecorators');
            extracted(core, mm, 'extractDecorators');
            const out = DM.extractDecorators(mm, Object.assign({}, KEEP));
            out.decoratorCommandSet[0].commands.length = 0;
            out.decoratorCommandSet.push({ junk: true });
            out.vocabularies[0] = 'junk';
            out.modelManager.deleteModelFile('test.b@1.0.0');
            out.modelManager.getType('test.a@1.0.0.Person').getDecorator('Term').getArguments()[0] = 'junk';
            const next = extracted(core, mm, 'extractDecorators');
            const again = DM.extractDecorators(mm, Object.assign({}, KEEP));
            return [next === first, JSON.stringify(mm.getAst()) === source,
                again.modelManager.getModelFiles().filter((mf) => !mf.isSystemModelFile()).map((mf) => mf.getNamespace()),
                again.modelManager.getType('test.a@1.0.0.Person').getDecorator('Term').getArguments()];
        },
        expect: { ok: [true, true, [ 'test.a@1.0.0', 'test.b@1.0.0' ], [ 'A model' ]] },
    },
    {
        id: 'DCS-MEMO-004',
        covers: 'decoratormanager.ts extractDecorators/extractVocabularies (removeDecoratorsFromModel false): a reserved vocabulary key throws the same class on every repeated call, and repeated extractNonVocabDecorators calls on the same models still succeed',
        run: (core) => {
            const mm = managerOf(core, [MODEL_A, RESERVED_KEY]);
            const DM = core.DecoratorManager;
            const out = [];
            for (let i = 0; i < 3; i++) {
                out.push(probe(() => { DM.extractDecorators(mm, Object.assign({}, KEEP)); }));
            }
            for (let i = 0; i < 3; i++) {
                out.push(probe(() => { DM.extractVocabularies(mm, Object.assign({}, KEEP)); }));
            }
            for (let i = 0; i < 4; i++) {
                out.push(probe(() => DM.extractNonVocabDecorators(mm, Object.assign({}, KEEP)).decoratorCommandSet.length));
            }
            out.push(probe(() => { DM.extractDecorators(mm, Object.assign({}, KEEP)); }));
            return out;
        },
        expect: { ok: [ 'Error', 'Error', 'Error', 'Error', 'Error', 'Error', 1, 1, 1, 1, 'Error' ] },
    },
];
