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

const Factory = require('../../src/factory');
const ModelManager = require('../../src/modelmanager');
const RelationshipDeclaration = require('../../src/introspect/relationshipdeclaration');
const Serializer = require('../../src/serializer');
const TypeNotFoundException = require('../../src/typenotfoundexception');
const fs = require('fs');
const Util = require('../composer/composermodelutility');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

require('chai').should();

describe('Test Model', function(){

    describe('#setPropertyValue', function() {
        it('check setPropertyValue validates input', function() {

            // create and populate the ModelManager with a model file
            let modelManager = new ModelManager();
            Util.addComposerModel(modelManager);
            modelManager.should.not.be.null;
            modelManager.clearModelFiles();

            let fileName = './test/data/model/composer.cto';
            let systemModel = fs.readFileSync(fileName, 'utf8');
            systemModel.should.not.be.null;
            modelManager.addCTOModel(systemModel,fileName);

            fileName = './test/data/model/carlease.cto';
            let file = fs.readFileSync(fileName, 'utf8');
            file.should.not.be.null;
            modelManager.addCTOModel(file,fileName);

            // create a factory
            let factory = new Factory(modelManager);

            // create a new instance
            let cObject = factory.newResource(
                'org.acme@1.0.0', 'Vehicle', 'YVBVLSFXXAL342374' );

            // model is defined as a string
            // set model to a number
            cObject.setPropertyValue('model', 'CAPRI');
            cObject.model.should.equal('CAPRI');

            // now try some invalid values
            ( function() {cObject.setPropertyValue('model', 1);}).should.throw('Model violation in the "org.acme@1.0.0.Vehicle#YVBVLSFXXAL342374" instance. The field "model" has a value of "1" (type of value: "number"). Expected type of value: "String".');
            ( function() {cObject.setPropertyValue('model', true);}).should.throw('Model violation in the "org.acme@1.0.0.Vehicle#YVBVLSFXXAL342374" instance. The field "model" has a value of "true" (type of value: "boolean"). Expected type of value: "String".');
            ( function() {cObject.setPropertyValue('model', dayjs.utc());}).should.throw(/.+Expected type of value: "String"./);
            ( function() {cObject.setPropertyValue('model', [1,2,3]);}).should.throw('Model violation in the "org.acme@1.0.0.Vehicle#YVBVLSFXXAL342374" instance. The field "model" has a value of "[1,2,3]" (type of value: "object"). Expected type of value: "String".');
        });
    });

    describe('#serialize', function() {
        it('check that objects can be marshalled to/from JSON', function() {

            // create and populate the ModelManager with a model file
            let modelManager = new ModelManager();
            Util.addComposerModel(modelManager);
            modelManager.should.not.be.null;
            modelManager.clearModelFiles();

            let fileName = './test/data/model/composer.cto';
            let systemModel = fs.readFileSync(fileName, 'utf8');
            systemModel.should.not.be.null;
            modelManager.addCTOModel(systemModel,fileName);

            fileName = './test/data/model/carlease.cto';
            let file = fs.readFileSync(fileName, 'utf8');
            file.should.not.be.null;
            modelManager.addCTOModel(file,fileName);

            let modelFile = modelManager.getModelFile('org.acme@1.0.0');
            modelFile.getNamespace().should.equal('org.acme@1.0.0');

            // declare an asset registry
            let factory = new Factory(modelManager);

            // create a new instance
            let cObject =  factory.newResource(
                'org.acme@1.0.0', 'Vehicle', 'AAAAAAAAXBB123456' );

            const customer = factory.newConcept('org.acme@1.0.0', 'Customer');
            customer.firstName = 'Dan';
            customer.lastName = 'Selman';
            customer.address = factory.newConcept('org.acme@1.0.0', 'Address');
            cObject.customer = customer;

            cObject.make = 'Renault';

            // vin is the identifying field for Vehicles, so should have been
            // set during object creation
            cObject.vin.should.equal('AAAAAAAAXBB123456');

            // set all the required fields
            cObject.integerArray = [1,2,3];
            cObject.state = 'CREATED';
            cObject.value = 123.45;
            cObject.colour = 'Red';
            cObject.V5cID = 'AB1234567';
            cObject.LeaseContractID = 'foo';
            cObject.scrapped = false;
            cObject.owner = factory.newRelationship(
                'composer@1.0.0', 'MyParticipant', 'CUST_1');
            cObject.previousOwners = null;
            // serialize the instance to JSON using a Serializer
            let serializer = new Serializer(factory, modelManager);
            serializer.should.not.be.null;
            cObject.should.not.be.null;
            let jsonText = serializer.toJSON(cObject);
            jsonText.should.not.be.null;

            // now deserialize and check the round-trip worked
            let cObject2 = serializer.fromJSON(jsonText);
            cObject.getNamespace().should.equal(cObject2.getNamespace());
            cObject.getType().should.equal(cObject2.getType());
            cObject.getIdentifier().should.equal(cObject2.getIdentifier());
            cObject2.make.should.equal('Renault');
        });
    });

    describe('#validateClass', function() {
        it('check that instances are validated against the model when serialized', function() {

            // create and populate the ModelManager with a model file
            let modelManager = new ModelManager();
            Util.addComposerModel(modelManager);
            modelManager.should.not.be.null;
            modelManager.clearModelFiles();

            let fileName = './test/data/model/composer.cto';
            let systemModel = fs.readFileSync(fileName, 'utf8');
            systemModel.should.not.be.null;
            modelManager.addCTOModel(systemModel,fileName);

            fileName = './test/data/model/carlease.cto';
            let file = fs.readFileSync(fileName, 'utf8');
            file.should.not.be.null;
            modelManager.addCTOModel(file,fileName);

            let modelFile = modelManager.getModelFile('org.acme@1.0.0');
            modelFile.getNamespace().should.equal('org.acme@1.0.0');

            // create a new instance
            let factory = new Factory(modelManager);
            let cObject =  factory.newResource(
                'org.acme@1.0.0', 'Vehicle', 'YVBVLSFXXAL342374' );

            // vin is the identifying field for Vehicles, so should have been
            // set during object creation
            cObject.vin.should.equal('YVBVLSFXXAL342374');
            cObject.getFullyQualifiedIdentifier().should.equal('org.acme@1.0.0.Vehicle#YVBVLSFXXAL342374');

            cObject.make = 'Renault';

            // serialize the instance to JSON using a Serializer
            let serializer = new Serializer(factory, modelManager);
            serializer.should.not.be.null;
            cObject.should.not.be.null;

            cObject.lastUpdate = dayjs.utc();
            cObject.year = 2014;
            cObject.integerArray = [1,2,3];
            cObject.state = 'REGISTERED';
            cObject.value = 123.45;
            cObject.colour = 'Red';
            cObject.V5cID = 'AS1234567';
            cObject.LeaseContractID = 'foo';
            cObject.scrapped = false;
            cObject.owner = factory.newRelationship(
                'composer@1.0.0', 'MyParticipant', 'CUST_1');
            cObject.previousOwners = null;

            const customer = factory.newConcept('org.acme@1.0.0', 'Customer');
            customer.firstName = 'Dan';
            customer.lastName = 'Selman';
            customer.address = factory.newConcept('org.acme@1.0.0', 'Address');
            cObject.customer = customer;

            // model is defined as a string
            // set model to a number
            cObject.model = 1;
            ( function() {serializer.toJSON(cObject);}).should.throw('Model violation in the "org.acme@1.0.0.Vehicle#YVBVLSFXXAL342374" instance. The field "model" has a value of "1" (type of value: "number"). Expected type of value: "String".');

            // set model to a double
            cObject.model = 42.05;
            ( function() {serializer.toJSON(cObject);}).should.throw('Model violation in the "org.acme@1.0.0.Vehicle#YVBVLSFXXAL342374" instance. The field "model" has a value of "42.05" (type of value: "number"). Expected type of value: "String".');

            // set model to a Boolean
            cObject.model = true;
            ( function() {serializer.toJSON(cObject);}).should.throw('Model violation in the "org.acme@1.0.0.Vehicle#YVBVLSFXXAL342374" instance. The field "model" has a value of "true" (type of value: "boolean"). Expected type of value: "String".');

            // set model to a DateTime
            cObject.model = dayjs.utc();
            ( function() {serializer.toJSON(cObject);}).should.throw(/Expected type of value: "String"./);

            // set model to an object
            cObject.model = { 'foo' : 'bar' };
            ( function() {serializer.toJSON(cObject);}).should.throw('Model violation in the "org.acme@1.0.0.Vehicle#YVBVLSFXXAL342374" instance. The field "model" has a value of "{"foo":"bar"}" (type of value: "object"). Expected type of value: "String".');

            // set model to an array
            cObject.model = ['1','2'];
            ( function() {serializer.toJSON(cObject);}).should.throw('Model violation in the "org.acme@1.0.0.Vehicle#YVBVLSFXXAL342374" instance. The field "model" has a value of "["1","2"]" (type of value: "object"). Expected type of value: "String".');

            // set model to a function
            cObject.model = function() {throw new Error('OOps');};
            ( function() {serializer.toJSON(cObject);}).should.throw('Model violation in the "org.acme@1.0.0.Vehicle#YVBVLSFXXAL342374" instance. The field "model" has a value of "undefined" (type of value: "function"). Expected type of value: "String".');
        });
    });


    describe('#getModelManager', function() {
        it('check parsing and model manager', function() {
            let modelManager = new ModelManager();
            Util.addComposerModel(modelManager);
            modelManager.should.not.be.null;

            let fileName1 = './test/data/model/composer.cto';
            let systemModel = fs.readFileSync(fileName1, 'utf8');
            systemModel.should.not.be.null;
            modelManager.addCTOModel(systemModel,fileName1);

            let fileName2 = './test/data/model/carlease.cto';
            let file = fs.readFileSync(fileName2, 'utf8');
            file.should.not.be.null;
            modelManager.addCTOModel(file,fileName2);

            let modelFile = modelManager.getModelFile('org.acme@1.0.0');
            modelFile.getNamespace().should.equal('org.acme@1.0.0');

            // check the clear
            modelManager.clearModelFiles();
            modelManager.getModelFiles().length.should.equal(0);
            // the system model will remain hence 1.

            // re-add
            modelManager.addCTOModel(systemModel);
            modelManager.addCTOModel(file);

            // getType
            let vehicleDecl = modelManager.getType('org.acme@1.0.0.Vehicle');
            vehicleDecl.should.not.be.null;
            vehicleDecl.getFullyQualifiedName().should.equal('org.acme@1.0.0.Vehicle');
            (() => { modelManager.getType('String'); }).should.throw(TypeNotFoundException);
            modelManager.getType('org.acme@1.0.0.Base').getFullyQualifiedName().should.equal('org.acme@1.0.0.Base');
            modelManager.getType('composer@1.0.0.MyParticipant').getName().should.equal('MyParticipant');

            modelFile.getAssetDeclarations().length.should.equal(2);
            modelFile.getTransactionDeclarations().length.should.equal(8);

            // test the Vehicle Asset class
            let vehicle = modelFile.getAssetDeclaration('Vehicle');
            vehicle.getIdentifierFieldName().should.equal('vin');
            vehicle.getName().should.equal('Vehicle');
            vehicle.getProperties().length.should.equal(17); // 15 from Vehicle, and 1 from Base, and one from $identifier

            // validator, default
            let vinField = vehicle.getProperty('vin');
            (vinField.getType() === 'String').should.be.true;
            vinField.getName().should.equal('vin');
            (vinField.getValidator() === null).should.be.false;
            (vinField.getDefaultValue() === null).should.be.true;
            vinField.isOptional().should.be.false;
            vinField.getValidator().should.not.be.null;

            // array of primitives
            let integerArrayField = vehicle.getProperty('integerArray');
            (integerArrayField.getType() === 'Integer').should.be.true;
            integerArrayField.getName().should.equal('integerArray');
            integerArrayField.isArray().should.be.true;

            // default value
            let makeField = vehicle.getProperty('make');
            makeField.getDefaultValue().should.equal('FORD');

            // optional field
            let lastUpdateField = vehicle.getProperty('lastUpdate');
            lastUpdateField.isOptional().should.be.true;

            // Nary relationship
            let previousOwnersField = vehicle.getProperty('previousOwners');
            previousOwnersField.isArray().should.be.true;
            (previousOwnersField instanceof RelationshipDeclaration).should.be.true;
            previousOwnersField.getType().should.equal('MyParticipant');

            // test the VehicleTransferredToScrapMerchant class
            let txDecl = modelFile.getTransactionDeclaration('VehicleTransferredToScrapMerchant');
            txDecl.should.not.be.null;
            txDecl.getName().should.equal('VehicleTransferredToScrapMerchant');
            txDecl.getProperties().length.should.equal(3); // Should have 3: scarpMerchant, vehicle, $timestamp
            let scrapMerchantField = txDecl.getProperty('scrapMerchant');
            (scrapMerchantField !== null).should.be.true;
            scrapMerchantField.getName().should.equal('scrapMerchant');
            (scrapMerchantField.getType() === 'MyParticipant').should.be.true;

            // test that we can retrieve a field declared in a base class
            let vehicleField = txDecl.getProperty('vehicle');
            vehicleField.should.not.be.null;
            vehicleField.getType().should.equal('Vehicle');
            (vehicleField instanceof RelationshipDeclaration).should.be.true;
        });
    });

    describe('#ModelFile.isImportedType', function() {
        it('check that imported types are identified', function() {

            // create and populate the ModelManager with a model file
            let modelManager = new ModelManager();
            Util.addComposerModel(modelManager);

            let fileName = './test/data/model/composer.cto';
            let systemModel = fs.readFileSync(fileName, 'utf8');
            systemModel.should.not.be.null;
            modelManager.addCTOModel(systemModel,fileName);

            fileName = './test/data/model/carlease.cto';
            let file = fs.readFileSync(fileName, 'utf8');
            file.should.not.be.null;
            modelManager.addCTOModel(file,fileName);

            let modelFile = modelManager.getModelFile('org.acme@1.0.0');
            modelFile.isLocalType('MyParticipant').should.equal(false);
            modelFile.isImportedType('MyParticipant').should.equal(true);
            let imprts = modelFile.getImports().filter((element) => {
                const split = element.split('.');
                split.pop();
                const importNamespace = split.join('.');
                return modelManager.getModelFile(importNamespace);
            });
            imprts.length.should.equal(6); // XXX Now includes all concerto.* classes
            modelFile.getImports().includes('composer@1.0.0.MyParticipant').should.equal(true);
        });
    });

    describe('#imports', function() {
        it('check that dependencies of imported types are resolved correctly', function() {

            // create and populate the ModelManager with a model file
            let modelManager = new ModelManager();
            Util.addComposerModel(modelManager);

            let fileName = './test/data/model/dependencies/base/base.cto';
            let baseModel = fs.readFileSync(fileName, 'utf8');
            baseModel.should.not.be.null;
            modelManager.addCTOModel(baseModel,fileName);

            fileName = './test/data/model/dependencies/business/business.cto';
            let businessModel = fs.readFileSync(fileName, 'utf8');
            businessModel.should.not.be.null;
            modelManager.addCTOModel(businessModel,fileName);

            fileName = './test/data/model/dependencies/contract/proforma.cto';
            let proformaModel = fs.readFileSync(fileName, 'utf8');
            proformaModel.should.not.be.null;
            modelManager.addCTOModel(proformaModel,fileName);

            fileName = './test/data/model/dependencies/contract/contract.cto';
            let contractModel = fs.readFileSync(fileName, 'utf8');
            contractModel.should.not.be.null;
            modelManager.addCTOModel(contractModel,fileName);

            let modelFile = modelManager.getModelFile('stdlib.business@1.0.0');
            modelFile.isLocalType('Business').should.equal(true);
            modelFile.isImportedType('Person').should.equal(true);
            modelFile.isImportedType('SSN').should.equal(true);
            let imprts = modelFile.getImports().filter( (element) => {
                const split = element.split('.');
                split.pop();
                const importNamespace = split.join('.');
                return modelManager.getModelFile(importNamespace);
            });
            imprts.length.should.equal(8); // XXX Now includes all concerto.* classes
        });
    });
});
