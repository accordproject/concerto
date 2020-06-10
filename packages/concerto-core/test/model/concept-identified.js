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

const ModelManager = require('../../lib/modelmanager');
const Factory = require('../../lib/factory');
const Identifiable = require('../../lib/model/identifiable');
const chai = require('chai');
chai.should();
chai.use(require('chai-things'));

describe('Concept Identified', function () {

    let modelManager;
    let classDecl;
    before(function () {
        modelManager = new ModelManager();
        modelManager.addModelFile(`namespace org.accordproject
        concept Order identified {
            o Double ammount
        }`);
        classDecl = modelManager.getType('org.accordproject.Order');
    });

    beforeEach(function () {
    });

    afterEach(function () {
    });

    describe('#factory', function() {
        it('should be able to create with an id', function () {
            const factory = new Factory(modelManager);
            const order = factory.newResource('org.accordproject', 'Order', '123');
            order.getIdentifier().should.equal('123');
        });

        it('should be able to create a relationship to the type', function () {
            const factory = new Factory(modelManager);
            const order = factory.newRelationship('org.accordproject', 'Order', '123');
            order.getIdentifier().should.equal('123');
        });
    });


    describe('#toString', function() {
        it('should be able to call toString', function () {
            const id = new Identifiable(modelManager, classDecl, 'org.accordproject', 'Order', '123' );
            id.toString().should.equal('Identifiable {id=org.accordproject.Order#123}');
        });
    });

    describe('#setIdentifier', () => {
        it('should be able to set identifier', function () {
            let id = new Identifiable(modelManager, modelManager.getType('org.accordproject.Order'), 'org.accordproject', 'Order', '123' );
            id.setIdentifier('321');
            id.getIdentifier().should.equal('321');
        });
    });
});
