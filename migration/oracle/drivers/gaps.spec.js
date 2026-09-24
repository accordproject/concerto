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
const ModelUtil = S('modelutil').default || S('modelutil').ModelUtil;

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
            const cto = 'namespace gaps.assign@1.0.0\nconcept C {\n  o String s\n}\n';
            const mm = new ModelManager();
            mm.addCTOModel(cto, 'assign.cto', true);
            const decl = mm.getType('gaps.assign@1.0.0.C');
            const modelFile = decl.getModelFile();
            const property = decl.getProperty('s');
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

        it('filter() skips system model files and drops emptied model files', () => {
            const cto1 = 'namespace gaps.filter1@1.0.0\nconcept Keep {\n  o String s\n}\n';
            const cto2 = 'namespace gaps.filter2@1.0.0\nconcept Drop {\n  o String s\n}\n';
            const mm = new ModelManager();
            mm.addCTOModel(cto1, 'f1.cto', true);
            mm.addCTOModel(cto2, 'f2.cto', true);
            attempt(() => mm.filter((decl) => decl.getNamespace() === 'gaps.filter1@1.0.0'));
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
}
concept Numbers {
  o Integer same1 range=[1,10]
  o Integer same2 range=[1,10]
  o Integer minOnly range=[1,]
  o Integer maxOnly range=[,10]
  o Integer narrow range=[3,5]
  o Integer wide range=[1,20]
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
            ];
            for (const [a, b] of pairs) {
                attempt(() => v(a).compatibleWith(v(b)));
            }
            attempt(() => v('same1').compatibleWith(null));
            const numMm = new ModelManager();
            numMm.addCTOModel(cto, 'validators2.cto', true);
            const numDecl = numMm.getType('gaps.validators@1.0.0.Numbers');
            attempt(() => v('same1').compatibleWith(numDecl.getProperty('same1').getValidator()));
        });

        it('NumberValidator.compatibleWith across bound combinations, and default-value bound checks', () => {
            const mm = new ModelManager();
            mm.addCTOModel(cto, 'validators3.cto', true);
            const decl = mm.getType('gaps.validators@1.0.0.Numbers');
            const v = (name) => decl.getProperty(name).getValidator();
            const pairs = [
                ['same1', 'same2'], ['minOnly', 'maxOnly'], ['maxOnly', 'minOnly'],
                ['narrow', 'wide'], ['wide', 'narrow'], ['minOnly', 'minOnly'],
            ];
            for (const [a, b] of pairs) {
                attempt(() => v(a).compatibleWith(v(b)));
            }
            attempt(() => v('same1').compatibleWith(null));
            const strMm = new ModelManager();
            strMm.addCTOModel(cto, 'validators4.cto', true);
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
});
