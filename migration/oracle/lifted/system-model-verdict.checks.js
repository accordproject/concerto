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
 * P5-73 lifted checks (accordproject/concerto-rust#414): `new
 * ModelManager()` and `clearModelFiles()` no longer load and shape-check
 * the two fixed system models (`concerto@1.0.0`,
 * `concerto.decorator@1.0.0`) on every call. Their ModelFiles take the
 * engine's precomputed verdict (engine/views.ts `systemModelAsts`,
 * concerto-wasm `systemModelFileHeader`), which the engine gives only for
 * exactly the fixed system model text.
 *
 * - An AST of a system namespace that user code passes to `new ModelFile`,
 *   and so to `addModelFile`, is always checked: a malformed one is
 *   rejected at construction, after `new ModelManager()` and after
 *   `clearModelFiles()` alike, and even a copy of the system model's own
 *   AST goes through the engine's checked load (SYS-005, which looks at
 *   the engine calls and so only runs on the workspace).
 * - The system models still load, with every option the verdict path
 *   touches (the opt-out, decorator factories), and `clearModelFiles()`
 *   neither loads nor checks them in the engine (SYS-007, workspace only).
 *
 * Each probe reports only the thrown class's name (error parity, P5-09).
 * `reference` is v5.0.0's outcome where BC-19 (R1) changes it. Run by
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
 * A deep copy of the AST a manager holds for `namespace`, changed by `edit`.
 * @param {object} mm the model manager
 * @param {string} namespace a system namespace
 * @param {Function} [edit] changes the copy in place
 * @returns {object} the AST
 */
function copyOf(mm, namespace, edit) {
    const ast = JSON.parse(JSON.stringify(mm.getModelFile(namespace).getAst()));
    if (edit) {
        edit(ast);
    }
    return ast;
}

/**
 * The malformed copies of each system model's AST: a non-array
 * `decorators` (BC-17), a non-string declaration name and an empty super
 * type name (BC-20), and a property the metamodel does not declare (BC-19).
 * @param {object} mm the model manager
 * @returns {object[]} the ASTs
 */
function malformed(mm) {
    const out = [];
    for (const ns of ['concerto@1.0.0', 'concerto.decorator@1.0.0']) {
        out.push(copyOf(mm, ns, (ast) => { ast.decorators = 'x'; }));
        out.push(copyOf(mm, ns, (ast) => { ast.declarations[0].name = 7; }));
        out.push(copyOf(mm, ns, (ast) => {
            ast.declarations[1].superType = { $class: `${MM}.TypeIdentifier`, name: '' };
        }));
        out.push(copyOf(mm, ns, (ast) => {
            ast.declarations[0].properties = [{ $class: `${MM}.IntegerProperty`, name: 'n', isArray: false, isOptional: false,
                validator: { $class: `${MM}.IntegerDomainValidator`, lower: '0' } }];
        }));
    }
    return out;
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

const LOADS = ['systemModelFileHeader', 'stageModelFileChecked', 'stageModelFileWithHeader', 'stageModelFile', 'checkAstShape'];

module.exports = [
    {
        id: 'P573-SYS-001',
        covers: 'P5-73: after new ModelManager(), a user ModelFile of a malformed system-namespace AST is rejected at construction',
        run: (core) => {
            const mm = new core.ModelManager();
            return malformed(mm).map((ast) => probe(() => {
                new core.ModelFile(mm, ast, undefined, 'x.json');
            }));
        },
        expect: { ok: Array(8).fill('IllegalModelException') },
        reference: { ok: ['ok', 'IllegalModelException', 'ok', 'ok', 'ok', 'IllegalModelException', 'ok', 'ok'] },
    },
    {
        id: 'P573-SYS-002',
        covers: 'P5-73: after clearModelFiles(), and in a second manager, a user ModelFile of a malformed system-namespace AST is still rejected at construction',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.clearModelFiles();
            const second = new core.ModelManager();
            return [mm, second].map((m) => malformed(m).map((ast) => probe(() => {
                new core.ModelFile(m, ast, undefined, 'x.json');
            })));
        },
        expect: { ok: [Array(8).fill('IllegalModelException'), Array(8).fill('IllegalModelException')] },
        reference: { ok: [
            ['ok', 'IllegalModelException', 'ok', 'ok', 'ok', 'IllegalModelException', 'ok', 'ok'],
            ['ok', 'IllegalModelException', 'ok', 'ok', 'ok', 'IllegalModelException', 'ok', 'ok'],
        ] },
    },
    {
        id: 'P573-SYS-003',
        covers: 'P5-73: addModelFile of a system namespace, from a malformed AST or from an exact copy of the system model, throws the same class as before',
        run: (core) => {
            const mm = new core.ModelManager();
            const bad = malformed(mm).map((ast) => probe(() => {
                mm.addModelFile(new core.ModelFile(mm, ast, undefined, 'x.json'), undefined, 'x.json');
            }));
            const exact = ['concerto@1.0.0', 'concerto.decorator@1.0.0'].map((ns) => probe(() => {
                mm.addModelFile(new core.ModelFile(mm, copyOf(mm, ns), undefined, 'x.json'), undefined, 'x.json');
            }));
            return [bad, exact, mm.getNamespaces()];
        },
        expect: { ok: [
            Array(8).fill('IllegalModelException'),
            ['Error', 'Error'],
            ['concerto.decorator@1.0.0', 'concerto@1.0.0'],
        ] },
        reference: { ok: [
            ['Error', 'IllegalModelException', 'Error', 'Error', 'Error', 'IllegalModelException', 'Error', 'Error'],
            ['Error', 'Error'],
            ['concerto.decorator@1.0.0', 'concerto@1.0.0'],
        ] },
    },
    {
        id: 'P573-SYS-004',
        covers: 'P5-73: the system models load as before with the shape check off, with a decorator factory, and after clearModelFiles()',
        run: (core) => [
            new core.ModelManager({ metamodelValidation: false }),
            (() => {
                const mm = new core.ModelManager();
                mm.addDecoratorFactory({ newDecorator: () => null });
                mm.clearModelFiles();
                return mm;
            })(),
            (() => {
                const mm = new core.ModelManager({ metamodelValidation: false });
                mm.addDecoratorFactory({ newDecorator: () => null });
                mm.clearModelFiles();
                return mm;
            })(),
        ].map((mm) => [
            mm.getNamespaces(),
            mm.getType('concerto@1.0.0.Asset').isIdentified(),
            mm.getType('concerto@1.0.0.Participant').getSuperType(),
            mm.getModelFile('concerto@1.0.0').getVersion(),
            mm.getModelFile('concerto@1.0.0').getImports().length,
            mm.getModelFile('concerto@1.0.0').getDecorators().map((d) => d.getName()),
            mm.getModelFile('concerto.decorator@1.0.0').getVersion(),
            mm.getModelFile('concerto.decorator@1.0.0').getAllDeclarations().map((d) => d.getFullyQualifiedName()),
            mm.getModelFile('concerto.decorator@1.0.0').getType('DotNetNamespace').getProperties().map((p) => p.getName()),
        ]),
        expect: { ok: Array(3).fill([
            ['concerto.decorator@1.0.0', 'concerto@1.0.0'],
            true,
            'concerto@1.0.0.Concept',
            '1.0.0',
            1,
            ['DotNetNamespace'],
            '1.0.0',
            ['concerto.decorator@1.0.0.Decorator', 'concerto.decorator@1.0.0.DotNetNamespace'],
            ['namespace'],
        ]) },
    },
    {
        id: 'P573-SYS-005',
        covers: 'P5-73: a user ModelFile built from an exact copy of a system model AST is loaded and checked by the engine, not given the precomputed verdict',
        run: (core) => {
            const mm = new core.ModelManager();
            if (!mm.rustHandle) {
                return 'no engine';
            }
            return ['concerto@1.0.0', 'concerto.decorator@1.0.0'].map((ns) => {
                const counts = countCalls(mm.rustHandle, LOADS);
                const outcome = probe(() => {
                    new core.ModelFile(mm, copyOf(mm, ns), undefined, 'x.json');
                });
                return [outcome, counts.systemModelFileHeader, counts.stageModelFileChecked];
            });
        },
        expect: { ok: [['ok', 0, 1], ['ok', 0, 1]] },
        reference: { ok: 'no engine' },
    },
    {
        id: 'P573-SYS-006',
        covers: 'P5-73: a user ModelFile of a system namespace is checked even when a constant system AST object is reused after the manager loaded it',
        run: (core) => {
            const mm = new core.ModelManager();
            const ast = mm.getModelFile('concerto@1.0.0').getAst();
            const original = ast.decorators;
            try {
                ast.decorators = 'x';
                return probe(() => {
                    new core.ModelFile(mm, ast, undefined, 'x.json');
                });
            } finally {
                ast.decorators = original;
            }
        },
        expect: { ok: 'IllegalModelException' },
        reference: { ok: 'ok' },
    },
    {
        id: 'P573-SYS-007',
        covers: 'P5-73: clearModelFiles() takes the precomputed verdict for both system models, with no engine load or shape check of them, with and without the shape check',
        run: (core) => [undefined, { metamodelValidation: false }].map((options) => {
            const mm = new core.ModelManager(options);
            if (typeof mm._newRustHandle !== 'function') {
                return 'no engine';
            }
            let counts;
            const newRustHandle = mm._newRustHandle;
            mm._newRustHandle = function () {
                const handle = newRustHandle.call(this);
                counts = countCalls(handle, LOADS);
                return handle;
            };
            mm.clearModelFiles();
            return [counts, mm.getNamespaces()];
        }),
        expect: { ok: Array(2).fill([
            { systemModelFileHeader: 2, stageModelFileChecked: 0, stageModelFileWithHeader: 0, stageModelFile: 0, checkAstShape: 0 },
            ['concerto.decorator@1.0.0', 'concerto@1.0.0'],
        ]) },
        reference: { ok: ['no engine', 'no engine'] },
    },
];
