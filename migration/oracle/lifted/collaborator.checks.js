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
 * P5-02b lifted checks: the collaborator fallback of `ModelFile.validate()`
 * (PORTING.md 1.5, P4-08; maintainer decision on accordproject/concerto-rust#73,
 * 2026-09-27: "The collaborator fallback stays only for collaborators that
 * are not engine-backed").
 *
 * `ModelFile.validate()` delegates to the engine through its manager's
 * `rustHandle`. A `ModelFile` built against a manager that is not
 * engine-backed (no `rustHandle`: a stub, or a host's own wrapper around a
 * model manager) validates with the TS body instead: `ModelFile.validate`
 * (imports, duplicate names), then each declaration's `validate()`
 * (Declaration, ClassDeclaration, Decorated, Decorator, ScalarDeclaration,
 * EnumValueDeclaration). The frozen unit suite only ever reaches that path
 * through sinon stubs that replace `validate` itself, so these checks drive
 * it through the public `ModelFile` constructor instead, with a manager
 * wrapper that forwards everything to a real `ModelManager` but has no
 * `rustHandle`. `expect` is the frozen v5.0.0 reference's outcome (v5.0.0
 * has no `rustHandle`, so the wrapper changes nothing there). Run by
 * fallbacks.spec.js.
 *
 * If P5-02 removes this fallback, delete this file with it.
 */

/**
 * A manager-like collaborator that is not engine-backed: it forwards every
 * member to `mm`, except that it has no `rustHandle`.
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

const DEPS = [
    'namespace org.acme.p502b.dep@1.0.0\nconcept B {}\nconcept D {}\nasset IdA identified by aid { o String aid }\nconcept SysC identified {}\nconcept P2 { o String pp o D d optional }',
    'namespace org.acme.p502b.dep@2.0.0\nconcept B2 {}',
];

/**
 * Validates `cto` as a ModelFile built against a collaborator wrapping a
 * ModelManager that holds DEPS.
 * @param {string} cto the model under test
 * @param {object} [options] the ModelManager options
 * @returns {Function} the check body; returns 'valid' or throws
 */
function validateWithCollaborator(cto, options = {}) {
    return (core) => {
        const mm = new core.ModelManager(options);
        DEPS.forEach((d, i) => mm.addCTOModel(d, `dep${i}.cto`));
        const scratch = new core.ModelManager(options);
        const ast = scratch.addCTOModel(cto, 'x.cto', true).getAst();
        const mf = new core.ModelFile(collaborator(mm), ast, undefined, 'x.cto');
        mf.validate();
        return 'valid';
    };
}

/**
 * As `validateWithCollaborator`, but with the AST mutated first, for
 * shapes CTO cannot express.
 * @param {string} cto the model under test
 * @param {Function} mutate `(ast) => void`
 * @returns {Function} the check body
 */
function validateMutated(cto, mutate) {
    return (core) => {
        const mm = new core.ModelManager();
        DEPS.forEach((d, i) => mm.addCTOModel(d, `dep${i}.cto`));
        const scratch = new core.ModelManager();
        const ast = JSON.parse(JSON.stringify(scratch.addCTOModel(cto, 'x.cto', true).getAst()));
        mutate(ast);
        const mf = new core.ModelFile(collaborator(mm), ast, undefined, 'x.cto');
        mf.validate();
        return 'valid';
    };
}

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
 * A ModelManager read on a manager that holds a hand-built ModelFile the
 * engine mirror could not take: `B`'s declaration carries a location
 * without `$class` (as a host building an AST by hand might write it), so
 * `addModelFile(..., disableValidation = true)` keeps it on the TS side
 * while the engine rejects its copy. The manager's reads
 * (`derivesFrom`, `isAssignableTo`, `getModelFileByFileName`,
 * `resolveType`) then answer from the TS body over `modelFiles`
 * (basemodelmanager.ts, `_rustHandleMatchesModelFiles()` false).
 * @param {Function} read `(mm) => value`
 * @returns {Function} the check body
 */
