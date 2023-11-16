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

const Factory = require('../../dist/factory');
const ModelManager = require('../../dist/modelmanager');
const Serializer = require('../../dist/serializer');
const Util = require('../composer/composermodelutility');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

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
            modelManager.addCTOModel(modelBase,fileName);

            // check functions can be retrieved
            const modelFile = modelManager.getModelFile('org.acme.base@1.0.0');
            modelFile.should.not.be.null;

            // check abstract classes are marked as abstract
            const abstractAsset = modelManager.getType('org.acme.base@1.0.0.AbstractAsset');
            abstractAsset.should.not.be.null;
            abstractAsset.isAbstract().should.be.true;

            // check we can get a concept
            const addressConcept = modelManager.getType('org.acme.base@1.0.0.Address');
            addressConcept.should.not.be.null;
            addressConcept.isAbstract().should.be.true;

            // check we can get a concept
            const unitedStatesAddressConcept = modelManager.getType('org.acme.base@1.0.0.UnitedStatesAddress');
            unitedStatesAddressConcept.should.not.be.null;
            unitedStatesAddressConcept.isAbstract().should.be.false;

            // check both concepts are registered
            modelManager.getConceptDeclarations().length.should.equal(2);

            // and vice-a-versa
            const baseAsset = modelManager.getType('org.acme.base@1.0.0.BaseAsset');
            baseAsset.should.not.be.null;
            baseAsset.isAbstract().should.be.false;

            // create a factory
            let factory = new Factory(modelManager);

            // attempt to create an abstract asset
            assert.throws( function() {factory.newResource('org.acme.base@1.0.0', 'AbstractAsset', '123' );}, 'Error: Cannot instantiate Abstract Type "AbstractAsset" in namespace "org.acme.base".');

            // create a new instance
            let resource = factory.newResource(
                'org.acme.base@1.0.0', 'BaseAsset', '123' );

            // check the id
            resource.stringProperty.should.equal('123');

            // o String stringProperty
            resource.setPropertyValue('stringProperty', 'string');
            resource.stringProperty.should.equal('string');
            assert.throws( function() {resource.setPropertyValue('stringProperty', 1);}, /ValidationException: Model violation in the "org.acme.base@1.0.0.BaseAsset#string" instance. The field "stringProperty" has a value of "1" \(type of value: "number"\). Expected type of value: "String"./);

            // o Integer integerProperty
            resource.setPropertyValue('integerProperty', 999);
            resource.integerProperty.should.equal(999);
            assert.throws( function() {resource.setPropertyValue('integerProperty', 'Foo');}, /ValidationException: Model violation in the "org.acme.base@1.0.0.BaseAsset#string" instance. The field "integerProperty" has a value of ""Foo"" \(type of value: "string"\). Expected type of value: "Integer"./);

            // o Double doubleProperty
            resource.setPropertyValue('doubleProperty', 10.0);
            resource.doubleProperty.should.equal(10.0);
            assert.throws( function() {resource.setPropertyValue('doubleProperty', 'Foo');}, /ValidationException: Model violation in the "org.acme.base@1.0.0.BaseAsset#string" instance. The field "doubleProperty" has a value of ""Foo"" \(type of value: "string"\). Expected type of value: "Double"./);

            // o Boolean booleanProperty
            resource.setPropertyValue('booleanProperty', true );
            resource.booleanProperty.should.equal(true);
            assert.throws( function() {resource.setPropertyValue('booleanProperty', 'Foo');}, /ValidationException: Model violation in the "org.acme.base@1.0.0.BaseAsset#string" instance. The field "booleanProperty" has a value of ""Foo"" \(type of value: "string"\). Expected type of value: "Boolean"./);

            // o DateTime dateTimeProperty
            const dateTime = dayjs.utc('2016-10-11T02:30:26.262Z');
            resource.setPropertyValue('dateTimeProperty', dateTime );
            resource.dateTimeProperty.should.equal(dateTime);
            assert.throws( function() {resource.setPropertyValue('dateTimeProperty', 'Foo');}, /ValidationException: Model violation in the "org.acme.base@1.0.0.BaseAsset#string" instance. The field "dateTimeProperty" has a value of ""Foo"" \(type of value: "string"\). Expected type of value: "DateTime"./);

            // o Long longProperty
            resource.setPropertyValue('longProperty', 100 );
            resource.longProperty.should.equal(100);
            assert.throws( function() {resource.setPropertyValue('longProperty', 'Foo');}, /ValidationException: Model violation in the "org.acme.base@1.0.0.BaseAsset#string" instance. The field "longProperty" has a value of ""Foo"" \(type of value: "string"\). Expected type of value: "Long"./);

            // o State stateProperty
            resource.setPropertyValue('stateProperty', 'GOLD' );
            resource.stateProperty.should.equal('GOLD');
            assert.throws( function() {resource.setPropertyValue('stateProperty', 'Foo');}, /ValidationException: Model violation in the "org.acme.base@1.0.0.BaseAsset#string" instance. Invalid enum value of "Foo" for the field "State"./);
            assert.throws( function() {resource.setPropertyValue('stateProperty', 1);}, /ValidationException: Model violation in the "org.acme.base@1.0.0.BaseAsset#string" instance. Invalid enum value of "1" for the field "State"./);

            // o String[] stringArrayProperty
            resource.setPropertyValue('stringArrayProperty', ['string'] );
            resource.stringArrayProperty.should.contain('string');
            assert.throws( function() {resource.setPropertyValue('stringArrayProperty', 1);}, /ValidationException: Model violation in the "org.acme.base@1.0.0.BaseAsset#string" instance. The field "stringArrayProperty" has a value of "1" \(type of value: "number"\). Expected type of value: "String\[\]"./);

            // o Integer[] integerArrayProperty
            resource.setPropertyValue('integerArrayProperty', [999] );
            resource.integerArrayProperty.should.contain(999);
            assert.throws( function() {resource.setPropertyValue('integerArrayProperty', 'Foo');}, /ValidationException: Model violation in the "org.acme.base@1.0.0.BaseAsset#string" instance. The field "integerArrayProperty" has a value of ""Foo"" \(type of value: "string"\). Expected type of value: "Integer\[\]"./);

            // o Double[] doubleArrayProperty
            resource.setPropertyValue('doubleArrayProperty', [999.0] );
            resource.doubleArrayProperty.should.contain(999.0);
            assert.throws( function() {resource.setPropertyValue('doubleArrayProperty', 'Foo');}, /ValidationException: Model violation in the "org.acme.base@1.0.0.BaseAsset#string" instance. The field "doubleArrayProperty" has a value of ""Foo"" \(type of value: "string"\). Expected type of value: "Double\[\]"./);

            // o Boolean[] booleanArrayProperty
            resource.setPropertyValue('booleanArrayProperty', [true, false] );
            resource.booleanArrayProperty.should.contain(true);
            assert.throws( function() {resource.setPropertyValue('booleanArrayProperty', 'Foo');}, /ValidationException: Model violation in the "org.acme.base@1.0.0.BaseAsset#string" instance. The field "booleanArrayProperty" has a value of ""Foo"" \(type of value: "string"\). Expected type of value: "Boolean\[\]"./);

            // o DateTime[] dateTimeArrayProperty
            resource.setPropertyValue('dateTimeArrayProperty', [dateTime] );
            resource.dateTimeArrayProperty.should.contain(dateTime);
            assert.throws( function() {resource.setPropertyValue('dateTimeArrayProperty', 'Foo');}, /ValidationException: Model violation in the "org.acme.base@1.0.0.BaseAsset#string" instance. The field "dateTimeArrayProperty" has a value of ""Foo"" \(type of value: "string"\). Expected type of value: "DateTime\[\]"./);

            // o Long[] longArrayProperty
            resource.setPropertyValue('longArrayProperty', [1,2,3] );
            resource.longArrayProperty.should.contain(3);
            assert.throws( function() {resource.setPropertyValue('longArrayProperty', 'Foo');}, /ValidationException: Model violation in the "org.acme.base@1.0.0.BaseAsset#string" instance. The field "longArrayProperty" has a value of ""Foo"" \(type of value: "string"\). Expected type of value: "Long\[\]"./);

            // o State[] stateArrayProperty
            resource.setPropertyValue('stateArrayProperty', ['GOLD', 'SILVER'] );
            resource.stateArrayProperty.should.contain('SILVER');
            assert.throws( function() {resource.setPropertyValue('stateArrayProperty', ['GOLD', 'Foo']);}, 'ValidationException: Model violation in the "org.acme.base@1.0.0.BaseAsset#string" instance. Invalid enum value of "Foo" for the field "State".');
            assert.throws( function() {resource.setPropertyValue('stateArrayProperty', 'GOLD');}, /ValidationException: Model violation in the "org.acme.base@1.0.0.BaseAsset#string" instance. The field "stateArrayProperty" has a value of ""GOLD"" \(type of value: "string"\). Expected type of value: "State\[\]"./);

            // set the relationships
            const personRelationship = factory.newRelationship('org.acme.base@1.0.0', 'Person', 'DAN' );
            resource.setPropertyValue('singlePerson', personRelationship );
            resource.setPropertyValue('personArray', [personRelationship,personRelationship] );

            // set an invalid relationship
            const blokeRelationship = factory.newRelationship('org.acme.base@1.0.0', 'Bloke', 'DAN' );
            assert.throws( function() {resource.setPropertyValue('singlePerson', blokeRelationship );}, /ValidationException: Instance "org.acme.base@1.0.0.BaseAsset#string" has a property "singlePerson" with type "org.acme.base@1.0.0.Bloke" that is not derived from "org.acme.base@1.0.0.Person"./);

            // create a Person
            const person = factory.newResource('org.acme.base@1.0.0', 'Person', 'P1' );
            person.address = factory.newConcept('org.acme.base@1.0.0', 'UnitedStatesAddress');
            person.address.setPropertyValue('street', 'Test');
            person.address.zipcode = 'CA';
            person.address.addArrayValue('counts', 10);
            person.address.addArrayValue('counts', 20);
            person.address.validate();
            delete person.address.counts;
            resource.myPerson = person;

            // check the instance validates
            resource.validate();

            // create a Bloke
            const bloke = factory.newResource('org.acme.base@1.0.0', 'Bloke', 'B1' );
            resource.myPerson = bloke;

            resource.myPeople = [person,person];

            assert.throws( function() {resource.validate();}, /ValidationException: Instance "org.acme.base@1.0.0.BaseAsset#string" has a property "myPerson" with type "org.acme.base@1.0.0.Bloke" that is not derived from "org.acme.base@1.0.0.Person"./);
            resource.myPerson = person;

            // set an extra property
            resource.blotto = 'Yes!';
            assert.throws( function() {resource.validate();}, /ValidationException: Instance "string" has a property named "blotto", which is not declared in "org.acme.base@1.0.0.BaseAsset"./);
            delete resource.blotto;

            // set a missing property
            assert.throws( function() {resource.setPropertyValue('missing', 'Foo');}, '/.+trying to set field missing which is not declared in the model./');

            // add a missing array value
            assert.throws( function() {resource.addArrayValue('missing', 'Foo');}, /.+trying to set field missing which is not declared in the model./);

            // not an array
            assert.throws( function() {resource.addArrayValue('longProperty', '[1]');}, /.+longProperty which is not declared as an array in the model./);

            const serializer = new Serializer(factory, modelManager);
            let json = serializer.toJSON(resource, { utcOffset: 0 });

            // assert on the entire format of the JSON serialization
            JSON.stringify(json).should.be.equal('{"$class":"org.acme.base@1.0.0.BaseAsset","stringProperty":"string","integerProperty":999,"doubleProperty":10,"booleanProperty":true,"dateTimeProperty":"2016-10-11T02:30:26.262Z","longProperty":100,"stateProperty":"GOLD","stringArrayProperty":["string"],"integerArrayProperty":[999],"doubleArrayProperty":[999],"booleanArrayProperty":[true,false],"dateTimeArrayProperty":["2016-10-11T02:30:26.262Z"],"longArrayProperty":[1,2,3],"stateArrayProperty":["GOLD","SILVER"],"singlePerson":"resource:org.acme.base@1.0.0.Person#DAN","personArray":["resource:org.acme.base@1.0.0.Person#DAN","resource:org.acme.base@1.0.0.Person#DAN"],"myPerson":{"$class":"org.acme.base@1.0.0.Person","stringProperty":"P1","address":{"$class":"org.acme.base@1.0.0.UnitedStatesAddress","zipcode":"CA","street":"Test","city":"Winchester","country":"UK"},"$identifier":"P1"},"myPeople":[{"$class":"org.acme.base@1.0.0.Person","stringProperty":"P1","address":{"$class":"org.acme.base@1.0.0.UnitedStatesAddress","zipcode":"CA","street":"Test","city":"Winchester","country":"UK"},"$identifier":"P1"},{"$class":"org.acme.base@1.0.0.Person","stringProperty":"P1","address":{"$class":"org.acme.base@1.0.0.UnitedStatesAddress","zipcode":"CA","street":"Test","city":"Winchester","country":"UK"},"$identifier":"P1"}],"$identifier":"string"}');

            // check we can convert back to an object
            const newResource = serializer.fromJSON(json);
            newResource.should.not.be.null;
            newResource.getFullyQualifiedIdentifier().should.equal('org.acme.base@1.0.0.BaseAsset#string');
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
            newResource.singlePerson.getFullyQualifiedIdentifier().should.equal('org.acme.base@1.0.0.Person#DAN');
            newResource.personArray[1].getFullyQualifiedIdentifier().should.equal('org.acme.base@1.0.0.Person#DAN');
            newResource.myPerson.getIdentifier().should.equal('P1');

            // check that we can set a complex type
            const tx = factory.newTransaction(
                'org.acme.base@1.0.0', 'MyTransaction', 'TX_123' );

            const txEx = factory.newTransaction(
                'org.acme.base@1.0.0', 'MyTransactionEx', 'TX_456' );

            tx.setPropertyValue('myAsset', resource );
            tx.myAsset.should.equal(resource);
            assert.throws( function() {tx.setPropertyValue('myAsset', ['GOLD', 'Foo']);}, /ValidationException: Model violation in the "org.acme.base@1.0.0.MyTransaction#TX_123" instance. Class "org.acme.base@1.0.0.BaseAsset" has the value of "GOLD,Foo". Expected a "Resource" or a "Concept"./);
            json = serializer.toJSON(tx);

            txEx.setPropertyValue('myAsset', resource );
            txEx.myAsset.should.equal(resource);
            assert.throws( function() {txEx.setPropertyValue('myAsset', txEx);}, /ValidationException: Instance "org.acme.base@1.0.0.MyTransactionEx#TX_456" has a property "myAsset" with type "org.acme.base@1.0.0.MyTransactionEx" that is not derived from "org.acme.base@1.0.0.BaseAsset"./);

            const derivedDerivedAsset = factory.newResource('org.acme.base@1.0.0', 'DerivedDerivedAsset', 'DERIVED_001' );

            derivedDerivedAsset.setPropertyValue('singlePerson', personRelationship );
            derivedDerivedAsset.setPropertyValue('personArray', [personRelationship,personRelationship] );
            const includedTransaction = factory.newTransaction('org.acme.base@1.0.0', 'MyBasicTransaction', 'TRANSACTION_001');
            derivedDerivedAsset.setPropertyValue('includedTransaction',  includedTransaction);

            txEx.setPropertyValue('myAsset', derivedDerivedAsset );
            txEx.myAsset.should.equal(derivedDerivedAsset);

            txEx.setPropertyValue('arrayOfBaseAssets', [resource, resource]);
        });
    });
});
