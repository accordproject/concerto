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
 * Corpus driver (task P2-11, plan §2.4): targeted black-box inputs that close
 * specific branches of migration/oracle/coverage-gaps.json which the unit
 * suite covers but the corpus does not. Every input here reaches its target
 * through concerto-core's public API (a CTO/AST model, an instance, or a
 * direct call on an introspection object returned by that API) while the
 * recorder is active (ORACLE_SOURCE=gaps). This driver never asserts on the
 * outcome; the reference decides it on replay.
 */

const path = require('path');
const { SRC_ROOT } = require('../lib/core');

const S = (m) => require(path.join(SRC_ROOT, m));
const { ModelManager } = S('modelmanager');
const { Factory } = S('factory');
const { Serializer } = S('serializer');
const ModelUtil = S('modelutil').default || S('modelutil').ModelUtil;
// The dayjs that concerto-core itself uses (with its utc plugin), not
// whichever copy require('dayjs') resolves to from this directory: a
// DateTime built from a different copy lacks .utc(), so its outcome would
// depend on the engine's own dayjs rather than on concerto-core.
const dayjs = S('dayjs-setup').default;

const attempt = (f) => {
    try {
        return f();
    } catch (e) {
        return undefined;
    }
};

// Some ops (fromAst, validateModelFiles) return no value on success, so a
// caller that needs to know whether the call threw uses this instead of
// branching on attempt()'s return value.
const succeeds = (f) => {
    try {
        f();
        return true;
    } catch (e) {
        return false;
    }
};

const MM1 = 'concerto.metamodel@1.0.0';
const clone = (o) => JSON.parse(JSON.stringify(o));

/**
 * Build a ModelManager from valid CTO, then return its raw (unresolved) AST
 * so a test can mutate individual declaration nodes before feeding them back
 * through fromAst.
 * @param {string} cto a Concerto model
 * @param {string} ns the namespace to read back out of the AST
 * @returns {object} the concerto.metamodel@1.0.0.Model node for ns
 */
function astFor(cto, ns) {
    const mm = new ModelManager();
    mm.addCTOModel(cto, 'gaps.cto', true);
    const ast = mm.getAst(false);
    return ast.models.find((m) => m.namespace === ns);
}

