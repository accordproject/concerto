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

const dayjs = require('dayjs');

const Factory = require('../../../src/factory');
const ModelManager = require('../../../src/modelmanager');
const Resource = require('../../../src/model/resource');
const Serializer = require('../../../src/serializer');
const Util = require('../../composer/composermodelutility');

require('chai').should();
const sinon = require('sinon');

describe('Serializer', () => {

    let sandbox;
    let factory;
    let modelManager;
    let serializer;

    beforeEach(() => {
        process.env.ENABLE_MAP_TYPE = 'true';
        sandbox = sinon.createSandbox();

        modelManager = new ModelManager();
        Util.addComposerModel(modelManager);
        modelManager.addCTOModel(`
        namespace org.acme.sample@1.0.0

        concept Concepts {
            o Dictionary dict optional
            o Diary diary optional
            o Timer timer optional
            o StopWatch stopwatch optional
            o RSVP rsvp optional
            o Database database optional
            o Appointment appointment optional
            o Birthday birthday optional
            o Celebration celebration optional
            o Rolodex rolodex optional
            o Directory directory optional
            o Score score optional
            o Points points optional
            o Balance balance optional
        }

        scalar GUID extends String

        scalar Time extends DateTime

        scalar PostalCode extends String

        concept Person identified by name {
            o String name
        }

        map Dictionary {
            o String
            o String
        }

        map Diary {
            o DateTime
            o String
        }

        map Timer {
            o DateTime
            o DateTime
        }

        map StopWatch {
            o Time
            o Time
        }

        map RSVP {
            o String
            o Boolean
        }

        map Database {
            o GUID
            o String
        }

        map Directory {
            o GUID
            o Person
        }

        map Appointment {
            o Time
            o String
        }

        map Birthday {
            o String
            o DateTime
        }

        map Celebration {
            o String
            o Time
        }

        map Rolodex {
            o String
            o Person
        }

        map Score {
            o String
            o Integer
        }

        map Points {
            o String
            o Long
        }

        map Balance {
            o String
            o Double
        }

        `);
        factory = new Factory(modelManager);

        serializer = new Serializer(factory, modelManager);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('# toJSON <> fromJSON', () => {
        it('should serialize -> deserialize with a Map <String, String>', () => {
            // setup
            let concept = factory.newConcept('org.acme.sample@1.0.0', 'Concepts');

            concept.dict = new Map();
            concept.dict.set('Lorem', 'Ipsum');
            concept.dict.set('Ipsum', 'Lorem');

            // serialize and assert
            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                dict: {
                    Lorem: 'Ipsum',
                    Ipsum: 'Lorem'
                }
            });

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.dict.should.be.an.instanceOf(Map);
            resource.dict.get('Lorem').should.equal('Ipsum');
            resource.dict.get('Ipsum').should.equal('Lorem');
        });

        it('should serialize -> deserialize with a Map <String, Integer>', () => {
            // setup
            let concept = factory.newConcept('org.acme.sample@1.0.0', 'Concepts');

            concept.score = new Map();
            concept.score.set('Bob', 1);
            concept.score.set('Alice', 1);

            // serialize and assert
            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                score: {
                    Bob: 1,
                    Alice: 1
                }
            });

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.score.should.be.an.instanceOf(Map);
            resource.score.get('Bob').should.equal(1);
            resource.score.get('Alice').should.equal(1);
        });

        it('should serialize -> deserialize with a Map <String, Long>', () => {
            // setup
            let concept = factory.newConcept('org.acme.sample@1.0.0', 'Concepts');

            concept.points = new Map();
            concept.points.set('Bob', -398741129664271);
            concept.points.set('Alice', 8999999125356546);

            // serialize and assert
            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                points: {
                    Bob: -398741129664271,
                    Alice: 8999999125356546
                }
            });

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.points.should.be.an.instanceOf(Map);
            resource.points.get('Bob').should.equal(-398741129664271);
            resource.points.get('Alice').should.equal(8999999125356546);
        });

        it('should serialize -> deserialize with a Map <String, Double>', () => {
            // setup
            let concept = factory.newConcept('org.acme.sample@1.0.0', 'Concepts');

            concept.balance = new Map();
            concept.balance.set('Bob', 99999.99);
            concept.balance.set('Alice', 1000000.00);

            // serialize and assert
            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                balance: {
                    Bob: 99999.99,
                    Alice: 1000000.00
                }
            });

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.balance.should.be.an.instanceOf(Map);
            resource.balance.get('Bob').should.equal(99999.99);
            resource.balance.get('Alice').should.equal(1000000.00);
        });

        it('should serialize -> deserialize with a Map <String, Boolean>', () => {
            // setup
            let concept = factory.newConcept('org.acme.sample@1.0.0', 'Concepts');

            concept.rsvp = new Map();
            concept.rsvp.set('Bob', true);
            concept.rsvp.set('Alice', false);

            // serialize and assert
            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                rsvp: {
                    Bob: true,
                    Alice: false
                }
            });

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.rsvp.should.be.an.instanceOf(Map);
            resource.rsvp.get('Bob').should.equal(true);
            resource.rsvp.get('Alice').should.equal(false);
        });

        it('should serialize -> deserialize with a Map <String, DateTime>', () => {
            // setup
            let concept = factory.newConcept('org.acme.sample@1.0.0', 'Concepts');

            concept.birthday = new Map();
            concept.birthday.set('Bob', dayjs('2023-10-28T01:02:03Z'));
            concept.birthday.set('Alice', dayjs('2024-10-28T01:02:03Z'));

            // serialize and assert
            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                birthday: {
                    Bob: '2023-10-28T01:02:03.000Z',
                    Alice: '2024-10-28T01:02:03.000Z'
                }
            });

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.birthday.should.be.an.instanceOf(Map);
            resource.birthday.get('Bob').unix().should.equal(dayjs('2023-10-28T01:02:03Z').unix());
            resource.birthday.get('Alice').unix().should.equal(dayjs('2024-10-28T01:02:03Z').unix());
        });

        it('should serialize -> deserialize with a Map <String, Scalar>', () => {
            // setup
            let concept = factory.newConcept('org.acme.sample@1.0.0', 'Concepts');

            concept.celebration = new Map();
            concept.celebration.set('BobBirthday', dayjs('2022-11-28T01:02:03Z'));
            concept.celebration.set('AliceAnniversary', dayjs('2023-10-28T01:02:03Z'));

            // serialize and assert
            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                celebration: {
                    'BobBirthday': '2022-11-28T01:02:03.000Z',
                    'AliceAnniversary': '2023-10-28T01:02:03.000Z',
                }
            });

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.celebration.should.be.an.instanceOf(Map);
            resource.celebration.get('BobBirthday').unix().should.equal(dayjs('2022-11-28T01:02:03Z').unix());
            resource.celebration.get('AliceAnniversary').unix().should.equal(dayjs('2023-10-28T01:02:03Z').unix());
        });

        it('should serialize -> deserialize with a Map <String, Concept>', () => {
            // setup
            let concept = factory.newConcept('org.acme.sample@1.0.0', 'Concepts');

            const bob = factory.newConcept('org.acme.sample@1.0.0', 'Person', 'Bob');
            const alice = factory.newConcept('org.acme.sample@1.0.0', 'Person', 'Alice');

            concept.rolodex = new Map();
            concept.rolodex.set('Dublin', bob);
            concept.rolodex.set('London', alice);

            // serialize & assert
            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                rolodex: {
                    'Dublin': {'$class':'org.acme.sample@1.0.0.Person','name':'Bob'},
                    'London': {'$class':'org.acme.sample@1.0.0.Person','name':'Alice'}
                }
            });

            // deserialize & assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.rolodex.should.be.an.instanceOf(Map);

            resource.rolodex.get('Dublin').should.be.an.instanceOf(Resource);
            resource.rolodex.get('London').should.be.an.instanceOf(Resource);

            resource.rolodex.get('Dublin').toJSON().should.deep.equal({ '$class': 'org.acme.sample@1.0.0.Person', name: 'Bob' });
            resource.rolodex.get('London').toJSON().should.deep.equal({ '$class': 'org.acme.sample@1.0.0.Person', name: 'Alice' });
        });

        it('should serialize -> deserialize with a Map <Scalar, String> : Scalar extends DateTime', () => {
            // setup
            let concept = factory.newConcept('org.acme.sample@1.0.0', 'Concepts');

            concept.appointment = new Map();
            concept.appointment.set(dayjs('2023-11-28T01:02:03Z'), 'BobBirthday');
            concept.appointment.set(dayjs('2024-10-28T01:02:03Z'), 'AliceAnniversary');

            // serialize and assert
            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                appointment: {
                    '2023-11-28T01:02:03.000Z': 'BobBirthday',
                    '2024-10-28T01:02:03.000Z': 'AliceAnniversary'
                }
            });

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.appointment.should.be.an.instanceOf(Map);
            const keyIt = resource.appointment.keys();
            resource.appointment.get(keyIt.next().value).should.equal('BobBirthday');
            resource.appointment.get(keyIt.next().value).should.equal('AliceAnniversary');
        });

        it('should serialize -> deserialize with a Map <Scalar, String> : Scalar extends String', () => {
            // setup
            let concept = factory.newConcept('org.acme.sample@1.0.0', 'Concepts');

            concept.database = new Map();
            concept.database.set('D4F45017-AD2B-416B-AD9F-3B74F7DEA291', 'Bob');
            concept.database.set('E17B69D9-9B57-4C4A-957E-8B202D7B6C5A', 'Alice');

            // serialize and assert
            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                database: {
                    'D4F45017-AD2B-416B-AD9F-3B74F7DEA291': 'Bob',
                    'E17B69D9-9B57-4C4A-957E-8B202D7B6C5A': 'Alice'
                }
            });

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.database.should.be.an.instanceOf(Map);
            resource.database.get('D4F45017-AD2B-416B-AD9F-3B74F7DEA291').should.equal('Bob');
            resource.database.get('E17B69D9-9B57-4C4A-957E-8B202D7B6C5A').should.equal('Alice');
        });

        it('should serialize -> deserialize with a Map <Scalar, Scalar>', () => {
            // setup
            let concept = factory.newConcept('org.acme.sample@1.0.0', 'Concepts');

            concept.stopwatch = new Map();
            concept.stopwatch.set(dayjs('2023-10-28T00:00:00Z'), dayjs('2023-10-28T11:12:13Z'));
            concept.stopwatch.set(dayjs('2024-11-28T00:00:00Z'), dayjs('2024-11-28T11:12:13Z'));

            // serialize and assert
            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                stopwatch: {
                    '2023-10-28T00:00:00.000Z': '2023-10-28T11:12:13.000Z',
                    '2024-11-28T00:00:00.000Z': '2024-11-28T11:12:13.000Z',
                }
            });

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.stopwatch.should.be.an.instanceOf(Map);
            const keyIt = resource.stopwatch.keys();
            resource.stopwatch.get(keyIt.next().value).unix().should.equal(dayjs('2023-10-28T11:12:13Z').unix());
            resource.stopwatch.get(keyIt.next().value).unix().should.equal(dayjs('2024-11-28T11:12:13Z').unix());
        });

        it('should serialize -> deserialize with a Map <Scalar, Concept>', () => {
            // setup
            let concept = factory.newConcept('org.acme.sample@1.0.0', 'Concepts');

            const bob = factory.newConcept('org.acme.sample@1.0.0', 'Person', 'Bob');
            const alice = factory.newConcept('org.acme.sample@1.0.0', 'Person', 'Alice');

            concept.directory = new Map();
            concept.directory.set('D4F45017-AD2B-416B-AD9F-3B74F7DEA291', bob);
            concept.directory.set('9FAE34BF-18C3-4770-A6AA-6F7656C356B8', alice);

            // serialize and assert
            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                directory: {
                    'D4F45017-AD2B-416B-AD9F-3B74F7DEA291': {'$class':'org.acme.sample@1.0.0.Person','name':'Bob'},
                    '9FAE34BF-18C3-4770-A6AA-6F7656C356B8': {'$class':'org.acme.sample@1.0.0.Person','name':'Alice'},
                }
            });

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.directory.should.be.an.instanceOf(Map);


            resource.directory.get('D4F45017-AD2B-416B-AD9F-3B74F7DEA291').should.be.an.instanceOf(Resource);
            resource.directory.get('9FAE34BF-18C3-4770-A6AA-6F7656C356B8').should.be.an.instanceOf(Resource);

            resource.directory.get('D4F45017-AD2B-416B-AD9F-3B74F7DEA291').toJSON().should.deep.equal({ '$class': 'org.acme.sample@1.0.0.Person', name: 'Bob' });
            resource.directory.get('9FAE34BF-18C3-4770-A6AA-6F7656C356B8').toJSON().should.deep.equal({ '$class': 'org.acme.sample@1.0.0.Person', name: 'Alice' });
        });

        it('should serialize -> deserialize with a Map <DateTime, String>', () => {
            // setup
            let concept = factory.newConcept('org.acme.sample@1.0.0', 'Concepts');

            concept.diary = new Map();
            concept.diary.set(dayjs('2023-10-28T01:02:03Z'), 'Birthday');
            concept.diary.set(dayjs('2024-10-28T01:02:03Z'), 'Anniversary');

            // serialize and assert
            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                diary: {
                    '2023-10-28T01:02:03.000Z': 'Birthday',
                    '2024-10-28T01:02:03.000Z': 'Anniversary'
                }
            });

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.diary.should.be.an.instanceOf(Map);
            const keyIt = resource.diary.keys();
            resource.diary.get(keyIt.next().value).should.equal('Birthday');
            resource.diary.get(keyIt.next().value).should.equal('Anniversary');
        });
    });

    describe('# fromJSON <> toJSON', () => {
        it('should deserialize -> serialize with a Map <String, String>', () => {
            // setup
            let json = {
                $class: 'org.acme.sample@1.0.0.Concepts',
                dict: {
                    Bob: 'Ipsum',
                    Alice: 'Lorem'
                }
            };

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.dict.should.be.an.instanceOf(Map);
            resource.dict.get('Bob').should.equal('Ipsum');
            resource.dict.get('Alice').should.equal('Lorem');

            // serialize and assert
            json = serializer.toJSON(resource);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                dict: {
                    Bob: 'Ipsum',
                    Alice: 'Lorem'
                }
            });
        });

        it('should deserialize -> serialize with a Map <String, Integer>', () => {
            // setup
            let json = {
                $class: 'org.acme.sample@1.0.0.Concepts',
                score: {
                    Bob: 1,
                    Alice: 1
                }
            };

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.score.should.be.an.instanceOf(Map);
            resource.score.get('Bob').should.equal(1);
            resource.score.get('Alice').should.equal(1);

            // serialize and assert
            json = serializer.toJSON(resource);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                score: {
                    Bob: 1,
                    Alice: 1
                }
            });
        });

        it('should deserialize -> serialize with a Map <String, Long>', () => {
            // setup
            let json = {
                $class: 'org.acme.sample@1.0.0.Concepts',
                points: {
                    Bob: -398741129664271,
                    Alice: 8999999125356546
                }
            };

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.points.should.be.an.instanceOf(Map);
            resource.points.get('Bob').should.equal(-398741129664271);
            resource.points.get('Alice').should.equal(8999999125356546);

            // serialize and assert
            json = serializer.toJSON(resource);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                points: {
                    Bob: -398741129664271,
                    Alice: 8999999125356546
                }
            });
        });

        it('should deserialize -> serialize with a Map <String, Double>', () => {
            // setup
            let json = {
                $class: 'org.acme.sample@1.0.0.Concepts',
                balance: {
                    Bob: 99999.99,
                    Alice: 1000000.00
                }
            };

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.balance.should.be.an.instanceOf(Map);
            resource.balance.get('Bob').should.equal(99999.99);
            resource.balance.get('Alice').should.equal(1000000.00);

            // serialize and assert
            json = serializer.toJSON(resource);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                balance: {
                    Bob: 99999.99,
                    Alice: 1000000.00
                }
            });
        });

        it('should deserialize -> serialize with a Map <String, Boolean>', () => {
            // setup
            let json = {
                $class: 'org.acme.sample@1.0.0.Concepts',
                rsvp: {
                    Bob: true,
                    Alice: false
                }
            };

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.rsvp.should.be.an.instanceOf(Map);
            resource.rsvp.get('Bob').should.equal(true);
            resource.rsvp.get('Alice').should.equal(false);

            // serialize and assert
            json = serializer.toJSON(resource);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                rsvp: {
                    Bob: true,
                    Alice: false
                }
            });
        });

        it('should deserialize -> serialize with a Map <String, DateTime>', () => {

            const bobBirthday = dayjs('2023-10-28T01:02:03Z');
            const aliceBirthday = dayjs('2024-10-28T01:02:03Z');

            // setup
            let json = {
                $class: 'org.acme.sample@1.0.0.Concepts',
                birthday: {
                    Bob: bobBirthday.utc(),
                    Alice: aliceBirthday.utc()
                }
            };

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.birthday.should.be.an.instanceOf(Map);
            resource.birthday.get('Bob').unix().should.equal(bobBirthday.unix());
            resource.birthday.get('Alice').unix().should.equal(aliceBirthday.unix());

            // serialize and assert
            json = serializer.toJSON(resource);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                birthday: {
                    Bob: '2023-10-28T01:02:03.000Z',
                    Alice: '2024-10-28T01:02:03.000Z'
                }
            });
        });

        it('should deserialize -> serialize with a Map <String, Scalar>', () => {

            const bobBirthday = dayjs('2022-11-28T01:02:03.000Z');
            const aliceAnniversary = dayjs('2023-10-28T01:02:03.000Z');

            // setup
            let json = {
                $class: 'org.acme.sample@1.0.0.Concepts',
                celebration: {
                    'BobBirthday': bobBirthday.utc(),
                    'AliceAnniversary': aliceAnniversary.utc(),
                }
            };

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.celebration.should.be.an.instanceOf(Map);
            resource.celebration.get('BobBirthday').unix().should.equal(bobBirthday.unix());
            resource.celebration.get('AliceAnniversary').unix().should.equal(aliceAnniversary.unix());

            // serialize and assert
            json = serializer.toJSON(resource);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                celebration: {
                    'BobBirthday': '2022-11-28T01:02:03.000Z',
                    'AliceAnniversary': '2023-10-28T01:02:03.000Z',
                }
            });

        });

        it('should deserialize -> serialize with a Map <String, Concept>', () => {
            // setup
            let json = {
                $class: 'org.acme.sample@1.0.0.Concepts',
                rolodex: {
                    'Dublin': {'$class':'org.acme.sample@1.0.0.Person','name':'Bob'},
                    'London': {'$class':'org.acme.sample@1.0.0.Person','name':'Alice'}
                }
            };

            // deserialize & assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.rolodex.should.be.an.instanceOf(Map);

            resource.rolodex.get('Dublin').should.be.an.instanceOf(Resource);
            resource.rolodex.get('London').should.be.an.instanceOf(Resource);

            resource.rolodex.get('Dublin').toJSON().should.deep.equal({ '$class': 'org.acme.sample@1.0.0.Person', name: 'Bob' });
            resource.rolodex.get('London').toJSON().should.deep.equal({ '$class': 'org.acme.sample@1.0.0.Person', name: 'Alice' });

            // serialize & assert
            json = serializer.toJSON(resource);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                rolodex: {
                    'Dublin': {'$class':'org.acme.sample@1.0.0.Person','name':'Bob'},
                    'London': {'$class':'org.acme.sample@1.0.0.Person','name':'Alice'}
                }
            });
        });

        it('should deserialize -> serialize with a Map <Scalar, String> - Scalar extends DateTime', () => {
            // setup
            let json = {
                $class: 'org.acme.sample@1.0.0.Concepts',
                appointment: {
                    '2023-11-28T01:02:03Z': 'Lorem',
                    '2024-10-28T01:02:03Z': 'Ipsum'
                }
            };

            // deserialize & assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.appointment.should.be.an.instanceOf(Map);
            const keyIt = resource.appointment.keys();
            resource.appointment.get(keyIt.next().value).should.equal('Lorem');
            resource.appointment.get(keyIt.next().value).should.equal('Ipsum');

            // serialize & assert
            json = serializer.toJSON(resource);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                appointment: {
                    '2023-11-28T01:02:03.000Z': 'Lorem',
                    '2024-10-28T01:02:03.000Z': 'Ipsum'
                }
            });
        });

        it('should deserialize -> serialize with a Map <Scalar, String> - Scalar extends String', () => {
            // setup
            let json = {
                $class: 'org.acme.sample@1.0.0.Concepts',
                database: {
                    'D4F45017-AD2B-416B-AD9F-3B74F7DEA291': 'Lorem',
                    'E17B69D9-9B57-4C4A-957E-8B202D7B6C5A': 'Ipsum'
                }
            };

            // deserialize & assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.database.should.be.an.instanceOf(Map);
            resource.database.get('D4F45017-AD2B-416B-AD9F-3B74F7DEA291').should.equal('Lorem');
            resource.database.get('E17B69D9-9B57-4C4A-957E-8B202D7B6C5A').should.equal('Ipsum');

            // serialize & assert
            json = serializer.toJSON(resource);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                database: {
                    'D4F45017-AD2B-416B-AD9F-3B74F7DEA291': 'Lorem',
                    'E17B69D9-9B57-4C4A-957E-8B202D7B6C5A': 'Ipsum'
                }
            });
        });

        it('should deserialize -> serialize with a Map <Scalar, Scalar>', () => {
            // setup
            let json = {
                $class: 'org.acme.sample@1.0.0.Concepts',
                stopwatch: {
                    '2023-10-28T00:00:00Z': '2023-10-28T11:12:13Z',
                    '2024-11-28T00:00:00Z': '2024-11-28T11:12:13Z',
                }
            };

            // deserialize & assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.stopwatch.should.be.an.instanceOf(Map);
            const keyIt = resource.stopwatch.keys();
            resource.stopwatch.get(keyIt.next().value).unix().should.equal(dayjs('2023-10-28T11:12:13Z').unix());
            resource.stopwatch.get(keyIt.next().value).unix().should.equal(dayjs('2024-11-28T11:12:13Z').unix());

            // serialize & assert
            json = serializer.toJSON(resource);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                stopwatch: {
                    '2023-10-28T00:00:00.000Z': '2023-10-28T11:12:13.000Z',
                    '2024-11-28T00:00:00.000Z': '2024-11-28T11:12:13.000Z',
                }
            });
        });

        it('should deserialize -> serialize with a Map <Scalar, Concept>', () => {
            // setup
            let json = {
                $class: 'org.acme.sample@1.0.0.Concepts',
                directory: {
                    'D4F45017-AD2B-416B-AD9F-3B74F7DEA291': {'$class':'org.acme.sample@1.0.0.Person','name':'Bob'},
                    '9FAE34BF-18C3-4770-A6AA-6F7656C356B8': {'$class':'org.acme.sample@1.0.0.Person','name':'Alice'},
                }
            };

            // deserialize & assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.directory.should.be.an.instanceOf(Map);
            resource.directory.get('D4F45017-AD2B-416B-AD9F-3B74F7DEA291').should.be.an.instanceOf(Resource);
            resource.directory.get('9FAE34BF-18C3-4770-A6AA-6F7656C356B8').should.be.an.instanceOf(Resource);
            resource.directory.get('D4F45017-AD2B-416B-AD9F-3B74F7DEA291').toJSON().should.deep.equal({ '$class': 'org.acme.sample@1.0.0.Person', name: 'Bob' });
            resource.directory.get('9FAE34BF-18C3-4770-A6AA-6F7656C356B8').toJSON().should.deep.equal({ '$class': 'org.acme.sample@1.0.0.Person', name: 'Alice' });

            // serialize & assert
            json = serializer.toJSON(resource);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                directory: {
                    'D4F45017-AD2B-416B-AD9F-3B74F7DEA291': {'$class':'org.acme.sample@1.0.0.Person','name':'Bob'},
                    '9FAE34BF-18C3-4770-A6AA-6F7656C356B8': {'$class':'org.acme.sample@1.0.0.Person','name':'Alice'},
                }
            });
        });

        it('should deserialize -> serialize with a Map <DateTime, String>', () => {
            // setup
            let json = {
                $class: 'org.acme.sample@1.0.0.Concepts',
                diary: {
                    '2023-10-28T01:02:03Z': 'Birthday',
                    '2024-10-28T01:02:03Z': 'Anniversary'
                }
            };

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.diary.should.be.an.instanceOf(Map);
            const keyIt = resource.diary.keys();
            resource.diary.get(keyIt.next().value).should.equal('Birthday');
            resource.diary.get(keyIt.next().value).should.equal('Anniversary');

            // serialize and assert
            json = serializer.toJSON(resource);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                diary: {
                    '2023-10-28T01:02:03.000Z': 'Birthday',
                    '2024-10-28T01:02:03.000Z': 'Anniversary'
                }
            });
        });
    });

    describe('#toJSON failure scenarios', () => {

        it('should ignore system properties', () => {
            let concept = factory.newConcept('org.acme.sample@1.0.0', 'Concepts');

            concept.dict = new Map();
            concept.dict.set('$type', 'foo');
            concept.dict.set('Lorem', 'Ipsum');
            concept.dict.set('Ipsum', 'Lorem');

            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                dict: {
                    Lorem: 'Ipsum',
                    Ipsum: 'Lorem'
                }
            });
        });
    });

    describe('#fromJSON failure scenarios', () => {
        it('should throw for Enums as Map key types', () => {
            let json = {
                $class: 'org.acme.sample@1.0.0.Concepts',
                stateLog: {
                    'ON': '2000-01-01T00:00:00.000Z',
                    'OFF': '2000-01-01T00:00:00.000Z',
                }
            };
            (() => {
                serializer.fromJSON(json);
            }).should.throw('Unexpected properties for type org.acme.sample@1.0.0.Concepts: stateLog');
        });
    });
});

