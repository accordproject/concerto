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
 * P5-11 lifted checks (accordproject/concerto-rust#287): the 14 port
 * candidates of accordproject/concerto-rust#276 now run in Rust
 * (`ModelManager.getType`, `validateModelFiles`, `_throwAlreadyExists` and
 * `updateExternalModels`; `ModelFile.getType`, `getFullyQualifiedTypeName`,
 * `resolveType`, the `fromAst` header, `isCompatibleVersion` and
 * `enforceImportVersioning`; `Declaration.validate` and
 * `isReservedSystemTypeImport`; `validateMetaModel`). Each keeps its TS body
 * only for what the engine cannot take: a model file its manager has not
 * mirrored into the engine (a detached file, or a manager holding a
 * duck-typed model file the ModelFile constructor never built), arguments a
 * binding cannot take, a namespace the engine is never written for, and an
 * input the serializer fast path cannot cross. The frozen unit suite
 * reaches most of those only through sinon stubs, so these checks drive
 * them through the public API. `expect` is the frozen v5.0.0 reference's
 * outcome. Run by fallbacks.spec.js; a check marked `async` returns a
 * promise.
 */

const A_CTO = 'namespace org.acme.p511.a@1.0.0\nconcept Shape {}\nenum Colour { o RED }\n';
const B_CTO = 'namespace org.acme.p511.b@1.0.0\nimport org.acme.p511.a@1.0.0.{Shape as Figure, Colour} from https://example.com/a.cto\nconcept Local { o Figure f o Colour c }\n';
const EXT_CTO = 'namespace org.acme.p511.ext@1.0.0\nconcept Ext { o String s }\n';
const EXT_BAD_CTO = 'namespace org.acme.p511.ext@1.0.0\nconcept Ext extends Nowhere { o String s }\n';
const A2_CTO = 'namespace org.acme.p511.a@1.0.0\nconcept Shape {}\nenum Colour { o RED }\nconcept Added {}\n';

/**
 * The outcome of `fn()` as plain data: its value, or `<Class>: <message>`.
 * @param {Function} fn the call
 * @returns {*} the value or the error text
 */
function attempt(fn) {
    try {
        const v = fn();
        if (v && typeof v === 'object' && typeof v.getFullyQualifiedName === 'function') {
            return { declaration: v.getFullyQualifiedName() };
        }
        return v === undefined ? '<undefined>' : v;
    } catch (e) {
        return `${e.constructor.name}: ${e.message}`;
    }
}

/**
 * A ModelManager holding A_CTO and, unless `onlyA`, B_CTO.
 * @param {object} core the core under test
 * @param {boolean} [onlyA] whether to leave B_CTO out
 * @returns {object} the ModelManager
 */
function manager(core, onlyA) {
    const mm = new core.ModelManager();
    mm.addCTOModel(A_CTO, 'a.cto');
    if (!onlyA) {
        mm.addCTOModel(B_CTO, 'b.cto');
    }
    return mm;
}

/**
 * The AST of `cto`, parsed by a scratch ModelManager.
 * @param {object} core the core under test
 * @param {string} cto the model
 * @returns {object} its AST (a copy)
 */
function astOf(core, cto) {
    return JSON.parse(JSON.stringify(new core.ModelManager().addCTOModel(cto, 'scratch.cto', true).getAst()));
}

/**
 * A duck-typed model file: an object with the ModelFile methods a model
 * manager calls, which the ModelFile constructor never built (so the
 * engine never mirrors it). Records its `validate()` calls.
 * @param {string} namespace its namespace
 * @param {string} [name] its file name
 * @returns {object} the duck
 */
function duck(namespace, name) {
    const d = {
        validated: 0,
        getNamespace: () => namespace,
        getVersion: () => '1.0.0',
        getName: () => name,
        isModelFile: () => true,
        validate: () => { d.validated++; },
        getType: (type) => (type === `${namespace}.Quack` ? 'quack' : null),
        getModelFiles: () => [],
        getAst: () => ({ $class: 'concerto.metamodel@1.0.0.Model', namespace, declarations: [] }),
        getDefinitions: () => undefined,
        isExternal: () => false,
        isSystemModelFile: () => false,
        getAllDeclarations: () => [],
        getExternalImports: () => ({}),
    };
    return d;
}

/**
 * A manager-like collaborator that is not engine-backed: it forwards every
 * member to `mm`, except that it has no `rustHandle` (as collaborator.checks.js).
 * @param {object} mm a real ModelManager
 * @returns {object} the collaborator
 */
function collaborator(mm) {
    return new Proxy(mm, {
        get(target, prop) {
            if (prop === 'rustHandle') {
                return undefined;
            }
            const v = Reflect.get(target, prop, target);
            return typeof v === 'function' ? v.bind(target) : v;
        },
    });
}

const TYPE_NAMES = ['String', 'Local', 'org.acme.p511.b@1.0.0.Local', 'Figure', 'Shape', 'Colour', 'Missing', 'Concept'];

/**
 * What `mf` resolves each of TYPE_NAMES (and a non-string) to.
 * @param {object} mf the ModelFile
 * @returns {object} per name: getType, getFullyQualifiedTypeName, resolveType
 */
function resolutions(mf) {
    const out = {};
    for (const t of [...TYPE_NAMES, 7]) {
        out[String(t)] = {
            getType: attempt(() => mf.getType(t)),
            getFullyQualifiedTypeName: attempt(() => mf.getFullyQualifiedTypeName(t)),
            resolveType: attempt(() => mf.resolveType('ctx', t)),
        };
    }
    return out;
}

/**
 * A downloader that resolves to `sources`, as `FileDownloader` would.
 * @param {object[]} sources the downloaded files
 * @returns {object} the downloader
 */
function downloader(sources) {
    return { downloadExternalDependencies: async () => sources };
}

/**
 * Runs `updateExternalModels` over `sources` and reports what it returned or
 * threw, and the manager's namespaces afterwards.
 * @param {object} mm the ModelManager
 * @param {object[]} sources the downloaded files
 * @returns {Promise<object>} the report
 */
async function update(mm, sources) {
    let result;
    try {
        result = (await mm.updateExternalModels({}, downloader(sources))).map((mf) => mf.getNamespace());
    } catch (e) {
        result = `${e.constructor.name}: ${e.message}`;
    }
    return { result, namespaces: mm.getNamespaces() };
}

const EXPECT_RESOLUTIONS = {
    String: { getType: 'String', getFullyQualifiedTypeName: 'String', resolveType: '<undefined>' },
    Local: { getType: { declaration: 'org.acme.p511.b@1.0.0.Local' }, getFullyQualifiedTypeName: 'org.acme.p511.b@1.0.0.Local', resolveType: '<undefined>' },
    'org.acme.p511.b@1.0.0.Local': { getType: { declaration: 'org.acme.p511.b@1.0.0.Local' }, getFullyQualifiedTypeName: 'org.acme.p511.b@1.0.0.Local', resolveType: '<undefined>' },
    Figure: { getType: { declaration: 'org.acme.p511.a@1.0.0.Shape' }, getFullyQualifiedTypeName: 'org.acme.p511.a@1.0.0.Shape', resolveType: '<undefined>' },
    Shape: { getType: null, getFullyQualifiedTypeName: null, resolveType: 'IllegalModelException: Undeclared type "Shape" in "ctx". File \'b.cto\': ' },
    Colour: { getType: { declaration: 'org.acme.p511.a@1.0.0.Colour' }, getFullyQualifiedTypeName: 'org.acme.p511.a@1.0.0.Colour', resolveType: '<undefined>' },
    Missing: { getType: null, getFullyQualifiedTypeName: null, resolveType: 'IllegalModelException: Undeclared type "Missing" in "ctx". File \'b.cto\': ' },
    Concept: { getType: { declaration: 'concerto@1.0.0.Concept' }, getFullyQualifiedTypeName: 'concerto@1.0.0.Concept', resolveType: '<undefined>' },
    7: { getType: 'TypeError: type.startsWith is not a function', getFullyQualifiedTypeName: 'TypeError: type.startsWith is not a function', resolveType: 'TypeError: type.startsWith is not a function' },
};

module.exports = [
    {
        id: 'P511-001',
        covers: 'ModelFile.getType/getFullyQualifiedTypeName/resolveType of a registered file (Rust), non-string types (TS body)',
        run: (core) => resolutions(manager(core).getModelFile('org.acme.p511.b@1.0.0')),
        expect: { ok: EXPECT_RESOLUTIONS },
    },
    {
        id: 'P511-002',
        covers: 'ModelFile.getType/getFullyQualifiedTypeName/resolveType of a detached file, which the engine has not mirrored (TS body)',
        run: (core) => {
            const mm = manager(core, true);
            const detached = new core.ModelFile(mm, astOf(core, B_CTO), B_CTO, 'b.cto');
            return resolutions(detached);
        },
        expect: { ok: EXPECT_RESOLUTIONS },
    },
    {
        id: 'P511-003',
        covers: 'ModelManager.getType, validateModelFiles and _throwAlreadyExists with a duck-typed model file the engine does not mirror (TS bodies)',
        run: (core) => {
            const mm = manager(core);
            const d = duck('org.acme.p511.duck@1.0.0', 'duck.cto');
            mm.addModelFile(d);
            const found = {
                quack: attempt(() => mm.getType('org.acme.p511.duck@1.0.0.Quack')),
                shape: attempt(() => mm.getType('org.acme.p511.a@1.0.0.Shape')),
                nowhere: attempt(() => mm.getType('org.acme.p511.nowhere@1.0.0.X')),
                none: attempt(() => mm.getType('org.acme.p511.duck@1.0.0.None')),
            };
            mm.validateModelFiles();
            const again = attempt(() => mm.addModelFile(duck('org.acme.p511.duck@1.0.0', 'again.cto')));
            const unnamed = attempt(() => mm.addModelFile(duck('org.acme.p511.a@1.0.0')));
            return { found, validated: d.validated, again, unnamed };
        },
        expect: {
            ok: {
                found: {
                    quack: 'quack',
                    shape: { declaration: 'org.acme.p511.a@1.0.0.Shape' },
                    nowhere: 'TypeNotFoundException: Namespace is not defined for type "org.acme.p511.nowhere@1.0.0.X".',
                    none: 'TypeNotFoundException: Type "None" is not defined in namespace "org.acme.p511.duck@1.0.0".',
                },
                validated: 2,
                again: 'Error: Namespace org.acme.p511.duck@1.0.0 specified in file again.cto is already declared in file duck.cto',
                unnamed: 'Error: Namespace org.acme.p511.a@1.0.0 is already declared in file a.cto',
            },
        },
    },
    {
        id: 'P511-004',
        covers: 'ModelManager.getType, validateModelFiles and _throwAlreadyExists of an engine-mirrored manager (Rust)',
        run: (core) => {
            const mm = manager(core);
            return {
                shape: attempt(() => mm.getType('org.acme.p511.a@1.0.0.Shape')),
                nowhere: attempt(() => mm.getType('org.acme.p511.nowhere@1.0.0.X')),
                none: attempt(() => mm.getType('org.acme.p511.a@1.0.0.None')),
                primitive: attempt(() => mm.getType('String')),
                nonString: attempt(() => mm.getType(7)),
                validate: attempt(() => mm.validateModelFiles()),
                again: attempt(() => mm.addCTOModel(A_CTO, 'again.cto')),
                unnamed: attempt(() => mm.addCTOModel(A_CTO)),
                batch: attempt(() => mm.addModelFiles([A_CTO], ['batch.cto'])),
            };
        },
        expect: {
            ok: {
                shape: { declaration: 'org.acme.p511.a@1.0.0.Shape' },
                nowhere: 'TypeNotFoundException: Namespace is not defined for type "org.acme.p511.nowhere@1.0.0.X".',
                none: 'TypeNotFoundException: Type "None" is not defined in namespace "org.acme.p511.a@1.0.0".',
                primitive: 'TypeNotFoundException: Namespace is not defined for type "String".',
                nonString: 'TypeError: fqn.lastIndexOf is not a function',
                validate: '<undefined>',
                again: 'Error: Namespace org.acme.p511.a@1.0.0 specified in file again.cto is already declared in file a.cto',
                unnamed: 'Error: Namespace org.acme.p511.a@1.0.0 is already declared in file a.cto',
                batch: 'Error: Namespace org.acme.p511.a@1.0.0 specified in file batch.cto is already declared in file a.cto',
            },
        },
    },
    {
        id: 'P511-005',
        async: true,
        covers: 'updateExternalModels of an engine-mirrored manager (Rust): an add, an update, and a failed validation that leaves the manager unchanged',
        run: async (core) => {
            const mm = manager(core);
            const ext = { ast: astOf(core, EXT_CTO), definitions: EXT_CTO, fileName: '@example.com/ext.cto' };
            const a2 = { ast: astOf(core, A2_CTO), definitions: A2_CTO, fileName: '@example.com/a.cto' };
            const bad = { ast: astOf(core, EXT_BAD_CTO), definitions: EXT_BAD_CTO, fileName: '@example.com/bad.cto' };
            const failed = await update(mm, [a2, bad]);
            const afterFailure = { added: attempt(() => mm.getType('org.acme.p511.a@1.0.0.Added')), local: attempt(() => mm.getType('org.acme.p511.b@1.0.0.Local')) };
            const applied = await update(mm, [ext, a2]);
            const afterApply = { added: attempt(() => mm.getType('org.acme.p511.a@1.0.0.Added')), ext: attempt(() => mm.getType('org.acme.p511.ext@1.0.0.Ext')) };
            return { failed, afterFailure, applied, afterApply, external: mm.getModelFile('org.acme.p511.ext@1.0.0').isExternal() };
        },
        expect: {
            ok: {
                failed: {
                    result: 'IllegalModelException: Could not find super type Nowhere File \'@example.com/bad.cto\': ',
                    namespaces: ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.acme.p511.a@1.0.0', 'org.acme.p511.b@1.0.0'],
                },
                afterFailure: {
                    added: 'TypeNotFoundException: Type "Added" is not defined in namespace "org.acme.p511.a@1.0.0".',
                    local: { declaration: 'org.acme.p511.b@1.0.0.Local' },
                },
                applied: {
                    result: ['org.acme.p511.ext@1.0.0', 'org.acme.p511.a@1.0.0'],
                    namespaces: ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.acme.p511.a@1.0.0', 'org.acme.p511.b@1.0.0', 'org.acme.p511.ext@1.0.0'],
                },
                afterApply: {
                    added: { declaration: 'org.acme.p511.a@1.0.0.Added' },
                    ext: { declaration: 'org.acme.p511.ext@1.0.0.Ext' },
                },
                external: true,
            },
        },
    },
    {
        id: 'P511-006',
        async: true,
        covers: 'updateExternalModels with a duck-typed model file the engine does not mirror (TS body): a file the constructor rejects, a failed validation undone (an update and an add), then an add and an update',
        run: async (core) => {
            const mm = manager(core);
            const d = duck('org.acme.p511.duck@1.0.0', 'duck.cto');
            mm.addModelFile(d);
            const ext = { ast: astOf(core, EXT_CTO), definitions: EXT_CTO, fileName: '@example.com/ext.cto' };
            const a2 = { ast: astOf(core, A2_CTO), definitions: A2_CTO, fileName: '@example.com/a.cto' };
            const bad = { ast: astOf(core, EXT_BAD_CTO), definitions: EXT_BAD_CTO, fileName: '@example.com/bad.cto' };
            const noNamespace = { ast: { $class: 'concerto.metamodel@1.0.0.Model', declarations: [] }, fileName: '@example.com/none.cto' };
            const rejected = await update(mm, [ext, noNamespace]);
            const invalid = await update(mm, [a2, bad]);
            const afterInvalid = attempt(() => mm.getType('org.acme.p511.a@1.0.0.Added'));
            const applied = await update(mm, [ext, a2]);
            const reapplied = await update(mm, [ext]);
            return { rejected, invalid, afterInvalid, applied, reapplied, validated: d.validated, added: attempt(() => mm.getType('org.acme.p511.a@1.0.0.Added')) };
        },
        expect: {
            ok: {
                rejected: {
                    result: 'Error: Namespace is null or undefined.',
                    namespaces: ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.acme.p511.a@1.0.0', 'org.acme.p511.b@1.0.0', 'org.acme.p511.duck@1.0.0'],
                },
                invalid: {
                    result: 'IllegalModelException: Could not find super type Nowhere File \'@example.com/bad.cto\': ',
                    namespaces: ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.acme.p511.a@1.0.0', 'org.acme.p511.b@1.0.0', 'org.acme.p511.duck@1.0.0'],
                },
                afterInvalid: 'TypeNotFoundException: Type "Added" is not defined in namespace "org.acme.p511.a@1.0.0".',
                applied: {
                    result: ['org.acme.p511.ext@1.0.0', 'org.acme.p511.a@1.0.0'],
                    namespaces: ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.acme.p511.a@1.0.0', 'org.acme.p511.b@1.0.0', 'org.acme.p511.duck@1.0.0', 'org.acme.p511.ext@1.0.0'],
                },
                reapplied: {
                    result: ['org.acme.p511.ext@1.0.0'],
                    namespaces: ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.acme.p511.a@1.0.0', 'org.acme.p511.b@1.0.0', 'org.acme.p511.duck@1.0.0', 'org.acme.p511.ext@1.0.0'],
                },
                validated: 4,
                added: { declaration: 'org.acme.p511.a@1.0.0.Added' },
            },
        },
    },
    {
        id: 'P511-007',
        async: true,
        covers: 'updateExternalModels of the metamodel namespace, which the engine mirror is never written for (TS body): an add, then an update',
        run: async (core) => {
            const mm = manager(core);
            const metamodel = core.metaModelModule.newMetaModelManager().getModelFile('concerto.metamodel@1.0.0');
            const source = { ast: metamodel.getAst(), definitions: metamodel.getDefinitions(), fileName: '@example.com/metamodel.cto' };
            const added = await update(mm, [source]);
            const updated = await update(mm, [source]);
            return { added, updated, model: attempt(() => mm.getType('concerto.metamodel@1.0.0.Model').getName()) };
        },
        expect: {
            ok: {
                added: {
                    result: ['concerto.metamodel@1.0.0'],
                    namespaces: ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.acme.p511.a@1.0.0', 'org.acme.p511.b@1.0.0', 'concerto.metamodel@1.0.0'],
                },
                updated: {
                    result: ['concerto.metamodel@1.0.0'],
                    namespaces: ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'org.acme.p511.a@1.0.0', 'org.acme.p511.b@1.0.0', 'concerto.metamodel@1.0.0'],
                },
                model: 'Model',
            },
        },
    },
    {
        id: 'P511-008',
        covers: 'validateMetaModel: a valid input and an invalid one (Rust), an input the engine cannot cross (the Serializer fallback path), and newMetaModelManager',
        run: (core) => {
            const { validateMetaModel, newMetaModelManager } = core.metaModelModule;
            const model = (namespace) => ({ $class: 'concerto.metamodel@1.0.0.Models', models: [{ $class: 'concerto.metamodel@1.0.0.Model', namespace, declarations: [] }] });
            return {
                valid: attempt(() => validateMetaModel(model('org.acme.p511@1.0.0')).models.length),
                noClass: attempt(() => validateMetaModel({ models: [] })),
                badField: attempt(() => validateMetaModel(model(7))),
                loneSurrogate: attempt(() => validateMetaModel(model('org.acme\uD800@1.0.0')).models[0].namespace.length),
                loneSurrogateBad: attempt(() => validateMetaModel(Object.assign(model('org.acme\uD800@1.0.0'), { extra: 1 }))),
                namespaces: newMetaModelManager().getNamespaces(),
            };
        },
        expect: {
            ok: {
                valid: 1,
                noClass: 'Error: Invalid JSON data. Does not contain a $class type identifier.',
                badField: 'ValidationException: Expected value at path `$.models[0].namespace` to be of type `String`',
                loneSurrogate: 15,
                loneSurrogateBad: 'ValidationException: Unexpected properties for type concerto.metamodel@1.0.0.Models: extra',
                namespaces: ['concerto.decorator@1.0.0', 'concerto@1.0.0', 'concerto.metamodel@1.0.0'],
            },
        },
    },
    {
        id: 'P511-009',
        covers: 'the ModelFile header (Rust) built eagerly, with no declarations, against a manager that is not engine-backed; enforceImportVersioning and isCompatibleVersion called directly',
        run: (core) => {
            const mm = manager(core);
            const ast = astOf(core, B_CTO);
            delete ast.declarations;
            ast.concertoVersion = '^3.0.0';
            const mf = new core.ModelFile(collaborator(mm), ast, undefined, 'b.cto');
            const unversioned = attempt(() => mf.enforceImportVersioning({ namespace: 'org.acme.p511.a' }));
            const versioned = attempt(() => mf.enforceImportVersioning({ namespace: 'org.acme.p511.a@1.0.0' }));
            mf.ast = Object.assign({}, mf.ast, { concertoVersion: 7 });
            const badVersion = attempt(() => mf.isCompatibleVersion());
            return {
                namespace: mf.getNamespace(),
                version: mf.getVersion(),
                imports: mf.getImports(),
                importShortNames: [...mf.importShortNames.entries()],
                externalImports: mf.getExternalImports(),
                concertoVersion: mf.getConcertoVersion(),
                declarations: mf.getAllDeclarations().length,
                unversioned,
                versioned,
                badVersion,
            };
        },
        expect: {
            ok: {
                namespace: 'org.acme.p511.b@1.0.0',
                version: '1.0.0',
                imports: [
                    'org.acme.p511.a@1.0.0.Shape', 'org.acme.p511.a@1.0.0.Colour',
                    'concerto@1.0.0.Concept', 'concerto@1.0.0.Asset', 'concerto@1.0.0.Transaction', 'concerto@1.0.0.Participant', 'concerto@1.0.0.Event',
                ],
                importShortNames: [
                    ['Figure', 'org.acme.p511.a@1.0.0.Shape'], ['Colour', 'org.acme.p511.a@1.0.0.Colour'],
                    ['Concept', 'concerto@1.0.0.Concept'], ['Asset', 'concerto@1.0.0.Asset'], ['Transaction', 'concerto@1.0.0.Transaction'],
                    ['Participant', 'concerto@1.0.0.Participant'], ['Event', 'concerto@1.0.0.Event'],
                ],
                externalImports: { 'org.acme.p511.a@1.0.0.Shape': 'https://example.com/a.cto' },
                concertoVersion: '^3.0.0',
                declarations: 0,
                unversioned: 'Error: Cannot use an unversioned import org.acme.p511.a.',
                versioned: '<undefined>',
                badVersion: 'Error: This version of Concerto supports a language version of v3.0.0 or greater, but this model is for 7',
            },
        },
    },
];
