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
 * P5-59 lifted checks (accordproject/concerto-rust#390): the ModelFile
 * header routes that lost their coverage when P5-35 (BC-47) removed the
 * lifted checks over managers that are not engine-backed.
 *
 * - The eager constructor (`fromAst`): a manager with a decorator factory
 *   builds each ModelFile eagerly (engine/views.ts `stageModelFile` keeps
 *   factories on the eager path), so the header is read by the engine's
 *   `modelFileFromAstHeader` from `fromAst`, and a ModelFile built that way
 *   and never added has no recorded import names: `getImports()` takes its
 *   TS body, through `ModelUtil.importFullyQualifiedNames`.
 * - The staged constructor without a staged header (`_fromAstHeader`): the
 *   engine stages the file but cannot vouch for the header when an import's
 *   `uri` is neither a string, `false` nor null (concerto-wasm
 *   `staged_header_from_parts`), so `_fromAstHeader` reads it with
 *   `modelFileFromAstHeader`, and `getImports()` again takes its TS body.
 *   Such an AST reaches the constructor only with the P5-49 shape check
 *   turned off (`metamodelValidation: false`).
 *
 * Only public members are used: `ModelManager` (with `addDecoratorFactory`
 * and `addModelFile`), `DecoratorFactory` and the `ModelFile` constructor.
 * `expect` is the frozen v5.0.0 reference's outcome, which src matches, so
 * no check needs a `reference`. Run by fallbacks.spec.js.
 */

const MM = 'concerto.metamodel@1.0.0';

/**
 * A model AST in namespace `org.acme.p559@1.0.0`.
 * @param {object[]} [imports] the import nodes (omitted when undefined)
 * @param {object[]} [declarations] the declarations (omitted when undefined)
 * @returns {object} the model AST
 */
function model(imports, declarations) {
    const ast = { $class: `${MM}.Model`, namespace: 'org.acme.p559@1.0.0' };
    if (imports !== undefined) {
        ast.imports = imports;
    }
    if (declarations !== undefined) {
        ast.declarations = declarations;
    }
    return ast;
}

const IMPORT_TYPES = { $class: `${MM}.ImportTypes`, namespace: 'org.acme.dep@1.0.0', types: ['A', 'B'] };

/**
 * The ModelFile class of a loaded core.
 * @param {object} core a loaded core
 * @returns {Function} the ModelFile constructor
 */
function modelFileClass(core) {
    return core.modelFileModule.ModelFile;
}

/**
 * A ModelManager with one decorator factory, which keeps every ModelFile it
 * builds on the eager constructor path. The factory returns null, so every
 * decorator is built as usual.
 * @param {object} core a loaded core
 * @returns {object} the ModelManager
 */
function eagerManager(core) {
    const mm = new core.ModelManager();
    class NullFactory extends core.DecoratorFactory {
        /**
         * @returns {null} null: build the decorator as usual
         */
        newDecorator() {
            return null;
        }
    }
    mm.addDecoratorFactory(new NullFactory());
    return mm;
}

/**
 * What a check reads off a ModelFile's header: its namespace, version and
 * `getImports()`, read twice (the second answers from the recorded names).
 * @param {object} mf the ModelFile
 * @returns {object} the header reading
 */
function header(mf) {
    return {
        namespace: mf.getNamespace(),
        version: mf.getVersion(),
        imports: mf.getImports(),
        again: mf.getImports(),
        declarations: mf.getAllDeclarations().length,
    };
}

const SYSTEM_IMPORTS = [
    'concerto@1.0.0.Concept',
    'concerto@1.0.0.Asset',
    'concerto@1.0.0.Transaction',
    'concerto@1.0.0.Participant',
    'concerto@1.0.0.Event',
];

const checks = [
    {
        id: 'MFH-001',
        covers: 'eager constructor (fromAst) and the TS getImports body, for a ModelFile never added',
        run: (core) => {
            const ModelFile = modelFileClass(core);
            return header(new ModelFile(eagerManager(core), model([IMPORT_TYPES]), undefined, 'x.cto'));
        },
        expect: {
            ok: {
                namespace: 'org.acme.p559@1.0.0',
                version: '1.0.0',
                imports: ['org.acme.dep@1.0.0.A', 'org.acme.dep@1.0.0.B'].concat(SYSTEM_IMPORTS),
                again: ['org.acme.dep@1.0.0.A', 'org.acme.dep@1.0.0.B'].concat(SYSTEM_IMPORTS),
                declarations: 0,
            },
        },
    },
    {
        id: 'MFH-002',
        covers: 'TS getImports body over an aliased ImportTypes and an ImportType with a uri',
        run: (core) => {
            const ModelFile = modelFileClass(core);
            const imports = [
                {
                    $class: `${MM}.ImportTypes`,
                    namespace: 'org.acme.dep@1.0.0',
                    types: ['A', 'B'],
                    aliasedTypes: [{ $class: `${MM}.AliasedType`, name: 'B', aliasedName: 'BB' }],
                },
                { $class: `${MM}.ImportType`, namespace: 'org.acme.other@2.0.0', name: 'C', uri: 'https://example.com/other.cto' },
            ];
            return header(new ModelFile(eagerManager(core), model(imports, []), undefined, 'x.cto'));
        },
        expect: {
            ok: {
                namespace: 'org.acme.p559@1.0.0',
                version: '1.0.0',
                imports: ['org.acme.dep@1.0.0.A', 'org.acme.dep@1.0.0.B', 'org.acme.other@2.0.0.C'].concat(SYSTEM_IMPORTS),
                again: ['org.acme.dep@1.0.0.A', 'org.acme.dep@1.0.0.B', 'org.acme.other@2.0.0.C'].concat(SYSTEM_IMPORTS),
                declarations: 0,
            },
        },
    },
    {
        id: 'MFH-003',
        covers: 'eager constructor (fromAst) for an AST without declarations, added to its manager',
        run: (core) => {
            const ModelFile = modelFileClass(core);
            const mm = eagerManager(core);
            const mf = mm.addModelFile(new ModelFile(mm, model()), undefined, 'x.cto');
            return Object.assign(header(mf), { namespaces: mm.getNamespaces().includes('org.acme.p559@1.0.0') });
        },
        expect: {
            ok: {
                namespace: 'org.acme.p559@1.0.0',
                version: '1.0.0',
                imports: SYSTEM_IMPORTS,
                again: SYSTEM_IMPORTS,
                declarations: 0,
                namespaces: true,
            },
        },
    },
    {
        id: 'MFH-004',
        covers: 'eager constructor (fromAst): the engine header read throws for an unversioned import',
        run: (core) => {
            const ModelFile = modelFileClass(core);
            new ModelFile(eagerManager(core), model([Object.assign({}, IMPORT_TYPES, { namespace: 'org.acme.dep' })], []));
            return 'constructed';
        },
        expect: { throws: { name: 'Error', message: 'Cannot use an unversioned import org.acme.dep.' } },
    },
    {
        id: 'MFH-005',
        covers: 'staged constructor without a staged header (_fromAstHeader), an import uri that is a number, and the TS getImports body',
        run: (core) => {
            const ModelFile = modelFileClass(core);
            const mm = new core.ModelManager({ metamodelValidation: false });
            return header(new ModelFile(mm, model([Object.assign({}, IMPORT_TYPES, { uri: 5 })], []), undefined, 'x.cto'));
        },
        expect: {
            ok: {
                namespace: 'org.acme.p559@1.0.0',
                version: '1.0.0',
                imports: ['org.acme.dep@1.0.0.A', 'org.acme.dep@1.0.0.B'].concat(SYSTEM_IMPORTS),
                again: ['org.acme.dep@1.0.0.A', 'org.acme.dep@1.0.0.B'].concat(SYSTEM_IMPORTS),
                declarations: 0,
            },
        },
    },
    {
        id: 'MFH-006',
        covers: 'staged constructor without a staged header (_fromAstHeader), an import uri of true',
        run: (core) => {
            const ModelFile = modelFileClass(core);
            const mm = new core.ModelManager({ metamodelValidation: false });
            const imp = { $class: `${MM}.ImportType`, namespace: 'org.acme.dep@1.0.0', name: 'A', uri: true };
            return header(new ModelFile(mm, model([imp], []), undefined, 'x.cto'));
        },
        expect: {
            ok: {
                namespace: 'org.acme.p559@1.0.0',
                version: '1.0.0',
                imports: ['org.acme.dep@1.0.0.A'].concat(SYSTEM_IMPORTS),
                again: ['org.acme.dep@1.0.0.A'].concat(SYSTEM_IMPORTS),
                declarations: 0,
            },
        },
    },
];

module.exports = checks;
