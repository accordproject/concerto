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
 * P5-02b lifted checks: `ModelFile.filter()` on a detached ModelFile and
 * `BaseModelManager`'s reads on a manager holding a hand-built ModelFile.
 * `expect` is the frozen v5.0.0 reference's outcome. Run by
 * fallbacks.spec.js.
 *
 * CO-VAL-001 to 032 drove the TS body of `ModelFile.validate()` through a
 * manager wrapper with no `rustHandle` (the collaborator fallback of P4-08).
 * P5-35 (BC-47) removed that support: a ModelFile needs a BaseModelManager,
 * so the TS body and those checks are deleted.
 */

const DEPS = [
    'namespace org.acme.p502b.dep@1.0.0\nconcept B {}\nconcept D {}\nasset IdA identified by aid { o String aid }\nconcept SysC identified {}\nconcept P2 { o String pp o D d optional }',
    'namespace org.acme.p502b.dep@2.0.0\nconcept B2 {}',
];

/**
 * `ModelFile.filter` on a ModelFile built against a real, engine-backed
 * ModelManager but never added to it (a detached ModelFile: its manager's
 * engine mirror has no entry for it, so the TS body filters it). Returns the
 * filtered file's AST, or null.
 * @param {string} cto the model to filter
 * @param {Function} predicate `(declaration) => boolean`
 * @returns {Function} the check body
 */
function filterDetached(cto, predicate) {
    return (core) => {
        const mm = new core.ModelManager();
        DEPS.forEach((d, i) => mm.addCTOModel(d, `dep${i}.cto`));
        const scratch = new core.ModelManager();
        const ast = scratch.addCTOModel(cto, 'x.cto', true).getAst();
        const detached = new core.ModelFile(mm, ast, undefined, 'x.cto');
        const filtered = detached.filter(predicate, new core.ModelManager());
        return filtered === null ? null : { ast: filtered.getAst(), name: filtered.getName() };
    };
}

const T = 'namespace org.acme.p502b.t@1.0.0';
const HB = 'namespace org.acme.p502b.hb@1.0.0';
const HBNS = 'org.acme.p502b.hb@1.0.0';

/**
 * A ModelManager read on a manager that holds a hand-built ModelFile:
 * `B`'s declaration carries a location without `$class` (as a host
 * building an AST by hand might write it). v5.0.0 loads it, and so does
 * the engine since #262 (a `Range` or `Position` may omit `$class`), so
 * the manager's reads (`derivesFrom`, `isAssignableTo`,
 * `getModelFileByFileName`, `resolveType`) answer from the engine.
 * @param {Function} read `(mm) => value`
 * @returns {Function} the check body
 */
function readHandBuilt(read) {
    const body = (core) => {
        const mm = new core.ModelManager();
        const scratch = new core.ModelManager();
        const ast = JSON.parse(JSON.stringify(scratch.addCTOModel(
            `${HB}\nabstract concept A {}\nconcept B extends A {}\nconcept Z {}`, 'hb.cto', true).getAst()));
        ast.declarations[1].location = {
            start: { line: 3, column: 1, offset: 0 },
            end: { line: 3, column: 26, offset: 25 },
        };
        mm.addModelFile(new core.ModelFile(mm, ast, undefined, 'hb.cto'), undefined, 'hb.cto', true);
        return read(mm);
    };
    return body;
}