describe('oracle gaps driver', function () {
    this.timeout(60000);

    describe('field.ts: getScalarField', () => {
        const cto = `
namespace gaps.scalar@1.0.0

scalar SSN extends String
scalar Age extends Integer
scalar Flag extends Boolean
scalar Amount extends Double
scalar BigNum extends Long
scalar When extends DateTime

concept Person {
  o SSN ssn
  o Age age
  o Flag flag
  o Amount amount
  o BigNum bignum
  o When when
}
`;
        for (const prop of ['ssn', 'age', 'flag', 'amount', 'bignum', 'when']) {
            it(`unboxes scalar field '${prop}'`, () => {
                const mm = new ModelManager();
                mm.addCTOModel(cto, 'scalar.cto', true);
                const decl = mm.getType('gaps.scalar@1.0.0.Person');
                const field = decl.getProperty(prop);
                attempt(() => field.getScalarField());
                // second call exercises the cached-field branch
                attempt(() => field.getScalarField());
            });
        }

        it('getScalarField throws on a field that is not a scalar type', () => {
            const cto2 = 'namespace gaps.scalar2@1.0.0\nconcept C {\n  o String s\n}\n';
            const mm = new ModelManager();
            mm.addCTOModel(cto2, 'scalar2.cto', true);
            const decl = mm.getType('gaps.scalar2@1.0.0.C');
            const field = decl.getProperty('s');
            attempt(() => field.getScalarField());
        });
    });

    describe('property.ts: process() edge cases via mutated AST', () => {
        const cto = `
namespace gaps.property@1.0.0

concept Address {
  o String street
}
concept Person {
  o Address home
}
`;
        it('throws for a property name that is a system property', () => {
            const model = astFor(cto, 'gaps.property@1.0.0');
            const m = clone(model);
            const person = m.declarations.find((d) => d.name === 'Person');
            person.properties[0].name = '$identifier';
            const mm = new ModelManager();
            attempt(() => mm.fromAst({ $class: `${MM1}.Models`, models: [m] }, { disableValidation: true }));
        });

        it('throws for a property whose name is not a valid identifier', () => {
            const model = astFor(cto, 'gaps.property@1.0.0');
            const m = clone(model);
            const person = m.declarations.find((d) => d.name === 'Person');
            person.properties[0].name = '1bad';
            const mm = new ModelManager();
            attempt(() => mm.fromAst({ $class: `${MM1}.Models`, models: [m] }, { disableValidation: true }));
        });

        it('throws "No name for type" when a property has no name at all', () => {
            // ModelUtil.isValidIdentifier(undefined) is true (the regex matches the
            // stringified "undefined"), so the name-shaped property below only trips
            // the later `if (!this.name)` guard.
            const model = astFor(cto, 'gaps.property@1.0.0');
            const m = clone(model);
            const person = m.declarations.find((d) => d.name === 'Person');
            delete person.properties[0].name;
            const mm = new ModelManager();
            attempt(() => mm.fromAst({ $class: `${MM1}.Models`, models: [m] }, { disableValidation: true }));
        });

        it('ObjectProperty with no type resolves to a null type', () => {
            const model = astFor(cto, 'gaps.property@1.0.0');
            const m = clone(model);
            const person = m.declarations.find((d) => d.name === 'Person');
            delete person.properties[0].type;
            const mm = new ModelManager();
            attempt(() => mm.fromAst({ $class: `${MM1}.Models`, models: [m] }, { disableValidation: true }));
        });

        it('getFullyQualifiedTypeName on a primitive property', () => {
            const cto2 = 'namespace gaps.property2@1.0.0\nconcept C {\n  o String s\n}\n';
            const mm = new ModelManager();
            mm.addCTOModel(cto2, 'p2.cto', true);
            const decl = mm.getType('gaps.property2@1.0.0.C');
            const field = decl.getProperty('s');
            attempt(() => field.getFullyQualifiedTypeName());
        });
    });

    describe('declaration.ts: invalid declaration name', () => {
        it('throws for a scalar declaration with an invalid name', () => {
            const cto = 'namespace gaps.decl@1.0.0\nscalar OK extends String\n';
            const model = astFor(cto, 'gaps.decl@1.0.0');
            const m = clone(model);
            m.declarations[0].name = '1Bad';
            const mm = new ModelManager();
            attempt(() => mm.fromAst({ $class: `${MM1}.Models`, models: [m] }, { disableValidation: true }));
        });
    });

    describe('scalardeclaration.ts: name conflicts with a primitive type', () => {
        it('throws when a scalar is named after a primitive type', () => {
            const cto = 'namespace gaps.scalarname@1.0.0\nscalar OK extends Integer\n';
            const model = astFor(cto, 'gaps.scalarname@1.0.0');
            const m = clone(model);
            m.declarations[0].name = 'String';
            const mm = new ModelManager();
            attempt(() => mm.fromAst({ $class: `${MM1}.Models`, models: [m] }, { disableValidation: true }));
        });
    });

    describe('mapdeclaration.ts: process() edge cases', () => {
        const cto = `
namespace gaps.map@1.0.0

map M {
  o String
  o String
}
`;
        it('throws when the map has no key', () => {
            const model = astFor(cto, 'gaps.map@1.0.0');
            const m = clone(model);
            delete m.declarations[0].key;
            const mm = new ModelManager();
            attempt(() => mm.fromAst({ $class: `${MM1}.Models`, models: [m] }, { disableValidation: true }));
        });

        it('throws when the map has no value', () => {
            const model = astFor(cto, 'gaps.map@1.0.0');
            const m = clone(model);
            delete m.declarations[0].value;
            const mm = new ModelManager();
            attempt(() => mm.fromAst({ $class: `${MM1}.Models`, models: [m] }, { disableValidation: true }));
        });

        it('throws for an invalid map key type', () => {
            const model = astFor(cto, 'gaps.map@1.0.0');
            const m = clone(model);
            m.declarations[0].key.$class = `${MM1}.BooleanMapKeyType`;
            const mm = new ModelManager();
            attempt(() => mm.fromAst({ $class: `${MM1}.Models`, models: [m] }, { disableValidation: true }));
        });

        it('throws for an invalid map value type', () => {
            const model = astFor(cto, 'gaps.map@1.0.0');
            const m = clone(model);
            m.declarations[0].value.$class = `${MM1}.NotARealMapValueType`;
            const mm = new ModelManager();
            attempt(() => mm.fromAst({ $class: `${MM1}.Models`, models: [m] }, { disableValidation: true }));
        });
    });

    describe('mapvaluetype.ts: ObjectMapValueType edge cases', () => {
        const cto = `
namespace gaps.mapvalue@1.0.0

concept Address {
  o String street
}
map M {
  o String
  o Address
}
`;
        it('throws when an ObjectMapValueType has no type', () => {
            const model = astFor(cto, 'gaps.mapvalue@1.0.0');
            const m = clone(model);
            const decl = m.declarations.find((d) => d.name === 'M');
            delete decl.value.type;
            const mm = new ModelManager();
            attempt(() => mm.fromAst({ $class: `${MM1}.Models`, models: [m] }, { disableValidation: true }));
        });

        it('throws when the type of an ObjectMapValueType is missing $class/name', () => {
            const model = astFor(cto, 'gaps.mapvalue@1.0.0');
            const m = clone(model);
            const decl = m.declarations.find((d) => d.name === 'M');
            decl.value.type = {};
            const mm = new ModelManager();
            attempt(() => mm.fromAst({ $class: `${MM1}.Models`, models: [m] }, { disableValidation: true }));
        });

        it('throws when the type $class of an ObjectMapValueType is not TypeIdentifier', () => {
            const model = astFor(cto, 'gaps.mapvalue@1.0.0');
            const m = clone(model);
            const decl = m.declarations.find((d) => d.name === 'M');
            decl.value.type.$class = `${MM1}.SomethingElse`;
            const mm = new ModelManager();
            attempt(() => mm.fromAst({ $class: `${MM1}.Models`, models: [m] }, { disableValidation: true }));
        });
    });

    describe('classdeclaration.ts: property/supertype edge cases', () => {
        it('throws for a property named after a reserved system property', () => {
            const cto = 'namespace gaps.class1@1.0.0\nconcept C {\n  o String s\n}\n';
            const model = astFor(cto, 'gaps.class1@1.0.0');
            const m = clone(model);
            m.declarations[0].properties[0].name = '$identifier';
            const mm = new ModelManager();
            attempt(() => mm.fromAst({ $class: `${MM1}.Models`, models: [m] }, { disableValidation: true }));
        });

        it('getProperties() throws when the super type cannot be found', () => {
            const cto = `
namespace gaps.class2@1.0.0

concept Base {
  o String x
}
concept Derived extends Base {
  o String y
}
`;
            const model = astFor(cto, 'gaps.class2@1.0.0');
            const m = clone(model);
            const derived = m.declarations.find((d) => d.name === 'Derived');
            derived.superType.name = 'NoSuchBase';
            const mm = new ModelManager();
            if (succeeds(() => mm.fromAst({ $class: `${MM1}.Models`, models: [m] }, { disableValidation: true }))) {
                const decl = mm.getType('gaps.class2@1.0.0.Derived');
                attempt(() => decl.getProperties());
            }
        });
    });

    describe('relationshipdeclaration.ts: validate() edge cases', () => {
        const cto = `
namespace gaps.rel@1.0.0

concept Address {
  o String street
}
concept Person {
  --> Address home
}
`;
        it('validate() throws when the relationship type is empty', () => {
            const model = astFor(cto, 'gaps.rel@1.0.0');
            const m = clone(model);
            const person = m.declarations.find((d) => d.name === 'Person');
            person.properties[0].type.name = '';
            const mm = new ModelManager();
            if (succeeds(() => mm.fromAst({ $class: `${MM1}.Models`, models: [m] }, { disableValidation: true }))) {
                attempt(() => mm.validateModelFiles());
            }
        });

        it('validate() throws when the relationship points to a missing type', () => {
            const model = astFor(cto, 'gaps.rel@1.0.0');
            const m = clone(model);
            const person = m.declarations.find((d) => d.name === 'Person');
            person.properties[0].type.name = 'NoSuchConcept';
            const mm = new ModelManager();
            if (succeeds(() => mm.fromAst({ $class: `${MM1}.Models`, models: [m] }, { disableValidation: true }))) {
                attempt(() => mm.validateModelFiles());
            }
        });
    });

    describe('typed.ts: instanceOf() over a super type chain', () => {
        it('walks the super type chain', () => {
            const cto = `
namespace gaps.typed@1.0.0

concept Base identified by id {
  o String id
}
concept Mid extends Base {
  o String m
}
concept Leaf extends Mid {
  o String l
}
`;
            const mm = new ModelManager();
            mm.addCTOModel(cto, 'typed.cto', true);
            const factory = new Factory(mm);
            const leaf = attempt(() => factory.newResource('gaps.typed@1.0.0', 'Leaf', 'id1'));
            if (leaf) {
                attempt(() => leaf.instanceOf('gaps.typed@1.0.0.Leaf'));
                attempt(() => leaf.instanceOf('gaps.typed@1.0.0.Mid'));
                attempt(() => leaf.instanceOf('gaps.typed@1.0.0.Base'));
                attempt(() => leaf.instanceOf('gaps.typed@1.0.0.NoSuchType'));
            }
        });
    });

    describe('modelutil.ts: isAssignableTo() cannot find the type', () => {
        it('throws when the candidate type does not exist in the model file', () => {
            // The property's own type must be non-primitive: isAssignableTo
            // short-circuits on isPrimitiveType(propertyTypeName) before it
            // ever calls modelFile.getType(), so a String-typed property (as
            // used here previously) can never reach that call.
            const cto = 'namespace gaps.assign@1.0.0\nconcept D {\n  o String x\n}\nconcept C {\n  o D d\n}\n';
            const mm = new ModelManager();
            mm.addCTOModel(cto, 'assign.cto', true);
            const decl = mm.getType('gaps.assign@1.0.0.C');
            const modelFile = decl.getModelFile();
            const property = decl.getProperty('d');
            attempt(() => ModelUtil.isAssignableTo(modelFile, 'gaps.assign@1.0.0.NoSuchType', property));
        });
    });

    describe('basemodelmanager.ts: MM_QUERIES edge cases', () => {
        it('validateModelFile(modelFile) validates an already-constructed ModelFile', () => {
            const cto = 'namespace gaps.vmf@1.0.0\nconcept C {\n  o String s\n}\n';
            const mm = new ModelManager();
            mm.addCTOModel(cto, 'vmf.cto', true);
            const modelFile = mm.getModelFiles()[0];
            attempt(() => mm.validateModelFile(modelFile));
        });

        it('updateModelFile throws for a namespace that was never added', () => {
            const cto = 'namespace gaps.umf@1.0.0\nconcept C {\n  o String s\n}\n';
            const model = astFor(cto, 'gaps.umf@1.0.0');
            const mm = new ModelManager();
            const ModelFile = S('introspect/modelfile').ModelFile;
            const mf = attempt(() => new ModelFile(mm, clone(model), cto, 'umf.cto'));
            if (mf) {
                attempt(() => mm.updateModelFile(mf));
            }
        });

        it('updateModelFile with disableValidation skips validate()', () => {
            const cto = 'namespace gaps.umf3@1.0.0\nconcept C {\n  o String s\n}\n';
            const mm = new ModelManager();
            mm.addCTOModel(cto, 'umf3.cto', true);
            const model = astFor(cto, 'gaps.umf3@1.0.0');
            const ModelFile = S('introspect/modelfile').ModelFile;
            const mf = attempt(() => new ModelFile(mm, clone(model), cto, 'umf3.cto'));
            if (mf) {
                attempt(() => mm.updateModelFile(mf, 'umf3.cto', true));
            }
        });

        it('getModels() with includeExternalModels combinations', () => {
            const cto = 'namespace gaps.gm@1.0.0\nconcept C {\n  o String s\n}\n';
            const mm = new ModelManager();
            mm.addCTOModel(cto, 'gm.cto', true);
            attempt(() => mm.getModels());
            attempt(() => mm.getModels({ includeExternalModels: true }));
            attempt(() => mm.getModels({ includeExternalModels: false }));
        });

        // ModelFile.isExternal() is set purely from the fileName ('@'-prefixed)
        // passed to addCTOModel, with no need to route through the async
        // updateExternalModels/FileDownloader path: this reaches the
        // isExternal() && !includeExternalModels branch in getModels() on a
        // synchronously-added model file.
        it('getModels({ includeExternalModels: false }) skips a model file named like an external dependency', () => {
            const cto = 'namespace gaps.gmext@1.0.0\nconcept C {\n  o String s\n}\n';
            const mm = new ModelManager();
            mm.addCTOModel(cto, '@gmext.cto', true);
            attempt(() => mm.getModels({ includeExternalModels: false }));
            attempt(() => mm.getModels({ includeExternalModels: true }));
        });

        it('filter() skips system model files and drops emptied model files', () => {
            const cto1 = 'namespace gaps.filter1@1.0.0\nconcept Keep {\n  o String s\n}\n';
            const cto2 = 'namespace gaps.filter2@1.0.0\nconcept Drop {\n  o String s\n}\n';
            const mm = new ModelManager();
            mm.addCTOModel(cto1, 'f1.cto', true);
            mm.addCTOModel(cto2, 'f2.cto', true);
            attempt(() => mm.filter((decl) => decl.getNamespace() === 'gaps.filter1@1.0.0'));
        });
    });

    describe('modelfile.ts: fromAst edge cases (namespace identifier, wildcard import)', () => {
        // Both branches below are exercised in the unit suite only by
        // sandbox.stub(Parser, 'parse') returning a hand-built AST (see
        // test/introspect/modelfile.js). That stubs an *external*
        // collaborator (the CTO parser), not concerto-core itself, so the
        // same crafted AST reaches the identical code path here via the
        // public ModelManager.fromAst op, with no stub at all.
        it('fromAst rejects a namespace part that is not a valid identifier', () => {
            const cto = 'namespace gaps.badns@1.0.0\nconcept C {\n  o String s\n}\n';
            const model = astFor(cto, 'gaps.badns@1.0.0');
            const m = clone(model);
            m.namespace = 'gaps.bad-ns@1.0.0';
            const mm = new ModelManager();
            attempt(() => mm.fromAst({ $class: `${MM1}.Models`, models: [m] }, { disableValidation: true }));
        });

        it('fromAst rejects a wildcard (ImportAll) import', () => {
            const cto = 'namespace gaps.wildcard@1.0.0\nconcept C {\n  o String s\n}\n';
            const model = astFor(cto, 'gaps.wildcard@1.0.0');
            const m = clone(model);
            m.imports = (m.imports || []).concat([{
                $class: `${MM1}.ImportAll`,
                namespace: 'gaps.wildcardtarget@1.0.0',
                uri: 'https://example.invalid/model.cto',
            }]);
            const mm = new ModelManager();
            attempt(() => mm.fromAst({ $class: `${MM1}.Models`, models: [m] }, { disableValidation: true }));
        });
    });

    describe('modelfile.ts: getFullyQualifiedTypeName / getType / getImportURI on a real registered ModelFile', () => {
        const target = 'namespace gaps.gfqtn.target@1.0.0\nconcept Foo {\n  o String s\n}\n';
        const cto = `namespace gaps.gfqtn@1.0.0
import gaps.gfqtn.target@1.0.0.{Foo}

concept Bar {
  o Foo foo
}
`;
        it('getFullyQualifiedTypeName resolves an imported type and returns null for an unknown one', () => {
            const mm = new ModelManager();
            mm.addCTOModel(target, 'target.cto', true);
            mm.addCTOModel(cto, 'gfqtn.cto', true);
            const modelFile = mm.getModelFile('gaps.gfqtn@1.0.0');
            attempt(() => modelFile.getFullyQualifiedTypeName('Foo'));
            attempt(() => modelFile.getFullyQualifiedTypeName('NoSuchLocalOrImportedType'));
        });

        it('getType returns null when an imported type\'s namespace has no registered ModelFile', () => {
            // Validation is disabled, so the import target namespace is
            // never added to this model manager: resolveImport() still
            // resolves the short name (it only reads this file's own
            // import table), but getModelManager().getModelFile(ns) for
            // that namespace comes back falsy.
            const cto2 = `namespace gaps.gettype@1.0.0
import gaps.gettype.missing@1.0.0.{Foo}

concept Bar {
  o Foo foo
}
`;
            const mm = new ModelManager();
            mm.addCTOModel(cto2, 'gettype.cto', true);
            const modelFile = mm.getModelFile('gaps.gettype@1.0.0');
            attempt(() => modelFile.getType('Foo'));
        });

        it('getImportURI resolves an import URI and returns null for a non-imported name', () => {
            const importer = `namespace gaps.importuri@1.0.0
import gaps.importuri.target@1.0.0.{Foo} from https://example.invalid/target.cto

concept Bar {
  o Foo foo
}
`;
            const mm = new ModelManager();
            mm.addCTOModel(target.replace(/gfqtn/g, 'importuri'), 'target2.cto', true);
            mm.addCTOModel(importer, 'importuri.cto', true);
            const modelFile = mm.getModelFile('gaps.importuri@1.0.0');
            attempt(() => modelFile.getImportURI('gaps.importuri.target@1.0.0.Foo'));
            attempt(() => modelFile.getImportURI('gaps.importuri@1.0.0.NotImported'));
        });
    });

    describe('classdeclaration.ts: process() rejects an unrecognized property $class (via mutated AST)', () => {
        it('throws for a property whose $class is not a known property kind', () => {
            const cto = 'namespace gaps.badprop@1.0.0\nconcept C {\n  o String s\n}\n';
            const model = astFor(cto, 'gaps.badprop@1.0.0');
            const m = clone(model);
            m.declarations[0].properties[0].$class = `${MM1}.BogusProperty`;
            const mm = new ModelManager();
            attempt(() => mm.fromAst({ $class: `${MM1}.Models`, models: [m] }, { disableValidation: true }));
        });
    });

    describe('scalardeclaration.ts: DateTimeScalar type detection', () => {
        it('a scalar extending DateTime gets type "DateTime"', () => {
            const cto = 'namespace gaps.dtscalar@1.0.0\nscalar TS extends DateTime\n';
            const mm = new ModelManager();
            attempt(() => mm.addCTOModel(cto, 'dtscalar.cto', true));
        });
    });

    describe('jsonpopulator.ts: constructor options via Serializer.fromJSON', () => {
        // Serializer.fromJSON passes options.strictQualifiedDateTimes and
        // options.acceptResourcesForRelationships straight through to `new
        // JSONPopulator(...)` (src/serializer.ts): the unit suite's
        // JSONPopulator tests construct it directly instead (`new
        // JSONPopulator(true)`, `new JSONPopulator(false, false, 0,
        // false)`), but the same constructor branches are reachable here
        // through the public op with no stub at all.
        const cto = 'namespace gaps.jsonpop@1.0.0\nconcept C {\n  o DateTime d optional\n}\n';
        it('strictQualifiedDateTimes default vs explicit true/false', () => {
            const mm = new ModelManager();
            mm.addCTOModel(cto, 'jsonpop.cto', true);
            const serializer = new Serializer(new Factory(mm), mm);
            attempt(() => serializer.fromJSON({ $class: 'gaps.jsonpop@1.0.0.C', d: '2020-01-01T00:00:00Z' }));
            attempt(() => serializer.fromJSON({ $class: 'gaps.jsonpop@1.0.0.C', d: '2020-01-01T00:00:00Z' }, { strictQualifiedDateTimes: true }));
            attempt(() => serializer.fromJSON({ $class: 'gaps.jsonpop@1.0.0.C', d: '2020-01-01' }, { strictQualifiedDateTimes: false }));
        });
    });

    describe('jsonpopulator.ts / jsongenerator.ts: convertToObject/convertItem/visitField/visitRelationshipDeclaration via Serializer.fromJSON/toJSON', () => {
        // The unit suite's tests for these branches build a JSONPopulator or
        // JSONGenerator directly (`new JSONPopulator(true)`, etc.) and drive
        // it with jsonStack/resourceStack pushed by hand. But visitField,
        // convertItem, convertToObject and visitRelationshipDeclaration are
        // the same code whichever way they are entered, and
        // Serializer.fromJSON/toJSON is the public, wrapped way in: real
        // model, real Factory, real ModelManager, no stub.
        const cto = `namespace gaps.jsonpop3@1.0.0

concept Inner {
  o String s
}
concept Root identified by id {
  o String id
  o DateTime dt optional
  o Integer i optional
  o Long l optional
  o Double d optional
  o Boolean b optional
  o String s optional
  o Inner inner optional
  o Inner[] items optional
  o String[] tags optional
  --> Inner rel optional
  --> Inner[] rels optional
}
`;
        /**
         * Builds a fresh ModelManager (with the `cto` model above) and a
         * Serializer over it.
         * @param {object} [options] - Serializer options, passed straight
         * through to the JSONPopulator/JSONGenerator constructors.
         * @returns {{mm: object, serializer: object}} the pair.
         */
        function newSerializer(options) {
            const mm = new ModelManager();
            mm.addCTOModel(cto, 'jsonpop3.cto', true);
            return { mm, serializer: new Serializer(new Factory(mm), mm, options) };
        }

        it('convertToObject: wrong-typed scalar values for every primitive branch', () => {
            const { serializer } = newSerializer();
            const base = { $class: 'gaps.jsonpop3@1.0.0.Root', id: 'r1' };
            const bad = [
                { i: 'not-a-number' }, { i: 1.5 }, { l: 'not-a-number' }, { l: 1.5 },
                { d: 'not-a-number' }, { b: 'not-a-boolean' }, { s: 42 },
                { dt: 42 }, { dt: '2020-01-01T00:00:00Z' }, { dt: 'not-a-date' },
                { dt: '2020-01-01T00:00:00.000Z' },
            ];
            for (const patch of bad) {
                attempt(() => serializer.fromJSON(Object.assign({}, base, patch)));
            }
        });

        it('convertItem/visitField: array vs non-array mismatches, and $class fallback for sub-resources', () => {
            const { serializer } = newSerializer();
            const base = { $class: 'gaps.jsonpop3@1.0.0.Root', id: 'r2' };
            attempt(() => serializer.fromJSON(Object.assign({}, base, { items: 'not-an-array' })));
            attempt(() => serializer.fromJSON(Object.assign({}, base, { tags: 'not-an-array' })));
            attempt(() => serializer.fromJSON(Object.assign({}, base, {
                inner: { s: 'x' }, // no $class: falls back to the field's own type
            })));
            attempt(() => serializer.fromJSON(Object.assign({}, base, {
                inner: { $class: 'gaps.jsonpop3@1.0.0.Inner', s: 'x' },
            })));
            attempt(() => serializer.fromJSON(Object.assign({}, base, {
                items: [{ s: 'x' }, { $class: 'gaps.jsonpop3@1.0.0.Inner', s: 'y' }],
            })));
        });

        it('visitRelationshipDeclaration: array/non-array, string URI vs object, $class-less object, acceptResourcesForRelationships on/off', () => {
            const base = { $class: 'gaps.jsonpop3@1.0.0.Root', id: 'r3' };
            for (const acceptResourcesForRelationships of [true, false]) {
                const { serializer } = newSerializer({ acceptResourcesForRelationships });
                attempt(() => serializer.fromJSON(Object.assign({}, base, {
                    rel: 'resource:gaps.jsonpop3@1.0.0.Inner#i1',
                })));
                attempt(() => serializer.fromJSON(Object.assign({}, base, {
                    rel: { $class: 'gaps.jsonpop3@1.0.0.Inner', s: 'x' },
                })));
                attempt(() => serializer.fromJSON(Object.assign({}, base, {
                    rel: { s: 'x' }, // object with no $class
                })));
                attempt(() => serializer.fromJSON(Object.assign({}, base, {
                    rels: 'not-an-array',
                })));
                attempt(() => serializer.fromJSON(Object.assign({}, base, {
                    rels: [
                        'resource:gaps.jsonpop3@1.0.0.Inner#i2',
                        { $class: 'gaps.jsonpop3@1.0.0.Inner', s: 'y' },
                        { s: 'z' }, // object with no $class, inside the array
                    ],
                })));
            }
        });

        it('toJSON: the JSONGenerator side of the same model (arrays, relationships, DateTime, optional fields absent)', () => {
            const { mm, serializer } = newSerializer();
            const factory = new Factory(mm);
            const resource = attempt(() => factory.newResource('gaps.jsonpop3@1.0.0', 'Root', 'r4'));
            if (resource) {
                attempt(() => serializer.toJSON(resource));
                resource.dt = dayjs.utc('2020-01-02T03:04:05.678Z');
                resource.i = 1;
                resource.l = 2;
                resource.d = 1.5;
                resource.b = true;
                resource.s = 'x';
                attempt(() => serializer.toJSON(resource));
            }
        });
    });

    describe('resourcevalidator.ts: undeclared field, empty identifier, abstract-superType assignment via a real Resource', () => {
        // A Resource is a dynamic, plain-property object: setting an
        // undeclared property directly, or clearing the identifying field,
        // is itself a public, black-box operation on an object obtained
        // from Factory.newResource. No stub of ResourceValidator, Field or
        // ClassDeclaration is needed to reach these checks.
        const cto = `namespace gaps.rv@1.0.0
concept C identified by id {
  o String id
  o String s optional
}
`;
        it('Resource.validate() rejects a property that is not declared on the class', () => {
            const mm = new ModelManager();
            mm.addCTOModel(cto, 'rv.cto', true);
            const factory = new Factory(mm);
            const r = attempt(() => factory.newResource('gaps.rv@1.0.0', 'C', 'r1'));
            if (r) {
                r.extra = 'bogus';
                attempt(() => r.validate());
            }
        });

        it('Resource.validate() rejects an empty identifier', () => {
            const mm = new ModelManager();
            mm.addCTOModel(cto, 'rv.cto', true);
            const factory = new Factory(mm);
            const r = attempt(() => factory.newResource('gaps.rv@1.0.0', 'C', 'r2'));
            if (r) {
                r.id = '';
                attempt(() => r.validate());
            }
        });
    });

    describe('serializer/validator families: compatibleWith() and constructor edge cases', () => {
        const cto = `
namespace gaps.validators@1.0.0

concept Strings {
  o String same1 regex=/a/ length=[1,10]
  o String same2 regex=/a/ length=[1,10]
  o String diffPattern regex=/b/ length=[1,10]
  o String diffFlags regex=/a/i length=[1,10]
  o String bothNullLen regex=/a/
  o String minOnly length=[1,]
  o String maxOnly length=[,10]
  o String narrow length=[3,5]
  o String wide length=[1,20]
  o String hiMin length=[5,20]
  o String loMax length=[1,10]
}
concept Numbers {
  o Integer same1 range=[1,10]
  o Integer same2 range=[1,10]
  o Integer minOnly range=[1,]
  o Integer maxOnly range=[,10]
  o Integer narrow range=[3,5]
  o Integer wide range=[1,20]
  o Integer hiLower range=[5,20]
  o Integer loUpper range=[1,10]
}
concept Collections {
  o String[] same1 size=[1,10]
  o String[] same2 size=[1,10]
  o String[] minOnly size=[1,]
  o String[] maxOnly size=[,10]
  o String[] narrow size=[3,5]
  o String[] wide size=[1,20]
  o String[] hiMin size=[5,20]
  o String[] loMax size=[1,10]
}
`;
        it('StringValidator.compatibleWith across pattern/flags/length combinations', () => {
            const mm = new ModelManager();
            mm.addCTOModel(cto, 'validators.cto', true);
            const decl = mm.getType('gaps.validators@1.0.0.Strings');
            const v = (name) => decl.getProperty(name).getValidator();
            const pairs = [
                ['same1', 'same2'], ['same1', 'diffPattern'], ['same1', 'diffFlags'],
                ['bothNullLen', 'minOnly'], ['minOnly', 'bothNullLen'], ['bothNullLen', 'bothNullLen'],
                ['minOnly', 'maxOnly'], ['maxOnly', 'minOnly'], ['narrow', 'wide'], ['wide', 'narrow'],
                // narrow/wide only ever trips the minLength check (in one
                // direction or the other), so the `thisMaxLength >
                // otherMaxLength` branch is never reached by either pair:
                // hiMin (min 5, max 20) vs loMax (min 1, max 10) clears the
                // minLength check (5 is not < 1) and then trips it.
                ['hiMin', 'loMax'],
            ];
            for (const [a, b] of pairs) {
                attempt(() => v(a).compatibleWith(v(b)));
            }
            attempt(() => v('same1').compatibleWith(null));
            const numMm = new ModelManager();
            numMm.addCTOModel(cto, 'validators2.cto', true);
            const numDecl = numMm.getType('gaps.validators@1.0.0.Numbers');
            attempt(() => v('same1').compatibleWith(numDecl.getProperty('same1').getValidator()));

            // StringValidator.validate() directly, on real Validators owned
            // by real Fields: below/above each bound, and a regex mismatch.
            attempt(() => v('same1').validate('id', 'a'.repeat(11)));
            attempt(() => v('same1').validate('id', ''));
            attempt(() => v('same1').validate('id', 'zzz'));
            attempt(() => v('same1').validate('id', null));
        });

        it('NumberValidator.compatibleWith across bound combinations, and default-value bound checks', () => {
            const mm = new ModelManager();
            mm.addCTOModel(cto, 'validators3.cto', true);
            const decl = mm.getType('gaps.validators@1.0.0.Numbers');
            const v = (name) => decl.getProperty(name).getValidator();
            const pairs = [
                ['same1', 'same2'], ['minOnly', 'maxOnly'], ['maxOnly', 'minOnly'],
                ['narrow', 'wide'], ['wide', 'narrow'], ['minOnly', 'minOnly'],
                // As with StringValidator above, narrow/wide only ever trips
                // the lowerBound check; hiLower (lower 5, upper 20) vs
                // loUpper (lower 1, upper 10) clears it (5 is not < 1) and
                // then trips the upperBound check (20 > 10).
                ['hiLower', 'loUpper'],
            ];
            for (const [a, b] of pairs) {
                attempt(() => v(a).compatibleWith(v(b)));
            }
            attempt(() => v('same1').compatibleWith(null));
            const strMm = new ModelManager();
            strMm.addCTOModel(cto, 'validators4.cto', true);
            const strDecl = strMm.getType('gaps.validators@1.0.0.Strings');
            attempt(() => v('same1').compatibleWith(strDecl.getProperty('same1').getValidator()));

            // NumberValidator.validate() directly, on a real Validator owned
            // by a real Field: below and above the bound.
            attempt(() => v('same1').validate('id', 0));
            attempt(() => v('same1').validate('id', 11));
            attempt(() => v('same1').validate('id', null));
        });

        it('CollectionSizeValidator.compatibleWith across bound combinations', () => {
            const mm = new ModelManager();
            mm.addCTOModel(cto, 'validators5.cto', true);
            const decl = mm.getType('gaps.validators@1.0.0.Collections');
            // Collection size bounds live on Property.getSizeValidator(),
            // not the Field.getValidator() used by String/Number above.
            const v = (name) => decl.getProperty(name).getSizeValidator();
            const pairs = [
                ['same1', 'same2'], ['minOnly', 'maxOnly'], ['maxOnly', 'minOnly'],
                ['narrow', 'wide'], ['wide', 'narrow'], ['minOnly', 'minOnly'],
                ['hiMin', 'loMax'],
            ];
            for (const [a, b] of pairs) {
                attempt(() => v(a).compatibleWith(v(b)));
            }
            attempt(() => v('same1').compatibleWith(null));
            const strMm = new ModelManager();
            strMm.addCTOModel(cto, 'validators6.cto', true);
            const strDecl = strMm.getType('gaps.validators@1.0.0.Strings');
            attempt(() => v('same1').compatibleWith(strDecl.getProperty('same1').getValidator()));
        });

        it('NumberValidator constructor: no bounds specified, and lower > upper (via AST)', () => {
            const noBoundsCto = 'namespace gaps.nv1@1.0.0\nconcept C {\n  o Integer x\n}\n';
            const model = astFor(noBoundsCto, 'gaps.nv1@1.0.0');
            const m = clone(model);
            m.declarations[0].properties[0].validator = { $class: `${MM1}.NumberDomainValidator` };
            const mm = new ModelManager();
            attempt(() => mm.fromAst({ $class: `${MM1}.Models`, models: [m] }, { disableValidation: true }));

            const invertedCto = 'namespace gaps.nv2@1.0.0\nconcept C {\n  o Integer x range=[10,1]\n}\n';
            attempt(() => {
                const mm2 = new ModelManager();
                mm2.addCTOModel(invertedCto, 'nv2.cto', true);
            });

            const lowDefaultCto = 'namespace gaps.nv3@1.0.0\nconcept C {\n  o Integer x default=1 range=[5,10]\n}\n';
            attempt(() => {
                const mm3 = new ModelManager();
                mm3.addCTOModel(lowDefaultCto, 'nv3.cto', true);
            });

            const highDefaultCto = 'namespace gaps.nv4@1.0.0\nconcept C {\n  o Integer x default=100 range=[5,10]\n}\n';
            attempt(() => {
                const mm4 = new ModelManager();
                mm4.addCTOModel(highDefaultCto, 'nv4.cto', true);
            });
        });

        it('StringValidator constructor: degenerate lengthValidator bounds (via AST)', () => {
            const cto2 = 'namespace gaps.strv1@1.0.0\nconcept C {\n  o String s length=[1,10]\n}\n';
            const model = astFor(cto2, 'gaps.strv1@1.0.0');

            const noBounds = clone(model);
            noBounds.declarations[0].properties[0].lengthValidator.minLength = null;
            noBounds.declarations[0].properties[0].lengthValidator.maxLength = null;
            attempt(() => {
                const mm = new ModelManager();
                mm.fromAst({ $class: `${MM1}.Models`, models: [noBounds] }, { disableValidation: true });
            });

            const negative = clone(model);
            negative.declarations[0].properties[0].lengthValidator.minLength = -1;
            negative.declarations[0].properties[0].lengthValidator.maxLength = -1;
            attempt(() => {
                const mm = new ModelManager();
                mm.fromAst({ $class: `${MM1}.Models`, models: [negative] }, { disableValidation: true });
            });

            const inverted = clone(model);
            inverted.declarations[0].properties[0].lengthValidator.minLength = 10;
            inverted.declarations[0].properties[0].lengthValidator.maxLength = 1;
            attempt(() => {
                const mm = new ModelManager();
                mm.fromAst({ $class: `${MM1}.Models`, models: [inverted] }, { disableValidation: true });
            });

            const minOnly = clone(model);
            delete minOnly.declarations[0].properties[0].lengthValidator.maxLength;
            attempt(() => {
                const mm = new ModelManager();
                mm.fromAst({ $class: `${MM1}.Models`, models: [minOnly] }, { disableValidation: true });
            });

            // CTO's own `length=[1,]`/`length=[,10]` syntax leaves the
            // missing bound `undefined`, not `null` (confirmed empirically),
            // so it can never trip the `this.minLength === null ||
            // this.maxLength === null` branch below -- only an AST with an
            // explicit JSON `null` for exactly one bound can.
            const explicitNullMin = clone(model);
            explicitNullMin.declarations[0].properties[0].lengthValidator.minLength = null;
            attempt(() => {
                const mm = new ModelManager();
                mm.fromAst({ $class: `${MM1}.Models`, models: [explicitNullMin] }, { disableValidation: true });
            });

            const badRegexCto = 'namespace gaps.strv2@1.0.0\nconcept C {\n  o String s\n}\n';
            const badRegexModel = clone(astFor(badRegexCto, 'gaps.strv2@1.0.0'));
            badRegexModel.declarations[0].properties[0].validator = {
                $class: `${MM1}.StringRegexValidator`, pattern: '(', flags: '',
            };
            attempt(() => {
                const mm = new ModelManager();
                mm.fromAst({ $class: `${MM1}.Models`, models: [badRegexModel] }, { disableValidation: true });
            });
        });

        it('CollectionSizeValidator constructor: no bounds and negative bounds (via AST)', () => {
            const cto2 = 'namespace gaps.csv1@1.0.0\nconcept C {\n  o String[] items\n}\n';
            const model = astFor(cto2, 'gaps.csv1@1.0.0');
            const m1 = clone(model);
            m1.declarations[0].properties[0].sizeValidator = { $class: `${MM1}.CollectionDomainValidator` };
            attempt(() => {
                const mm = new ModelManager();
                mm.fromAst({ $class: `${MM1}.Models`, models: [m1] }, { disableValidation: true });
            });

            const m2 = clone(model);
            m2.declarations[0].properties[0].sizeValidator = { $class: `${MM1}.CollectionDomainValidator`, minSize: -1, maxSize: -1 };
            attempt(() => {
                const mm2 = new ModelManager();
                mm2.fromAst({ $class: `${MM1}.Models`, models: [m2] }, { disableValidation: true });
            });

            const m3 = clone(model);
            m3.declarations[0].properties[0].sizeValidator = { $class: `${MM1}.CollectionDomainValidator`, minSize: 10, maxSize: 1 };
            attempt(() => {
                const mm3 = new ModelManager();
                mm3.fromAst({ $class: `${MM1}.Models`, models: [m3] }, { disableValidation: true });
            });

            const m4 = clone(model);
            m4.declarations[0].properties[0].sizeValidator = { $class: `${MM1}.CollectionDomainValidator`, minSize: 1, maxSize: 5 };
            const mm4 = new ModelManager();
            if (succeeds(() => mm4.fromAst({ $class: `${MM1}.Models`, models: [m4] }, { disableValidation: true }))) {
                const decl = mm4.getType('gaps.csv1@1.0.0.C');
                const validator = decl.getProperty('items').getSizeValidator?.();
                attempt(() => validator && validator.compatibleWith(validator));
            }
        });
    });

    // ---------------------------------------------------------------------
    // Second P2-11 round: the remaining public-API gaps in the serializer
    // visitors (jsongenerator.ts, resourcevalidator.ts, instancegenerator.ts,
    // valuegenerator.ts) and in basemodelmanager.ts, modelfile.ts,
    // property.ts, jsonpopulator.ts and serializer.ts. Each block names the
    // public op it goes through; none uses a stub or calls an internal.
    // ---------------------------------------------------------------------

    describe('jsongenerator.ts / resourcevalidator.ts: Serializer.toJSON options over hand-built Resources', () => {
        // Serializer.toJSON hands its options straight to `new
        // ResourceValidator(options)` and `new JSONGenerator(...)`
        // (src/serializer.ts). A Resource is a plain dynamic object: the
        // values below are assigned to its fields directly, as a caller
        // would, and never through any concerto-core internal.
        const NS = 'gaps.jgen@1.0.0';
        const cto = `namespace ${NS}

asset Car identified by vin {
  o String vin
  o String colour optional
  --> Car next optional
  --> Car[] nexts optional
}
asset Bike identified by bid {
  o String bid
}
concept Part {
  o String name
}
map PartMap {
  o String
  o Part
}
map PhoneBook {
  o String
  o String
}
asset Garage identified by gid {
  o String gid
  o String label optional
  o String[] tags optional
  o Car car optional
  o Car[] cars optional
  o Part part optional
  o PartMap parts optional
  o PhoneBook contacts size=[1,2] optional
  --> Car rel optional
  --> Car[] rels optional
}
`;
        const setup = () => {
            const mm = new ModelManager();
            mm.addCTOModel(cto, 'jgen.cto', true);
            const factory = new Factory(mm);
            const serializer = new Serializer(factory, mm);
            const garage = (id) => factory.newResource(NS, 'Garage', id);
            const car = (id) => factory.newResource(NS, 'Car', id);
            const rel = (type, id) => factory.newRelationship(NS, type, id);
            return { mm, factory, serializer, garage, car, rel };
        };
        const OPTION_SETS = [
            undefined,
            { validate: false },
            { deduplicateResources: true },
            { deduplicateResources: true, validate: false },
            { convertResourcesToRelationships: true },
            { convertResourcesToRelationships: true, validate: false },
            { permitResourcesForRelationships: true },
            { permitResourcesForRelationships: true, validate: false },
            { convertResourcesToId: true },
            { convertResourcesToId: true, validate: false },
        ];

        it('deduplicateResources: the same car (by identifier) reached several times', () => {
            const { serializer, garage, car } = setup();
            const g = garage('g1');
            g.car = car('c1');
            g.cars = [car('c1'), car('c2'), car('c1')];
            for (const options of OPTION_SETS) {
                attempt(() => serializer.toJSON(g, options));
            }
        });

        it('a Relationship where a contained Car is expected', () => {
            const { serializer, garage, rel } = setup();
            const g = garage('g2');
            g.car = rel('Car', 'c1');
            for (const options of OPTION_SETS) {
                attempt(() => serializer.toJSON(g, options));
            }
            const g2 = garage('g2b');
            g2.cars = [rel('Car', 'c1')];
            for (const options of OPTION_SETS) {
                attempt(() => serializer.toJSON(g2, options));
            }
        });

        it('Resources in relationship fields: single and array, fresh and already being serialised', () => {
            const { serializer, garage, car, rel } = setup();
            // A car whose own relationships point back at a car with the
            // same identifier: separate objects (no cycle), same identifier.
            const loopCar = (id) => {
                const c = car(id);
                c.next = car(id);
                c.nexts = [car(id), rel('Car', 'other')];
                return c;
            };
            const g = garage('g3');
            g.rel = loopCar('c1');
            g.rels = [loopCar('c2'), rel('Car', 'c3'), car('c4')];
            for (const options of OPTION_SETS) {
                attempt(() => serializer.toJSON(g, options));
            }
            const single = garage('g3b');
            single.rel = loopCar('c5');
            for (const options of OPTION_SETS) {
                attempt(() => serializer.toJSON(single, options));
            }
            const plainRels = garage('g3c');
            plainRels.rel = rel('Car', 'c6');
            plainRels.rels = [rel('Car', 'c7')];
            for (const options of OPTION_SETS) {
                attempt(() => serializer.toJSON(plainRels, options));
            }
        });

        it('relationship fields holding the wrong kind of value', () => {
            const { serializer, garage, car, rel } = setup();
            const values = [
                { rels: 'not-an-array' },
                { rels: [rel('Bike', 'b1')] },
                { rel: rel('Bike', 'b1') },
                { rel: 'resource:gaps.jgen@1.0.0.Car#c1' },
                { rels: [car('c1')] },
            ];
            for (const patch of values) {
                const g = garage('g4');
                Object.assign(g, patch);
                for (const options of OPTION_SETS) {
                    attempt(() => serializer.toJSON(g, options));
                }
                attempt(() => g.validate());
            }
        });

        it('primitive and contained fields holding Resources, Relationships and undefined items', () => {
            const { factory, serializer, garage, car, rel } = setup();
            const values = [
                { label: rel('Car', 'c1') },
                { label: car('c1') },
                { tags: ['a', undefined, 'b'] },
                { cars: [factory.newResource(NS, 'Bike', 'b1')] },
                { car: factory.newResource(NS, 'Bike', 'b1') },
                { part: { name: 'plain object, not a Resource' } },
                { parts: new Map([['p1', { name: 'plain object map value' }]]) },
                { parts: new Map([['p1', factory.newConcept(NS, 'Part')]]) },
            ];
            for (const patch of values) {
                const g = garage('g5');
                Object.assign(g, patch);
                for (const options of [undefined, { validate: false }]) {
                    attempt(() => serializer.toJSON(g, options));
                }
                attempt(() => g.validate());
            }
        });

        it('a map field with a size validator: within, below and above the bounds', () => {
            const { serializer, garage } = setup();
            for (const entries of [[['a', '1']], [], [['a', '1'], ['b', '2'], ['c', '3']]]) {
                const g = garage('g6');
                g.contacts = new Map(entries);
                attempt(() => serializer.toJSON(g));
                attempt(() => g.validate());
            }
        });

        it('an unidentified concept with an undeclared property', () => {
            const { factory, serializer, garage } = setup();
            const p = factory.newConcept(NS, 'Part');
            p.name = 'wheel';
            p.extra = 'not declared';
            attempt(() => p.validate());
            attempt(() => serializer.toJSON(p));
            const g = garage('g7');
            g.part = p;
            attempt(() => g.validate());
            attempt(() => serializer.toJSON(g));
        });
    });

    describe('jsongenerator.ts / resourcevalidator.ts: Serializer.toJSON of a Relationship to a scalar type', () => {
        // Relationship.fromURI (public, recorded) resolves the type named in
        // the URI without checking that it is identifiable, unlike
        // Factory.newRelationship. A Relationship to a scalar is Typed, so
        // Serializer.toJSON accepts it and dispatches the ScalarDeclaration to
        // both visitors: neither visit() recognises it.
        it('toJSON with and without validation', () => {
            const { Relationship } = S('model/relationship');
            const NS = 'gaps.relscalar@1.0.0';
            const mm = new ModelManager();
            mm.addCTOModel(`namespace ${NS}\nscalar SSN extends String\nconcept C {\n  o String s\n}\n`, 'relscalar.cto', true);
            const serializer = new Serializer(new Factory(mm), mm);
            for (const uri of [`resource:${NS}.SSN#x`, `resource:${NS}.C#x`]) {
                const rel = attempt(() => Relationship.fromURI(mm, uri));
                if (rel) {
                    attempt(() => serializer.toJSON(rel));
                    attempt(() => serializer.toJSON(rel, { validate: false }));
                }
            }
        });
    });

    describe('basemodelmanager.ts / modelfile.ts / property.ts: public queries on unusual but real inputs', () => {
        it('deleteModelFile for a namespace that was never added', () => {
            const mm = new ModelManager();
            mm.addCTOModel('namespace gaps.del@1.0.0\nconcept C {\n  o String s\n}\n', 'del.cto', true);
            attempt(() => mm.deleteModelFile('gaps.nothere@1.0.0'));
            attempt(() => mm.deleteModelFile('gaps.del@1.0.0'));
        });

        it('ModelFile.getFullyQualifiedTypeName of a primitive type name', () => {
            const mm = new ModelManager();
            mm.addCTOModel('namespace gaps.prim@1.0.0\nconcept C {\n  o String s\n}\n', 'prim.cto', true);
            const mf = mm.getModelFile('gaps.prim@1.0.0');
            for (const t of ['String', 'Integer', 'DateTime', 'C', 'Nope']) {
                attempt(() => mf.getFullyQualifiedTypeName(t));
            }
        });

        it('Property.getFullyQualifiedTypeName of a property whose type is not declared (model added without validation)', () => {
            const mm = new ModelManager();
            mm.addCTOModel('namespace gaps.undecl@1.0.0\nconcept C {\n  o Missing m\n  --> Missing2 r\n}\n', 'undecl.cto', true);
            const decl = mm.getType('gaps.undecl@1.0.0.C');
            attempt(() => decl.getProperty('m').getFullyQualifiedTypeName());
            attempt(() => decl.getProperty('r').getFullyQualifiedTypeName());
        });
    });

    describe('jsonpopulator.ts: Serializer.fromJSON of a relationship to a primitive type (model added without validation)', () => {
        // A relationship whose type is a primitive has an unqualified
        // fully-qualified type name, so visitRelationshipDeclaration falls
        // back to the relationship's own namespace for its default.
        it('single and array relationships, string and object values', () => {
            const NS = 'gaps.relprim@1.0.0';
            const mm = new ModelManager();
            mm.addCTOModel(`namespace ${NS}\nconcept C {\n  --> String s optional\n  --> String[] ss optional\n}\n`, 'relprim.cto', true);
            const serializer = new Serializer(new Factory(mm), mm);
            for (const options of [undefined, { validate: false }, { acceptResourcesForRelationships: true, validate: false }]) {
                attempt(() => serializer.fromJSON({ $class: `${NS}.C`, s: 'abc' }, options));
                attempt(() => serializer.fromJSON({ $class: `${NS}.C`, ss: ['abc', 'resource:gaps.other@1.0.0.X#1'] }, options));
            }
        });
    });

    describe('serializer.ts: the Serializer constructor (Serializer.new)', () => {
        it('rejects a missing factory or model manager', () => {
            const mm = new ModelManager();
            mm.addCTOModel('namespace gaps.ser@1.0.0\nconcept C {\n  o String s\n}\n', 'ser.cto', true);
            const factory = new Factory(mm);
            attempt(() => new Serializer(null, mm));
            attempt(() => new Serializer(factory, null));
            attempt(() => new Serializer(undefined, undefined));
            attempt(() => new Serializer(factory, mm));
            attempt(() => new Serializer(factory, mm, { validate: false, utcOffset: 60 }));
        });
    });

    describe('resourcevalidator.ts: a Resource whose type is redeclared abstract', () => {
        it('validates a Resource after its class is made abstract by updateModelFile', () => {
            const NS = 'gaps.abs@1.0.0';
            const mm = new ModelManager();
            mm.addCTOModel(`namespace ${NS}\nconcept C {\n  o String s\n}\n`, 'abs.cto', true);
            const factory = new Factory(mm);
            const serializer = new Serializer(factory, mm);
            const c = factory.newConcept(NS, 'C');
            c.s = 'x';
            attempt(() => mm.updateModelFile(`namespace ${NS}\nabstract concept C {\n  o String s\n}\n`, 'abs.cto'));
            attempt(() => c.validate());
            attempt(() => serializer.toJSON(c));
        });
    });

    describe('instancegenerator.ts / valuegenerator.ts: Factory.newResource with generate options', () => {
        const NS = 'gaps.igen@1.0.0';
        const cto = `namespace ${NS}

scalar SSN extends String regex=/[0-9]{3}-[0-9]{2}-[0-9]{4}/
scalar Code extends String

participant Person identified by ssn {
  o SSN ssn
}
participant Member identified by code {
  o Code code
}
participant Badge identified by badgeId {
  o String badgeId regex=/B-[0-9]{4}/
}
concept Node {
  o String label
  o Node child optional
  o Node[] children optional
}
concept Loop {
  o Loop self
}
concept Numbers {
  o Integer i range=[1,5]
  o Integer iLow range=[3,]
  o Integer iHigh range=[,7]
  o Long l range=[10,20]
  o Long lHigh range=[,20]
  o Double d range=[0.5,1.5]
  o Double dLow range=[0.5,]
}
concept Strings {
  o String plainRegex regex=/abc/
  o String shortRegex regex=/a/ length=[5,10]
  o String longRegex regex=/abcdefghijklmnop/ length=[1,3]
  o String fitRegex regex=/abc/ length=[1,10]
  o String minOnlyRegex regex=/abc/ length=[1,]
  o String maxOnlyRegex regex=/abc/ length=[,10]
  o String lenOnly length=[2,4]
}
concept People {
  o Person person
  o Member member
  o Badge badge
  o Person[] people
}
`;
        const GEN = [
            { generate: 'sample' },
            { generate: 'sample', includeOptionalFields: true },
            { generate: 'empty' },
            { generate: 'empty', includeOptionalFields: true },
        ];
        const setup = () => {
            const mm = new ModelManager();
            mm.addCTOModel(cto, 'igen.cto', true);
            return new Factory(mm);
        };
        for (const type of ['Node', 'Loop', 'Numbers', 'Strings', 'People']) {
            it(`generates ${type}`, () => {
                const factory = setup();
                for (const options of GEN) {
                    attempt(() => factory.newConcept(NS, type, undefined, options));
                }
            });
        }
    });

    describe('resourcevalidator.ts / instancegenerator.ts / jsonpopulator.ts: enums and undefined values through the public API', () => {
        const NS = 'gaps.enumvis@1.0.0';
        const cto = `namespace ${NS}
enum Color {
  o RED
  o GREEN
}
concept C {
  o String s optional
}
concept D {
  o C c
}
map M {
  o String
  o C
}
concept E {
  o M m optional
}
concept F {
  o String s
}
`;
        const setup = () => {
            const mm = new ModelManager();
            mm.addCTOModel(cto, 'enumvis.cto');
            const factory = new Factory(mm);
            return { mm, factory, serializer: new Serializer(factory, mm) };
        };

        // A Factory-built instance is a ValidatedResource: setPropertyValue
        // validates the raw value, so undefined reaches visitField's
        // undefined/symbol check (resourcevalidator.ts 306).
        it('Resource.setPropertyValue with undefined on a validated instance', () => {
            const { factory } = setup();
            const f = factory.newConcept(NS, 'F');
            attempt(() => f.setPropertyValue('s', undefined));
            attempt(() => f.setPropertyValue('s', 'x'));
        });

        // Factory.newResource resolves any declared type, including an enum;
        // with generate options the InstanceGenerator then visits the enum
        // declaration, which none of its visit() cases accepts
        // (instancegenerator.ts 44).
        it('Factory.newResource of an enum type with generate options', () => {
            const { factory } = setup();
            for (const generate of ['sample', 'empty']) {
                attempt(() => factory.newResource(NS, 'Color', undefined, { generate }));
            }
        });

        // A nested object whose $class names an enum makes JSONPopulator
        // visit the enum declaration, which none of its visit() cases accepts
        // (jsonpopulator.ts 154): as a field value and as a map value.
        it('Serializer.fromJSON with an enum $class for a nested object and a map value', () => {
            const { serializer } = setup();
            attempt(() => serializer.fromJSON({ $class: `${NS}.D`, c: { $class: `${NS}.Color`, RED: 'x' } }));
            attempt(() => serializer.fromJSON({ $class: `${NS}.E`, m: { k: { $class: `${NS}.Color`, RED: 'x' } } }));
        });
    });

    describe('basemodelmanager.ts: ModelManager.writeModelsToFileSystem without a directory', () => {
        // Only a falsy path is recorded (lib/ops.js WRITES_TO_DISK): the call
        // then throws before anything is written, either for a model file
        // with no file name or for the missing path.
        it('named and unnamed model files, no path', () => {
            const cto = 'namespace gaps.write@1.0.0\nconcept C {\n  o String s\n}\n';
            const named = new ModelManager();
            named.addCTOModel(cto, 'write.cto');
            attempt(() => named.writeModelsToFileSystem(null));
            attempt(() => named.writeModelsToFileSystem(undefined, { includeExternalModels: false }));
            const unnamed = new ModelManager();
            unnamed.addCTOModel(cto);
            attempt(() => unnamed.writeModelsToFileSystem(null));
        });
    });

    describe('typenotfoundexception.ts: the exported TypeNotFoundException constructor', () => {
        it('with and without a message', () => {
            const { TypeNotFoundException } = S('typenotfoundexception');
            attempt(() => new TypeNotFoundException('gaps.tnf@1.0.0.Missing'));
            attempt(() => new TypeNotFoundException('gaps.tnf@1.0.0.Missing', 'custom message'));
            attempt(() => new TypeNotFoundException('gaps.tnf@1.0.0.Missing', undefined, 'my-component'));
        });
    });
});
