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

const Factory = require('../lib/factory');
const ModelManager = require('../lib/modelmanager');
const Relationship = require('../lib/model/relationship');
const Resource = require('../lib/model/resource');
const Serializer = require('../lib/serializer');
const TypeNotFoundException = require('../lib/typenotfoundexception');
const Util = require('./composer/composermodelutility');

const should = require('chai').should();
const sinon = require('sinon');

describe('Serializer', () => {

    let sandbox;
    let factory;
    let modelManager;
    let serializer;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        modelManager = new ModelManager();
        Util.addComposerModel(modelManager);
        modelManager.addCTOModel(`
        namespace org.acme.sample

        scalar PostalCode extends String

        asset SampleAsset identified by assetId {
        o String assetId
        --> SampleParticipant owner
        o String stringValue
        o Double doubleValue
        }

        participant SampleParticipant identified by participantId {
        o String participantId
        o String firstName
        o String lastName
        }

        transaction SampleTransaction identified by transactionId {
        o String transactionId
        --> SampleAsset asset
        o String newValue
        }

        concept Address {
            o String city
            o String country
            o Double elevation
            o PostalCode postcode optional
        }

        concept DateTimeTest {
            o DateTime date
        }

        event SampleEvent identified by eventId {
        o String eventId
        --> SampleAsset asset
        o String newValue
        }

        `);
        factory = new Factory(modelManager);
        serializer = new Serializer(factory, modelManager);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#constructor', () => {

        it('should throw if factory not specified', () => {
            (() => {
                new Serializer(null, modelManager);
            }).should.throw(/"Factory" cannot be "null"./);
        });

        it('should throw if modelManager not specified', () => {
            (() => {
                new Serializer(factory, null);
            }).should.throw(/"ModelManager" cannot be "null"./);
        });

    });

    describe('#toJSON', () => {

        it('should throw if resource not a Resource', () => {
            (() => {
                serializer.toJSON([{}]);
            }).should.throw(/only accepts/);
        });

        it('should throw if the class declaration cannot be found', () => {
            let mockResource = sinon.createStubInstance(Resource);
            mockResource.getFullyQualifiedType.returns('org.acme.sample.NoSuchAsset');
            (() => {
                serializer.toJSON(mockResource);
            }).should.throw(TypeNotFoundException, /NoSuchAsset/);
        });

        it('should generate a JSON object and validate if the validate flag is set to true', () => {
            let resource = factory.newResource('org.acme.sample', 'SampleAsset', '1');
            resource.owner = factory.newRelationship('org.acme.sample', 'SampleParticipant', 'alice@email.com');
            resource.stringValue = 'the value';
            resource.doubleValue = 3.14;
            let json = serializer.toJSON(resource, {
                validate: true
            });
            json.should.deep.equal({
                $class: 'org.acme.sample.SampleAsset',
                $identifier: '1',
                assetId: '1',
                owner: 'resource:org.acme.sample.SampleParticipant#alice@email.com',
                stringValue: 'the value',
                doubleValue: 3.14
            });
        });

        it('should throw validation errors during JSON object generation if Double is NaN', () => {
            let resource = factory.newResource('org.acme.sample', 'SampleAsset', '1');
            resource.owner = factory.newRelationship('org.acme.sample', 'SampleParticipant', 'alice@email.com');
            resource.stringValue = 'the value';
            resource.doubleValue = NaN;
            (() => {
                serializer.toJSON(resource);
            }).should.throw(/Model violation in the "org.acme.sample.SampleAsset#1" instance. The field "doubleValue" has a value of "NaN"./);
        });

        it('should throw validation errors during JSON object generation if Double is Infinity', () => {
            let resource = factory.newResource('org.acme.sample', 'SampleAsset', '1');
            resource.owner = factory.newRelationship('org.acme.sample', 'SampleParticipant', 'alice@email.com');
            resource.stringValue = 'the value';
            resource.doubleValue = Infinity;
            (() => {
                serializer.toJSON(resource);
            }).should.throw(/Model violation in the "org.acme.sample.SampleAsset#1" instance. The field "doubleValue" has a value of "Infinity"./);
        });

        it('should throw validation errors during JSON object generation if Double is -Infinity', () => {
            let resource = factory.newResource('org.acme.sample', 'SampleAsset', '1');
            resource.owner = factory.newRelationship('org.acme.sample', 'SampleParticipant', 'alice@email.com');
            resource.stringValue = 'the value';
            resource.doubleValue = -Infinity;
            (() => {
                serializer.toJSON(resource);
            }).should.throw(/Model violation in the "org.acme.sample.SampleAsset#1" instance. The field "doubleValue" has a value of "-Infinity"./);
        });

        it('should throw validation errors during JSON object generation if the validate flag is not specified and errors are present', () => {
            let resource = factory.newResource('org.acme.sample', 'SampleAsset', '1');
            (() => {
                serializer.toJSON(resource);
            }).should.throw('The instance "org.acme.sample.SampleAsset#1" is missing the required field "owner".');
        });

        it('should throw validation errors during JSON object generation if the validate flag is set to true and errors are present', () => {
            let resource = factory.newResource('org.acme.sample', 'SampleAsset', '1');
            (() => {
                serializer.toJSON(resource, {
                    validate: true
                });
            }).should.throw('The instance "org.acme.sample.SampleAsset#1" is missing the required field "owner".');
        });

        it('should generate a JSON object if errors are present but the validate flag is set to false', () => {
            let resource = factory.newResource('org.acme.sample', 'SampleAsset', '1');
            let json = serializer.toJSON(resource, {
                validate: false
            });
            json.should.deep.equal({
                $class: 'org.acme.sample.SampleAsset',
                $identifier: '1',
                assetId: '1'
            });
        });

        it('should not validate during JSON object generation if the default options specifies the validate flag set to false', () => {
            serializer.setDefaultOptions({ validate: false });
            let resource = factory.newResource('org.acme.sample', 'SampleAsset', '1');
            let json = serializer.toJSON(resource);
            json.should.deep.equal({
                $class: 'org.acme.sample.SampleAsset',
                $identifier: '1',
                assetId: '1'
            });
        });

        it('should validate during JSON object generation if the default options specifies the validate flag set to false but the input options specify true', () => {
            serializer.setDefaultOptions({ validate: false });
            let resource = factory.newResource('org.acme.sample', 'SampleAsset', '1');
            (() => {
                serializer.toJSON(resource, {
                    validate: true
                });
            }).should.throw('The instance "org.acme.sample.SampleAsset#1" is missing the required field "owner".');
        });

        it('should generate a concept', () => {
            let address = factory.newConcept('org.acme.sample', 'Address');
            address.city = 'Winchester';
            address.country = 'UK';
            address.elevation = 3.14;
            address.postcode = 'SO21 2JN';
            const json = serializer.toJSON(address);
            json.should.deep.equal({
                $class: 'org.acme.sample.Address',
                country: 'UK',
                elevation: 3.14,
                city: 'Winchester',
                postcode: 'SO21 2JN',
            });
        });

        it('should generate a field if an empty string is specififed', () => {
            let resource = factory.newResource('org.acme.sample', 'SampleAsset', '1');
            resource.owner = factory.newRelationship('org.acme.sample', 'SampleParticipant', 'alice@email.com');
            resource.stringValue = '';
            resource.doubleValue = 3.14;
            let json = serializer.toJSON(resource, {
                validate: true
            });
            json.should.deep.equal({
                $class: 'org.acme.sample.SampleAsset',
                $identifier: '1',
                assetId: '1',
                owner: 'resource:org.acme.sample.SampleParticipant#alice@email.com',
                stringValue: '',
                doubleValue: 3.14
            });
        });
    });

    describe('#fromJSON', () => {

        it('should throw if object is not a class', () => {
            let serializer = new Serializer(factory, modelManager);
            (() => {
                serializer.fromJSON({});
            }).should.throw(/Does not contain a \$class type identifier/);
        });

        it('should throw if the class declaration cannot be found', () => {
            let mockResource = sinon.createStubInstance(Resource);
            mockResource.$class = 'org.acme.sample.NoSuchAsset';
            let serializer = new Serializer(factory, modelManager);
            (() => {
                serializer.fromJSON(mockResource);
            }).should.throw(TypeNotFoundException, /NoSuchAsset/);
        });

        it('should deserialize a valid asset', () => {
            let json = {
                $class: 'org.acme.sample.SampleAsset',
                assetId: '1',
                owner: 'resource:org.acme.sample.SampleParticipant#alice@email.com',
                stringValue: 'the value',
                doubleValue: 3.14
            };
            let resource = serializer.fromJSON(json);
            resource.should.be.an.instanceOf(Resource);
            resource.assetId.should.equal('1');
            resource.$identifier.should.equal('1');
            resource.owner.should.be.an.instanceOf(Relationship);
            resource.stringValue.should.equal('the value');
            resource.doubleValue.should.equal(3.14);
        });

        it('should deserialize a valid transaction', () => {
            let json = {
                $class: 'org.acme.sample.SampleTransaction',
                transactionId: '111',
                asset: 'resource:org.acme.sample.SampleAsset#1',
                newValue: 'the value'
            };
            let resource = serializer.fromJSON(json);
            resource.should.be.an.instanceOf(Resource);
            resource.transactionId.should.exist;
            resource.$timestamp.should.exist;
            resource.asset.should.be.an.instanceOf(Relationship);
            resource.newValue.should.equal('the value');
        });

        it('should deserialize a valid event', () => {
            let json = {
                $class: 'org.acme.sample.SampleEvent',
                eventId: '111',
                asset: 'resource:org.acme.sample.SampleAsset#1',
                newValue: 'the value'
            };
            let resource = serializer.fromJSON(json);
            resource.$timestamp.should.exist;
            resource.should.be.an.instanceOf(Resource);
            resource.eventId.should.exist;
            resource.asset.should.be.an.instanceOf(Relationship);
            resource.newValue.should.equal('the value');
        });

        it('should deserialize a valid concept', () => {
            let json = {
                $class: 'org.acme.sample.Address',
                city: 'Winchester',
                country: 'UK',
                elevation: 3.14,
                postcode: 'SO21 2JN',
            };
            let resource = serializer.fromJSON(json);
            resource.should.be.an.instanceOf(Resource);
            resource.city.should.equal('Winchester');
            resource.country.should.equal('UK');
            resource.elevation.should.equal(3.14);
            resource.postcode.should.equal('SO21 2JN');
        });

        it('should throw validation errors if the validate flag is not specified', () => {
            let json = {
                $class: 'org.acme.sample.SampleAsset',
                assetId: '1',
                owner: 'resource:org.acme.sample.SampleParticipant#alice@email.com'
            };
            (() => {
                serializer.fromJSON(json);
            }).should.throw('The instance "org.acme.sample.SampleAsset#1" is missing the required field "stringValue".');
        });

        it('should throw validation errors if the validate flag is set to true', () => {
            let json = {
                $class: 'org.acme.sample.SampleAsset',
                assetId: '1',
                owner: 'resource:org.acme.sample.SampleParticipant#alice@email.com'
            };
            (() => {
                serializer.fromJSON(json, { validate: true });
            }).should.throw('The instance "org.acme.sample.SampleAsset#1" is missing the required field "stringValue".');
        });

        it('should not validate if the validate flag is set to false', () => {
            let json = {
                $class: 'org.acme.sample.SampleAsset',
                assetId: '1',
                owner: 'resource:org.acme.sample.SampleParticipant#alice@email.com'
            };
            let resource = serializer.fromJSON(json, { validate: false });
            resource.should.be.an.instanceOf(Resource);
            resource.assetId.should.equal('1');
            resource.$identifier.should.equal('1');
            resource.owner.should.be.an.instanceOf(Relationship);
            should.equal(resource.stringValue, undefined);
        });

        it('should not validate if the default options specifies the validate flag set to false', () => {
            serializer.setDefaultOptions({ validate: false });
            let json = {
                $class: 'org.acme.sample.SampleAsset',
                assetId: '1',
                owner: 'resource:org.acme.sample.SampleParticipant#alice@email.com'
            };
            let resource = serializer.fromJSON(json);
            resource.should.be.an.instanceOf(Resource);
            resource.assetId.should.equal('1');
            resource.$identifier.should.equal('1');
            resource.owner.should.be.an.instanceOf(Relationship);
            should.equal(resource.stringValue, undefined);
        });

        it('should validate if the default options specifies the validate flag set to false but the input options specify true', () => {
            serializer.setDefaultOptions({ validate: false });
            let json = {
                $class: 'org.acme.sample.SampleAsset',
                assetId: '1',
                owner: 'resource:org.acme.sample.SampleParticipant#alice@email.com'
            };
            (() => {
                serializer.fromJSON(json, { validate: true });
            }).should.throw('The instance "org.acme.sample.SampleAsset#1" is missing the required field "stringValue".');
        });

        it('should error on unexpected properties', () => {
            const json = {
                $class: 'org.acme.sample.SampleParticipant',
                participantId: 'alphablock',
                firstName: 'Block',
                lastName: 'Norris',
                WRONG: 'blah'
            };
            (() => serializer.fromJSON(json))
                .should.throw(/WRONG/);
        });

        it('should not error on unexpected properties if their value is undefined', () => {
            const json = {
                $class: 'org.acme.sample.SampleParticipant',
                participantId: 'alphablock',
                firstName: 'Block',
                lastName: 'Norris',
                WRONG: undefined
            };
            const result = serializer.fromJSON(json);
            result.should.be.an.instanceOf(Resource);
        });

        const json = {
            $class : 'org.acme.sample.DateTimeTest',
        };

        const DEFAULT_EXPECTED_VALUE =  '2022-11-28T01:02:03.987Z';

        describe('legacy datetime formats', () => {

            // See the visualization at https://ijmacd.github.io/rfc3339-iso8601/
            const dateTests = [
            // Test Structure
            // [TEST_STRING, DESCRIPTION, EXPECTED_VALUE, EXPLICIT_UTC_OFFSET]

                // Component Design goals
                // CLI and above: Respect user's local offset
                // API: Explicitly define and publish the assumed offset (e.g. Z)
                // SDK: Allow both options above, and be backwards compatible.


                // WIP Rules
                // Rule 1: When an offset is not specified in the input string, assume the local offset.
                // Rule 2: When a target offset is specified, format the date in the target offset.
                // Rule 3a: When a target offset is not specified, format the date as Z.
                // Rule 3b: When a target offset is not specified, format the date as the local offset ().

                // Plan
                // 1. Add an opt-in flag to drop support for unqualified dates/times
                // 2. Same flag should treat the offset param as a rendering target

                // RFC 3339 & ISO 8601
                // Current Behaviour
                ['2022-11-28', 'YYYY-MM-DD', '2022-11-28T00:00:00.000Z'],
                ['2022-11-28', 'YYYY-MM-DD', '2022-11-28T00:00:00.000Z', 'Z'],
                ['2022-11-28', 'YYYY-MM-DD', '2022-11-28T00:00:00.000Z', 0],
                ['2022-11-28', 'YYYY-MM-DD', '2022-11-27T19:00:00.000-05:00', '-05:00'],
                ['2022-11-28T01:02:03Z', 'YYYY-MM-DDTHH:mm:ssZ', '2022-11-28T01:02:03.000Z'],
                ['2022-11-28T01:02:03Z', 'YYYY-MM-DDTHH:mm:ssZ', '2022-11-28T01:02:03.000Z', 'Z'],
                ['2022-11-28T01:02:03Z', 'YYYY-MM-DDTHH:mm:ssZ', '2022-11-28T01:02:03.000Z', 0],
                ['2022-11-28T01:02:03Z', 'YYYY-MM-DDTHH:mm:ssZ', '2022-11-27T20:02:03.000-05:00', '-05:00'],
                ['2022-11-28T01:02:03-05:00', 'YYYY-MM-DDTHH:mm:ss-HH:mm', '2022-11-28T01:02:03.000-05:00', '-05:00'],
                ['2022-11-28T01:02:03-08:00', 'YYYY-MM-DDTHH:mm:ss-HH:mm', '2022-11-28T09:02:03.000Z'],
                ['2022-11-28T01:02:03.9Z', 'YYYY-MM-DDTHH:mm:ss.SZ', '2022-11-28T01:02:03.900Z'],
                ['2022-11-28T01:02:03.98Z', 'YYYY-MM-DDTHH:mm:ss.SSZ', '2022-11-28T01:02:03.980Z'],
                ['2022-11-28T01:02:03.987Z', 'YYYY-MM-DDTHH:mm:ss.SSSZ'],
                ['2022-11-28T01:02:03+08:00', 'YYYY-MM-DDTHH:mm:ss+HH:mm', '2022-11-27T17:02:03.000Z'],
                ['2022-11-28T01:02:03.987+08:00', 'YYYY-MM-DDTHH:mm:ss.SSS+HH:mm', '2022-11-27T17:02:03.987Z'],
                ['2022-11-28T01:02:03.98765+08:00', 'YYYY-MM-DDTHH:mm:ss.SSSSSS+HH:mm', '2022-11-27T17:02:03.987Z'],
                ['2022-11-28T01:02:03-08:00', 'YYYY-MM-DDTHH:mm:ss-HH:mm', '2022-11-28T09:02:03.000Z'],
                ['2022-11-28T01:02:03.987-08:00', 'YYYY-MM-DDTHH:mm:ss.SSS-HH:mm', '2022-11-28T09:02:03.987Z'],
                ['2022-11-28T01:02:03.98765-08:00', 'YYYY-MM-DDTHH:mm:ss.SSSSSS-HH:mm', '2022-11-28T09:02:03.987Z'],

                // Tests below this line are accepted but fall outside the specification for Concerto
                // Future failures of these tests are not considered breaking changes.

                // Truncated nanoseconds
                ['2022-11-28T01:02:03.98765Z', 'YYYY-MM-DDTHH:mm:ss.SSSSSS'],

                // RFC 3339 && HTML Living Standard
                ['2022-11-28 01:02:03.987Z', 'YYYY-MM-DD HH:mm:ss.SSSZ'],

                // RFC 3339
                ['2022-11-28t01:02:03.987Z', 'Lowercase t'],
                ['2022-11-28T01:02:03.987z', 'Lowercase z'],

                // ISO 8601
                ['2022', 'YYYY', '2022-01-01T00:00:00.000Z'],
                ['2022', 'YYYY', '2022-01-01T00:00:00.000Z', 0],
                ['+002022-11-28', '+YYYYYY-MM-DD', '2022-11-28T00:00:00.000Z'],
                ['+002022-11-28', '+YYYYYY-MM-DD', '2022-11-28T00:00:00.000Z', 0],

                // ISO 8601 & HTML Living Standard
                ['2022-11-28T01:02:03', 'YYYY-MM-DDTHH:mm:ss', '2022-11-28T01:02:03.000Z'],
                ['2022-11-28T01:02:03', 'YYYY-MM-DDTHH:mm:ss', '2022-11-28T01:02:03.000Z', 'Z'],
                ['2022-11-28T01:02:03', 'YYYY-MM-DDTHH:mm:ss', '2022-11-28T01:02:03.000Z', 0],
                ['2022-11-28T01:02:03', 'YYYY-MM-DDTHH:mm:ss', '2022-11-27T20:02:03.000-05:00', '-05:00'],
                ['2022-11-28T01:02:03.987', 'YYYY-MM-DDTHH:mm:ss.SSS'],
                ['2022-11-28T01:02:03.987', 'YYYY-MM-DDTHH:mm:ss.SSS', DEFAULT_EXPECTED_VALUE, 0],
                ['2022-11-28T01:02:03.987', 'YYYY-MM-DDTHH:mm:ss.SSS', '2022-11-27T20:02:03.987-05:00' ,'-05:00'],
                ['2022-11', 'YYYY-MM', '2022-11-01T00:00:00.000Z'],
                ['2022-11', 'YYYY-MM', '2022-10-31T19:00:00.000-05:00', '-05:00'],

                // HTML Living Standard
                ['2022-11-28 01:02:03.987', 'No separator, no offset information'],
                ['2022-11-28 01:02:03.987', 'No separator, no offset information', '2022-11-27T20:02:03.987-05:00', '-05:00'],
                ['--11-28', '--MM-DD', '2001-11-28T00:00:00.000Z'],
                ['11-28', 'MM-DD', '2001-11-28T00:00:00.000Z'],
            ];
            dateTests.forEach(([dateValue, message, expected, utcOffset]) => {
                it(`should accept date-time values with the format '${message}' and offset '${utcOffset}'`, () => {
                // Simulate running the tests in UTC+1, i.e. a non-zero local offset
                // serializer.setDefaultOptions({ utcOffset: 60 });

                    json.date = dateValue;
                    const options = utcOffset !== undefined ? { utcOffset } : {};
                    const result = serializer.toJSON(serializer.fromJSON(json, options), options);
                    result.date.should.equal(expected || DEFAULT_EXPECTED_VALUE);
                });
            });

            const negativeDateTests =[
                // ISO 8601
                ['2022‐11‐28T01:02:03.987Z', 'U+2010 HYPHEN'],
                ['2022−11−28T01:02:03.987Z', 'U+2212 MINUS'],
                ['2022-11-28T11,7', 'YYYY-MM-DDTHH,1h'],
                ['2022-W48', 'YYYY-Ww'],
                ['2022-W48-1', 'YYYY-Ww-z'],
                ['20', 'YYY'],
                ['+0020221128T115723Z', '+YYYYYYMMDDTHHMMSSZ'],

                // RFC 3339
                ['2022-11-28_01:02:03.987Z', 'Underscore separator'],
            ];

            negativeDateTests.forEach(([dateValue, message, utcOffset = 0]) => {
                it(`should not accept invalid dates or dateTime values, ${message}`, () => {
                    json.date = dateValue;
                    (() => {
                        const options = { utcOffset };
                        serializer.toJSON(serializer.fromJSON(json, options), options);
                    }).should.throw('Expected value at path `$.date` to be of type `DateTime`');
                });
            });
        });

        describe('strict datetime format, strictQualifiedDateTimes parameter', () => {
            // Test Structure
            // [TEST_STRING, DESCRIPTION, EXPECTED_VALUE, EXPLICIT_UTC_OFFSET]
            const dateTests = [
                // RFC 3339 & ISO 8601
                ['2022-11-28T01:02:03Z', 'YYYY-MM-DDTHH:mm:ssZ', '2022-11-28T01:02:03.000Z'],
                ['2022-11-28T01:02:03Z', 'YYYY-MM-DDTHH:mm:ssZ', '2022-11-28T01:02:03.000Z', 'Z'],
                ['2022-11-28T01:02:03Z', 'YYYY-MM-DDTHH:mm:ssZ', '2022-11-28T01:02:03.000Z', 0],
                ['2022-11-28T01:02:03Z', 'YYYY-MM-DDTHH:mm:ssZ', '2022-11-27T20:02:03.000-05:00', '-05:00'],
                ['2022-11-28T01:02:03-05:00', 'YYYY-MM-DDTHH:mm:ss-HH:mm', '2022-11-28T01:02:03.000-05:00', '-05:00'],
                ['2022-11-28T01:02:03-08:00', 'YYYY-MM-DDTHH:mm:ss-HH:mm', '2022-11-28T09:02:03.000Z'],
                ['2022-11-28T01:02:03.9Z', 'YYYY-MM-DDTHH:mm:ss.SZ', '2022-11-28T01:02:03.900Z'],
                ['2022-11-28T01:02:03.98Z', 'YYYY-MM-DDTHH:mm:ss.SSZ', '2022-11-28T01:02:03.980Z'],
                ['2022-11-28T01:02:03.987Z', 'YYYY-MM-DDTHH:mm:ss.SSSZ'],
                ['2022-11-28T01:02:03+08:00', 'YYYY-MM-DDTHH:mm:ss+HH:mm', '2022-11-27T17:02:03.000Z'],
                ['2022-11-28T01:02:03.987+08:00', 'YYYY-MM-DDTHH:mm:ss.SSS+HH:mm', '2022-11-27T17:02:03.987Z'],
                ['2022-11-28T01:02:03.98765+08:00', 'YYYY-MM-DDTHH:mm:ss.SSSSSS+HH:mm', '2022-11-27T17:02:03.987Z'],
                ['2022-11-28T01:02:03-08:00', 'YYYY-MM-DDTHH:mm:ss-HH:mm', '2022-11-28T09:02:03.000Z'],
                ['2022-11-28T01:02:03.987-08:00', 'YYYY-MM-DDTHH:mm:ss.SSS-HH:mm', '2022-11-28T09:02:03.987Z'],
                ['2022-11-28T01:02:03.98765-08:00', 'YYYY-MM-DDTHH:mm:ss.SSSSSS-HH:mm', '2022-11-28T09:02:03.987Z'],
                ['2022-11-28T01:02:03.98765Z', 'YYYY-MM-DDTHH:mm:ss.SSSSSS'],

            ];
            dateTests.forEach(([dateValue, message, expected, utcOffset]) => {
                it(`should accept date-time values with the format '${message}' and offset '${utcOffset}'`, () => {
                    json.date = dateValue;
                    const options = utcOffset !== undefined ? { utcOffset } : {};
                    options.strictQualifiedDateTimes = true;
                    const result = serializer.toJSON(serializer.fromJSON(json, options), options);
                    result.date.should.equal(expected || DEFAULT_EXPECTED_VALUE);
                });
            });

            const negativeDateTests =[
                // RFC 3339 & ISO 8601
                ['2022-11-28', 'YYYY-MM-DD'],
                ['2022-11-28', 'YYYY-MM-DD'],
                ['2022-11-28', 'YYYY-MM-DD'],
                ['2022-11-28', 'YYYY-MM-DD'],

                // RFC 3339 && HTML Living Standard
                ['2022-11-28 01:02:03.987Z', 'YYYY-MM-DD HH:mm:ss.SSSZ'],

                // RFC 3339
                ['2022-11-28t01:02:03.987Z', 'Lowercase t'],
                ['2022-11-28T01:02:03.987z', 'Lowercase z'],
                ['2022-11-28_01:02:03.987Z', 'Underscore separator'],

                // ISO 8601
                ['2022', 'YYYY'],
                ['2022', 'YYYY'],
                ['+002022-11-28', '+YYYYYY-MM-DD'],
                ['+002022-11-28', '+YYYYYY-MM-DD'],
                ['2022‐11‐28T01:02:03.987Z', 'U+2010 HYPHEN'],
                ['2022−11−28T01:02:03.987Z', 'U+2212 MINUS'],
                ['2022-11-28T11,7', 'YYYY-MM-DDTHH,1h'],
                ['2022-W48', 'YYYY-Ww'],
                ['2022-W48-1', 'YYYY-Ww-z'],
                ['20', 'YYY'],
                ['+0020221128T115723Z', '+YYYYYYMMDDTHHMMSSZ'],

                // ISO 8601 & HTML Living Standard
                ['2022-11-28T01:02:03', 'YYYY-MM-DDTHH:mm:ss'],
                ['2022-11-28T01:02:03', 'YYYY-MM-DDTHH:mm:ss'],
                ['2022-11-28T01:02:03', 'YYYY-MM-DDTHH:mm:ss'],
                ['2022-11-28T01:02:03', 'YYYY-MM-DDTHH:mm:ss'],
                ['2022-11-28T01:02:03.987', 'YYYY-MM-DDTHH:mm:ss.SSS'],
                ['2022-11-28T01:02:03.987', 'YYYY-MM-DDTHH:mm:ss.SSS'],
                ['2022-11-28T01:02:03.987', 'YYYY-MM-DDTHH:mm:ss.SSS'],
                ['2022-11', 'YYYY-MM'],
                ['2022-11', 'YYYY-MM'],

                // HTML Living Standard
                ['2022-11-28 01:02:03.987', 'No separator, no offset information'],
                ['2022-11-28 01:02:03.987', 'No separator, no offset information'],
                ['--11-28', '--MM-DD'],
                ['11-28', 'MM-DD'],

                // Other
                ['2022-11-28T01:02:03.987-08', 'YYYY-MM-DDTHH:mm:ss.SSS-HH'],

            ];

            negativeDateTests.forEach(([dateValue, message, utcOffset = 0]) => {
                it(`should not accept invalid dates or dateTime values, ${message}`, () => {
                    json.date = dateValue;
                    (() => {
                        const options = { utcOffset, strictQualifiedDateTimes: true };
                        serializer.toJSON(serializer.fromJSON(json, options), options);
                    }).should.throw('Expected value at path `$.date` to be of type `DateTime`');
                });
            });
        });
    });

});
