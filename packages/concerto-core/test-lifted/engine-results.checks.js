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
 * P5-94 lifted checks (accordproject/concerto-rust#444): the routes that
 * cut the JS-side garbage of `addModelFile` and `extract_cold` keep the
 * results they replace.
 *
 * - The flat staging header (concerto-wasm `stageModelFileCheckedCompactFlat`
 *   and `...WithHeaderCompactFlat`, read by engine/views.ts
 *   `applyStagedFileHeader`): a ModelFile's version, `importShortNames`
 *   (in order), `importUriMap` and `getImports()` are the same with the
 *   flat result as with the object one (the flat bindings hidden on the
 *   manager's rustHandle), and as v5.0.0's, for plain, aliased and
 *   URI-carrying imports, with and without BC-19's shape check.
 * - The remembered text of the metamodel copy every `new ModelManager()`
 *   builds from one shared constant AST (engine/views.ts `stableAstText`):
 *   a change to that constant is seen by the next manager, which checks
 *   and loads the changed AST, and a change back is accepted again.
 * - `declarations` and `localTypes`, which P5-100 (E-13,
 *   accordproject/concerto-rust#454) made ModelFile.prototype accessors
 *   (`installLazyField`), like the other lazy parts: the same declarations
 *   and local types as v5.0.0, for a lazily and an eagerly (decorator
 *   factory) built ModelFile. Their place among the own keys is BC-23(b)'s
 *   object-shape change: absent until first read in a lazily built file,
 *   then last; v5.0.0's order is the checks' `reference`.
 *
 * Only public members are used. `expect` is the frozen v5.0.0 reference's
 * outcome, which src matches, except for the two P594-FIELDS checks, whose
 * `reference` is v5.0.0's (BC-23(b)). Run by fallbacks.spec.js.
 */

const MM = 'concerto.metamodel@1.0.0';

/**
 * The staging bindings with the flat result.
 */
const FLAT_BINDINGS = ['stageModelFileCheckedCompactFlat', 'stageModelFileWithHeaderCompactFlat'];

/**
 * The outcome of `fn`: its value, or the class of the error it threw.
 * @param {Function} fn the body
 * @returns {Array} `['ok', value]` or `['throws', name]`
 */
function probe(fn) {
    try {
        return ['ok', fn()];
    } catch (e) {
        return ['throws', e && e.name];
    }
}

/**
 * A model AST.
 * @param {string} namespace its namespace
 * @param {object[]} [imports] its import nodes
 * @returns {object} the AST
 */
function model(namespace, imports) {
    const ast = { $class: `${MM}.Model`, namespace, imports: imports || [], declarations: [
        { $class: `${MM}.ConceptDeclaration`, name: 'Thing', isAbstract: false, properties: [] },
    ] };
    return ast;
}

const DEPENDENCIES = [
    model('org.acme.dep@1.0.0'),
    model('org.acme.other@2.0.0'),
];
for (const dep of DEPENDENCIES) {
    dep.declarations.push(
        { $class: `${MM}.ConceptDeclaration`, name: 'A', isAbstract: false, properties: [] },
        { $class: `${MM}.ConceptDeclaration`, name: 'B', isAbstract: false, properties: [] });
}

const IMPORTERS = [
    model('org.acme.none@1.0.0'),
    model('org.acme.types@1.0.0', [
        { $class: `${MM}.ImportTypes`, namespace: 'org.acme.dep@1.0.0', types: ['A', 'B'] },
    ]),
    model('org.acme.aliased@1.0.0', [
        { $class: `${MM}.ImportTypes`, namespace: 'org.acme.dep@1.0.0', types: ['A', 'B'],
            aliasedTypes: [{ $class: `${MM}.AliasedType`, name: 'B', aliasedName: 'C' }] },
        { $class: `${MM}.ImportType`, namespace: 'org.acme.other@2.0.0', name: 'B', uri: 'https://example.org/other.cto' },
    ]),
    model('org.acme.uris@1.0.0', [
        { $class: `${MM}.ImportTypes`, namespace: 'org.acme.dep@1.0.0', types: ['A'], uri: 'https://example.org/dep.cto' },
        { $class: `${MM}.ImportType`, namespace: 'org.acme.other@2.0.0', name: 'B', uri: '' },
    ]),
];

/**
 * Loads every model in a fresh manager, the importers after their
 * dependencies, with the flat staging bindings hidden when `hideFlat`, and
 * reads each importer's header.
 * @param {object} core a loaded core
 * @param {object} options the manager options
 * @param {boolean} hideFlat whether to hide the flat staging bindings
 * @returns {Array} each importer's header reading, or the error class
 */
function headers(core, options, hideFlat) {
    const ModelFile = core.modelFileModule.ModelFile;
    const mm = new core.ModelManager(options);
    if (hideFlat && mm.rustHandle) {
        for (const binding of FLAT_BINDINGS) {
            mm.rustHandle[binding] = undefined;
        }
    }
    return probe(() => {
        for (const ast of DEPENDENCIES) {
            mm.addModelFile(new ModelFile(mm, JSON.parse(JSON.stringify(ast)), undefined, 'dep.cto'));
        }
        return IMPORTERS.map((ast) => {
            const mf = new ModelFile(mm, JSON.parse(JSON.stringify(ast)), undefined, 'importer.cto');
            const before = [mf.getVersion(), [...mf.importShortNames], Object.entries(mf.importUriMap), mf.getImports()];
            mm.addModelFile(mf);
            return [mf.getNamespace(), before, mf.getImports(), mf.getAllDeclarations().map((d) => d.getFullyQualifiedName())];
        });
    });
}

const SYSTEM_SHORT_NAMES = ['Concept', 'Asset', 'Transaction', 'Participant', 'Event'].map((n) => [n, `concerto@1.0.0.${n}`]);
const SYSTEM_IMPORTS = SYSTEM_SHORT_NAMES.map((pair) => pair[1]);

/**
 * The header reading `headers` gives for every importer.
 */
const HEADERS = ['ok', [
    ['org.acme.none@1.0.0', ['1.0.0', SYSTEM_SHORT_NAMES, [], SYSTEM_IMPORTS], SYSTEM_IMPORTS, ['org.acme.none@1.0.0.Thing']],
    ['org.acme.types@1.0.0', ['1.0.0',
        [['A', 'org.acme.dep@1.0.0.A'], ['B', 'org.acme.dep@1.0.0.B']].concat(SYSTEM_SHORT_NAMES), [],
        ['org.acme.dep@1.0.0.A', 'org.acme.dep@1.0.0.B'].concat(SYSTEM_IMPORTS)],
    ['org.acme.dep@1.0.0.A', 'org.acme.dep@1.0.0.B'].concat(SYSTEM_IMPORTS), ['org.acme.types@1.0.0.Thing']],
    ['org.acme.aliased@1.0.0', ['1.0.0',
        [['A', 'org.acme.dep@1.0.0.A'], ['C', 'org.acme.dep@1.0.0.B'], ['B', 'org.acme.other@2.0.0.B']].concat(SYSTEM_SHORT_NAMES),
        [['org.acme.other@2.0.0.B', 'https://example.org/other.cto']],
        ['org.acme.dep@1.0.0.A', 'org.acme.dep@1.0.0.B', 'org.acme.other@2.0.0.B'].concat(SYSTEM_IMPORTS)],
    ['org.acme.dep@1.0.0.A', 'org.acme.dep@1.0.0.B', 'org.acme.other@2.0.0.B'].concat(SYSTEM_IMPORTS), ['org.acme.aliased@1.0.0.Thing']],
    ['org.acme.uris@1.0.0', ['1.0.0',
        [['A', 'org.acme.dep@1.0.0.A'], ['B', 'org.acme.other@2.0.0.B']].concat(SYSTEM_SHORT_NAMES),
        [['org.acme.dep@1.0.0.A', 'https://example.org/dep.cto']],
        ['org.acme.dep@1.0.0.A', 'org.acme.other@2.0.0.B'].concat(SYSTEM_IMPORTS)],
    ['org.acme.dep@1.0.0.A', 'org.acme.other@2.0.0.B'].concat(SYSTEM_IMPORTS), ['org.acme.uris@1.0.0.Thing']],
]];

/**
 * The shared metamodel AST constant `new ModelManager()` builds its
 * metamodel copy from, as the core under test loads it.
 * @param {object} core a loaded core
 * @returns {object} the AST constant
 */
function metaModelAst(core) {
    const ModelManager = core.ModelManager;
    const mm = new ModelManager({ addMetamodel: true });
    return mm.getModelFile('concerto.metamodel@1.0.0').getAst();
}

/**
 * A ModelManager with a decorator factory that never replaces a decorator,
 * which keeps every ModelFile it builds on the eager constructor path.
 * @param {object} core a loaded core
 * @returns {object} the ModelManager
 */
function eagerManager(core) {
    const mm = new core.ModelManager();
    /**
     * A decorator factory that never replaces a decorator.
     */
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
 * A ModelFile's own keys in order, but `decorators`, which src has among
 * the last (P5-10b builds a lazily built file's decorators on first read)
 * and v5.0.0 first, from before this task.
 * @param {object} mf the ModelFile
 * @returns {string[]} the keys
 */
function ownKeys(mf) {
    return Object.keys(mf).filter((key) => key !== 'decorators');
}

/**
 * What a check reads off a ModelFile's fields: its own keys in order
 * (`ownKeys`), `localTypes`' keys and the declarations' names, then the
 * same after `declarations` is assigned.
 * @param {object} mf the ModelFile
 * @returns {Array} the reading
 */
function fields(mf) {
    const keys = ownKeys(mf);
    const declarations = mf.declarations.map((d) => d.getName());
    const localTypes = mf.localTypes === null ? null : [...mf.localTypes.keys()];
    const first = mf.declarations[0];
    mf.declarations = [first];
    return [keys, declarations, localTypes, mf.getAllDeclarations().map((d) => d.getName()), ownKeys(mf)];
}

const KEYS = ['ast', 'modelManager', 'external', 'declarations', 'localTypes', 'imports', 'importShortNames', 'importWildcardNamespaces',
    'importUriMap', 'fileName', 'concertoVersion', 'version', 'definitions', 'namespace'];

/**
 * P5-100 (E-13, BC-23(b)): a ModelFile's own keys in src: `declarations`
 * and `localTypes` are prototype accessors until first read or write, and
 * then plain own fields, last.
 */
const KEYS_UNREAD = ['ast', 'modelManager', 'external', 'imports', 'importShortNames', 'importWildcardNamespaces',
    'importUriMap', 'fileName', 'concertoVersion', 'version', 'definitions', 'namespace'];
const KEYS_READ = KEYS_UNREAD.concat(['declarations', 'localTypes']);

module.exports = [
    {
        id: 'P594-HDR-001',
        covers: 'P5-94: a ModelFile\'s header from the flat staging result, with BC-19\'s shape check',
        run: (core) => headers(core, {}, false),
        expect: { ok: HEADERS },
    },
    {
        id: 'P594-HDR-002',
        covers: 'P5-94: a ModelFile\'s header from the object staging result (flat bindings hidden), with BC-19\'s shape check',
        run: (core) => headers(core, {}, true),
        expect: { ok: HEADERS },
    },
    {
        id: 'P594-HDR-003',
        covers: 'P5-94: a ModelFile\'s header from the flat staging result, with the shape check off',
        run: (core) => headers(core, { metamodelValidation: false }, false),
        expect: { ok: HEADERS },
    },
    {
        id: 'P594-HDR-004',
        covers: 'P5-94: a ModelFile\'s header from the object staging result (flat bindings hidden), with the shape check off',
        run: (core) => headers(core, { metamodelValidation: false }, true),
        expect: { ok: HEADERS },
    },
    {
        id: 'P594-MEMO-001',
        covers: 'P5-94: a change to the shared metamodel constant is seen by the next new ModelManager(), and a change back is accepted again',
        run: (core) => {
            const ast = metaModelAst(core);
            const declaration = ast.declarations[0];
            const name = declaration.name;
            const outcomes = [];
            try {
                outcomes.push(probe(() => new core.ModelManager() && 'built'));
                declaration.name = 42;
                outcomes.push(probe(() => new core.ModelManager() && 'built'));
                outcomes.push(probe(() => new core.ModelManager() && 'built'));
                declaration.name = name;
                outcomes.push(probe(() => new core.ModelManager() && 'built'));
                declaration.name = 'Renamed';
                outcomes.push(probe(() => new core.ModelManager({ addMetamodel: true }).getModelFile('concerto.metamodel@1.0.0')
                    .getAllDeclarations()[0].getName()));
            } finally {
                declaration.name = name;
            }
            outcomes.push(probe(() => new core.ModelManager({ addMetamodel: true }).getModelFile('concerto.metamodel@1.0.0')
                .getAllDeclarations()[0].getName()));
            return outcomes;
        },
        expect: { ok: [['ok', 'built'], ['throws', 'IllegalModelException'], ['throws', 'IllegalModelException'], ['ok', 'built'],
            ['throws', 'IllegalModelException'], ['ok', 'Position']] },
    },
    {
        id: 'P594-FIELDS-001',
        covers: 'P5-94, P5-100 (E-13, BC-23(b)): a lazily built ModelFile has the same declarations and localTypes; they are own keys only from first read, last',
        run: (core) => {
            const mm = new core.ModelManager();
            return fields(mm.addCTOModel('namespace org.acme.f@1.0.0\nconcept A {}\nconcept B {}', 'f.cto'));
        },
        expect: { ok: [KEYS_UNREAD, ['A', 'B'], ['org.acme.f@1.0.0.A', 'org.acme.f@1.0.0.B'], ['A'], KEYS_READ] },
        reference: { ok: [KEYS, ['A', 'B'], ['org.acme.f@1.0.0.A', 'org.acme.f@1.0.0.B'], ['A'], KEYS] },
    },
    {
        id: 'P594-FIELDS-002',
        covers: 'P5-94, P5-100 (E-13, BC-23(b)): an eagerly built ModelFile (decorator factory) has the same declarations and localTypes, as its last own keys',
        run: (core) => {
            const mm = eagerManager(core);
            return fields(mm.addCTOModel('namespace org.acme.f@1.0.0\nconcept A {}\nconcept B {}', 'f.cto'));
        },
        expect: { ok: [KEYS_READ, ['A', 'B'], ['org.acme.f@1.0.0.A', 'org.acme.f@1.0.0.B'], ['A'], KEYS_READ] },
        reference: { ok: [KEYS, ['A', 'B'], ['org.acme.f@1.0.0.A', 'org.acme.f@1.0.0.B'], ['A'], KEYS] },
    },
];
