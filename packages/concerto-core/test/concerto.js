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

const fs = require('fs');
const chai = require('chai');

// eslint-disable-next-line no-unused-vars
const should = chai.should();
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));

const ModelManager = require('../lib/modelmanager');
const Concerto = require('../lib/concerto');

describe('concerto', () => {

    let concertoModel = fs.readFileSync('./test/data/model/concerto.cto', 'utf8');
    let concerto;

    beforeEach(() => {
        const modelManager = new ModelManager();
        modelManager.addModelFile( concertoModel, 'test.cto');
        concerto = new Concerto(modelManager);
    });

    afterEach(() => {
    });

    describe('#isIdentifiable', () => {

        it('should return the identifier', () => {
            const obj = {
                $class : 'org.accordproject.test.Person',
                ssn: '123456789',
                name: 'Dan Selman'
            };

            concerto.isIdentifiable(obj).should.be.true;
        });

        it('should not return the identifier', () => {
            const obj = {
                $class : 'org.accordproject.test.Product',
                sku: '001',
                description: 'Widgets'
            };

            concerto.isIdentifiable(obj).should.be.false;
        });

    });

    describe('#getIdentifier', () => {

        it('should return the identifier', () => {
            const obj = {
                $class : 'org.accordproject.test.Person',
                ssn: '123456789',
                name: 'Dan Selman'
            };

            const ssn = concerto.getIdentifier(obj);
            ssn.should.equal('123456789');
        });

        it('should not return the identifier', () => {
            const obj = {
                $class : 'org.accordproject.test.Product',
                sku: '001',
                description: 'Widgets'
            };

            (() => {
                concerto.getIdentifier(obj);
            }).should.throw(/Object does not have an identifier/);
        });

    });

    describe('#setIdentifier', () => {

        it('should set the identifier', () => {
            const obj = {
                $class : 'org.accordproject.test.Person',
                ssn: '123456789',
                name: 'Dan Selman'
            };

            const clone = concerto.setIdentifier(obj, 'abcdefg');
            clone.ssn.should.equal('abcdefg');
        });
    });

    describe('#getFullyQualifiedIdentifier', () => {

        it('should get the fully qualified identifier', () => {
            const obj = {
                $class : 'org.accordproject.test.Person',
                ssn: '123456789',
                name: 'Dan Selman'
            };

            const fgid = concerto.getFullyQualifiedIdentifier(obj);
            fgid.should.equal('org.accordproject.test.Person#123456789');
        });
    });

    describe('#toURI', () => {

        it('should get a URI', () => {
            const obj = {
                $class : 'org.accordproject.test.Person',
                ssn: '123456789',
                name: 'Dan Selman'
            };

            const uri = concerto.toURI(obj);
            uri.should.equal('resource:org.accordproject.test.Person#123456789');
        });
    });

    describe('#fromURI', () => {

        it('should be able to roundtrip toURI and fromURI', () => {
            const obj = {
                $class : 'org.accordproject.test.Person',
                ssn: '123456789',
                name: 'Dan Selman'
            };

            const uri = concerto.toURI(obj);
            const result = concerto.fromURI(uri);
            result.typeDeclaration.getName().should.equal('Person');
            result.id.should.equal('123456789');
        });
    });

    describe('#getTypeDeclaration', () => {

        it('should get type declaration', () => {
            const obj = {
                $class : 'org.accordproject.test.Person',
                ssn: '123456789',
                name: 'Dan Selman'
            };

            const type = concerto.getTypeDeclaration(obj);
            type.getName().should.equal('Person');
        });

        it('should fail to get type declaration is $class missing', () => {
            const obj = {
                ssn: '123456789',
                name: 'Dan Selman'
            };

            (() => {
                concerto.getTypeDeclaration(obj);
            }).should.throw(/Input object does not have a \$class attribute./);
        });

        it('should fail to get type declaration is $class in invalid', () => {
            const obj = {
                $class: 'Foo',
                ssn: '123456789',
                name: 'Dan Selman'
            };

            (() => {
                concerto.getTypeDeclaration(obj);
            }).should.throw(/Namespace is not defined for type "Foo"./);
        });
    });

    describe('#isRelationship', () => {

        it('should identify a relationship', () => {
            concerto.isRelationship('resource:org.accordproject.test.Person#001').should.be.true;
        });

        it('should not identify a relationship with wrong scheme', () => {
            concerto.isRelationship('foo:org.accordproject.test.Person#001').should.be.false;
        });

        it('should not identify a relationship with wrong type', () => {
            concerto.isRelationship(false).should.be.false;
        });
    });

    describe('#getType', () => {

        it('should get type', () => {
            const obj = {
                $class : 'org.accordproject.test.Person',
                ssn: '123456789',
                name: 'Dan Selman'
            };

            const type = concerto.getType(obj);
            type.should.equal('Person');
        });
    });

    describe('#getNamespace', () => {

        it('should get namespace', () => {
            const obj = {
                $class : 'org.accordproject.test.Person',
                ssn: '123456789',
                name: 'Dan Selman'
            };

            const ns = concerto.getNamespace(obj);
            ns.should.equal('org.accordproject.test');
        });
    });

    describe('#validate', () => {

        it('should validate data that conforms to model', () => {
            const obj = {
                $class : 'org.accordproject.test.Customer',
                ssn: '123456789',
                customerId: '001',
                department: 'ENGINEERING'
            };

            concerto.validate(obj);
        });

        it('should validate data that conforms to model (types)', () => {
            const obj = {
                $class : 'org.accordproject.test.TestAsset',
                id: '001',
                types: {
                    $class : 'org.accordproject.test.Types',
                    stringValue: 'a',
                    stringArrayValue : ['a', 'b', 'c'],
                    longValue: 1,
                    integerValue: 10,
                    doubleValue: 5.0,
                    booleanValue: true,
                    departmentValue : 'ENGINEERING',
                    departmentArrayValue : ['ENGINEERING', 'HR'],
                    relationshipValue: 'resource:org.accordproject.test.Person#ABC',
                    relationshipArrayValue: ['resource:org.accordproject.test.Person#ABC', 'resource:org.accordproject.test.Person#DEF'],
                    dateTimeValue: '2020-03-31',
                    conceptValue : {
                        $class : 'org.accordproject.test.Product',
                        sku: 'abc',
                        description: 'widget'
                    }
                }
            };

            concerto.validate(obj);
        });

        it('should fail with extra property', () => {
            const obj = {
                $class : 'org.accordproject.test.Customer',
                ssn: '123456789',
                name: 'Dan',
                department: 'ENGINEERING'
            };

            (() => {
                concerto.validate(obj);
            }).should.throw(/Instance "123456789" has a property named "name", which is not declared in "org.accordproject.test.Customer"./);
        });

        it('should fail with extra property (concept)', () => {
            const obj = {
                $class : 'org.accordproject.test.Product',
                sku: '001',
                description: 'Widget',
                price: 100
            };

            (() => {
                concerto.validate(obj);
            }).should.throw(/Instance "undefined" has a property named "price", which is not declared in "org.accordproject.test.Product"./);
        });

        it('should fail with invalid enum', () => {
            const obj = {
                $class : 'org.accordproject.test.Customer',
                ssn: '123456789',
                department: 'FOO',
                customerId: 'A'
            };

            (() => {
                concerto.validate(obj);
            }).should.throw(/Model violation in the "org.accordproject.test.Customer#123456789" instance. Invalid enum value of "FOO" for the field "Department"./);
        });

        it('should fail with empty identifier', () => {
            const obj = {
                $class : 'org.accordproject.test.Customer',
                ssn: '',
                department: 'HR',
                customerId: 'A'
            };

            (() => {
                concerto.validate(obj);
            }).should.throw(/Instance "org.accordproject.test.Customer#" has an empty identifier./);
        });

        it('should fail with missing required property', () => {
            const obj = {
                $class : 'org.accordproject.test.Customer',
                ssn: '001',
                customerId: 'A'
            };

            (() => {
                concerto.validate(obj);
            }).should.throw(/The instance "org.accordproject.test.Customer#001" is missing the required field "department"./);
        });

        it('should fail with string used for string[]', () => {
            const obj = {
                $class : 'org.accordproject.test.Employee',
                ssn: '001',
                department: 'ENGINEERING',
                pets: 'cat'
            };

            (() => {
                concerto.validate(obj);
            }).should.throw(/Model violation in the "org.accordproject.test.Employee#001" instance. The field "pets" has a value of ""cat"" \(type of value: "string"\). Expected type of value: "String\[\]"./);
        });

        it('should fail with abstract type', () => {
            const obj = {
                $class : 'org.accordproject.test.Person',
                ssn: '123456789',
                department: 'ENGINEERING',
            };

            (() => {
                concerto.validate(obj);
            }).should.throw(/The class "org.accordproject.test.Person" is abstract and should not contain an instance./);
        });

    });
});
