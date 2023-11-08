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

const Factory = require('../../../lib/factory');
const ModelManager = require('../../../lib/modelmanager');
const Serializer = require('../../../lib/serializer');
const fs = require('fs');
const Util = require('../../composer/composermodelutility');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

let chai = require('chai');
chai.should();
const sinon = require('sinon');

describe('Test generating deduplicated JSON for complex models', () => {

    let modelManager;
    let factory;
    let sandbox;
    let serializer;

    before(() => {
        modelManager = new ModelManager();
        Util.addComposerModel(modelManager);

        const base = fs.readFileSync('./test/serializer/complex/vehicle-lifecycle/base.cto', 'utf8');
        const business = fs.readFileSync('./test/serializer/complex/vehicle-lifecycle/business.cto', 'utf8');
        const vl = fs.readFileSync('./test/serializer/complex/vehicle-lifecycle/vehicle.cto', 'utf8');
        const odm = fs.readFileSync('./test/serializer/complex/vehicle-lifecycle/odm.cto', 'utf8');
        const manufacturer = fs.readFileSync('./test/serializer/complex/vehicle-lifecycle/manufacturer.cto', 'utf8');
        const dvla = fs.readFileSync('./test/serializer/complex/vehicle-lifecycle/vda.cto', 'utf8');

        modelManager.addModelFiles([base,business,vl,manufacturer,dvla,odm]);
        factory = new Factory(modelManager);
        serializer = new Serializer(factory, modelManager);
    });

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#convertToJSON', () => {

        it('should generate deduplicated JSON for a complex model', () => {

            const wrapper = factory.newResource( 'org.acme.vehicle.lifecycle@1.0.0', 'TransactionWrapper', 'dummy');
            wrapper.transaction = factory.newTransaction('org.vda@1.0.0', 'PrivateVehicleTransfer', '111');
            wrapper.transaction.seller = factory.newResource('composer.base@1.0.0', 'Person', 'dan');
            wrapper.transaction.seller.firstName = 'Dan';
            wrapper.transaction.seller.lastName = 'Selman';
            wrapper.transaction.seller.gender = 'MALE';
            wrapper.transaction.seller.nationalities = ['French', 'UK'];
            wrapper.transaction.seller.contactDetails = factory.newConcept('composer.base@1.0.0', 'ContactDetails');
            wrapper.transaction.seller.contactDetails.email = 'dan@acme.org';
            wrapper.transaction.buyer = factory.newResource('composer.base@1.0.0', 'Person', 'anthony');
            wrapper.transaction.vehicle = factory.newResource('org.vda@1.0.0', 'Vehicle', '156478954');
            wrapper.transaction.vehicle.vehicleDetails = factory.newConcept( 'org.vda@1.0.0', 'VehicleDetails');
            wrapper.transaction.vehicle.vehicleDetails.make = 'Ford';
            wrapper.transaction.vehicle.vehicleDetails.modelType = 'Mustang';
            wrapper.transaction.vehicle.vehicleDetails.colour = 'Red';
            wrapper.transaction.vehicle.vehicleStatus = 'ACTIVE';
            wrapper.transaction.vehicle.owner = factory.newRelationship( 'composer.base@1.0.0', 'Person', 'dan');

            const logEntry = factory.newConcept('org.vda@1.0.0', 'VehicleTransferLogEntry');
            logEntry.vehicle = wrapper.transaction.vehicle;
            logEntry.buyer = wrapper.transaction.buyer;
            logEntry.seller = wrapper.transaction.seller;
            logEntry.timestamp = dayjs.utc();
            wrapper.transaction.vehicle.logEntries= [logEntry];

            const obj = serializer.toJSON(wrapper, {deduplicateResources: true, permitResourcesForRelationships: true});

            // check that the resources have been deduplicated
            // and the $id attribute has been added
            obj.$id.should.equal('resource:org.acme.vehicle.lifecycle@1.0.0.TransactionWrapper#dummy');
            obj.transaction.vehicle.logEntries[0].buyer.should.equal('resource:composer.base@1.0.0.Person#anthony');
            obj.transaction.vehicle.logEntries[0].seller.should.equal('resource:composer.base@1.0.0.Person#dan');
        });
    });
});
