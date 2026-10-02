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
 * P5-75 lifted checks (accordproject/concerto-rust#417): a ModelManager's
 * namespace list (`getNamespaces()`) is kept up to date in place by every
 * model change (packages/concerto-core/src/basemodelmanager.ts
 * `NamespaceList`) rather than asked of the engine again after each one.
 *
 * Each check changes the models through the public API and reads
 * `getNamespaces()` after every step, so a list that missed a change, or
 * put a namespace in the wrong place, fails. The steps cover what TS 5.0.0
 * orders by (`Object.keys(this.modelFiles)`): the system namespaces first,
 * a new namespace appended, a replaced one keeping its place, a deleted one
 * removed (and appended again when re-added), `clearModelFiles`, the
 * batch `addModelFiles` (its own order, and its roll-back), failed adds of
 * every kind, `updateExternalModels` (async) and its roll-back, `fromAst`,
 * `filter`, the metamodel (`addMetamodel`, a user-added copy, and a
 * malformed file added with `metamodelValidation`, which the ModelFile
 * constructor rejects since BC-19, so no metamodel copy is registered), and
 * two managers changed in turn. The last
 * check (NS-009) looks at the engine itself and so runs on the workspace
 * only: after every step the list equals `rustHandle.getNamespaces()`, and
 * reading it crossed into the engine for none of them.
 *
 * Each probe reports only the thrown class's name (error parity, P5-09).
 * `expect` is the frozen v5.0.0 reference's outcome. Run by
 * fallbacks.spec.js.
 */

const MM = 'concerto.metamodel@1.0.0';

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
 * The async outcome of `fn`: `ok`, or the thrown class's name.
 * @param {Function} fn the call, returning a promise
 * @returns {Promise<string>} the outcome
 */
async function probeAsync(fn) {
    try {
        await fn();
        return 'ok';
    } catch (e) {
        return e.constructor.name;
    }
}

/**
 * A CTO model.
 * @param {string} name the namespace's name (versioned 1.0.0)
 * @param {string} [body] the declarations
 * @returns {string} the CTO
 */
function cto(name, body) {
    return `namespace ${name}@1.0.0\n${body ?? `concept C_${name.replace(/\./g, '_')} {\n  o String s\n}\n`}`;
}

/**
 * Runs `steps` against `mm`, reading `getNamespaces()` after each.
 * @param {object} mm the model manager
 * @param {Array<[string, Function]>} steps labelled changes
 * @returns {Array} `[label, outcome, namespaces]` per step
 */
function trace(mm, steps) {
    return steps.map(([label, step]) => [label, probe(() => {
        step(mm);
    }), mm.getNamespaces()]);
}

/**
 * The steps every engine and the reference take in NS-001 and NS-009: the
 * single-file changes and `clearModelFiles`.
 * @param {object} core the core under test
 * @returns {Array<[string, Function]>} the steps
 */
function singleFileSteps(core) {
    return [
        ['new', () => {}],
        ['add a', (mm) => mm.addCTOModel(cto('org.a'), 'a.cto')],
        ['add b', (mm) => mm.addCTOModel(cto('org.b'), 'b.cto')],
        ['add c', (mm) => mm.addCTOModel(cto('org.c'), 'c.cto')],
        ['update b', (mm) => mm.updateModelFile(cto('org.b', 'concept D {\n  o Integer i\n}\n'), 'b2.cto')],
        ['update b (ModelFile)', (mm) => mm.updateModelFile(new core.ModelFile(mm, mm.getModelFile('org.b@1.0.0').getAst(), undefined, 'b3.json'))],
        ['delete a', (mm) => mm.deleteModelFile('org.a@1.0.0')],
        ['add a again', (mm) => mm.addCTOModel(cto('org.a'), 'a.cto')],
        ['delete c', (mm) => mm.deleteModelFile('org.c@1.0.0')],
        ['delete absent', (mm) => mm.deleteModelFile('org.c@1.0.0')],
        ['delete a system model', (mm) => mm.deleteModelFile('concerto.decorator@1.0.0')],
        ['add d', (mm) => mm.addCTOModel(cto('org.d'), 'd.cto')],
        ['clear', (mm) => mm.clearModelFiles()],
        ['add b after clear', (mm) => mm.addCTOModel(cto('org.b'), 'b.cto')],
        ['clear again', (mm) => mm.clearModelFiles()],
    ];
}

/**
 * The failed single-file adds and updates of NS-002 and NS-009.
 * @param {object} core the core under test
 * @returns {Array<[string, Function]>} the steps
 */
function failedAddSteps(core) {
    return [
        ['add a', (mm) => mm.addCTOModel(cto('org.a'), 'a.cto')],
        ['parse error', (mm) => mm.addCTOModel('namespace org.p@1.0.0\nconcept {', 'p.cto')],
        ['unknown import', (mm) => mm.addCTOModel(cto('org.u', 'import org.missing@1.0.0.{X}\nconcept U extends X {}\n'), 'u.cto')],
        ['unknown super type', (mm) => mm.addCTOModel(cto('org.s', 'concept S extends Nope {}\n'), 's.cto')],
        ['duplicate', (mm) => mm.addCTOModel(cto('org.a'), 'a2.cto')],
        ['unversioned', (mm) => mm.addCTOModel('namespace org.v\nconcept V {}\n', 'v.cto')],
        ['not a ModelFile', (mm) => mm.addModelFile({ getNamespace: () => 'org.x@1.0.0', getVersion: () => '1.0.0' })],
        ['update absent', (mm) => mm.updateModelFile(cto('org.n'), 'n.cto')],
        ['update invalid', (mm) => mm.updateModelFile(cto('org.a', 'concept A extends Nope {}\n'), 'a.cto')],
        ['add b', (mm) => mm.addCTOModel(cto('org.b'), 'b.cto')],
        ['add an invalid file without validation', (mm) => mm.addCTOModel(cto('org.w', 'concept W extends Nope {}\n'), 'w.cto', true)],
    ];
}

/**
 * The batch `addModelFiles` steps of NS-003 and NS-009.
 * @returns {Array<[string, Function]>} the steps
 */
function batchSteps() {
    const local = (name) => `C_${name.replace(/\./g, '_')}`;
    const importing = (name, from) => cto(name, `import ${from}@1.0.0.{${local(from)}}\nconcept ${local(name)} extends ${local(from)} {}\n`);
    return [
        ['add z', (mm) => mm.addCTOModel(cto('org.z'), 'z.cto')],
        ['batch (imports out of order)', (mm) => mm.addModelFiles([importing('org.y', 'org.x'), cto('org.x'), importing('org.w', 'org.y')], ['y.cto', 'x.cto', 'w.cto'])],
        ['batch, one invalid', (mm) => mm.addModelFiles([cto('org.v'), cto('org.u', 'concept U extends Nope {}\n')], ['v.cto', 'u.cto'])],
        ['batch, a duplicate', (mm) => mm.addModelFiles([cto('org.t'), cto('org.z')], ['t.cto', 'z2.cto'])],
        ['batch, a duplicate within it', (mm) => mm.addModelFiles([cto('org.t'), cto('org.t')], ['t.cto', 't2.cto'])],
        ['batch, a parse error', (mm) => mm.addModelFiles([cto('org.t'), 'namespace org.q@1.0.0\nconcept {'], ['t.cto', 'q.cto'])],
        ['batch, unversioned', (mm) => mm.addModelFiles([cto('org.t'), 'namespace org.q\nconcept Q {}\n'], ['t.cto', 'q.cto'])],
        ['batch without validation', (mm) => mm.addModelFiles([cto('org.s')], ['s.cto'], true)],
        ['empty batch', (mm) => mm.addModelFiles([])],
        ['add r', (mm) => mm.addCTOModel(cto('org.r'), 'r.cto')],
        ['delete w', (mm) => mm.deleteModelFile('org.w@1.0.0')],
        ['batch re-adding w', (mm) => mm.addModelFiles([importing('org.w', 'org.y')], ['w.cto'])],
        ['batch of an invalid file without validation', (mm) => mm.addModelFiles([cto('org.q', 'concept Q extends Nope {}\n')], ['q.cto'], true)],
    ];
}

/**
 * The `updateExternalModels` steps of NS-005 and NS-009: each downloader
 * hands back `files` (CTO texts).
 * @param {object} mm the model manager
 * @param {string[]} files the downloaded CTO texts
 * @returns {Promise<string>} the outcome
 */
function updateExternal(mm, files) {
    const downloader = {
        downloadExternalDependencies: async () => files.map((text, i) => {
            const probeManager = new mm.constructor();
            const ast = probeManager.addCTOModel(text, `ext${i}.cto`, true).getAst();
            return { ast, definitions: text, fileName: `@ext${i}.cto` };
        }),
    };
    return probeAsync(() => mm.updateExternalModels({}, downloader));
}

/**
 * The `updateExternalModels` scenario (NS-005, NS-009): `read` reads the
 * namespaces after each step.
 * @param {object} core the core under test
 * @param {Function} read the reader, given the manager
 * @returns {Promise<Array>} `[label, outcome, read(mm)]` per step
 */
async function externalScenario(core, read) {
    const mm = new core.ModelManager();
    const out = [['new', 'ok', read(mm)]];
    const step = async (label, fn) => {
        out.push([label, await fn(), read(mm)]);
    };
    await step('add a', async () => probe(() => {
        mm.addCTOModel(cto('org.a'), 'a.cto');
    }));
    await step('add b', async () => probe(() => {
        mm.addCTOModel(cto('org.b'), 'b.cto');
    }));
    await step('external: new e, f; replaced a', () => updateExternal(mm, [cto('org.e'), cto('org.a', 'concept A2 {}\n'), cto('org.f')]));
    await step('external: e twice', () => updateExternal(mm, [cto('org.e', 'concept E2 {}\n'), cto('org.e', 'concept E3 {}\n')]));
    await step('external: one invalid', () => updateExternal(mm, [cto('org.g'), cto('org.h', 'concept H extends Nope {}\n')]));
    await step('external: none', () => updateExternal(mm, []));
    await step('add c', async () => probe(() => {
        mm.addCTOModel(cto('org.c'), 'c.cto');
    }));
    await step('delete e', async () => probe(() => {
        mm.deleteModelFile('org.e@1.0.0');
    }));
    return out;
}

/**
 * The metamodel steps (NS-006, NS-009) for managers built with `options`.
 * @param {object} core the core under test
 * @returns {Array} per manager, its trace
 */
function metamodelScenarios(core) {
    const bad = (mm) => {
        const ast = JSON.parse(JSON.stringify(new core.ModelManager().addCTOModel(cto('org.m')).getAst()));
        ast.declarations[0].properties[0].$class = 'concerto.metamodel@1.0.0.NoSuchProperty';
        return new core.ModelFile(mm, ast, undefined, 'm.json');
    };
    return [
        [{ addMetamodel: true }, [
            ['add a', (mm) => mm.addCTOModel(cto('org.a'), 'a.cto')],
            ['delete the metamodel', (mm) => mm.deleteModelFile(MM)],
            ['add b', (mm) => mm.addCTOModel(cto('org.b'), 'b.cto')],
            ['clear', (mm) => mm.clearModelFiles()],
        ]],
        [{ metamodelValidation: true }, [
            ['add a', (mm) => mm.addCTOModel(cto('org.a'), 'a.cto')],
            ['add a malformed file', (mm) => mm.addModelFile(bad(mm))],
            ['add b', (mm) => mm.addCTOModel(cto('org.b'), 'b.cto')],
        ]],
        [{}, [
            ['add the metamodel', (mm) => mm.addModelFile(new core.ModelFile(mm, new core.ModelManager({ addMetamodel: true }).getModelFile(MM).getAst(), undefined, 'mm.json'))],
            ['add a', (mm) => mm.addCTOModel(cto('org.a'), 'a.cto')],
        ]],
    ].map(([options, steps]) => trace(new core.ModelManager(options), [['new', () => {}], ...steps]));
}

/**
 * Wraps `mm` so that every rustHandle it uses (the current one, and each
 * one `clearModelFiles` starts) counts its `getNamespaces` calls, then runs
 * `steps`, reading after each one: the list, whether it equals the engine's
 * own answer, and the engine crossings the read made.
 * @param {object} mm the model manager
 * @param {Array<[string, Function]>} steps labelled changes
 * @returns {Array|string} per step `[label, outcome, list, sameAsEngine, crossings]`,
 *  or 'no engine' on the reference
 */
function engineTrace(mm, steps) {
    if (typeof mm._newRustHandle !== 'function') {
        return 'no engine';
    }
    let calls = 0;
    const counted = new WeakSet();
    const count = (handle) => {
        if (!counted.has(handle)) {
            counted.add(handle);
            const original = handle.getNamespaces;
            handle.getNamespaces = function (...args) {
                calls++;
                return original.apply(this, args);
            };
        }
        return handle;
    };
    count(mm.rustHandle);
    const newRustHandle = mm._newRustHandle;
    mm._newRustHandle = function () {
        return count(newRustHandle.call(this));
    };
    return steps.map(([label, step]) => {
        const outcome = probe(() => {
            step(mm);
        });
        count(mm.rustHandle);
        const before = calls;
        const list = mm.getNamespaces();
        const crossings = calls - before;
        const engine = mm.rustHandle.getNamespaces();
        return [label, outcome, list, JSON.stringify(list) === JSON.stringify(engine), crossings];
    });
}

module.exports = [
    {
        id: 'P575-NS-001',
        covers: 'P5-75: getNamespaces after each single-file add, update (CTO and ModelFile), delete (and failed delete), re-add and clearModelFiles',
        run: (core) => trace(new core.ModelManager(), singleFileSteps(core)),
        expect: { ok: [
            ['new', 'ok', ['concerto.decorator@1.0.0', 'concerto@1.0.0']],
            ['add a', 'ok', ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0']],
            ['add b', 'ok', ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0', 'org.b@1.0.0']],
            [
                'add c',
                'ok',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0', 'org.b@1.0.0', 'org.c@1.0.0'],
            ],
            [
                'update b',
                'ok',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0', 'org.b@1.0.0', 'org.c@1.0.0'],
            ],
            [
                'update b (ModelFile)',
                'ok',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0', 'org.b@1.0.0', 'org.c@1.0.0'],
            ],
            [
                'delete a',
                'ok',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.b@1.0.0', 'org.c@1.0.0'],
            ],
            [
                'add a again',
                'ok',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.b@1.0.0', 'org.c@1.0.0', 'org.a@1.0.0'],
            ],
            [
                'delete c',
                'ok',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.b@1.0.0', 'org.a@1.0.0'],
            ],
            [
                'delete absent',
                'Error',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.b@1.0.0', 'org.a@1.0.0'],
            ],
            ['delete a system model', 'ok', ['concerto@1.0.0', 'org.b@1.0.0', 'org.a@1.0.0']],
            ['add d', 'ok', ['concerto@1.0.0', 'org.b@1.0.0', 'org.a@1.0.0', 'org.d@1.0.0']],
            ['clear', 'ok', ['concerto.decorator@1.0.0', 'concerto@1.0.0']],
            ['add b after clear', 'ok', ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.b@1.0.0']],
            ['clear again', 'ok', ['concerto.decorator@1.0.0', 'concerto@1.0.0']],
        ] },
    },
    {
        id: 'P575-NS-002',
        covers: 'P5-75: a failed add or update of every kind leaves getNamespaces unchanged; the next add appends',
        run: (core) => trace(new core.ModelManager(), failedAddSteps(core)),
        expect: { ok: [
            ['add a', 'ok', ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0']],
            [
                'parse error',
                'ParseException',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0'],
            ],
            [
                'unknown import',
                'IllegalModelException',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0'],
            ],
            [
                'unknown super type',
                'IllegalModelException',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0'],
            ],
            ['duplicate', 'Error', ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0']],
            ['unversioned', 'Error', ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0']],
            [
                'not a ModelFile',
                'TypeError',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0'],
            ],
            ['update absent', 'Error', ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0']],
            [
                'update invalid',
                'IllegalModelException',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0'],
            ],
            ['add b', 'ok', ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0', 'org.b@1.0.0']],
            [
                'add an invalid file without validation',
                'ok',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0', 'org.b@1.0.0', 'org.w@1.0.0'],
            ],
        ] },
    },
    {
        id: 'P575-NS-003',
        covers: 'P5-75: addModelFiles appends its batch in the order given, and a batch that fails (validation, duplicate, parse error, unversioned) is rolled back, leaving getNamespaces as before',
        run: (core) => trace(new core.ModelManager(), batchSteps()),
        expect: { ok: [
            ['add z', 'ok', ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.z@1.0.0']],
            [
                'batch (imports out of order)',
                'ok',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.z@1.0.0', 'org.y@1.0.0', 'org.x@1.0.0', 'org.w@1.0.0'],
            ],
            [
                'batch, one invalid',
                'IllegalModelException',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.z@1.0.0', 'org.y@1.0.0', 'org.x@1.0.0', 'org.w@1.0.0'],
            ],
            [
                'batch, a duplicate',
                'Error',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.z@1.0.0', 'org.y@1.0.0', 'org.x@1.0.0', 'org.w@1.0.0'],
            ],
            [
                'batch, a duplicate within it',
                'Error',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.z@1.0.0', 'org.y@1.0.0', 'org.x@1.0.0', 'org.w@1.0.0'],
            ],
            [
                'batch, a parse error',
                'ParseException',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.z@1.0.0', 'org.y@1.0.0', 'org.x@1.0.0', 'org.w@1.0.0'],
            ],
            [
                'batch, unversioned',
                'Error',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.z@1.0.0', 'org.y@1.0.0', 'org.x@1.0.0', 'org.w@1.0.0'],
            ],
            [
                'batch without validation',
                'ok',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.z@1.0.0', 'org.y@1.0.0', 'org.x@1.0.0', 'org.w@1.0.0', 'org.s@1.0.0'],
            ],
            [
                'empty batch',
                'ok',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.z@1.0.0', 'org.y@1.0.0', 'org.x@1.0.0', 'org.w@1.0.0', 'org.s@1.0.0'],
            ],
            [
                'add r',
                'ok',
                [
                    'concerto.decorator@1.0.0',
                    'concerto@1.0.0',
                    'org.z@1.0.0',
                    'org.y@1.0.0',
                    'org.x@1.0.0',
                    'org.w@1.0.0',
                    'org.s@1.0.0',
                    'org.r@1.0.0',
                ],
            ],
            [
                'delete w',
                'ok',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.z@1.0.0', 'org.y@1.0.0', 'org.x@1.0.0', 'org.s@1.0.0', 'org.r@1.0.0'],
            ],
            [
                'batch re-adding w',
                'ok',
                [
                    'concerto.decorator@1.0.0',
                    'concerto@1.0.0',
                    'org.z@1.0.0',
                    'org.y@1.0.0',
                    'org.x@1.0.0',
                    'org.s@1.0.0',
                    'org.r@1.0.0',
                    'org.w@1.0.0',
                ],
            ],
            [
                'batch of an invalid file without validation',
                'ok',
                [
                    'concerto.decorator@1.0.0',
                    'concerto@1.0.0',
                    'org.z@1.0.0',
                    'org.y@1.0.0',
                    'org.x@1.0.0',
                    'org.s@1.0.0',
                    'org.r@1.0.0',
                    'org.w@1.0.0',
                    'org.q@1.0.0',
                ],
            ],
        ] },
    },
    {
        id: 'P575-NS-004',
        covers: 'P5-75: changing the array getNamespaces returns changes neither the next answer nor the models; two managers changed in turn keep their own lists',
        run: (core) => {
            const one = new core.ModelManager();
            const two = new core.ModelManager();
            const out = [];
            one.addCTOModel(cto('org.a'), 'a.cto');
            const first = one.getNamespaces();
            first.push('org.injected@1.0.0');
            first.reverse();
            out.push(one.getNamespaces(), two.getNamespaces());
            two.addCTOModel(cto('org.b'), 'b.cto');
            out.push(one.getNamespaces(), two.getNamespaces());
            one.addCTOModel(cto('org.c'), 'c.cto');
            two.deleteModelFile('org.b@1.0.0');
            out.push(one.getNamespaces(), two.getNamespaces());
            const again = one.getNamespaces();
            again.length = 0;
            out.push(one.getNamespaces(), one.getModelFiles().map((mf) => mf.getNamespace()));
            return out;
        },
        expect: { ok: [
            ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0'],
            ['concerto.decorator@1.0.0', 'concerto@1.0.0'],
            ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0'],
            ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.b@1.0.0'],
            ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0', 'org.c@1.0.0'],
            ['concerto.decorator@1.0.0', 'concerto@1.0.0'],
            ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0', 'org.c@1.0.0'],
            ['org.a@1.0.0', 'org.c@1.0.0'],
        ] },
    },
    {
        id: 'P575-NS-005',
        covers: 'P5-75: updateExternalModels appends new namespaces in download order, keeps a replaced one in place, and a failed update leaves getNamespaces unchanged',
        async: true,
        run: (core) => externalScenario(core, (mm) => mm.getNamespaces()),
        expect: { ok: [
            ['new', 'ok', ['concerto.decorator@1.0.0', 'concerto@1.0.0']],
            ['add a', 'ok', ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0']],
            ['add b', 'ok', ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0', 'org.b@1.0.0']],
            [
                'external: new e, f; replaced a',
                'ok',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0', 'org.b@1.0.0', 'org.e@1.0.0', 'org.f@1.0.0'],
            ],
            [
                'external: e twice',
                'ok',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0', 'org.b@1.0.0', 'org.e@1.0.0', 'org.f@1.0.0'],
            ],
            [
                'external: one invalid',
                'IllegalModelException',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0', 'org.b@1.0.0', 'org.e@1.0.0', 'org.f@1.0.0'],
            ],
            [
                'external: none',
                'ok',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0', 'org.b@1.0.0', 'org.e@1.0.0', 'org.f@1.0.0'],
            ],
            [
                'add c',
                'ok',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0', 'org.b@1.0.0', 'org.e@1.0.0', 'org.f@1.0.0', 'org.c@1.0.0'],
            ],
            [
                'delete e',
                'ok',
                ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0', 'org.b@1.0.0', 'org.f@1.0.0', 'org.c@1.0.0'],
            ],
        ] },
    },
    {
        id: 'P575-NS-006',
        covers: 'P5-75: the metamodel namespace in getNamespaces: addMetamodel, deleted and cleared; a malformed file added with metamodelValidation; a user-added metamodel',
        run: (core) => metamodelScenarios(core),
        expect: { ok: [
            [
                ['new', 'ok', ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'concerto.metamodel@1.0.0']],
                [
                    'add a',
                    'ok',
                    ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'concerto.metamodel@1.0.0', 'org.a@1.0.0'],
                ],
                ['delete the metamodel', 'ok', ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0']],
                ['add b', 'ok', ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0', 'org.b@1.0.0']],
                ['clear', 'ok', ['concerto.decorator@1.0.0', 'concerto@1.0.0']],
            ],
            [
                ['new', 'ok', ['concerto.decorator@1.0.0', 'concerto@1.0.0']],
                ['add a', 'ok', ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0']],
                [
                    'add a malformed file',
                    'IllegalModelException',
                    ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0'],
                ],
                ['add b', 'ok', ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0', 'org.b@1.0.0']],
            ],
            [
                ['new', 'ok', ['concerto.decorator@1.0.0', 'concerto@1.0.0']],
                [
                    'add the metamodel',
                    'ok',
                    ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'concerto.metamodel@1.0.0'],
                ],
                [
                    'add a',
                    'ok',
                    ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'concerto.metamodel@1.0.0', 'org.a@1.0.0'],
                ],
            ],
        ] },
    },
    {
        id: 'P575-NS-007',
        covers: 'P5-75: getNamespaces after fromAst (which clears first, in the AST\'s order), and filter()',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel(cto('org.a'), 'a.cto');
            mm.addCTOModel(cto('org.b', 'import org.a@1.0.0.{C_org_a}\nconcept B extends C_org_a {}\n'), 'b.cto');
            mm.addCTOModel(cto('org.c'), 'c.cto');
            const ast = mm.getAst();
            const other = new core.ModelManager();
            other.addCTOModel(cto('org.z'), 'z.cto');
            const before = other.getNamespaces();
            other.fromAst({ ...ast, models: [ast.models[2], ast.models[0], ast.models[1]] });
            const afterFromAst = other.getNamespaces();
            other.addCTOModel(cto('org.d'), 'd.cto');
            // v5.0.0's filter() rejects a ModelManager's own decorator model.
            const filtered = probe(() => mm.filter((d) => d.getName() !== 'C_org_c').getNamespaces());
            return [before, afterFromAst, other.getNamespaces(), filtered, mm.getNamespaces()];
        },
        expect: { ok: [
            ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.z@1.0.0'],
            ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.c@1.0.0', 'org.a@1.0.0', 'org.b@1.0.0'],
            ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.c@1.0.0', 'org.a@1.0.0', 'org.b@1.0.0', 'org.d@1.0.0'],
            'Error',
            ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.a@1.0.0', 'org.b@1.0.0', 'org.c@1.0.0'],
        ] },
    },
    {
        id: 'P575-NS-008',
        covers: 'P5-75: after each step of NS-005 (updateExternalModels), getNamespaces equals rustHandle.getNamespaces(); reading it makes no engine call, except once after a failed update, whose roll-back replaces the model file map',
        async: true,
        run: async (core) => {
            if (typeof new core.ModelManager()._newRustHandle !== 'function') {
                return 'no engine';
            }
            let calls = 0;
            const counted = new WeakSet();
            return (await externalScenario(core, (mm) => {
                const handle = mm.rustHandle;
                if (!counted.has(handle)) {
                    counted.add(handle);
                    const original = handle.getNamespaces;
                    handle.getNamespaces = function (...args) {
                        calls++;
                        return original.apply(this, args);
                    };
                }
                const before = calls;
                const list = mm.getNamespaces();
                const crossings = calls - before;
                return [JSON.stringify(list) === JSON.stringify(handle.getNamespaces()), crossings];
            })).map(([label, outcome, read]) => [label, outcome, ...read]);
        },
        expect: { ok: [
            ['new', 'ok', true, 0],
            ['add a', 'ok', true, 0],
            ['add b', 'ok', true, 0],
            ['external: new e, f; replaced a', 'ok', true, 0],
            ['external: e twice', 'ok', true, 0],
            ['external: one invalid', 'IllegalModelException', true, 1],
            ['external: none', 'ok', true, 0],
            ['add c', 'ok', true, 0],
            ['delete e', 'ok', true, 0],
        ] },
        reference: { ok: 'no engine' },
    },
    {
        id: 'P575-NS-009',
        covers: 'P5-75: after every change of NS-001, NS-002, NS-003, NS-006 and NS-007, the list getNamespaces answers equals rustHandle.getNamespaces(), and reading it makes no engine call',
        run: (core) => {
            const fromAst = [
                ['add a', (mm) => mm.addCTOModel(cto('org.a'), 'a.cto')],
                ['fromAst', (mm) => {
                    const src = new core.ModelManager();
                    src.addCTOModel(cto('org.c'), 'c.cto');
                    src.addCTOModel(cto('org.b'), 'b.cto');
                    mm.fromAst(src.getAst());
                }],
                ['add d', (mm) => mm.addCTOModel(cto('org.d'), 'd.cto')],
            ];
            const metamodel = (options, steps) => [new core.ModelManager(options), steps];
            const bad = (mm) => {
                const ast = JSON.parse(JSON.stringify(new core.ModelManager().addCTOModel(cto('org.m')).getAst()));
                ast.declarations[0].properties[0].$class = 'concerto.metamodel@1.0.0.NoSuchProperty';
                return new core.ModelFile(mm, ast, undefined, 'm.json');
            };
            return [
                [new core.ModelManager(), singleFileSteps(core)],
                [new core.ModelManager(), failedAddSteps(core)],
                [new core.ModelManager(), batchSteps()],
                [new core.ModelManager(), fromAst],
                metamodel({ addMetamodel: true }, [['delete the metamodel', (mm) => mm.deleteModelFile(MM)], ['clear', (mm) => mm.clearModelFiles()]]),
                metamodel({ metamodelValidation: true }, [['add a malformed file', (mm) => mm.addModelFile(bad(mm))], ['add b', (mm) => mm.addCTOModel(cto('org.b'), 'b.cto')]]),
            ].map(([mm, steps]) => {
                const traced = engineTrace(mm, steps);
                return traced === 'no engine' ? traced : traced.map(([label, outcome, , same, crossings]) => [label, outcome, same, crossings]);
            });
        },
        expect: { ok: [
            [
                ['new', 'ok', true, 0],
                ['add a', 'ok', true, 0],
                ['add b', 'ok', true, 0],
                ['add c', 'ok', true, 0],
                ['update b', 'ok', true, 0],
                ['update b (ModelFile)', 'ok', true, 0],
                ['delete a', 'ok', true, 0],
                ['add a again', 'ok', true, 0],
                ['delete c', 'ok', true, 0],
                ['delete absent', 'Error', true, 0],
                ['delete a system model', 'ok', true, 0],
                ['add d', 'ok', true, 0],
                ['clear', 'ok', true, 0],
                ['add b after clear', 'ok', true, 0],
                ['clear again', 'ok', true, 0],
            ],
            [
                ['add a', 'ok', true, 0],
                ['parse error', 'ParseException', true, 0],
                ['unknown import', 'IllegalModelException', true, 0],
                ['unknown super type', 'IllegalModelException', true, 0],
                ['duplicate', 'Error', true, 0],
                ['unversioned', 'Error', true, 0],
                ['not a ModelFile', 'TypeError', true, 0],
                ['update absent', 'Error', true, 0],
                ['update invalid', 'IllegalModelException', true, 0],
                ['add b', 'ok', true, 0],
                ['add an invalid file without validation', 'ok', true, 0],
            ],
            [
                ['add z', 'ok', true, 0],
                ['batch (imports out of order)', 'ok', true, 0],
                ['batch, one invalid', 'IllegalModelException', true, 0],
                ['batch, a duplicate', 'Error', true, 0],
                ['batch, a duplicate within it', 'Error', true, 0],
                ['batch, a parse error', 'ParseException', true, 0],
                ['batch, unversioned', 'Error', true, 0],
                ['batch without validation', 'ok', true, 0],
                ['empty batch', 'ok', true, 0],
                ['add r', 'ok', true, 0],
                ['delete w', 'ok', true, 0],
                ['batch re-adding w', 'ok', true, 0],
                ['batch of an invalid file without validation', 'ok', true, 0],
            ],
            [['add a', 'ok', true, 0], ['fromAst', 'ok', true, 0], ['add d', 'ok', true, 0]],
            [['delete the metamodel', 'ok', true, 0], ['clear', 'ok', true, 0]],
            [['add a malformed file', 'IllegalModelException', true, 0], ['add b', 'ok', true, 0]],
        ] },
        reference: { ok: ['no engine', 'no engine', 'no engine', 'no engine', 'no engine', 'no engine'] },
    },
];
