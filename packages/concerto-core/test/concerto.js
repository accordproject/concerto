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

const chai = require('chai');
const expect = chai.expect;
// eslint-disable-next-line no-unused-vars
const should = chai.should();
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));

const ModelManager = require('../lib/modelmanager');
const Concerto = require('../index').Concerto;

describe('concerto', () => {

    let modelManager;

    beforeEach(() => {
        modelManager = new ModelManager();

        modelManager.addModelFile( `
namespace org.accordproject.test

participant Person identified by ssn {
    o String ssn
}

participant Customer extends Person {
    o String customerId
}

`, 'test.cto');
    });

    afterEach(() => {
    });

    describe('#getIdentifier', () => {

        it('should return the identifier', () => {
            const obj = {
                $class : 'org.accordproject.test.Person',
                ssn: '123456789',
                name: 'Dan Selman'
            };

            const ssn = Concerto.getIdentifier(obj, modelManager);
            ssn.should.equal('123456789');
        });
    });

    describe('#setIdentifier', () => {

        it('should set the identifier', () => {
            const obj = {
                $class : 'org.accordproject.test.Person',
                ssn: '123456789',
                name: 'Dan Selman'
            };

            Concerto.setIdentifier(obj, modelManager, 'abcdefg');
            obj.ssn.should.equal('abcdefg');
        });
    });

    describe('#getFullyQualifiedIdentifier', () => {

        it('should get the fully qualified identifier', () => {
            const obj = {
                $class : 'org.accordproject.test.Person',
                ssn: '123456789',
                name: 'Dan Selman'
            };

            const fgid = Concerto.getFullyQualifiedIdentifier(obj, modelManager);
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

            const uri = Concerto.toURI(obj, modelManager);
            uri.should.equal('resource:org.accordproject.test.Person#123456789');
        });
    });

    describe('#getType', () => {

        it('should get type', () => {
            const obj = {
                $class : 'org.accordproject.test.Person',
                ssn: '123456789',
                name: 'Dan Selman'
            };

            const type = Concerto.getType(obj, modelManager);
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

            const ns = Concerto.getNamespace(obj, modelManager);
            ns.should.equal('org.accordproject.test');
        });
    });

    describe('#instanceOf', () => {

        it('should get instanceOf for sub type', () => {
            const obj = {
                $class : 'org.accordproject.test.Customer',
                ssn: '123456789',
                customerId: '001',
                name: 'Dan Selman'
            };

            const result = Concerto.instanceOf(obj, modelManager, 'org.accordproject.test.Person');
            result.should.be.true;
        });

        it('should get instanceOf for type', () => {
            const obj = {
                $class : 'org.accordproject.test.Customer',
                ssn: '123456789',
                customerId: '001',
                name: 'Dan Selman'
            };

            const result = Concerto.instanceOf(obj, modelManager, 'org.accordproject.test.Customer');
            result.should.be.true;
        });

        it('should not get instanceOf for derived type', () => {
            const obj = {
                $class : 'org.accordproject.test.Person',
                ssn: '123456789'
            };

            const result = Concerto.instanceOf(obj, modelManager, 'org.accordproject.test.Customer');
            expect(result).to.be.false;
        });
    });

    describe('#validate', () => {

        it('should validate a valid obj', () => {
            const obj = {
                $class : 'org.accordproject.test.Customer',
                ssn: '123456789',
                customerId: '001',
            };

            Concerto.validate(obj, modelManager);
        });

        it('should fail an invalid obj', () => {
            const obj = {
                $class : 'org.accordproject.test.Customer',
                ssn: '123456789',
                name: 'Dan',
            };

            (() => {
                Concerto.validate(obj, modelManager);
            }).should.throw(/Instance 123456789 has a property named name which is not declared in org.accordproject.test.Customer/);
        });
    });
});
