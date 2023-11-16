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

const ModelManager = require('../../dist/modelmanager');
const Factory = require('../../dist/factory');
const Identifiable = require('../../dist/model/identifiable');

const dayjs = require('dayjs');
const chai = require('chai');
const should = chai.should();
chai.use(require('chai-things'));

describe('Concept Identifiers', function () {

    let modelManager;
    let classDecl;
    before(function () {
        modelManager = new ModelManager();
        modelManager.addCTOModel(`namespace org.accordproject@1.0.0
        concept Address {
            o String country
        }
        concept Product identified by sku {
            o String sku
        }
        concept Order identified {
            o Double ammount
            o Address address
            --> Product product
        }
        transaction Request {}
        event Event {}
        `, 'test.cto');
        classDecl = modelManager.getType('org.accordproject@1.0.0.Order');
    });

    beforeEach(function () {
    });

    afterEach(function () {
    });

    describe('#modelManager', function() {
        it('should not parse a model with a relationship to a concept without an identifier', function () {
            const temp = new ModelManager();
            (function () {
                temp.addCTOModel(`namespace org.accordproject@1.0.0
                concept Address {
                    o String country
                }
                concept Order identified {
                    --> Address address
                }`, 'invalid.cto');
            }).should.throw(/Relationship address must be to a class that has an identifier, but this is to org.accordproject@1.0.0.Address/);
        });
    });

    describe('#factory', function() {
        it('should be able to create a relationship to a concept with an id', function () {
            const factory = new Factory(modelManager);
            const order = factory.newRelationship('org.accordproject@1.0.0', 'Order', '123');
            order.getIdentifier().should.equal('123');
        });

        it('should not be able to create a relationship to a concept without an id', function () {
            const factory = new Factory(modelManager);
            (function () {
                factory.newRelationship('org.accordproject@1.0.0', 'Address', '123');
            }).should.throw(/Cannot create a relationship to org.accordproject@1.0.0.Address, it is not identifiable./);
        });

    });


    describe('#toString', function() {
        it('should be able to call toString', function () {
            const id = new Identifiable(modelManager, classDecl, 'org.accordproject@1.0.0', 'Order', '123' );
            id.toString().should.equal('Identifiable {id=org.accordproject@1.0.0.Order#123}');
        });
    });

    describe('#getTimestamp', function() {
        it('should be able to call getTimestamp', function () {
            const factory = new Factory(modelManager);
            const txn = factory.newResource('org.accordproject@1.0.0', 'Request');
            dayjs(txn.getTimestamp()).isValid().should.be.true;

            const event = factory.newResource('org.accordproject@1.0.0', 'Event');
            dayjs(event.getTimestamp()).isValid().should.be.true;
        });

        it('should be able to call getTimestamp for an identifiable without a $timestamp property', function () {
            const id = new Identifiable(modelManager, classDecl, 'org.accordproject@1.0.0', 'Order', '123' );
            should.equal(id.getTimestamp(), undefined);
        });
    });

    describe('#setIdentifier', () => {
        it('should be able to set system identifier', function () {
            const factory = new Factory(modelManager);
            const order = factory.newResource('org.accordproject@1.0.0', 'Order', '123');
            order.getIdentifier().should.equal('123');
            order.$identifier.should.equal('123');
            order.setIdentifier('321');
            order.$identifier.should.equal('321');
            order.$identifier = 'ABC';
            order.getIdentifier().should.equal('ABC');
        });

        it('should be able to set explicit identifier', function () {
            const factory = new Factory(modelManager);
            const product = factory.newResource('org.accordproject@1.0.0', 'Product', '123');
            product.getIdentifier().should.equal('123');
            product.sku.should.equal('123');
            product.setIdentifier('321');
            product.sku.should.equal('321');
        });
    });
});
