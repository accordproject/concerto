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
 * P5-100 lifted checks (accordproject/concerto-rust#454): the per-manager
 * engine state and the boundary placement rule.
 *
 * - `STATE-*`: every cached answer of a manager is keyed on its own model
 *   version (`BaseModelManager._engine`), so one manager's change keeps
 *   another manager's answers (no engine call for them), and its own
 *   changes are seen by its getType, getNamespaces, properties and
 *   serializer at once, as in v5.0.0.
 * - `STAGED-*`: `updateModelFile`, `updateExternalModels` and `validateAst`
 *   use the copy the engine staged when each ModelFile was constructed, so
 *   no AST is sent again; the outcome is v5.0.0's.
 * - `KIND-*`: the declaration kind predicates, `declarationKind()` and
 *   `toString()` run in TS (E-1), with v5.0.0's answers.
 *
 * A check that counts engine calls returns 'no engine' for the count where
 * the manager has no engine handle (v5.0.0), so its `reference` differs
 * from its `expect` in that field only.
 *
 * Run by fallbacks.spec.js.
 */

const NO_ENGINE = 'no engine';
const NS = 'org.acme.p5100@1.0.0';

const MODEL = `namespace ${NS}
abstract concept Shape { o String name }
concept Address { o String city o String zip optional }
enum Colour { o RED o GREEN }
participant Person identified by email { o String email o Address address o Colour colour optional }
asset Car identified by vin { o String vin o Integer seats default=4 o DateTime built optional }
transaction Sell { --> Car car }
event Sold { o String vin }
map Labels { o String o String }
`;

const OTHER_NS = 'org.acme.p5100.other@1.0.0';
const OTHER = `namespace ${OTHER_NS}
concept Note { o String text }
`;

/**
 * Counts the calls `handle` gets to each of `methods`, by wrapping them on
 * the instance.
 * @param {object} handle an engine handle (or undefined)
 * @param {string[]} methods the method names
 * @returns {object} `{ counts }`, whose fields are read after the calls
 */
function countCalls(handle, methods) {
    const counts = {};
    for (const name of methods) {
        counts[name] = 0;
        if (handle && typeof handle[name] === 'function') {
            const original = handle[name];
            handle[name] = function (...args) {
                counts[name]++;
                return original.apply(this, args);
            };
        }
    }
    return counts;
}

/**
 * The AST of a CTO model, as a fresh manager reads it.
 * @param {object} core the core
 * @param {string} cto the model
 * @returns {object} the AST
 */
function astOf(core, cto) {
    const mm = new core.ModelManager();
    return mm.addCTOModel(cto, 'x.cto').getAst();
}

/**
 * A model of NS whose Address extends a type that does not exist.
 * @returns {object} the AST
 */
function missingSuperType() {
    return {
        $class: 'concerto.metamodel@1.0.0.Model',
        namespace: NS,
        imports: [],
        declarations: [{
            $class: 'concerto.metamodel@1.0.0.ConceptDeclaration',
            name: 'Address',
            isAbstract: false,
            properties: [],
            superType: { $class: 'concerto.metamodel@1.0.0.TypeIdentifier', name: 'Gone' },
        }],
    };
}

const checks = [
    {
        id: 'STATE-01',
        covers: 'one manager\'s model change keeps another manager\'s cached getType, resolveType and getNamespaces answers (per-manager model version)',
        run: (core) => {
            const a = new core.ModelManager();
            a.addCTOModel(MODEL, 'm.cto');
            const b = new core.ModelManager();
            b.addCTOModel(MODEL, 'm.cto');
            const read = (m) => [m.getType(`${NS}.Person`).getName(), m.resolveType('ctx', `${NS}.Car`), m.getNamespaces().length,
                m.getType(`${NS}.Person`).getProperties().length, m.getType(`${NS}.Car`).getIdentifierFieldName()];
            const warm = read(b);
            const counts = countCalls(b.rustHandle, ['getTypeName', 'resolveType', 'getNamespaces']);
            a.addCTOModel(OTHER, 'o.cto');
            a.deleteModelFile(OTHER_NS);
            a.updateModelFile(MODEL.replace('o String city', 'o String city o String street'), 'm.cto');
            const after = read(b);
            return {
                warm,
                after,
                crossings: b.rustHandle ? counts.getTypeName + counts.resolveType + counts.getNamespaces : NO_ENGINE,
                a: a.getType(`${NS}.Address`).getProperties().map((p) => p.getName()),
            };
        },
        expect: {
            ok: {
                warm: ['Person', `${NS}.Car`, 3, 4, 'vin'],
                after: ['Person', `${NS}.Car`, 3, 4, 'vin'],
                crossings: 0,
                a: ['city', 'street', 'zip'],
            },
        },
        reference: {
            ok: {
                warm: ['Person', `${NS}.Car`, 3, 4, 'vin'],
                after: ['Person', `${NS}.Car`, 3, 4, 'vin'],
                crossings: NO_ENGINE,
                a: ['city', 'street', 'zip'],
            },
        },
    },
    {
        id: 'STATE-02',
        covers: 'a manager\'s own changes reach its getType, getNamespaces, properties and serializer at once',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel(MODEL, 'm.cto');
            const serializer = mm.getSerializer();
            const before = serializer.toJSON(serializer.fromJSON({ $class: `${NS}.Address`, city: 'C' }));
            mm.updateModelFile(MODEL.replace('o String city', 'o String city o String street default="S"'), 'm.cto');
            const after = serializer.toJSON(serializer.fromJSON({ $class: `${NS}.Address`, city: 'C', street: 'T' }));
            mm.addCTOModel(OTHER, 'o.cto');
            const namespaces = mm.getNamespaces();
            mm.clearModelFiles();
            let missing;
            try {
                mm.getType(`${NS}.Address`);
            } catch (e) {
                missing = e.constructor.name;
            }
            return { before, after, namespaces, missing, cleared: mm.getNamespaces() };
        },
        expect: {
            ok: {
                before: { $class: `${NS}.Address`, city: 'C' },
                after: { $class: `${NS}.Address`, city: 'C', street: 'T' },
                namespaces: ['concerto.decorator@1.0.0', 'concerto@1.0.0', NS, OTHER_NS],
                missing: 'TypeNotFoundException',
                cleared: ['concerto.decorator@1.0.0', 'concerto@1.0.0'],
            },
        },
    },
    {
        id: 'STAGED-01',
        covers: 'updateModelFile (CTO text and a ModelFile) registers the staged copy: no AST is sent again, and the types are v5.0.0\'s',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel(MODEL, 'm.cto');
            const counts = countCalls(mm.rustHandle, ['updateModelFile', 'addModelWithDefinitions']);
            mm.updateModelFile(MODEL.replace('o String city', 'o String city o String street'), 'm.cto');
            const first = mm.getType(`${NS}.Address`).getProperties().map((p) => p.getName());
            const file = new core.ModelFile(mm, astOf(core, MODEL.replace('o String city', 'o String town')), undefined, 'n.cto');
            mm.updateModelFile(file);
            const second = mm.getType(`${NS}.Address`).getProperties().map((p) => p.getName());
            let invalid;
            try {
                mm.updateModelFile(`namespace ${NS}\nconcept Address extends Missing {}`, 'bad.cto');
            } catch (e) {
                invalid = e.constructor.name;
            }
            return {
                first,
                second,
                invalid,
                kept: mm.getType(`${NS}.Address`).getProperties().map((p) => p.getName()),
                crossings: mm.rustHandle ? counts.updateModelFile + counts.addModelWithDefinitions : NO_ENGINE,
            };
        },
        expect: {
            ok: {
                first: ['city', 'street', 'zip'],
                second: ['town', 'zip'],
                invalid: 'IllegalModelException',
                kept: ['town', 'zip'],
                crossings: 0,
            },
        },
        reference: {
            ok: {
                first: ['city', 'street', 'zip'],
                second: ['town', 'zip'],
                invalid: 'IllegalModelException',
                kept: ['town', 'zip'],
                crossings: NO_ENGINE,
            },
        },
    },
    {
        id: 'STAGED-02',
        covers: 'updateExternalModels updates from the staged copies: no AST is sent again; a file that fails validation leaves the manager as it was, as v5.0.0',
        async: true,
        run: async (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel(MODEL, 'm.cto');
            const counts = countCalls(mm.rustHandle, ['updateExternalModels']);
            const downloader = (sources) => ({ downloadExternalDependencies: async () => sources });
            const updated = await mm.updateExternalModels({}, downloader([
                { ast: astOf(core, OTHER), definitions: OTHER, fileName: 'o.cto' },
                { ast: astOf(core, MODEL.replace('o String city', 'o String city o String street')), definitions: undefined, fileName: 'm2.cto' },
            ]));
            const after = [updated.map((mf) => mf.getNamespace()), mm.getNamespaces(),
                mm.getType(`${NS}.Address`).getProperties().map((p) => p.getName()), mm.getType(`${OTHER_NS}.Note`).getName()];
            let failed;
            try {
                // The second file's super type does not exist: the
                // ModelFile constructor accepts it, and validation fails.
                await mm.updateExternalModels({}, downloader([
                    { ast: astOf(core, `namespace ${OTHER_NS}\nconcept Note { o String text }\nconcept Memo extends Note {}`), fileName: 'o2.cto' },
                    { ast: missingSuperType(), fileName: 'm3.cto' },
                ]));
            } catch (e) {
                failed = e.constructor.name;
            }
            return {
                after,
                failed,
                kept: [mm.getNamespaces(), mm.getType(`${NS}.Address`).getProperties().map((p) => p.getName())],
                crossings: mm.rustHandle ? counts.updateExternalModels : NO_ENGINE,
            };
        },
        expect: {
            ok: {
                after: [[OTHER_NS, NS], ['concerto.decorator@1.0.0', 'concerto@1.0.0', NS, OTHER_NS], ['city', 'street', 'zip'], 'Note'],
                failed: 'IllegalModelException',
                kept: [['concerto.decorator@1.0.0', 'concerto@1.0.0', NS, OTHER_NS], ['city', 'street', 'zip']],
                crossings: 0,
            },
        },
        reference: {
            ok: {
                after: [[OTHER_NS, NS], ['concerto.decorator@1.0.0', 'concerto@1.0.0', NS, OTHER_NS], ['city', 'street', 'zip'], 'Note'],
                failed: 'IllegalModelException',
                kept: [['concerto.decorator@1.0.0', 'concerto@1.0.0', NS, OTHER_NS], ['city', 'street', 'zip']],
                crossings: NO_ENGINE,
            },
        },
    },
    {
        id: 'STAGED-03',
        covers: 'addModelFile with metamodelValidation true checks the staged copy (no AST sent for validateAst), with v5.0.0\'s outcome',
        run: (core) => {
            const mm = new core.ModelManager({ metamodelValidation: true });
            const counts = countCalls(mm.rustHandle, ['validateAstValue']);
            mm.addCTOModel(MODEL, 'm.cto');
            return {
                types: mm.getType(`${NS}.Car`).getProperties().map((p) => p.getName()),
                crossings: mm.rustHandle ? counts.validateAstValue : NO_ENGINE,
            };
        },
        expect: { ok: { types: ['vin', 'seats', 'built', '$identifier'], crossings: 0 } },
        reference: { ok: { types: ['vin', 'seats', 'built', '$identifier'], crossings: NO_ENGINE } },
    },
    {
        id: 'KIND-01',
        covers: 'the declaration kind predicates, declarationKind() and toString() of every declaration kind are v5.0.0\'s',
        run: (core) => {
            const mm = new core.ModelManager();
            mm.addCTOModel(MODEL, 'm.cto');
            return mm.getModelFile(NS).getAllDeclarations().map((d) => [
                d.getName(),
                d.declarationKind(),
                d.toString(),
                ...['isAsset', 'isParticipant', 'isTransaction', 'isEvent', 'isConcept', 'isEnum', 'isMapDeclaration']
                    .map((m) => (typeof d[m] === 'function' ? d[m]() : '-')),
            ]);
        },
        expect: {
            ok: [
                ['Shape', 'ConceptDeclaration', `ClassDeclaration {id=${NS}.Shape super=Concept enum=false abstract=true}`, false, false, false, false, true, false, false],
                ['Address', 'ConceptDeclaration', `ClassDeclaration {id=${NS}.Address super=Concept enum=false abstract=false}`, false, false, false, false, true, false, false],
                ['Colour', 'EnumDeclaration', `EnumDeclaration {id=${NS}.Colour}`, false, false, false, false, false, true, false],
                ['Person', 'ParticipantDeclaration', `ClassDeclaration {id=${NS}.Person super=Participant enum=false abstract=false}`, false, true, false, false, false, false, false],
                ['Car', 'AssetDeclaration', `ClassDeclaration {id=${NS}.Car super=Asset enum=false abstract=false}`, true, false, false, false, false, false, false],
                ['Sell', 'TransactionDeclaration', `ClassDeclaration {id=${NS}.Sell super=Transaction enum=false abstract=false}`, false, false, true, false, false, false, false],
                ['Sold', 'EventDeclaration', `ClassDeclaration {id=${NS}.Sold super=Event enum=false abstract=false}`, false, false, false, true, false, false, false],
                ['Labels', 'MapDeclaration', `MapDeclaration {id=${NS}.Labels}`, false, false, false, false, false, false, true],
            ],
        },
    },
];

module.exports = checks;