const checks = [
    // ---- ModelFile.filter on a detached ModelFile ------------------------
    {
        id: 'CO-FLT-001',
        covers: 'ModelFile.filter TS body: keep everything (imports of every kind kept)',
        run: filterDetached(`${T}
import org.acme.p502b.dep@1.0.0.{B, D as DD}
import org.acme.p502b.dep@1.0.0.IdA
import org.acme.p502b.gone@1.0.0.{G}
import org.acme.p502b.gone@1.0.0.H
import concerto@1.0.0.{Concept}
concept C { o B b }
concept E2 { o DD d }
asset A2 extends IdA {}`, () => true),
        expect: {
            ok: {
                ast: {
                    '$class': 'concerto.metamodel@1.0.0.Model',
                    decorators: [],
                    namespace: 'org.acme.p502b.t@1.0.0',
                    imports: [
                        {
                            '$class': 'concerto.metamodel@1.0.0.ImportTypes',
                            namespace: 'org.acme.p502b.dep@1.0.0',
                            types: [ 'B', 'D' ],
                            aliasedTypes: [
                                {
                                    '$class': 'concerto.metamodel@1.0.0.AliasedType',
                                    name: 'D',
                                    aliasedName: 'DD'
                                }
                            ]
                        },
                        {
                            '$class': 'concerto.metamodel@1.0.0.ImportType',
                            name: 'IdA',
                            namespace: 'org.acme.p502b.dep@1.0.0'
                        },
                        {
                            '$class': 'concerto.metamodel@1.0.0.ImportTypes',
                            namespace: 'org.acme.p502b.gone@1.0.0',
                            types: [ 'G' ]
                        },
                        {
                            '$class': 'concerto.metamodel@1.0.0.ImportType',
                            name: 'H',
                            namespace: 'org.acme.p502b.gone@1.0.0'
                        },
                        {
                            '$class': 'concerto.metamodel@1.0.0.ImportTypes',
                            namespace: 'concerto@1.0.0',
                            types: [ 'Concept' ]
                        }
                    ],
                    declarations: [
                        {
                            '$class': 'concerto.metamodel@1.0.0.ConceptDeclaration',
                            name: 'C',
                            isAbstract: false,
                            properties: [
                                {
                                    '$class': 'concerto.metamodel@1.0.0.ObjectProperty',
                                    name: 'b',
                                    type: { '$class': 'concerto.metamodel@1.0.0.TypeIdentifier', name: 'B' },
                                    isArray: false,
                                    isOptional: false
                                }
                            ]
                        },
                        {
                            '$class': 'concerto.metamodel@1.0.0.ConceptDeclaration',
                            name: 'E2',
                            isAbstract: false,
                            properties: [
                                {
                                    '$class': 'concerto.metamodel@1.0.0.ObjectProperty',
                                    name: 'd',
                                    type: { '$class': 'concerto.metamodel@1.0.0.TypeIdentifier', name: 'DD' },
                                    isArray: false,
                                    isOptional: false
                                }
                            ]
                        },
                        {
                            '$class': 'concerto.metamodel@1.0.0.AssetDeclaration',
                            name: 'A2',
                            isAbstract: false,
                            properties: [],
                            superType: { '$class': 'concerto.metamodel@1.0.0.TypeIdentifier', name: 'IdA' }
                        }
                    ]
                },
                name: 'x.cto'
            }
        },
    },
    {
        id: 'CO-FLT-002',
        covers: 'ModelFile.filter TS body: nothing left gives null',
        run: filterDetached(`${T}
import org.acme.p502b.dep@1.0.0.{B, D as DD}
import org.acme.p502b.dep@1.0.0.IdA
import org.acme.p502b.gone@1.0.0.{G}
import org.acme.p502b.gone@1.0.0.H
import concerto@1.0.0.{Concept}
concept C { o B b }
concept E2 { o DD d }
asset A2 extends IdA {}`, () => false),
        expect: { ok: null },
    },
    {
        id: 'CO-FLT-003',
        covers: 'ModelFile.filter TS body: dropping imported types prunes (and removes) their imports',
        run: filterDetached(`${T}
import org.acme.p502b.dep@1.0.0.{B, D as DD}
import org.acme.p502b.dep@1.0.0.IdA
import org.acme.p502b.gone@1.0.0.{G}
import org.acme.p502b.gone@1.0.0.H
import concerto@1.0.0.{Concept}
concept C { o B b }
concept E2 { o DD d }
asset A2 extends IdA {}`, (d) => !['B', 'D', 'IdA'].includes(d.getName())),
        expect: {
            ok: {
                ast: {
                    '$class': 'concerto.metamodel@1.0.0.Model',
                    decorators: [],
                    namespace: 'org.acme.p502b.t@1.0.0',
                    imports: [
                        {
                            '$class': 'concerto.metamodel@1.0.0.ImportTypes',
                            namespace: 'org.acme.p502b.gone@1.0.0',
                            types: [ 'G' ]
                        },
                        {
                            '$class': 'concerto.metamodel@1.0.0.ImportType',
                            name: 'H',
                            namespace: 'org.acme.p502b.gone@1.0.0'
                        },
                        {
                            '$class': 'concerto.metamodel@1.0.0.ImportTypes',
                            namespace: 'concerto@1.0.0',
                            types: [ 'Concept' ]
                        }
                    ],
                    declarations: [
                        {
                            '$class': 'concerto.metamodel@1.0.0.ConceptDeclaration',
                            name: 'C',
                            isAbstract: false,
                            properties: [
                                {
                                    '$class': 'concerto.metamodel@1.0.0.ObjectProperty',
                                    name: 'b',
                                    type: { '$class': 'concerto.metamodel@1.0.0.TypeIdentifier', name: 'B' },
                                    isArray: false,
                                    isOptional: false
                                }
                            ]
                        },
                        {
                            '$class': 'concerto.metamodel@1.0.0.ConceptDeclaration',
                            name: 'E2',
                            isAbstract: false,
                            properties: [
                                {
                                    '$class': 'concerto.metamodel@1.0.0.ObjectProperty',
                                    name: 'd',
                                    type: { '$class': 'concerto.metamodel@1.0.0.TypeIdentifier', name: 'DD' },
                                    isArray: false,
                                    isOptional: false
                                }
                            ]
                        },
                        {
                            '$class': 'concerto.metamodel@1.0.0.AssetDeclaration',
                            name: 'A2',
                            isAbstract: false,
                            properties: [],
                            superType: { '$class': 'concerto.metamodel@1.0.0.TypeIdentifier', name: 'IdA' }
                        }
                    ]
                },
                name: 'x.cto'
            }
        },
    },
    {
        id: 'CO-FLT-004',
        covers: 'ModelFile.filter TS body: dropping only the aliased import keeps the others',
        run: filterDetached(`${T}
import org.acme.p502b.dep@1.0.0.{B, D as DD}
import org.acme.p502b.dep@1.0.0.IdA
import org.acme.p502b.gone@1.0.0.{G}
import org.acme.p502b.gone@1.0.0.H
import concerto@1.0.0.{Concept}
concept C { o B b }
concept E2 { o DD d }
asset A2 extends IdA {}`, (d) => d.getName() !== 'D'),
        expect: {
            ok: {
                ast: {
                    '$class': 'concerto.metamodel@1.0.0.Model',
                    decorators: [],
                    namespace: 'org.acme.p502b.t@1.0.0',
                    imports: [
                        {
                            '$class': 'concerto.metamodel@1.0.0.ImportTypes',
                            namespace: 'org.acme.p502b.dep@1.0.0',
                            types: [ 'B' ],
                            aliasedTypes: []
                        },
                        {
                            '$class': 'concerto.metamodel@1.0.0.ImportType',
                            name: 'IdA',
                            namespace: 'org.acme.p502b.dep@1.0.0'
                        },
                        {
                            '$class': 'concerto.metamodel@1.0.0.ImportTypes',
                            namespace: 'org.acme.p502b.gone@1.0.0',
                            types: [ 'G' ]
                        },
                        {
                            '$class': 'concerto.metamodel@1.0.0.ImportType',
                            name: 'H',
                            namespace: 'org.acme.p502b.gone@1.0.0'
                        },
                        {
                            '$class': 'concerto.metamodel@1.0.0.ImportTypes',
                            namespace: 'concerto@1.0.0',
                            types: [ 'Concept' ]
                        }
                    ],
                    declarations: [
                        {
                            '$class': 'concerto.metamodel@1.0.0.ConceptDeclaration',
                            name: 'C',
                            isAbstract: false,
                            properties: [
                                {
                                    '$class': 'concerto.metamodel@1.0.0.ObjectProperty',
                                    name: 'b',
                                    type: { '$class': 'concerto.metamodel@1.0.0.TypeIdentifier', name: 'B' },
                                    isArray: false,
                                    isOptional: false
                                }
                            ]
                        },
                        {
                            '$class': 'concerto.metamodel@1.0.0.ConceptDeclaration',
                            name: 'E2',
                            isAbstract: false,
                            properties: [
                                {
                                    '$class': 'concerto.metamodel@1.0.0.ObjectProperty',
                                    name: 'd',
                                    type: { '$class': 'concerto.metamodel@1.0.0.TypeIdentifier', name: 'DD' },
                                    isArray: false,
                                    isOptional: false
                                }
                            ]
                        },
                        {
                            '$class': 'concerto.metamodel@1.0.0.AssetDeclaration',
                            name: 'A2',
                            isAbstract: false,
                            properties: [],
                            superType: { '$class': 'concerto.metamodel@1.0.0.TypeIdentifier', name: 'IdA' }
                        }
                    ]
                },
                name: 'x.cto'
            }
        },
    },
    {
        id: 'CO-FLT-005',
        covers: 'ModelFile.filter TS body: a model without imports',
        run: filterDetached(`${T}\nconcept C {}\nconcept X {}`, (d) => d.getName() === 'X'),
        expect: {
            ok: {
                ast: {
                    '$class': 'concerto.metamodel@1.0.0.Model',
                    decorators: [],
                    namespace: 'org.acme.p502b.t@1.0.0',
                    imports: [],
                    declarations: [
                        {
                            '$class': 'concerto.metamodel@1.0.0.ConceptDeclaration',
                            name: 'X',
                            isAbstract: false,
                            properties: []
                        }
                    ]
                },
                name: 'x.cto'
            }
        },
    },
    // ---- BaseModelManager reads over a hand-built ModelFile ------------
    {
        id: 'CO-MM-001',
        covers: 'BaseModelManager.derivesFrom TS body: a subtype',
        run: readHandBuilt((mm) => mm.derivesFrom(`${HBNS}.B`, `${HBNS}.A`)),
        expect: { ok: true },
    },
    {
        id: 'CO-MM-002',
        covers: 'BaseModelManager.derivesFrom TS body: an unrelated type',
        run: readHandBuilt((mm) => mm.derivesFrom(`${HBNS}.Z`, `${HBNS}.A`)),
        expect: { ok: false },
    },
    {
        id: 'CO-MM-003',
        covers: 'BaseModelManager.isAssignableTo TS body: a concrete subtype',
        run: readHandBuilt((mm) => mm.isAssignableTo(`${HBNS}.B`, `${HBNS}.A`)),
        expect: { ok: true },
    },
    {
        id: 'CO-MM-004',
        covers: 'BaseModelManager.isAssignableTo TS body: an abstract type',
        run: readHandBuilt((mm) => mm.isAssignableTo(`${HBNS}.A`, `${HBNS}.A`)),
        expect: { ok: false },
    },
    {
        id: 'CO-MM-005',
        covers: 'BaseModelManager.isAssignableTo TS body: an unknown type',
        run: readHandBuilt((mm) => mm.isAssignableTo(`${HBNS}.Q`, `${HBNS}.A`)),
        expect: { ok: false },
    },
    {
        id: 'CO-MM-006',
        covers: 'BaseModelManager.getModelFileByFileName TS body: a known and an unknown file name',
        run: readHandBuilt((mm) => [
            mm.getModelFileByFileName('hb.cto').getNamespace(),
            mm.getModelFileByFileName('nope.cto'),
        ]),
        expect: { ok: [HBNS, '<undefined>'] },
    },
    {
        id: 'CO-MM-007',
        covers: 'BaseModelManager.resolveType TS body: a primitive and a local type',
        run: readHandBuilt((mm) => [mm.resolveType('ctx', 'String'), mm.resolveType('ctx', `${HBNS}.B`)]),
        expect: { ok: ['String', `${HBNS}.B`] },
    },
    {
        id: 'CO-MM-008',
        covers: 'BaseModelManager.resolveType TS body: an unregistered namespace',
        run: readHandBuilt((mm) => mm.resolveType('ctx', 'org.acme.p502b.nope@1.0.0.B')),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'No registered namespace for type "org.acme.p502b.nope@1.0.0.B" in "ctx". '
            }
        },
    },
    {
        id: 'CO-MM-009',
        covers: 'BaseModelManager.resolveType TS body: an unknown type in a registered namespace',
        run: readHandBuilt((mm) => mm.resolveType('ctx', `${HBNS}.Q`)),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: `No type "${HBNS}.Q" in namespace "${HBNS}" for "ctx". `
            }
        },
    },
];

// CO-MM-010 to 018 repeated CO-MM-001 to 009's reads on a manager holding
// a stub ModelFile. P5-34 (BC-46) removed stub ModelFile support: a
// manager accepts only ModelFiles the ModelFile constructor built.

module.exports = checks;
