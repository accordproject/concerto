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

const { Factory } = require('../../../src/factory');
const { ModelManager } = require('../../../src/modelmanager');
const { Resource } = require('../../../src/model/resource');
const { Serializer } = require('../../../src/serializer');
const Util = require('../../composer/composermodelutility');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

require('chai').should();
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
            concept.birthday.set('Bob', '2023-10-28T01:02:03Z');
            concept.birthday.set('Alice', '2024-10-28T01:02:03Z');

            // serialize and assert
            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                birthday: {
                    Bob: '2023-10-28T01:02:03Z',
                    Alice: '2024-10-28T01:02:03Z'
                }
            });

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.birthday.should.be.an.instanceOf(Map);
            resource.birthday.get('Bob').should.equal('2023-10-28T01:02:03Z');
            resource.birthday.get('Alice').should.equal('2024-10-28T01:02:03Z');
        });

        it('should serialize -> deserialize with a Map <String, Scalar>', () => {
            // setup
            let concept = factory.newConcept('org.acme.sample@1.0.0', 'Concepts');

            concept.celebration = new Map();
            concept.celebration.set('BobBirthday', '2022-11-28T01:02:03Z');
            concept.celebration.set('AliceAnniversary', '2023-10-28T01:02:03Z');

            // serialize and assert
            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                celebration: {
                    'BobBirthday': '2022-11-28T01:02:03Z',
                    'AliceAnniversary': '2023-10-28T01:02:03Z',
                }
            });

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.celebration.should.be.an.instanceOf(Map);
            resource.celebration.get('BobBirthday').should.equal('2022-11-28T01:02:03Z');
            resource.celebration.get('AliceAnniversary').should.equal('2023-10-28T01:02:03Z');
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
            concept.appointment.set('2023-11-28T01:02:03Z', 'BobBirthday');
            concept.appointment.set('2024-10-28T01:02:03Z', 'AliceAnniversary');

            // serialize and assert
            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                appointment: {
                    '2023-11-28T01:02:03Z': 'BobBirthday',
                    '2024-10-28T01:02:03Z': 'AliceAnniversary'
                }
            });

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.appointment.should.be.an.instanceOf(Map);
            resource.appointment.get('2023-11-28T01:02:03Z').should.equal('BobBirthday');
            resource.appointment.get('2024-10-28T01:02:03Z').should.equal('AliceAnniversary');
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
            concept.stopwatch.set('2023-10-28T00:00:00Z', '2023-10-28T11:12:13Z');
            concept.stopwatch.set('2024-11-28T00:00:00Z', '2024-11-28T11:12:13Z');

            // serialize and assert
            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                stopwatch: {
                    '2023-10-28T00:00:00Z': '2023-10-28T11:12:13Z',
                    '2024-11-28T00:00:00Z': '2024-11-28T11:12:13Z',
                }
            });

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.stopwatch.should.be.an.instanceOf(Map);
            resource.stopwatch.get('2023-10-28T00:00:00Z').should.equal('2023-10-28T11:12:13Z');
            resource.stopwatch.get('2024-11-28T00:00:00Z').should.equal('2024-11-28T11:12:13Z');
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
            concept.diary.set('2023-10-28T01:02:03Z', 'Birthday');
            concept.diary.set('2024-10-28T01:02:03Z', 'Anniversary');

            // serialize and assert
            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                diary: {
                    '2023-10-28T01:02:03Z': 'Birthday',
                    '2024-10-28T01:02:03Z': 'Anniversary'
                }
            });

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.diary.should.be.an.instanceOf(Map);
            resource.diary.get('2023-10-28T01:02:03Z').should.equal('Birthday');
            resource.diary.get('2024-10-28T01:02:03Z').should.equal('Anniversary');
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
            // setup
            let json = {
                $class: 'org.acme.sample@1.0.0.Concepts',
                birthday: {
                    Bob: '2023-10-28T01:02:03Z',
                    Alice: '2024-10-28T01:02:03Z'
                }
            };

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.birthday.should.be.an.instanceOf(Map);
            resource.birthday.get('Bob').should.equal('2023-10-28T01:02:03Z');
            resource.birthday.get('Alice').should.equal('2024-10-28T01:02:03Z');

            // serialize and assert
            json = serializer.toJSON(resource);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                birthday: {
                    Bob: '2023-10-28T01:02:03Z',
                    Alice: '2024-10-28T01:02:03Z'
                }
            });
        });

        it('should deserialize -> serialize with a Map <String, Scalar>', () => {
            // setup
            let json = {
                $class: 'org.acme.sample@1.0.0.Concepts',
                celebration: {
                    'BobBirthday': '2022-11-28T01:02:03Z',
                    'AliceAnniversary': '2023-10-28T01:02:03Z',
                }
            };

            // deserialize and assert
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.celebration.should.be.an.instanceOf(Map);
            resource.celebration.get('BobBirthday').should.equal('2022-11-28T01:02:03Z');
            resource.celebration.get('AliceAnniversary').should.equal('2023-10-28T01:02:03Z');

            // serialize and assert
            json = serializer.toJSON(resource);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                celebration: {
                    'BobBirthday': '2022-11-28T01:02:03Z',
                    'AliceAnniversary': '2023-10-28T01:02:03Z',
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
            resource.appointment.get('2023-11-28T01:02:03Z').should.equal('Lorem');
            resource.appointment.get('2024-10-28T01:02:03Z').should.equal('Ipsum');

            // serialize & assert
            json = serializer.toJSON(resource);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                appointment: {
                    '2023-11-28T01:02:03Z': 'Lorem',
                    '2024-10-28T01:02:03Z': 'Ipsum'
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
            resource.stopwatch.get('2023-10-28T00:00:00Z').should.equal('2023-10-28T11:12:13Z');
            resource.stopwatch.get('2024-11-28T00:00:00Z').should.equal('2024-11-28T11:12:13Z');

            // serialize & assert
            json = serializer.toJSON(resource);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                stopwatch: {
                    '2023-10-28T00:00:00Z': '2023-10-28T11:12:13Z',
                    '2024-11-28T00:00:00Z': '2024-11-28T11:12:13Z',
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
            resource.diary.get('2023-10-28T01:02:03Z').should.equal('Birthday');
            resource.diary.get('2024-10-28T01:02:03Z').should.equal('Anniversary');

            // serialize and assert
            json = serializer.toJSON(resource);

            json.should.deep.equal({
                $class: 'org.acme.sample@1.0.0.Concepts',
                diary: {
                    '2023-10-28T01:02:03Z': 'Birthday',
                    '2024-10-28T01:02:03Z': 'Anniversary'
                }
            });
        });
    });

    describe('#toJSON failure scenarios', () => {
        it('should throw if bad Key value is provided for Map, where Key Type DateTime is expected', () => {
            let concept = factory.newConcept('org.acme.sample@1.0.0', 'Concepts');

            concept.appointment = new Map();
            concept.appointment.set('BAD-DATE-28T01:02:03Z', 'Lorem'); // Bad DateTime

            (() => {
                serializer.toJSON(concept);
            }).should.throw('Model violation in org.acme.sample@1.0.0.Appointment. Expected Type of DateTime but found \'BAD-DATE-28T01:02:03Z\' instead.');
        });

        it('should throw if bad Key value is provided for Map, where Key Type String is expected', () => {
            let concept = factory.newConcept('org.acme.sample@1.0.0', 'Concepts');

            concept.dict = new Map();
            concept.dict.set(1234, 'Lorem'); // Bad key

            (() => {
                serializer.toJSON(concept);
            }).should.throw('Model violation in org.acme.sample@1.0.0.Dictionary. Expected Type of String but found \'1234\' instead.');
        });

        it('should throw if a bad Value is Supplied for Map, where Value type Boolean is expected', () => {
            let concept = factory.newConcept('org.acme.sample@1.0.0', 'Concepts');

            concept.rsvp = new Map();
            concept.rsvp.set('Lorem', true);
            concept.rsvp.set('Ipsum', 'false');

            (() => {
                serializer.toJSON(concept);
            }).should.throw('Model violation in org.acme.sample@1.0.0.RSVP. Expected Type of Boolean but found string instead, for value \'false\'.');
        });

        it('should throw if a bad Value is Supplied for Map, where Value type String is expected', () => {
            let concept = factory.newConcept('org.acme.sample@1.0.0', 'Concepts');

            concept.dict = new Map();
            concept.dict.set('Lorem', 1234);

            (() => {
                serializer.toJSON(concept);
            }).should.throw('Model violation in org.acme.sample@1.0.0.Dictionary. Expected Type of String but found \'1234\' instead.');
        });

        it('should throw if a bad value is Supplied for Map - where Value type Boolean is expected', () => {
            let concept = factory.newConcept('org.acme.sample@1.0.0', 'Concepts');

            concept.timer = new Map();
            concept.timer.set('2023-10-28T01:02:03Z', '2023-10-28T01:02:03Z');
            concept.timer.set('2023-10-28T01:02:03Z', 'BAD-DATE-VALUE');

            (() => {
                serializer.toJSON(concept);
            }).should.throw('Model violation in org.acme.sample@1.0.0.Timer. Expected Type of DateTime but found \'BAD-DATE-VALUE\' instead.');
        });

        it('should throw if the value of a Map is not a Map instance', () => {
            let concept = factory.newConcept('org.acme.sample@1.0.0', 'Concepts');

            concept.dict = 'xyz'; // bad value

            (() => {
                serializer.toJSON(concept);
            }).should.throw(`Expected a Map, but found ${JSON.stringify(concept.dict)}`);
        });

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

    describe('# cross-namespace concept values in maps', () => {
        let xnsModelManager;
        let xnsFactory;
        let xnsSerializer;

        beforeEach(() => {
            xnsModelManager = new ModelManager();
            Util.addComposerModel(xnsModelManager);

            // the value concept lives in its own namespace
            xnsModelManager.addCTOModel(`
            namespace org.acme.unit@1.0.0

            concept MonetaryUnit {
                o String code
                o Integer scale
            }
            `, 'unit.cto');

            // the map (and its container) live in a different namespace and
            // import the value concept
            xnsModelManager.addCTOModel(`
            namespace org.acme.registry@1.0.0

            import org.acme.unit@1.0.0.{MonetaryUnit}

            map UnitMap {
                o String
                o MonetaryUnit
            }

            concept Registry {
                o UnitMap units optional
            }
            `, 'registry.cto');

            xnsFactory = new Factory(xnsModelManager);
            xnsSerializer = new Serializer(xnsFactory, xnsModelManager);
        });

        it('should serialize -> deserialize a Map whose value concept is imported from another namespace', () => {
            const registry = xnsFactory.newConcept('org.acme.registry@1.0.0', 'Registry');

            const usd = xnsFactory.newConcept('org.acme.unit@1.0.0', 'MonetaryUnit');
            usd.code = 'USD';
            usd.scale = 2;
            const jpy = xnsFactory.newConcept('org.acme.unit@1.0.0', 'MonetaryUnit');
            jpy.code = 'JPY';
            jpy.scale = 0;

            registry.units = new Map();
            registry.units.set('USD', usd);
            registry.units.set('JPY', jpy);

            // previously threw: TypeError: Cannot read properties of undefined (reading 'accept')
            // because the value declaration was looked up only in the map's own model file.
            const json = xnsSerializer.toJSON(registry);

            json.should.deep.equal({
                $class: 'org.acme.registry@1.0.0.Registry',
                units: {
                    USD: { $class: 'org.acme.unit@1.0.0.MonetaryUnit', code: 'USD', scale: 2 },
                    JPY: { $class: 'org.acme.unit@1.0.0.MonetaryUnit', code: 'JPY', scale: 0 }
                }
            });

            const resource = xnsSerializer.fromJSON(json);
            resource.units.should.be.an.instanceOf(Map);
            resource.units.get('USD').code.should.equal('USD');
            resource.units.get('USD').scale.should.equal(2);
            resource.units.get('JPY').scale.should.equal(0);

            // round-trips back to the same JSON
            xnsSerializer.toJSON(resource).should.deep.equal(json);
        });
    });

    describe('Map keys and values type validation (#1560)', () => {
        let typeModelManager;
        let typeFactory;
        let typeSerializer;

        beforeEach(() => {
            typeModelManager = new ModelManager({ strict: true });
            typeModelManager.addCTOModel(`
            namespace org.lib@1.0.0
            concept Addr {
                o String street
            }
            scalar Upper extends String regex=/^[A-Z]+$/
            `, 'lib.cto');

            typeModelManager.addCTOModel(`
            namespace org.acme.types@1.0.0
            import org.lib@1.0.0.{Addr, Upper}

            scalar Code extends String regex=/^[A-Z]+$/
            scalar Name extends String

            map StrToInt {
                o String
                o Integer
            }

            map StrToLong {
                o String
                o Long
            }

            map StrToDouble {
                o String
                o Double
            }

            map StrToBool {
                o String
                o Boolean
            }

            map StrToDate {
                o String
                o DateTime
            }

            map StrToName {
                o String
                o Name
            }

            map CodeToStr {
                o Code
                o String
            }

            map StrToAddr {
                o String
                o Addr
            }

            map UpperToStr {
                o Upper
                o String
            }

            map StrToUpper {
                o String
                o Upper
            }

            concept Container {
                o StrToInt intMap optional
                o StrToLong longMap optional
                o StrToDouble doubleMap optional
                o StrToBool boolMap optional
                o StrToDate dateMap optional
                o StrToName nameMap optional
                o CodeToStr codeMap optional
                o StrToAddr addrMap optional
                o UpperToStr upperMap optional
                o StrToUpper upperValMap optional
            }
            `, 'types.cto');

            typeFactory = new Factory(typeModelManager);
            typeSerializer = new Serializer(typeFactory, typeModelManager);
        });

        it('should accept valid Integer and reject non-integer values', () => {
            const valid = typeSerializer.fromJSON({
                $class: 'org.acme.types@1.0.0.Container',
                intMap: { k: 42 }
            });
            valid.intMap.get('k').should.equal(42);

            (() => {
                typeSerializer.fromJSON({
                    $class: 'org.acme.types@1.0.0.Container',
                    intMap: { k: 'abc' }
                });
            }).should.throw(/Expected Type of Integer but found 'abc'/);

            (() => {
                typeSerializer.fromJSON({
                    $class: 'org.acme.types@1.0.0.Container',
                    intMap: { k: 1.5 }
                });
            }).should.throw(/Expected Type of Integer but found '1.5'/);
        });

        it('should accept valid Long and reject non-long values', () => {
            const valid = typeSerializer.fromJSON({
                $class: 'org.acme.types@1.0.0.Container',
                longMap: { k: 100 }
            });
            valid.longMap.get('k').should.equal(100);

            (() => {
                typeSerializer.fromJSON({
                    $class: 'org.acme.types@1.0.0.Container',
                    longMap: { k: 'abc' }
                });
            }).should.throw(/Expected Type of Long but found 'abc'/);

            (() => {
                typeSerializer.fromJSON({
                    $class: 'org.acme.types@1.0.0.Container',
                    longMap: { k: 2.5 }
                });
            }).should.throw(/Expected Type of Long but found '2.5'/);
        });

        it('should accept valid Double and reject non-number values', () => {
            const valid = typeSerializer.fromJSON({
                $class: 'org.acme.types@1.0.0.Container',
                doubleMap: { k: 3.14 }
            });
            valid.doubleMap.get('k').should.equal(3.14);

            (() => {
                typeSerializer.fromJSON({
                    $class: 'org.acme.types@1.0.0.Container',
                    doubleMap: { k: 'abc' }
                });
            }).should.throw(/Expected Type of Double but found 'abc'/);

            (() => {
                typeSerializer.fromJSON({
                    $class: 'org.acme.types@1.0.0.Container',
                    doubleMap: { k: Infinity }
                });
            }).should.throw(/Expected Type of Double/);
        });

        it('should accept valid Boolean and reject non-boolean values', () => {
            const valid = typeSerializer.fromJSON({
                $class: 'org.acme.types@1.0.0.Container',
                boolMap: { k: true }
            });
            valid.boolMap.get('k').should.equal(true);

            (() => {
                typeSerializer.fromJSON({
                    $class: 'org.acme.types@1.0.0.Container',
                    boolMap: { k: 'true' }
                });
            }).should.throw(/Expected Type of Boolean/);
        });

        it('should accept valid DateTime and reject numbers, booleans, and non-date strings', () => {
            const valid = typeSerializer.fromJSON({
                $class: 'org.acme.types@1.0.0.Container',
                dateMap: { k: '2023-01-01T00:00:00.000Z' }
            });
            valid.dateMap.get('k').should.equal('2023-01-01T00:00:00.000Z');

            (() => {
                typeSerializer.fromJSON({
                    $class: 'org.acme.types@1.0.0.Container',
                    dateMap: { k: true }
                });
            }).should.throw(/Expected Type of DateTime but found 'true'/);

            (() => {
                typeSerializer.fromJSON({
                    $class: 'org.acme.types@1.0.0.Container',
                    dateMap: { k: 1 }
                });
            }).should.throw(/Expected Type of DateTime but found '1'/);

            (() => {
                typeSerializer.fromJSON({
                    $class: 'org.acme.types@1.0.0.Container',
                    dateMap: { k: 'invalid-date' }
                });
            }).should.throw(/Expected Type of DateTime/);
        });

        it('should unwrap scalar value slot even when key is not a scalar', () => {
            const valid = typeSerializer.fromJSON({
                $class: 'org.acme.types@1.0.0.Container',
                nameMap: { k: 'Alice' }
            });
            valid.nameMap.get('k').should.equal('Alice');

            (() => {
                typeSerializer.fromJSON({
                    $class: 'org.acme.types@1.0.0.Container',
                    nameMap: { k: 42 }
                });
            }).should.throw(/Expected Type of String but found '42'/);
        });

        it('should apply scalar validators on map keys', () => {
            const valid = typeSerializer.fromJSON({
                $class: 'org.acme.types@1.0.0.Container',
                codeMap: { ABC: 'val' }
            });
            valid.codeMap.get('ABC').should.equal('val');

            (() => {
                typeSerializer.fromJSON({
                    $class: 'org.acme.types@1.0.0.Container',
                    codeMap: { lower: 'val' }
                });
            }).should.throw(/failed to match validation regex/);
        });

        it('should validate imported concept in map value slot', () => {
            const valid = typeSerializer.fromJSON({
                $class: 'org.acme.types@1.0.0.Container',
                addrMap: { k: { $class: 'org.lib@1.0.0.Addr', street: '1 Main St' } }
            });
            valid.addrMap.get('k').street.should.equal('1 Main St');

            (() => {
                typeSerializer.fromJSON({
                    $class: 'org.acme.types@1.0.0.Container',
                    addrMap: { k: { $class: 'org.lib@1.0.0.Addr' } }
                });
            }).should.throw(/missing the required field "street"/);
        });

        it('should resolve and validate imported scalar in map key slot', () => {
            const valid = typeSerializer.fromJSON({
                $class: 'org.acme.types@1.0.0.Container',
                upperMap: { ABC: 'val' }
            });
            valid.upperMap.get('ABC').should.equal('val');

            (() => {
                typeSerializer.fromJSON({
                    $class: 'org.acme.types@1.0.0.Container',
                    upperMap: { abc: 'val' }
                });
            }).should.throw(/failed to match validation regex/);
        });

        it('should apply scalar validators on map values', () => {
            const valid = typeSerializer.fromJSON({
                $class: 'org.acme.types@1.0.0.Container',
                upperValMap: { k: 'ABC' }
            });
            valid.upperValMap.get('k').should.equal('ABC');

            (() => {
                typeSerializer.fromJSON({
                    $class: 'org.acme.types@1.0.0.Container',
                    upperValMap: { k: 'abc' }
                });
            }).should.throw(/failed to match validation regex/);
        });
    });
});

