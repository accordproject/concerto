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

const { MetaModelNamespace } = require('@accordproject/concerto-metamodel');

const { ClassDeclaration } = require('../../src/introspect/classdeclaration');
const { Field } = require('../../src/introspect/field');
const { ModelFile } = require('../../src/introspect/modelfile');
const { ModelManager } = require('../../src/modelmanager');
const { IllegalModelException } = require('../../src/introspect/illegalmodelexception');

const should = require('chai').should();
const sinon = require('sinon');

describe('Field', () => {

    let mockClassDeclaration;
    let mockModelFile;

    beforeEach(() => {
        mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
        mockModelFile = sinon.createStubInstance(ModelFile);
        mockClassDeclaration.getModelFile.returns(mockModelFile);
    });

    describe('#constructor', () => {

        it('should not have a validator by default', () => {
            let f = new Field(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.StringProperty`,
                name: 'field',
            });
            should.equal(f.validator, null);
        });

        it('should save the incoming string validator', () => {

            let f = new Field(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.StringProperty`,
                name: 'field',
                validator: {
                    pattern: '^suchValidator$',
                    flags: ''
                }
            });
            f.getValidator().validate('id', 'suchValidator');
        });

        it('should save the incoming string validator (with flag)', () => {

            let f = new Field(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.StringProperty`,
                name: 'field',
                validator: {
                    pattern: '^suchValidator$',
                    flags: 'u'
                }
            });
            f.getValidator().validate('id', 'suchValidator');
        });

        it('should not have a default value by default', () => {
            let f = new Field(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.StringProperty`,
                name: 'field',
            });
            should.equal(f.defaultValue, null);
        });

        it('should save the incoming default value', () => {
            let f = new Field(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.StringProperty`,
                name: 'field',
                defaultValue: 'wowSuchDefault'
            });
            f.defaultValue.should.equal('wowSuchDefault');
        });

        it('should not be optional by default', () => {
            let f = new Field(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.StringProperty`,
                name: 'field',
            });
            f.optional.should.equal(false);
        });

        it('should detect if field is optional', () => {
            let f = new Field(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.StringProperty`,
                name: 'field',
                isOptional: true
            });
            f.optional.should.equal(true);
        });
    });

    describe('#toString',()=>{
        it('regular toString',()=>{
            let f = new Field(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.StringProperty`,
                name: 'field',
            });
            let stub = sinon.stub(f,'getFullyQualifiedTypeName');
            stub.returns('fqn');
            f.toString().should.equal('Field {name=field, type=fqn, array=false, optional=false}');
        });

    });


    describe('#getDefaultValue', () => {
        it('should return the default value for falsy defaults', () => {
            let f = new Field(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.BooleanProperty`,
                name: 'field',
                isOptional: false, // implicitly optional
                defaultValue: false
            });
            f.getDefaultValue().should.equal(false);
        });
    });

    describe('#validate', () => {
        let modelManager;

        beforeEach(() => {
            modelManager = new ModelManager();
        });

        it('should validate primitive field with valid default value', () => {
            modelManager.addCTOModel(`
            namespace t@1.0.0
            concept C {
              o String str default="hello"
              o Integer num default=42
              o Boolean flag default=true
            }
            `);
            const c = modelManager.getType('t@1.0.0.C');
            c.getProperty('str').getDefaultValue().should.equal('hello');
            c.getProperty('num').getDefaultValue().should.equal(42);
            c.getProperty('flag').getDefaultValue().should.equal(true);
        });

        it('should throw when an array property declares a default value (String[])', () => {
            (() => {
                modelManager.addCTOModel(`
                namespace t@1.0.0
                concept C {
                  o String[] names default="foo"
                }
                `);
            }).should.throw(IllegalModelException, /Array property 't@1.0.0.C.names' cannot declare a default value\./);
        });

        it('should throw when an array property declares a default value (Integer[])', () => {
            (() => {
                modelManager.addCTOModel(`
                namespace t@1.0.0
                concept C {
                  o Integer[] nums default=1
                }
                `);
            }).should.throw(IllegalModelException, /Array property 't@1.0.0.C.nums' cannot declare a default value\./);
        });

        it('should throw when an array property declares a default value (Boolean[])', () => {
            (() => {
                modelManager.addCTOModel(`
                namespace t@1.0.0
                concept C {
                  o Boolean[] flags default=true
                }
                `);
            }).should.throw(IllegalModelException, /Array property 't@1.0.0.C.flags' cannot declare a default value\./);
        });

        it('should throw when a concept-typed property declares a default value', () => {
            (() => {
                modelManager.addCTOModel(`
                namespace t@1.0.0
                concept Address {
                  o String street
                }
                concept Person {
                  o Address address default="foo"
                }
                `);
            }).should.throw(IllegalModelException, /Property 't@1.0.0.Person.address' of type 'Address' cannot declare a default value\. Default values are only supported for primitive and enum properties\./);
        });

        it('should throw when an asset-typed property declares a default value', () => {
            (() => {
                modelManager.addCTOModel(`
                namespace t@1.0.0
                asset Car identified by vin {
                  o String vin
                }
                concept Person {
                  o Car car default="foo"
                }
                `);
            }).should.throw(IllegalModelException, /Property 't@1.0.0.Person.car' of type 'Car' cannot declare a default value\. Default values are only supported for primitive and enum properties\./);
        });

        it('should throw when an imported concept-typed property declares a default value', () => {
            modelManager.addCTOModel(`
            namespace base@1.0.0
            concept Address {
              o String street
            }
            `);
            (() => {
                modelManager.addCTOModel(`
                namespace child@1.0.0
                import base@1.0.0.Address
                concept Person {
                  o Address address default="foo"
                }
                `);
            }).should.throw(IllegalModelException, /Property 'child@1.0.0.Person.address' of type 'Address' cannot declare a default value\. Default values are only supported for primitive and enum properties\./);
        });

        it('should validate an enum property with a valid default value', () => {
            modelManager.addCTOModel(`
            namespace t@1.0.0
            enum Status {
              o ACTIVE
              o INACTIVE
            }
            concept Person {
              o Status status default="ACTIVE"
            }
            `);
            const c = modelManager.getType('t@1.0.0.Person');
            c.getProperty('status').getDefaultValue().should.equal('ACTIVE');
        });

        it('should throw when an enum property declares an invalid default value', () => {
            (() => {
                modelManager.addCTOModel(`
                namespace t@1.0.0
                enum Status {
                  o ACTIVE
                  o INACTIVE
                }
                concept Person {
                  o Status status default="UNKNOWN"
                }
                `);
            }).should.throw(IllegalModelException, /Invalid default value 'UNKNOWN' for enum property 't@1.0.0.Person.status'\. Expected one of: ACTIVE, INACTIVE\./);
        });

        it('should throw when an imported enum property declares an invalid default value', () => {
            modelManager.addCTOModel(`
            namespace base@1.0.0
            enum Status {
              o ACTIVE
              o INACTIVE
            }
            `);
            (() => {
                modelManager.addCTOModel(`
                namespace child@1.0.0
                import base@1.0.0.Status
                concept Person {
                  o Status status default="INVALID"
                }
                `);
            }).should.throw(IllegalModelException, /Invalid default value 'INVALID' for enum property 'child@1.0.0.Person.status'\. Expected one of: ACTIVE, INACTIVE\./);
        });

        it('should throw when an enum array property declares a default value', () => {
            (() => {
                modelManager.addCTOModel(`
                namespace t@1.0.0
                enum Status {
                  o ACTIVE
                  o INACTIVE
                }
                concept Person {
                  o Status[] statuses default="ACTIVE"
                }
                `);
            }).should.throw(IllegalModelException, /Array property 't@1.0.0.Person.statuses' cannot declare a default value\./);
        });
    });

});
