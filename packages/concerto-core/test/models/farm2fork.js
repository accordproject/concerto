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

require('chai').should();
const ModelManager = require('../../lib/modelmanager');
const RelationshipDeclaration = require('../../lib/introspect/relationshipdeclaration');
const Util = require('../composer/composermodelutility');

const fs = require('fs');

describe('Farm2Fork Model', function() {
    describe('#getModelManagerFarm2Fork', function() {
        it('check parsing and model manager', function() {
            let modelManager = new ModelManager();
            Util.addComposerModel(modelManager);
            modelManager.should.not.be.null;

            // parse a model file from disk and add to the ModelManager
            let fileName = './test/data/model/composer.cto';
            let systemModel = fs.readFileSync(fileName, 'utf8');
            systemModel.should.not.be.null;
            modelManager.addCTOModel(systemModel,fileName);

            fileName = './test/data/model/farm2fork.cto';
            let file = fs.readFileSync(fileName, 'utf8');
            file.should.not.be.null;
            modelManager.addCTOModel(file,fileName);
            modelManager.getModelFiles().length.should.equal(3);
            let modelFile = modelManager.getModelFile('org.acme');
            modelFile.getNamespace().should.equal('org.acme');

            modelFile.getAssetDeclarations().length.should.equal(3);
            modelFile.getTransactionDeclarations().length.should.equal(11);

            // test the Animal Asset class
            let animal = modelFile.getAssetDeclaration('Animal');
            animal.should.not.be.null;
            animal.getIdentifierFieldName().should.equal('identifier');
            animal.getName().should.equal('Animal');
            animal.getProperties().length.should.equal(10);

            // validator, default
            let identifierField = animal.getProperty('identifier');
            (identifierField.getType() === 'String').should.be.true;
            identifierField.getName().should.equal('identifier');
            (identifierField.getDefaultValue() === null).should.be.true;
            identifierField.isOptional().should.be.false;

            // flockNumber type
            let flockNumberField = animal.getProperty('flockNumber');
            (flockNumberField.getType() === 'Integer').should.be.true;

            // array of participant
            let previousKeeperField = animal.getProperty('previousKeeper');
            previousKeeperField.getName().should.equal('previousKeeper');
            previousKeeperField.isArray().should.be.true;
            (previousKeeperField instanceof RelationshipDeclaration).should.be.true;
            previousKeeperField.getType().should.equal('MyParticipant');

            // test the VehicleTransferredToScrapMerchant class
            let txDecl = modelFile.getTransactionDeclaration('MoveAnimalToHolding');
            txDecl.should.not.be.null;
            txDecl.getName().should.equal('MoveAnimalToHolding');
            txDecl.getProperties().length.should.equal(3); // XXX Should have farmer, holding, $timestamp
            let holdingField = txDecl.getProperty('holding');
            (holdingField !== null).should.be.true;
            holdingField.getName().should.equal('holding');
            (holdingField.getType() === 'MyParticipant').should.be.true;

            // test that we can retrieve a field declared in a base class
            let animalField = txDecl.getProperty('animal');
            animalField.should.not.be.null;
            animalField.getType().should.equal('Animal');
            (animalField instanceof RelationshipDeclaration).should.be.true;
        });
    });
});
