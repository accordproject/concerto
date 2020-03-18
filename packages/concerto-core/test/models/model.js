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

const Factory = require('../../lib/factory');
const ModelManager = require('../../lib/modelmanager');
const Serializer = require('../../lib/serializer');
const Util = require('../composer/composermodelutility');
const Moment = require('moment-mini');

const assert = require('assert');
require('chai').should();
const fs = require('fs');

describe('Model Tests', function(){

    describe('#validation', function() {
        it('check property validation', function() {
            const modelManager = new ModelManager();
            Util.addComposerModel(modelManager);
            modelManager.should.not.be.null;
            modelManager.clearModelFiles();

            let fileName = './test/data/model/model-base.cto';
            let modelBase = fs.readFileSync(fileName, 'utf8');
            modelBase.should.not.be.null;
            modelManager.addModelFile(modelBase,fileName);

            // check functions can be retrieved
            const modelFile = modelManager.getModelFile('org.acme.base');
            modelFile.should.not.be.null;

            // check abstract classes are marked as abstract
            const abstractAsset = modelManager.getType('org.acme.base.AbstractAsset');
            abstractAsset.should.not.be.null;
            abstractAsset.isAbstract().should.be.true;

            // check we can get a concept
            const addressConcept = modelManager.getType('org.acme.base.Address');
            addressConcept.should.not.be.null;
            addressConcept.isAbstract().should.be.true;

            // check we can get a concept
            const unitedStatesAddressConcept = modelManager.getType('org.acme.base.UnitedStatesAddress');
            unitedStatesAddressConcept.should.not.be.null;
            unitedStatesAddressConcept.isAbstract().should.be.false;

            // check both concepts are registered
            modelManager.getConceptDeclarations().length.should.equal(2);

            // and vice-a-versa
            const baseAsset = modelManager.getType('org.acme.base.BaseAsset');
            baseAsset.should.not.be.null;
            baseAsset.isAbstract().should.be.false;

            // create a factory
            let factory = new Factory(modelManager);

            // attempt to create an abstract asset
            assert.throws( function() {factory.newResource('org.acme.base', 'AbstractAsset', '123' );}, /.+Cannot instantiate Abstract Type AbstractAsset in namespace org.acme.base/, 'did not throw with expected message');

            // create a new instance
            let resource = factory.newResource(
                'org.acme.base', 'BaseAsset', '123' );

            // check the id
            resource.stringProperty.should.equal('123');

            // o String stringProperty
            resource._setPropertyValue('stringProperty', 'string');
            resource.stringProperty.should.equal('string');
            assert.throws( function() {resource._setPropertyValue('stringProperty', 1);}, /.+expected type String/, 'did not throw with expected message');

            // o Integer integerProperty
            resource._setPropertyValue('integerProperty', 999);
            resource.integerProperty.should.equal(999);
            assert.throws( function() {resource._setPropertyValue('integerProperty', 'Foo');}, /.+expected type Integer/, 'did not throw with expected message');

            // o Double doubleProperty
            resource._setPropertyValue('doubleProperty', 10.0);
            resource.doubleProperty.should.equal(10.0);
            assert.throws( function() {resource._setPropertyValue('doubleProperty', 'Foo');}, /.+expected type Double/, 'did not throw with expected message');

            // o Boolean booleanProperty
            resource._setPropertyValue('booleanProperty', true );
            resource.booleanProperty.should.equal(true);
            assert.throws( function() {resource._setPropertyValue('booleanProperty', 'Foo');}, /.+expected type Boolean/, 'did not throw with expected message');

            // o DateTime dateTimeProperty
            const dateTime = Moment.parseZone('2016-10-11T02:30:26.262Z');
            resource._setPropertyValue('dateTimeProperty', dateTime );
            resource.dateTimeProperty.should.equal(dateTime);
            assert.throws( function() {resource._setPropertyValue('dateTimeProperty', 'Foo');}, /.+expected type DateTime/, 'did not throw with expected message');

            // o Long longProperty
            resource._setPropertyValue('longProperty', 100 );
            resource.longProperty.should.equal(100);
            assert.throws( function() {resource._setPropertyValue('longProperty', 'Foo');}, /.+expected type Long/, 'did not throw with expected message');

            // o State stateProperty
            resource._setPropertyValue('stateProperty', 'GOLD' );
            resource.stateProperty.should.equal('GOLD');
            assert.throws( function() {resource._setPropertyValue('stateProperty', 'Foo');}, /.+for field State/, 'did not throw with expected message');
            assert.throws( function() {resource._setPropertyValue('stateProperty', 1);}, /.+for field State/, 'did not throw with expected message');

            // o String[] stringArrayProperty
            resource._setPropertyValue('stringArrayProperty', ['string'] );
            resource.stringArrayProperty.should.contain('string');
            assert.throws( function() {resource._setPropertyValue('stringArrayProperty', 1);}, /.+expected type String\[\]/, 'did not throw with expected message');

            // o Integer[] integerArrayProperty
            resource._setPropertyValue('integerArrayProperty', [999] );
            resource.integerArrayProperty.should.contain(999);
            assert.throws( function() {resource._setPropertyValue('integerArrayProperty', 'Foo');}, /.+expected type Integer\[\]/, 'did not throw with expected message');

            // o Double[] doubleArrayProperty
            resource._setPropertyValue('doubleArrayProperty', [999.0] );
            resource.doubleArrayProperty.should.contain(999.0);
            assert.throws( function() {resource._setPropertyValue('doubleArrayProperty', 'Foo');}, /.+expected type Double\[\]/, 'did not throw with expected message');

            // o Boolean[] booleanArrayProperty
            resource._setPropertyValue('booleanArrayProperty', [true, false] );
            resource.booleanArrayProperty.should.contain(true);
            assert.throws( function() {resource._setPropertyValue('booleanArrayProperty', 'Foo');}, /.+expected type Boolean\[\]/, 'did not throw with expected message');

            // o DateTime[] dateTimeArrayProperty
            resource._setPropertyValue('dateTimeArrayProperty', [dateTime] );
            resource.dateTimeArrayProperty.should.contain(dateTime);
            assert.throws( function() {resource._setPropertyValue('dateTimeArrayProperty', 'Foo');}, /.+expected type DateTime\[\]/, 'did not throw with expected message');

            // o Long[] longArrayProperty
            resource._setPropertyValue('longArrayProperty', [1,2,3] );
            resource.longArrayProperty.should.contain(3);
            assert.throws( function() {resource._setPropertyValue('longArrayProperty', 'Foo');}, /.+expected type Long\[\]/, 'did not throw with expected message');

            // o State[] stateArrayProperty
            resource._setPropertyValue('stateArrayProperty', ['GOLD', 'SILVER'] );
            resource.stateArrayProperty.should.contain('SILVER');
            assert.throws( function() {resource._setPropertyValue('stateArrayProperty', ['GOLD', 'Foo']);}, /.+for field State/, 'did not throw with expected message');
            assert.throws( function() {resource._setPropertyValue('stateArrayProperty', 'GOLD');}, /.+expected type State\[\]/, 'did not throw with expected message');

            // set the relationships
            const personRelationship = factory.newRelationship('org.acme.base', 'Person', 'DAN' );
            resource._setPropertyValue('singlePerson', personRelationship );
            resource._setPropertyValue('personArray', [personRelationship,personRelationship] );

            // set an invalid relationship
            const blokeRelationship = factory.newRelationship('org.acme.base', 'Bloke', 'DAN' );
            assert.throws( function() {resource._setPropertyValue('singlePerson', blokeRelationship );}, /.+not derived from org.acme.base.Person/, 'did not throw with expected message');

            // create a Person
            const person = factory.newResource('org.acme.base', 'Person', 'P1' );
            person.address = factory.newConcept('org.acme.base', 'UnitedStatesAddress');
            person.address._setPropertyValue('street', 'Test');
            person.address.zipcode = 'CA';
            person.address._addArrayValue('counts', 10);
            person.address._addArrayValue('counts', 20);
            person.address._validate();
            delete person.address.counts;
            resource.myPerson = person;

            // check the instance validates
            resource._validate();

            // create a Bloke
            const bloke = factory.newResource('org.acme.base', 'Bloke', 'B1' );
            resource.myPerson = bloke;

            resource.myPeople = [person,person];

            assert.throws( function() {resource._validate();}, /.+type org.acme.base.Bloke that is not derived from org.acme.base.Person/, 'did not throw with expected message');
            resource.myPerson = person;

            // set an extra property
            resource.blotto = 'Yes!';
            assert.throws( function() {resource._validate();}, /.+blotto which is not declared in org.acme.base.BaseAsset/, 'did not throw with expected message');
            delete resource.blotto;

            // set a missing property
            assert.throws( function() {resource._setPropertyValue('missing', 'Foo');}, /.+trying to set field missing which is not declared in the model./, 'did not throw with expected message');

            // add a missing array value
            assert.throws( function() {resource._addArrayValue('missing', 'Foo');}, /.+trying to set field missing which is not declared in the model./, 'did not throw with expected message');

            // not an array
            assert.throws( function() {resource._addArrayValue('longProperty', '[1]');}, /.+longProperty which is not declared as an array in the model./, 'did not throw with expected message');

            const serializer = new Serializer(factory, modelManager);
            let json = serializer.toJSON(resource);

            // assert on the entire format of the JSON serialization
            JSON.stringify(json).should.be.equal('{"$class":"org.acme.base.BaseAsset","stringProperty":"string","integerProperty":999,"doubleProperty":10,"booleanProperty":true,"dateTimeProperty":"2016-10-11T02:30:26.262Z","longProperty":100,"stateProperty":"GOLD","stringArrayProperty":["string"],"integerArrayProperty":[999],"doubleArrayProperty":[999],"booleanArrayProperty":[true,false],"dateTimeArrayProperty":["2016-10-11T02:30:26.262Z"],"longArrayProperty":[1,2,3],"stateArrayProperty":["GOLD","SILVER"],"singlePerson":"resource:org.acme.base.Person#DAN","personArray":["resource:org.acme.base.Person#DAN","resource:org.acme.base.Person#DAN"],"myPerson":{"$class":"org.acme.base.Person","stringProperty":"P1","address":{"$class":"org.acme.base.UnitedStatesAddress","zipcode":"CA","street":"Test","city":"Winchester","country":"UK"}},"myPeople":[{"$class":"org.acme.base.Person","stringProperty":"P1","address":{"$class":"org.acme.base.UnitedStatesAddress","zipcode":"CA","street":"Test","city":"Winchester","country":"UK"}},{"$class":"org.acme.base.Person","stringProperty":"P1","address":{"$class":"org.acme.base.UnitedStatesAddress","zipcode":"CA","street":"Test","city":"Winchester","country":"UK"}}]}');

            // check we can convert back to an object
            const newResource = serializer.fromJSON(json);
            newResource.should.not.be.null;
            newResource._getFullyQualifiedIdentifier().should.equal('org.acme.base.BaseAsset#string');
            newResource.stringProperty.should.equal('string');
            newResource.integerProperty.should.equal(999);
            newResource.doubleProperty.should.equal(10.0);
            newResource.booleanProperty.should.equal(true);
            newResource.dateTimeProperty.toISOString().should.equal(dateTime.toISOString());
            newResource.longProperty.should.equal(100);
            newResource.stateProperty.should.equal('GOLD');
            newResource.stringArrayProperty.should.contain('string');
            newResource.integerArrayProperty.should.contain(999);
            newResource.doubleArrayProperty.should.contain(999.0);
            newResource.booleanArrayProperty.should.contain(true);
            newResource.dateTimeArrayProperty[0].toISOString().should.equal(dateTime.toISOString());
            newResource.longArrayProperty.should.contain(3);
            newResource.stateArrayProperty.should.contain('SILVER');
            newResource.singlePerson._getFullyQualifiedIdentifier().should.equal('org.acme.base.Person#DAN');
            newResource.personArray[1]._getFullyQualifiedIdentifier().should.equal('org.acme.base.Person#DAN');
            newResource.myPerson._getIdentifier().should.equal('P1');

            // check that we can set a complex type
            const tx = factory.newTransaction(
                'org.acme.base', 'MyTransaction', 'TX_123' );

            const txEx = factory.newTransaction(
                'org.acme.base', 'MyTransactionEx', 'TX_456' );

            tx._setPropertyValue('myAsset', resource );
            tx.myAsset.should.equal(resource);
            assert.throws( function() {tx._setPropertyValue('myAsset', ['GOLD', 'Foo']);}, /.+GOLD,Foo expected a Resource./, 'did not throw with expected message');
            json = serializer.toJSON(tx);

            txEx._setPropertyValue('myAsset', resource );
            txEx.myAsset.should.equal(resource);
            assert.throws( function() {txEx._setPropertyValue('myAsset', txEx);}, /.+type org.acme.base.MyTransactionEx that is not derived from org.acme.base.BaseAsset/, 'did not throw with expected message');

            const derivedDerivedAsset = factory.newResource('org.acme.base', 'DerivedDerivedAsset', 'DERIVED_001' );

            derivedDerivedAsset._setPropertyValue('singlePerson', personRelationship );
            derivedDerivedAsset._setPropertyValue('personArray', [personRelationship,personRelationship] );
            const includedTransaction = factory.newTransaction('org.acme.base', 'MyBasicTransaction', 'TRANSACTION_001');
            derivedDerivedAsset._setPropertyValue('includedTransaction',  includedTransaction);

            txEx._setPropertyValue('myAsset', derivedDerivedAsset );
            txEx.myAsset.should.equal(derivedDerivedAsset);

            txEx._setPropertyValue('arrayOfBaseAssets', [resource, resource]);
        });
    });
});
