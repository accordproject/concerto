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
 * P5-35 lifted checks (accordproject/concerto-rust#345, BC-47): the
 * per-declaration `validate()` methods, called directly.
 *
 * P5-35 deleted the TS body of `ModelFile.validate()`, and with it the
 * lifted checks CO-VAL-001 to 032 that reached the per-declaration
 * `validate()` methods through it (Declaration, ClassDeclaration, Decorated,
 * Decorator, ScalarDeclaration, EnumValueDeclaration, Field,
 * RelationshipDeclaration). Those methods stay public until BC-49 removes
 * them, so these checks call them directly, through the public API: the
 * model under test is added to a real ModelManager with validation
 * disabled, and each of its declarations' `validate()` is then called in
 * order. The scenarios are CO-VAL's, less the ones that only
 * `ModelFile.validate()` itself checked (imports, duplicate names).
 *
 * BC47-001 and BC47-002 cover the BC-47 constructor check: a ModelFile
 * needs a BaseModelManager. `reference` is what v5.0.0 gives instead.
 *
 * `expect` is the frozen v5.0.0 reference's outcome. Run by
 * fallbacks.spec.js.
 */

const DEPS = [
    'namespace org.acme.p535.dep@1.0.0\nconcept B {}\nconcept D {}\nasset IdA identified by aid { o String aid }\nconcept SysC identified {}\nconcept P2 { o String pp o D d optional }',
];

const T = 'namespace org.acme.p535.t@1.0.0';

/**
 * Adds `cto` without validation to a ModelManager that holds DEPS, then
 * calls each of its declarations' `validate()` in order.
 * @param {string} cto the model under test
 * @param {object} [options] the ModelManager options
 * @returns {Function} the check body; returns 'valid' or throws
 */
function validateDeclarations(cto, options = {}) {
    return (core) => {
        const mm = new core.ModelManager(options);
        DEPS.forEach((d, i) => mm.addCTOModel(d, `dep${i}.cto`));
        const mf = mm.addCTOModel(cto, 'x.cto', true);
        mf.getAllDeclarations().forEach((d) => d.validate());
        return 'valid';
    };
}

/**
 * A manager-like object that forwards every member to `mm`: a Proxy
 * around a real ModelManager, which is not the manager itself.
 * @param {object} mm a real ModelManager
 * @returns {object} the wrapper
 */
function wrapper(mm) {
    return new Proxy(mm, {
        get(target, prop) {
            const v = Reflect.get(target, prop, target);
            return typeof v === 'function' ? v.bind(target) : v;
        },
    });
}

const checks = [
    {
        id: 'DECL-VAL-001',
        covers: 'per-declaration validate(): a valid model with imports of every kind',
        run: validateDeclarations(`${T}
import org.acme.p535.dep@1.0.0.{B, IdA}
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
        id: 'DECL-VAL-002',
        covers: 'Declaration.validate: a local type clashes with an import',
        run: validateDeclarations(`${T}\nimport org.acme.p535.dep@1.0.0.{B}\nconcept B {}`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Type \'B\' clashes with an imported type with the same name. File \'x.cto\': '
            }
        },
    },
    {
        id: 'DECL-VAL-003',
        covers: 'Declaration.validate: a reserved system type name, allowed by the option',
        run: validateDeclarations(`${T}\nimport concerto@1.0.0.{Transaction}\ntransaction Transaction {}`, { dangerouslyAllowReservedSystemTypeNamesInUserModels: true }),
        expect: { ok: 'valid' },
    },
    {
        id: 'DECL-VAL-004',
        covers: 'Declaration.validate: a reserved system type name, not allowed',
        run: validateDeclarations(`${T}\nimport concerto@1.0.0.{Transaction}\ntransaction Transaction {}`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Type \'Transaction\' clashes with an imported type with the same name. File \'x.cto\': '
            }
        },
    },
    {
        id: 'DECL-VAL-005',
        covers: 'Declaration.validate: the option set, but the clash is with a user type',
        run: validateDeclarations(`${T}\nimport org.acme.p535.dep@1.0.0.{B}\nconcept B {}`, { dangerouslyAllowReservedSystemTypeNamesInUserModels: true }),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Type \'B\' clashes with an imported type with the same name. File \'x.cto\': '
            }
        },
    },
    {
        id: 'DECL-VAL-006',
        covers: 'Field.validate: an undeclared property type',
        run: validateDeclarations(`${T}\nconcept C { o Nope n }`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Undeclared type "Nope" in "property org.acme.p535.t@1.0.0.C.n". File \'x.cto\': '
            }
        },
    },
    {
        id: 'DECL-VAL-007',
        covers: 'ClassDeclaration.validate: identified by a missing field',
        run: validateDeclarations(`${T}\nasset A identified by nope { o String id }`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Class "A" is identified by field "nope", but does not contain this property. File \'x.cto\': '
            }
        },
    },
    {
        id: 'DECL-VAL-008',
        covers: 'ClassDeclaration.validate: identified by a non-String field',
        run: validateDeclarations(`${T}\nasset A identified by n { o Integer n }`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Class "A" is identified by field "n", but the type of the field is not "String". File \'x.cto\': '
            }
        },
    },
    {
        id: 'DECL-VAL-009',
        covers: 'ClassDeclaration.validate: an optional identifying field',
        run: validateDeclarations(`${T}\nasset A identified by n { o String n optional }`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Identifying fields cannot be optional. File \'x.cto\': '
            }
        },
    },
    {
        id: 'DECL-VAL-010',
        covers: 'ClassDeclaration.validate: redeclaring an explicit identifier of the super type',
        run: validateDeclarations(`${T}\nimport org.acme.p535.dep@1.0.0.{IdA}\nasset A identified by x extends IdA { o String x }`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Super class org.acme.p535.dep@1.0.0.IdA has an explicit identifier aid that cannot be redeclared. File \'x.cto\': '
            }
        },
    },
    {
        id: 'DECL-VAL-011',
        covers: 'ClassDeclaration.validate: a system-identified subtype of a system-identified super type',
        run: validateDeclarations(`${T}\nimport org.acme.p535.dep@1.0.0.{SysC}\nconcept Sub identified extends SysC {}`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Class "Sub" has more than one field named "$identifier". File \'x.cto\': '
            }
        },
    },
    {
        id: 'DECL-VAL-012',
        covers: 'ClassDeclaration.validate: a duplicate field inherited from the super type',
        run: validateDeclarations(`${T}\nconcept P { o String a }\nconcept C extends P { o String a }`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Class "C" has more than one field named "a". File \'x.cto\': '
            }
        },
    },
    {
        id: 'DECL-VAL-013',
        covers: 'ClassDeclaration.validate: a class extending itself (an AST the CTO parser rejects)',
        run: (core) => {
            const mm = new core.ModelManager();
            const ast = JSON.parse(JSON.stringify(new core.ModelManager().addCTOModel(`${T}\nconcept C {}`, 'x.cto', true).getAst()));
            ast.declarations[0].superType = { $class: 'concerto.metamodel@1.0.0.TypeIdentifier', name: 'C' };
            const mf = new core.ModelFile(mm, ast, undefined, 'x.cto');
            mm.addModelFile(mf, undefined, 'x.cto', true);
            mf.getAllDeclarations().forEach((d) => d.validate());
            return 'valid';
        },
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Class "C" cannot extend itself. File \'x.cto\': '
            }
        },
    },
    {
        id: 'DECL-VAL-014',
        covers: 'Decorated.validate: a duplicate decorator',
        run: validateDeclarations(`${T}\n@a @a concept C {}`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Duplicate decorator a File \'x.cto\': '
            }
        },
    },
    {
        id: 'DECL-VAL-015',
        covers: 'Decorator.validate/handleError: an undeclared decorator, missingDecorator=error',
        run: validateDeclarations(`${T}\n@Nope concept C {}`, { decoratorValidation: { missingDecorator: 'error', invalidDecorator: 'error' } }),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'IllegalModelException: Undeclared type "Nope" in "org.acme.p535.t@1.0.0.C". File \'x.cto\':  File \'x.cto\': '
            }
        },
    },
    {
        id: 'DECL-VAL-016',
        covers: 'Decorator.validate/handleError: a declared decorator with a bad argument, invalidDecorator=error',
        run: validateDeclarations(`${T}
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
        id: 'DECL-VAL-017',
        covers: 'Decorator.validate: a declared decorator, validation on',
        run: validateDeclarations(`${T}
import concerto.decorator@1.0.0.Decorator
concept Hide extends Decorator { o Boolean hidden optional }
@Hide(true) concept C { @Hide o String s }`, { decoratorValidation: { missingDecorator: 'error', invalidDecorator: 'error' } }),
        expect: { ok: 'valid' },
    },
    {
        id: 'DECL-VAL-018',
        covers: 'Decorator.handleError: an undeclared decorator, missingDecorator=warn (logged, not thrown)',
        run: validateDeclarations(`${T}\n@Nope concept C {}`, { decoratorValidation: { missingDecorator: 'warn', invalidDecorator: 'warn' } }),
        expect: { ok: 'valid' },
    },
    {
        id: 'DECL-VAL-019',
        covers: 'ScalarDeclaration.validate: an invalid default for the scalar',
        run: validateDeclarations(`${T}\nscalar S extends Integer default=5 range=[10,20]`),
        // P5-53 (BC-39, R1): a validator error while the model loads is an IllegalModelException,
        // keeping its errorType; v5.0.0 threw a BaseException.
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Validator error for field `null`. org.acme.p535.t@1.0.0.S: Value 5 is outside lower bound 10 '
            }
        },
        reference: {
            throws: {
                name: 'BaseException',
                message: 'Validator error for field `null`. org.acme.p535.t@1.0.0.S: Value 5 is outside lower bound 10'
            }
        },
    },
    {
        id: 'DECL-VAL-020',
        covers: 'EnumDeclaration/EnumValueDeclaration.validate: a duplicate enum value',
        run: validateDeclarations(`${T}\nenum E { o X o Y }\nenum F { o X o X }`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Class "F" has more than one field named "X". File \'x.cto\': '
            }
        },
    },
    {
        id: 'DECL-VAL-021',
        covers: 'Field.validate: a field typed with a declaration from another namespace',
        run: validateDeclarations(`${T}\nimport org.acme.p535.dep@1.0.0.{D}\nconcept C { o D[] ds o D d optional }`),
        expect: { ok: 'valid' },
    },
    {
        id: 'DECL-VAL-022',
        covers: 'RelationshipDeclaration.validate: a relationship to a concept',
        run: validateDeclarations(`${T}\nimport org.acme.p535.dep@1.0.0.{D}\nconcept C { --> D d }`),
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Relationship d must be to a class that has an identifier, but this is to org.acme.p535.dep@1.0.0.D File \'x.cto\': '
            }
        },
    },
    {
        id: 'DECL-VAL-023',
        covers: 'ClassDeclaration.validate: fields inherited from a super type in another namespace',
        run: validateDeclarations(`${T}\nimport org.acme.p535.dep@1.0.0.{P2}\nconcept Sub extends P2 { o String own }`),
        expect: { ok: 'valid' },
    },
    {
        id: 'DECL-VAL-024',
        covers: 'Declaration.isReservedSystemTypeImport: Concept, Asset, Participant and Event, allowed by the option',
        run: validateDeclarations(`${T}
import concerto@1.0.0.{Concept, Asset, Participant, Event}
concept Concept {}
asset Asset identified by x { o String x }
participant Participant identified by x { o String x }
event Event {}`, { dangerouslyAllowReservedSystemTypeNamesInUserModels: true }),
        expect: { ok: 'valid' },
    },
    {
        id: 'DECL-VAL-025',
        covers: 'ClassDeclaration.process: properties that are not an array (with the BC-19 opt-out, which v5.0.0 ignores; strict-ast.checks.js covers the default)',
        run: (core) => {
            const mm = new core.ModelManager({ metamodelValidation: false });
            const ast = JSON.parse(JSON.stringify(new core.ModelManager().addCTOModel(`${T}\nconcept C { o String a }`, 'x.cto', true).getAst()));
            ast.declarations[0].properties = {};
            const mf = new core.ModelFile(mm, ast, undefined, 'x.cto');
            mf.getAllDeclarations().forEach((d) => d.validate());
            return 'valid';
        },
        expect: {
            throws: {
                name: 'IllegalModelException',
                message: 'Properties of Class "C" has to be defined. File \'x.cto\': '
            }
        },
    },
    {
        id: 'BC47-001',
        covers: 'ModelFile constructor (BC-47): a Proxy around a real ModelManager is not a BaseModelManager',
        run: (core) => {
            const mm = new core.ModelManager();
            const ast = new core.ModelManager().addCTOModel(`${T}\nconcept C {}`, 'x.cto', true).getAst();
            return new core.ModelFile(wrapper(mm), ast, undefined, 'x.cto').getNamespace();
        },
        expect: {
            throws: {
                name: 'TypeError',
                message: 'ModelFile expects a BaseModelManager built by its constructor'
            }
        },
        reference: { ok: 'org.acme.p535.t@1.0.0' },
    },
    {
        id: 'BC47-002',
        covers: 'ModelFile constructor (BC-47): a model file needs a model manager',
        run: (core) => {
            const ast = new core.ModelManager().addCTOModel(`${T}\nconcept C {}`, 'x.cto', true).getAst();
            return new core.ModelFile(undefined, ast, undefined, 'x.cto').getNamespace();
        },
        expect: {
            throws: {
                name: 'TypeError',
                message: 'ModelFile expects a BaseModelManager built by its constructor'
            }
        },
        reference: { ok: 'org.acme.p535.t@1.0.0' },
    },
];

module.exports = checks;
