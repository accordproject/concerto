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
const Resource = require('../../lib/model/resource');
const Serializer = require('../../lib/serializer');
const Factory = require('../../lib/factory');
const Util = require('../composer/composermodelutility');

const fs = require('fs');

const chai = require('chai');
chai.should();
chai.use(require('chai-things'));

describe('Concept', function () {

    const levelOneModel = `namespace org.acme.l1
  concept Person {
    o String name
  }
  asset Car identified by vin {
    o String vin
    o Person owner
  }
  `;

    let modelManager = null;
    let classDecl = null;

    before(function () {
        modelManager = new ModelManager();
        Util.addComposerModel(modelManager);
    });

    beforeEach(function () {
        modelManager.addCTOModel(levelOneModel);
        classDecl = modelManager.getType('org.acme.l1.Person');
    });

    afterEach(function () {
        modelManager.clearModelFiles();
    });

    describe('#getClassDeclaration', function() {
        it('should return the class declaraction', function () {
            const resource = new Resource(modelManager, classDecl, 'org.acme.l1', 'Person' );
            resource.getClassDeclaration().should.equal(classDecl);
        });
    });

    describe('#toJSON', () => {
        it('should call default toJSON', function () {
            const resource = new Resource(modelManager, classDecl, 'org.acme.l1', 'Person', 'AAAA');
            resource.name = 'Dan';
            resource.toJSON().should.not.be.null;
        });

        it('should generate JSON for an asset that contains a concept', function () {
            let conceptModel = fs.readFileSync('./test/data/model/concept.cto', 'utf8');
            modelManager.addCTOModel(conceptModel, 'concept.cto');
            const factory = new Factory(modelManager);
            const asset = factory.newResource('org.acme.biznet', 'MakerInventory', '123' );
            const inventorySets = factory.newConcept('org.acme.biznet', 'InventorySets' );
            inventorySets.Make = 'Make';
            inventorySets.Model = 'Model';
            inventorySets.invCount = 10;
            inventorySets.invType = 'NEWBATCH';
            asset.invSets = [inventorySets];
            const serializer = new Serializer(factory, modelManager);
            const obj = serializer.toJSON(asset);
            JSON.stringify(obj).should.equal('{"$class":"org.acme.biznet.MakerInventory","makerId":"123","invSets":[{"$class":"org.acme.biznet.InventorySets","Make":"Make","Model":"Model","invCount":10,"invType":"NEWBATCH"}],"$identifier":"123"}');
        });

        it('should generate JSON for an asset that contains a concept', function () {
            let conceptModel = fs.readFileSync('./test/data/model/concept2.cto', 'utf8');
            modelManager.addCTOModel(conceptModel, 'concept2.cto');
            const factory = new Factory(modelManager);
            const options = {'generate': 'true'};
            const asset = factory.newResource('ibm.procurement.contingentLabor', 'POContractorRecord', '123', options );
            const serializer = new Serializer(factory, modelManager);
            serializer.toJSON(asset);
        });
    });

    describe('#fromJSON', () => {
        it('should generate an asset from JSON that contains a concept', function () {
            let conceptModel = fs.readFileSync('./test/data/model/concept.cto', 'utf8');
            modelManager.addCTOModel(conceptModel, 'concept.cto');
            const factory = new Factory(modelManager);
            const serializer = new Serializer(factory, modelManager);
            const jsObject = JSON.parse('{"$class":"org.acme.biznet.MakerInventory","makerId":"123","invSets":[{"$class":"org.acme.biznet.InventorySets","Make":"Make","Model":"Model","invCount":10,"invType":"NEWBATCH"}]}');
            const obj = serializer.fromJSON(jsObject);
            obj.getIdentifier().should.equal('123');
        });

        it('should generate a concept from JSON', function () {
            let conceptModel = fs.readFileSync('./test/data/model/concept.cto', 'utf8');
            modelManager.addCTOModel(conceptModel, 'concept.cto');
            const factory = new Factory(modelManager);
            const serializer = new Serializer(factory, modelManager);
            const jsObject = JSON.parse('{"$class":"org.acme.biznet.InventorySets","Make":"Make","Model":"Model","invCount":10,"invType":"NEWBATCH"}');
            const obj = serializer.fromJSON(jsObject);
            obj.isConcept().should.be.true;
        });

        it('should generate an error trying to create an ENUM from JSON', function () {
            let conceptModel = fs.readFileSync('./test/data/model/concept.cto', 'utf8');
            modelManager.addCTOModel(conceptModel, 'concept.cto');
            const factory = new Factory(modelManager);
            const serializer = new Serializer(factory, modelManager);
            const jsObject = JSON.parse('{"$class":"org.acme.biznet.assetStatus"}');
            (function () {
                serializer.fromJSON(jsObject);
            }).should.throw(/Attempting to create an ENUM declaration is not supported./);
        });

        it.only('should generate an error trying to create an Map from JSON', function () {
            let conceptModel = fs.readFileSync('./test/data/model/concept.cto', 'utf8');
            modelManager.addCTOModel(conceptModel, 'concept.cto');
            const factory = new Factory(modelManager);
            const serializer = new Serializer(factory, modelManager);
            const jsObject = JSON.parse('{"$class":"org.acme.biznet.Dictionary"}');
            (function () {
                serializer.fromJSON(jsObject);
            }).should.throw(/Attempting to create an Map declaration is not supported./);
        });

    });

    describe('#isConcept', () => {
        it('should be true', () => {
            const resource = new Resource(modelManager, classDecl, 'org.acme.l1', 'Person');
            resource.isConcept().should.be.true;
        });
    });
});