function readHandBuilt(read) {
    return (core) => {
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
}

module.exports = [
    {
        id: 'CO-VAL-001',
        covers: 'ModelFile.validate TS body: a valid model with imports of every kind',
        run: validateWithCollaborator(`${T}
import org.acme.p502b.dep@1.0.0.{B, IdA}
import concerto@1.0.0.{Concept}
scalar S extends String default="x" regex=/x/
enum E { o X o Y }
map M { o String o B }
@deco("a", 1)
concept C {
  @fdeco
  o B b
  o S s
  o E e
  o M m optional
  o String str length=[1,5]
  o Integer i range=[0,]
  --> IdA a
}
asset A2 extends IdA {}
concept Sub extends C {}`),
        expect: { ok: 'valid' },
    },
    {
        id: 'CO-VAL-002',
        covers: 'Declaration.validate: a local type clashes with an import',
        run: validateWithCollaborator(`${T}\nimport org.acme.p502b.dep@1.0.0.{B}\nconcept B {}`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Type \'B\' clashes with an imported type with the same name. File \'x.cto\': '
            }
        },
    },
    {
        id: 'CO-VAL-003',
        covers: 'Declaration.validate: a reserved system type name, allowed by the option',
        run: validateWithCollaborator(`${T}\nimport concerto@1.0.0.{Transaction}\ntransaction Transaction {}`, { dangerouslyAllowReservedSystemTypeNamesInUserModels: true }),
        expect: { ok: 'valid' },
    },
    {
        id: 'CO-VAL-004',
        covers: 'Declaration.validate: a reserved system type name, not allowed',
        run: validateWithCollaborator(`${T}\nimport concerto@1.0.0.{Transaction}\ntransaction Transaction {}`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Type \'Transaction\' clashes with an imported type with the same name. File \'x.cto\': '
            }
        },
    },
    {
        id: 'CO-VAL-005',
        covers: 'Declaration.validate: the option set, but the clash is with a user type',
        run: validateWithCollaborator(`${T}\nimport org.acme.p502b.dep@1.0.0.{B}\nconcept B {}`, { dangerouslyAllowReservedSystemTypeNamesInUserModels: true }),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Type \'B\' clashes with an imported type with the same name. File \'x.cto\': '
            }
        },
    },
    {
        id: 'CO-VAL-006',
        covers: 'ModelFile.validate: an import from an unknown namespace',
        run: validateWithCollaborator(`${T}\nimport org.acme.p502b.nope@1.0.0.{B}\nconcept C {}`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Namespace is not defined for type "org.acme.p502b.nope@1.0.0.B". File \'x.cto\': '
            }
        },
    },
    {
        id: 'CO-VAL-007',
        covers: 'ModelFile.validate: an import of an unknown type',
        run: validateWithCollaborator(`${T}\nimport org.acme.p502b.dep@1.0.0.{Z}\nconcept C {}`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Type "Z" is not defined in namespace "org.acme.p502b.dep@1.0.0". File \'x.cto\': '
            }
        },
    },
    {
        id: 'CO-VAL-008',
        covers: 'ModelFile.validate: two versions of the same namespace',
        run: validateWithCollaborator(`${T}\nimport org.acme.p502b.dep@1.0.0.{B}\nimport org.acme.p502b.dep@2.0.0.{B2}\nconcept C {}`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Importing types from different versions ("1.0.0", "2.0.0") of the same namespace "org.acme.p502b.dep@2.0.0" is not permitted. File \'x.cto\': '
            }
        },
    },
    {
        id: 'CO-VAL-009',
        covers: 'ModelFile.validate: a duplicate declaration',
        run: validateWithCollaborator(`${T}\nconcept C {}\nconcept C {}`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Duplicate class name org.acme.p502b.t@1.0.0.C '
            }
        },
    },
    {
        id: 'CO-VAL-010',
        covers: 'ModelFile.resolveType: an undeclared property type',
        run: validateWithCollaborator(`${T}\nconcept C { o Nope n }`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Undeclared type "Nope" in "property org.acme.p502b.t@1.0.0.C.n". File \'x.cto\': '
            }
        },
    },
    {
        id: 'CO-VAL-011',
        covers: 'ClassDeclaration.validate: identified by a missing field',
        run: validateWithCollaborator(`${T}\nasset A identified by nope { o String id }`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Class "A" is identified by field "nope", but does not contain this property. File \'x.cto\': '
            }
        },
    },
    {
        id: 'CO-VAL-012',
        covers: 'ClassDeclaration.validate: identified by a non-String field',
        run: validateWithCollaborator(`${T}\nasset A identified by n { o Integer n }`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Class "A" is identified by field "n", but the type of the field is not "String". File \'x.cto\': '
            }
        },
    },
    {
        id: 'CO-VAL-013',
        covers: 'ClassDeclaration.validate: an optional identifying field',
        run: validateWithCollaborator(`${T}\nasset A identified by n { o String n optional }`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Identifying fields cannot be optional. File \'x.cto\': '
            }
        },
    },
    {
        id: 'CO-VAL-014',
        covers: 'ClassDeclaration.validate: redeclaring an explicit identifier of the super type',
        run: validateWithCollaborator(`${T}\nimport org.acme.p502b.dep@1.0.0.{IdA}\nasset A identified by x extends IdA { o String x }`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Super class org.acme.p502b.dep@1.0.0.IdA has an explicit identifier aid that cannot be redeclared. File \'x.cto\': '
            }
        },
    },
    {
        id: 'CO-VAL-015',
        covers: 'ClassDeclaration.validate: a system-identified subtype of a system-identified super type',
        run: validateWithCollaborator(`${T}\nimport org.acme.p502b.dep@1.0.0.{SysC}\nconcept Sub identified extends SysC {}`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Class "Sub" has more than one field named "$identifier". File \'x.cto\': '
            }
        },
    },
    {
        id: 'CO-VAL-016',
        covers: 'ClassDeclaration.validate: a duplicate field inherited from the super type',
        run: validateWithCollaborator(`${T}\nconcept P { o String a }\nconcept C extends P { o String a }`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Class "C" has more than one field named "a". File \'x.cto\': '
            }
        },
    },
    {
        id: 'CO-VAL-017',
        covers: 'ClassDeclaration.validate: properties that are not an array',
        run: validateMutated(`${T}\nconcept C { o String a }`, (ast) => {
            ast.declarations[0].properties = {};
        }),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Properties of Class "C" has to be defined. File \'x.cto\': '
            }
        },
    },
    {
        id: 'CO-VAL-018',
        covers: 'Decorated.validate: a duplicate decorator',
        run: validateWithCollaborator(`${T}\n@a @a concept C {}`),
        expect: {
            throws: { name: 'IllegalModelException', message: 'Duplicate decorator a File \'x.cto\': ' }
        },
    },
    {
        id: 'CO-VAL-019',
        covers: 'Decorator.validate/handleError: an undeclared decorator, missingDecorator=error',
        run: validateWithCollaborator(`${T}\n@Nope concept C {}`, { decoratorValidation: { missingDecorator: 'error', invalidDecorator: 'error' } }),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'IllegalModelException: Undeclared type "Nope" in "org.acme.p502b.t@1.0.0.C". File \'x.cto\':  File \'x.cto\': '
            }
        },
    },
    {
        id: 'CO-VAL-020',
        covers: 'Decorator.validate/handleError: a declared decorator with a bad argument, invalidDecorator=error',
        run: validateWithCollaborator(`${T}
import concerto.decorator@1.0.0.Decorator
concept Hide extends Decorator { o Boolean hidden optional }
@Hide("yes") concept C {}`, { decoratorValidation: { missingDecorator: 'error', invalidDecorator: 'error' } }),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'IllegalModelException: Decorator Hide has invalid decorator argument. Expected boolean. Found string, with value "yes" File \'x.cto\':  File \'x.cto\': '
            }
        },
    },
    {
        id: 'CO-VAL-021',
        covers: 'Decorator.validate: a declared decorator, validation on',
        run: validateWithCollaborator(`${T}
import concerto.decorator@1.0.0.Decorator
concept Hide extends Decorator { o Boolean hidden optional }
@Hide(true) concept C { @Hide o String s }`, { decoratorValidation: { missingDecorator: 'error', invalidDecorator: 'error' } }),
        expect: { ok: 'valid' },
    },
    {
        id: 'CO-VAL-022',
        covers: 'ScalarDeclaration.validate: an invalid default for the scalar',
        run: validateWithCollaborator(`${T}\nscalar S extends Integer default=5 range=[10,20]`),
        expect: {
            throws: {
                name: 'BaseException',
                message: 'Validator error for field `null`. org.acme.p502b.t@1.0.0.S: Value 5 is outside lower bound 10'
            }
        },
    },
    {
        id: 'CO-VAL-023',
        covers: 'EnumDeclaration/EnumValueDeclaration.validate: a duplicate enum value',
        run: validateWithCollaborator(`${T}\nenum E { o X o X }`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Class "E" has more than one field named "X". File \'x.cto\': '
            }
        },
    },
    {
        id: 'CO-VAL-024',
        covers: 'Field.validate: a field typed with a declaration from another namespace',
        run: validateWithCollaborator(`${T}\nimport org.acme.p502b.dep@1.0.0.{D}\nconcept C { o D[] ds o D d optional }`),
        expect: { ok: 'valid' },
    },
    {
        id: 'CO-VAL-025',
        covers: 'RelationshipDeclaration.validate: a relationship to a concept',
        run: validateWithCollaborator(`${T}\nimport org.acme.p502b.dep@1.0.0.{D}\nconcept C { --> D d }`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Relationship d must be to a class that has an identifier, but this is to org.acme.p502b.dep@1.0.0.D File \'x.cto\': '
            }
        },
    },
    {
        id: 'CO-VAL-026',
        covers: 'ClassDeclaration.validate: fields inherited from a super type in another namespace',
        run: validateWithCollaborator(`${T}\nimport org.acme.p502b.dep@1.0.0.{P2}\nconcept Sub extends P2 { o String own }`),
        expect: { ok: 'valid' },
    },
    {
        id: 'CO-VAL-027',
        covers: 'ClassDeclaration.validate: an explicitly identified concept with no super type',
        run: validateWithCollaborator(`${T}\nconcept X identified by n { o String n }`),
        expect: { ok: 'valid' },
    },
    {
        id: 'CO-VAL-028',
        covers: 'Declaration.isReservedSystemTypeImport: Concept, allowed by the option',
        run: validateWithCollaborator(`${T}\nimport concerto@1.0.0.{Concept}\nconcept Concept {}`, { dangerouslyAllowReservedSystemTypeNamesInUserModels: true }),
        expect: { ok: 'valid' },
    },
    {
        id: 'CO-VAL-029',
        covers: 'Declaration.isReservedSystemTypeImport: Asset, allowed by the option',
        run: validateWithCollaborator(`${T}\nimport concerto@1.0.0.{Asset}\nasset Asset identified by x { o String x }`, { dangerouslyAllowReservedSystemTypeNamesInUserModels: true }),
        expect: { ok: 'valid' },
    },
    {
        id: 'CO-VAL-030',
        covers: 'Declaration.isReservedSystemTypeImport: Participant, allowed by the option',
        run: validateWithCollaborator(`${T}\nimport concerto@1.0.0.{Participant}\nparticipant Participant identified by x { o String x }`, { dangerouslyAllowReservedSystemTypeNamesInUserModels: true }),
        expect: { ok: 'valid' },
    },
    {
        id: 'CO-VAL-031',
        covers: 'Declaration.isReservedSystemTypeImport: Event, allowed by the option',
        run: validateWithCollaborator(`${T}\nimport concerto@1.0.0.{Event}\nevent Event {}`, { dangerouslyAllowReservedSystemTypeNamesInUserModels: true }),
        expect: { ok: 'valid' },
    },
    {
        id: 'CO-VAL-032',
        covers: 'Decorator.handleError: an undeclared decorator, missingDecorator=warn (logged, not thrown)',
        run: validateWithCollaborator(`${T}\n@Nope concept C {}`, { decoratorValidation: { missingDecorator: 'warn', invalidDecorator: 'warn' } }),
        expect: { ok: 'valid' },
    },
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
