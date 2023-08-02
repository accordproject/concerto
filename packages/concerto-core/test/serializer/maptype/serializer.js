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
const Resource = require('../../../lib/model/resource');
const Serializer = require('../../../lib/serializer');
const Util = require('../../composer/composermodelutility');
const ModelUtil = require('../../../../concerto-core/lib/modelutil');

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
        namespace org.acme.sample


        concept Concepts {
            o Dictionary dict optional
            o Diary diary optional
            o Timer timer optional
            o StopWatch stopwatch optional
            o RSVP rsvp optional
            o Database database optional
            o Appointment appointment optional
            o MarriageRegister marriages optional
            o PostCodeEntries postcodes optional
            o AddressBook addressBook optional
            o Birthday birthday optional
            o Celebration celebration optional
            o ExaminationGrade grade optional
            o Rolodex rolodex optional
            o Attendance attendance optional
            o Vegan vegan optional
            o Reservation reservation optional
            o GuestList vip optional
            o Graduated graduated optional
            o Directory directory optional
            o Meeting meeting optional
            o Graduation graduation optional
            o Team team optional
            o StateLog stateLog optional
        }

        map Dictionary {
            o String
            o String
        }

        map PhoneBook {
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

        map Attendance {
            o DateTime
            o Boolean
        }

        map Meeting {
            o Time
            o Person
        }

        map Database {
            o GUID
            o String
        }

        map Vegan {
            o GUID
            o Boolean
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

        map Graduation {
            o DateTime
            o Person
        }

        map Rolodex {
            o String
            o Person
        }

        map MarriageRegister {
            o Person
            o Person
        }

        map ExaminationGrade {
            o Person
            o String
        }

        map Reservation {
            o Person
            o Time
        }

        map Graduated {
            o Person
            o DateTime
        }

        map GuestList {
            o Person
            o Boolean
        }

        map PostCodeEntries {
            o GUID
            o PostalCode
        }

        map AddressBook {
            o GUID
            --> Person
        }

        map Team {
            o Person
            o Leader
        }

        scalar GUID extends String

        scalar Time extends DateTime

        scalar PostalCode extends String

        concept Person identified by name {
            o String name
        }

        concept Leader {
            o String name
        }

        enum State {
            o ON
            o OFF
        }

        map StateLog {
            o State
            o DateTime
        }

        `);
        factory = new Factory(modelManager);
        serializer = new Serializer(factory, modelManager);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#toJSON', () => {

        it('should generate a JSON object with a Map <String, String>', () => {
            let concept = factory.newConcept('org.acme.sample', 'Concepts');

            concept.dict = new Map();
            concept.dict.set('$class', 'org.acme.sample.Dictionary');
            concept.dict.set('Lorem', 'Ipsum');
            concept.dict.set('Ipsum', 'Lorem');

            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample.Concepts',
                dict: {
                    $class: 'org.acme.sample.Dictionary',
                    Lorem: 'Ipsum',
                    Ipsum: 'Lorem'
                }
            });
        });

        it('should generate a JSON object with a Map <String, Boolean>', () => {
            let concept = factory.newConcept('org.acme.sample', 'Concepts');

            concept.rsvp = new Map();
            concept.rsvp.set('$class', 'org.acme.sample.RSVP');
            concept.rsvp.set('Lorem', true);
            concept.rsvp.set('Ipsum', false);

            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample.Concepts',
                rsvp: {
                    $class: 'org.acme.sample.RSVP',
                    'Lorem': true,
                    'Ipsum': false,
                }
            });
        });

        it('should generate a JSON object with a Map <String, DateTime>', () => {
            let concept = factory.newConcept('org.acme.sample', 'Concepts');

            concept.birthday = new Map();
            concept.birthday.set('$class', 'org.acme.sample.Birthday');
            concept.birthday.set('Lorem', '2023-10-28T01:02:03Z');
            concept.birthday.set('Ipsum', '2023-11-28T01:02:03Z');

            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample.Concepts',
                birthday: {
                    $class: 'org.acme.sample.Birthday',
                    'Lorem': '2023-10-28T01:02:03Z',
                    'Ipsum': '2023-11-28T01:02:03Z'
                }
            });
        });

        it('should generate a JSON object with a Map <String, Concept>', () => {
            let concept = factory.newConcept('org.acme.sample', 'Concepts');

            const bob = factory.newConcept('org.acme.sample', 'Person', 'Bob');
            const alice = factory.newConcept('org.acme.sample', 'Person', 'Alice');

            concept.rolodex = new Map();
            concept.rolodex.set('$class', 'org.acme.sample.Rolodex');
            concept.rolodex.set('Abbeyleix', bob);
            concept.rolodex.set('Ireland', alice);

            const json = serializer.toJSON(concept);
            json.should.deep.equal({
                $class: 'org.acme.sample.Concepts',
                rolodex: {
                    $class: 'org.acme.sample.Rolodex',
                    'Abbeyleix': '{"$class":"org.acme.sample.Person","name":"Bob"}',
                    'Ireland': '{"$class":"org.acme.sample.Person","name":"Alice"}'
                }
            });
        });

        it('should generate a JSON object with a Map <String, Scalar>, where Scalar extends String', () => {
            let concept = factory.newConcept('org.acme.sample', 'Concepts');

            concept.celebration = new Map();
            concept.celebration.set('$class', 'org.acme.sample.Celebration');
            concept.celebration.set('D4F45017-AD2B-416B-AD9F-3B74F7DEA291', '2022-11-28T01:02:03Z');
            concept.celebration.set('9FAE34BF-18C3-4770-A6AA-6F7656C356B8', '2023-10-28T01:02:03Z');

            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample.Concepts',
                celebration: {
                    $class: 'org.acme.sample.Celebration',
                    'D4F45017-AD2B-416B-AD9F-3B74F7DEA291': '2022-11-28T01:02:03Z',
                    '9FAE34BF-18C3-4770-A6AA-6F7656C356B8': '2023-10-28T01:02:03Z',
                }
            });
        });

        it('should generate a JSON object with a Map <DateTime, String>', () => {
            let concept = factory.newConcept('org.acme.sample', 'Concepts');

            concept.diary = new Map();
            concept.diary.set('$class', 'org.acme.sample.Diary');
            concept.diary.set('2023-10-28T01:02:03Z', 'Ipsum');

            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample.Concepts',
                diary: {
                    $class: 'org.acme.sample.Diary',
                    '2023-10-28T01:02:03Z': 'Ipsum',
                }
            });
        });

        it('should generate a JSON object with a Map <DateTime, Boolean>', () => {
            let concept = factory.newConcept('org.acme.sample', 'Concepts');

            concept.attendance = new Map();
            concept.attendance.set('$class', 'org.acme.sample.Attendance');
            concept.attendance.set('2023-10-28T01:02:03Z', true);
            concept.attendance.set('2023-11-28T01:02:03Z', false);

            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample.Concepts',
                attendance: {
                    $class: 'org.acme.sample.Attendance',
                    '2023-10-28T01:02:03Z': true,
                    '2023-11-28T01:02:03Z': false,
                }
            });
        });

        it('should generate a JSON object with a Map <DateTime, Concept>', () => {
            let concept = factory.newConcept('org.acme.sample', 'Concepts');

            const person = factory.newConcept('org.acme.sample', 'Person', 'Bob');
            const alice = factory.newConcept('org.acme.sample', 'Person', 'Alice');

            concept.graduation = new Map();
            concept.graduation.set('$class', 'org.acme.sample.Graduation');
            concept.graduation.set('2023-10-28T01:02:03Z', person);
            concept.graduation.set('2023-11-28T01:02:03Z', alice);

            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample.Concepts',
                graduation: {
                    $class: 'org.acme.sample.Graduation',
                    '2023-10-28T01:02:03Z': '{"$class":"org.acme.sample.Person","name":"Bob"}',
                    '2023-11-28T01:02:03Z': '{"$class":"org.acme.sample.Person","name":"Alice"}'
                }
            });
        });

        it('should generate a JSON object with a Map <Scalar, Scalar>, where Scalar extends String', () => {
            let concept = factory.newConcept('org.acme.sample', 'Concepts');

            concept.stopwatch = new Map();
            concept.stopwatch.set('$class', 'org.acme.sample.StopWatch');
            concept.stopwatch.set('2023-10-28T00:02:03Z', '2023-10-28T01:02:03Z');
            concept.stopwatch.set('2023-11-28T00:02:03Z', '2023-11-28T01:02:03Z');

            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample.Concepts',
                stopwatch: {
                    $class: 'org.acme.sample.StopWatch',
                    '2023-10-28T00:02:03Z': '2023-10-28T01:02:03Z',
                    '2023-11-28T00:02:03Z': '2023-11-28T01:02:03Z',
                }
            });
        });

        it('should generate a JSON object with a Map <Scalar, String>, where Scalar extends String', () => {
            let concept = factory.newConcept('org.acme.sample', 'Concepts');

            concept.database = new Map();
            concept.database.set('$class', 'org.acme.sample.Database');
            concept.database.set('D4F45017-AD2B-416B-AD9F-3B74F7DEA291', 'Lorem');
            concept.database.set('9FAE34BF-18C3-4770-A6AA-6F7656C356B8', 'Ipsum');

            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample.Concepts',
                database: {
                    $class: 'org.acme.sample.Database',
                    'D4F45017-AD2B-416B-AD9F-3B74F7DEA291': 'Lorem',
                    '9FAE34BF-18C3-4770-A6AA-6F7656C356B8': 'Ipsum',
                }
            });
        });

        it('should generate a JSON object with a Map <Scalar, Boolean>, where Scalar extends String', () => {
            let concept = factory.newConcept('org.acme.sample', 'Concepts');

            concept.vegan = new Map();
            concept.vegan.set('$class', 'org.acme.sample.Vegan');
            concept.vegan.set('D4F45017-AD2B-416B-AD9F-3B74F7DEA291',  true);
            concept.vegan.set('9FAE34BF-18C3-4770-A6AA-6F7656C356B8', false);

            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample.Concepts',
                vegan: {
                    $class: 'org.acme.sample.Vegan',
                    'D4F45017-AD2B-416B-AD9F-3B74F7DEA291': true,
                    '9FAE34BF-18C3-4770-A6AA-6F7656C356B8': false,
                }
            });
        });

        it('should generate a JSON object with a Map <Scalar, Concept>, where Scalar extends String', () => {
            let concept = factory.newConcept('org.acme.sample', 'Concepts');

            const bob = factory.newConcept('org.acme.sample', 'Person', 'Bob');
            const alice = factory.newConcept('org.acme.sample', 'Person', 'Alice');

            concept.directory = new Map();
            concept.directory.set('$class', 'org.acme.sample.Directory');
            concept.directory.set('D4F45017-AD2B-416B-AD9F-3B74F7DEA291', bob);
            concept.directory.set('9FAE34BF-18C3-4770-A6AA-6F7656C356B8', alice);

            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample.Concepts',
                directory: {
                    $class: 'org.acme.sample.Directory',
                    'D4F45017-AD2B-416B-AD9F-3B74F7DEA291': '{"$class":"org.acme.sample.Person","name":"Bob"}',
                    '9FAE34BF-18C3-4770-A6AA-6F7656C356B8': '{"$class":"org.acme.sample.Person","name":"Alice"}',
                }
            });
        });

        it('should generate a JSON object with a Map <Scalar, String>, where Scalar extends DateTime', () => {
            let concept = factory.newConcept('org.acme.sample', 'Concepts');

            concept.appointment = new Map();
            concept.appointment.set('$class', 'org.acme.sample.Appointment');
            concept.appointment.set('2023-10-28T01:02:03Z', 'Lorem');
            concept.appointment.set('2023-11-28T01:02:03Z', 'Ipsum');

            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample.Concepts',
                appointment: {
                    $class: 'org.acme.sample.Appointment',
                    '2023-10-28T01:02:03Z': 'Lorem',
                    '2023-11-28T01:02:03Z': 'Ipsum',
                }
            });
        });

        it('should generate a JSON object with a Map <Scalar, Concept>, where Scalar extends DateTime', () => {
            let concept = factory.newConcept('org.acme.sample', 'Concepts');

            const bob = factory.newConcept('org.acme.sample', 'Person', 'Bob');
            const alice = factory.newConcept('org.acme.sample', 'Person', 'Alice');

            concept.meeting = new Map();
            concept.meeting.set('$class', 'org.acme.sample.Meeting');
            concept.meeting.set('2023-10-28T01:02:03Z', bob);
            concept.meeting.set('2023-11-28T01:02:03Z', alice);

            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample.Concepts',
                meeting: {
                    $class: 'org.acme.sample.Meeting',
                    '2023-10-28T01:02:03Z': '{"$class":"org.acme.sample.Person","name":"Bob"}',
                    '2023-11-28T01:02:03Z': '{"$class":"org.acme.sample.Person","name":"Alice"}'
                }
            });
        });

        it('should generate a JSON object with a Map <Concept, String>, where Concept is Identified', () => {
            let concepts = factory.newConcept('org.acme.sample', 'Concepts');

            const bob = factory.newConcept('org.acme.sample', 'Person', 'Bob');
            const alice = factory.newConcept('org.acme.sample', 'Person', 'Alice');

            concepts.grade = new Map();
            concepts.grade.set('$class', 'org.acme.sample.ExaminationGrade');
            concepts.grade.set(bob, 'A+');
            concepts.grade.set(alice, 'B+');

            const json = serializer.toJSON(concepts);

            json.should.deep.equal({
                $class: 'org.acme.sample.Concepts',
                grade: {
                    '$class': 'org.acme.sample.ExaminationGrade',
                    '{"$class":"org.acme.sample.Person","name":"Bob"}' : 'A+',
                    '{"$class":"org.acme.sample.Person","name":"Alice"}' : 'B+'
                }
            });
        });

        it('should generate a JSON object with a Map <Concept, Scalar>, where Concept is Identified & Scalar extends DateTime ', () => {
            let concepts = factory.newConcept('org.acme.sample', 'Concepts');

            const bob = factory.newConcept('org.acme.sample', 'Person', 'Bob');
            const alice = factory.newConcept('org.acme.sample', 'Person', 'Alice');

            concepts.reservation = new Map();
            concepts.reservation.set('$class', 'org.acme.sample.Reservation');
            concepts.reservation.set(bob, '2023-10-28T01:02:03Z');
            concepts.reservation.set(alice, '2023-11-28T01:02:03Z');

            const json = serializer.toJSON(concepts);

            json.should.deep.equal({
                $class: 'org.acme.sample.Concepts',
                reservation: {
                    $class: 'org.acme.sample.Reservation',
                    '{"$class":"org.acme.sample.Person","name":"Bob"}' : '2023-10-28T01:02:03Z',
                    '{"$class":"org.acme.sample.Person","name":"Alice"}' : '2023-11-28T01:02:03Z'
                }
            });
        });

        it('should generate a JSON object with a Map <Concept, Boolean>, where Concept is Identified', () => {
            let concepts = factory.newConcept('org.acme.sample', 'Concepts');

            const bob = factory.newConcept('org.acme.sample', 'Person', 'Bob');
            const alice = factory.newConcept('org.acme.sample', 'Person', 'Alice');

            concepts.vip = new Map();
            concepts.vip.set('$class', 'org.acme.sample.GuestList');
            concepts.vip.set(bob, true);
            concepts.vip.set(alice, true);

            const json = serializer.toJSON(concepts);

            json.should.deep.equal({
                $class: 'org.acme.sample.Concepts',
                vip: {
                    $class: 'org.acme.sample.GuestList',
                    '{"$class":"org.acme.sample.Person","name":"Bob"}' : true,
                    '{"$class":"org.acme.sample.Person","name":"Alice"}' : true
                }
            });
        });

        it('should generate a JSON object with a Map <Concept, Concept>, where Concept is Identified', () => {
            let concepts = factory.newConcept('org.acme.sample', 'Concepts');

            const bob = factory.newConcept('org.acme.sample', 'Person', 'Bob');
            const alice = factory.newConcept('org.acme.sample', 'Person', 'Alice');

            concepts.marriages = new Map();
            concepts.marriages.set('$class', 'org.acme.sample.MarriageRegister');
            concepts.marriages.set(bob, alice);

            const json = serializer.toJSON(concepts);

            json.should.deep.equal({
                $class: 'org.acme.sample.Concepts',
                marriages: {
                    $class: 'org.acme.sample.MarriageRegister',
                    '{"$class":"org.acme.sample.Person","name":"Bob"}' : '{"$class":"org.acme.sample.Person","name":"Alice"}'
                }
            });
        });

        it('should generate a JSON object with a Map <Concept, DateTime>, where Concept is Identified', () => {
            let concepts = factory.newConcept('org.acme.sample', 'Concepts');

            const bob = factory.newConcept('org.acme.sample', 'Person', 'Bob');
            const alice = factory.newConcept('org.acme.sample', 'Person', 'Alice');

            concepts.graduated = new Map();
            concepts.graduated.set('$class', 'org.acme.sample.Graduated');
            concepts.graduated.set(bob, '2023-10-28T01:02:03Z');
            concepts.graduated.set(alice, '2023-11-28T01:02:03Z');

            const json = serializer.toJSON(concepts);

            json.should.deep.equal({
                $class: 'org.acme.sample.Concepts',
                graduated: {
                    $class: 'org.acme.sample.Graduated',
                    '{"$class":"org.acme.sample.Person","name":"Bob"}' : '2023-10-28T01:02:03Z',
                    '{"$class":"org.acme.sample.Person","name":"Alice"}' : '2023-11-28T01:02:03Z'
                }
            });
        });

        it('should throw if bad Key value is provided for Map, where Key Type DateTime is expected', () => {
            let concept = factory.newConcept('org.acme.sample', 'Concepts');

            concept.appointment = new Map();
            concept.appointment.set('$class', 'org.acme.sample.Appointment');
            concept.appointment.set('BAD-DATE-28T01:02:03Z', 'Lorem'); // Bad DateTime

            (() => {
                serializer.toJSON(concept);
            }).should.throw('Model violation in org.acme.sample.Appointment. Expected Type of DateTime but found \'BAD-DATE-28T01:02:03Z\' instead.');
        });

        it('should throw if bad Key value is provided for Map, where Key Type String is expected', () => {
            let concept = factory.newConcept('org.acme.sample', 'Concepts');

            concept.dict = new Map();
            concept.dict.set('$class', 'org.acme.sample.Dictionary');
            concept.dict.set(1234, 'Lorem'); // Bad key

            (() => {
                serializer.toJSON(concept);
            }).should.throw('Model violation in org.acme.sample.Dictionary. Expected Type of String but found \'1234\' instead.');
        });

        it('should throw if a bad Value is Supplied for Map, where Value type Boolean is expected', () => {
            let concept = factory.newConcept('org.acme.sample', 'Concepts');

            concept.rsvp = new Map();
            concept.rsvp.set('$class', 'org.acme.sample.RSVP');
            concept.rsvp.set('Lorem', true);
            concept.rsvp.set('Ipsum', 'false');

            (() => {
                serializer.toJSON(concept);
            }).should.throw('Model violation in org.acme.sample.RSVP. Expected Type of Boolean but found string instead, for value \'false\'.');
        });

        it('should throw if a bad Value is Supplied for Map, where Value type String is expected', () => {
            let concept = factory.newConcept('org.acme.sample', 'Concepts');

            concept.dict = new Map();
            concept.dict.set('$class', 'org.acme.sample.Dictionary');
            concept.dict.set('Lorem', 1234);

            (() => {
                serializer.toJSON(concept);
            }).should.throw('Model violation in org.acme.sample.Dictionary. Expected Type of String but found \'1234\' instead.');
        });


        it('should throw if a bad value is Supplied for Map - where Value type Boolean is expected', () => {
            let concept = factory.newConcept('org.acme.sample', 'Concepts');

            concept.timer = new Map();
            concept.timer.set('$class', 'org.acme.sample.Timer');
            concept.timer.set('2023-10-28T01:02:03Z', '2023-10-28T01:02:03Z');
            concept.timer.set('2023-10-28T01:02:03Z', 'BAD-DATE-VALUE');

            (() => {
                serializer.toJSON(concept);
            }).should.throw('Model violation in org.acme.sample.Timer. Expected Type of DateTime but found \'BAD-DATE-VALUE\' instead.');
        });

        it('should throw if the value of a Map is not a Map instance', () => {
            let concept = factory.newConcept('org.acme.sample', 'Concepts');

            concept.dict = 'xyz'; // bad value

            (() => {
                serializer.toJSON(concept);
            }).should.throw(`Expected a Map, but found ${JSON.stringify(concept.dict)}`);
        });

        it('should throw validation error when there is a mismatch on map $class property', () => {
            let concept = factory.newConcept('org.acme.sample', 'Concepts');

            concept.dict = new Map();
            concept.dict.set('$class', 'org.acme.sample.PhoneBook'); // dict is not a PhoneBook.
            concept.dict.set('Lorem', 'Ipsum');

            (() => {
                serializer.toJSON(concept);
            }).should.throw('$class value must match org.acme.sample.Dictionary');
        });

        it('should ignore system properties', () => {
            let concept = factory.newConcept('org.acme.sample', 'Concepts');

            concept.dict = new Map();
            concept.dict.set('$class', 'org.acme.sample.Dictionary');
            concept.dict.set('$type', 'foo');
            concept.dict.set('Lorem', 'Ipsum');
            concept.dict.set('Ipsum', 'Lorem');

            const json = serializer.toJSON(concept);

            json.should.deep.equal({
                $class: 'org.acme.sample.Concepts',
                dict: {
                    $class: 'org.acme.sample.Dictionary',
                    Lorem: 'Ipsum',
                    Ipsum: 'Lorem'
                }
            });
        });
    });

    describe('#fromJSON', () => {

        it('should deserialize a JSON object with a Map <String, String>', () => {
            let json = {
                $class: 'org.acme.sample.Concepts',
                dict: {
                    '$class': 'org.acme.sample.Dictionary',
                    'Lorem': 'Ipsum',
                    'Ipsum': 'Lorem'
                }
            };
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.dict.should.be.an.instanceOf(Map);
            resource.dict.get('$class').should.equal('org.acme.sample.Dictionary');
            resource.dict.get('Lorem').should.equal('Ipsum');
        });

        it('should deserialize a JSON object with a Map <Scalar, String>, where Scalar extends String', () => {
            let json = {
                $class: 'org.acme.sample.Concepts',
                database: {
                    '$class': 'org.acme.sample.Database',
                    'E17B69D9-9B57-4C4A-957E-8B202D7B6C5A': 'Ipsum',
                    'D4F45017-AD2B-416B-AD9F-3B74F7DEA291': 'Lorem'
                }
            };
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.database.should.be.an.instanceOf(Map);
            resource.database.get('$class').should.equal('org.acme.sample.Database');
            resource.database.get('E17B69D9-9B57-4C4A-957E-8B202D7B6C5A').should.equal('Ipsum');
            resource.database.get('D4F45017-AD2B-416B-AD9F-3B74F7DEA291').should.equal('Lorem');
        });

        it('should deserialize a JSON object with a Map <Scalar, String>, where Scalar extends DateTime', () => {
            let json = {
                $class: 'org.acme.sample.Concepts',
                appointment: {
                    '$class': 'org.acme.sample.Appointment',
                    '2023-10-28T01:02:03Z': 'Ipsum',
                    '2023-11-28T01:02:03Z': 'Lorem'
                }
            };
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.appointment.should.be.an.instanceOf(Map);
            resource.appointment.get('$class').should.equal('org.acme.sample.Appointment');
            resource.appointment.get('2023-10-28T01:02:03Z').should.equal('Ipsum');
        });

        it('should deserialize a JSON object with a Map <Concept, Concept>, where both Key & Value are Identified Concepts', () => {
            let json = {
                $class: 'org.acme.sample.Concepts',
                marriages: {
                    '$class': 'org.acme.sample.MarriageRegister',
                    '{"$class":"org.acme.sample.Person","name":"Bob"}': '{"$class":"org.acme.sample.Person","name":"Alice"}'
                }
            };

            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.marriages.should.be.an.instanceOf(Map);
            resource.marriages.get('$class').should.equal('org.acme.sample.MarriageRegister');

            resource.marriages.forEach((value, key) => {
                if (!ModelUtil.isSystemProperty(key)) {
                    key.should.be.an.instanceOf(Resource);
                    key.name.should.equal('Bob');
                    value.should.be.an.instanceOf(Resource);
                    value.name.should.equal('Alice');
                }
            });
        });

        it('should deserialize a JSON object with a Map <Concept, String>', () => {
            let json = {
                $class: 'org.acme.sample.Concepts',
                grade: {
                    '$class': 'org.acme.sample.ExaminationGrade',
                    '{"$class":"org.acme.sample.Person","name":"Bob"}': 'A+'
                }
            };
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.grade.should.be.an.instanceOf(Map);
            resource.grade.get('$class').should.equal('org.acme.sample.ExaminationGrade');
            resource.grade.forEach((value, key) => {
                if (!ModelUtil.isSystemProperty(key)) {
                    key.should.be.an.instanceOf(Resource);
                    key.name.should.equal('Bob');
                    value.should.be.a('String');
                    value.should.equal('A+');
                }
            });
        });

        it('should deserialize a JSON object with a Map <Concept, DateTime>', () => {
            let json = {
                $class: 'org.acme.sample.Concepts',
                graduated: {
                    '$class': 'org.acme.sample.Graduated',
                    '{"$class":"org.acme.sample.Person","name":"Bob"}': '2023-10-28T01:02:03Z'
                }
            };

            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.graduated.should.be.an.instanceOf(Map);
            resource.graduated.get('$class').should.equal('org.acme.sample.Graduated');
            resource.graduated.forEach((value, key) => {
                if (!ModelUtil.isSystemProperty(key)) {
                    key.should.be.an.instanceOf(Resource);
                    key.name.should.equal('Bob');
                    value.should.be.a('String');
                    value.should.equal('2023-10-28T01:02:03Z');
                }
            });
        });

        it('should deserialize a JSON object with a Map <Concept, DateTime>', () => {
            let json = {
                $class: 'org.acme.sample.Concepts',
                reservation: {
                    '$class': 'org.acme.sample.Reservation',
                    '{"$class":"org.acme.sample.Person","name":"Bob"}': '2023-10-28T01:02:03Z'
                }
            };
            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.reservation.should.be.an.instanceOf(Map);
            resource.reservation.get('$class').should.equal('org.acme.sample.Reservation');
            resource.reservation.forEach((value, key) => {
                if (!ModelUtil.isSystemProperty(key)) {
                    key.should.be.an.instanceOf(Resource);
                    key.name.should.equal('Bob');
                    value.should.be.a('String');
                    value.should.equal('2023-10-28T01:02:03Z');
                }
            });
        });

        it('should deserialize a JSON object with a Map <Concept, Boolean>', () => {
            let json = {
                $class: 'org.acme.sample.Concepts',
                vip: {
                    '$class': 'org.acme.sample.GuestList',
                    '{"$class":"org.acme.sample.Person","name":"Bob"}': true
                }
            };

            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.vip.should.be.an.instanceOf(Map);
            resource.vip.get('$class').should.equal('org.acme.sample.GuestList');
            resource.vip.forEach((value, key) => {
                if (!ModelUtil.isSystemProperty(key)) {
                    key.should.be.an.instanceOf(Resource);
                    key.name.should.equal('Bob');
                    value.should.be.a('Boolean');
                    value.should.equal(true);
                }
            });
        });

        it('should deserialize a JSON object with a Map <Concept, Concept>, where Value is a Non-Identified Concept', () => {
            let json = {
                $class: 'org.acme.sample.Concepts',
                team: {
                    '$class': 'org.acme.sample.Team',
                    '{"$class":"org.acme.sample.Person","name":"Bob"}': '{"$class":"org.acme.sample.Person","name":"Alice"}'
                }
            };

            let resource = serializer.fromJSON(json);

            resource.should.be.an.instanceOf(Resource);
            resource.team.should.be.an.instanceOf(Map);
            resource.team.get('$class').should.equal('org.acme.sample.Team');
            resource.team.forEach((value, key) => {
                if (!ModelUtil.isSystemProperty(key)) {
                    key.should.be.an.instanceOf(Resource);
                    key.name.should.equal('Bob');
                    value.should.be.an.instanceOf(Resource);
                    value.name.should.equal('Alice');
                }
            });
        });

        it('should throw an error when deserializing a Map without a $class property', () => {
            let json = {
                $class: 'org.acme.sample.Concepts',
                dict: {
                    // '$class': 'org.acme.sample.Dictionary',
                    'Lorem': 'Ipsum'
                }
            };
            (() => {
                serializer.fromJSON(json);
            }).should.throw('Invalid Map. Map must contain a properly formatted $class property');
        });

        it('should throw an error when deserializing a Map using a reserved Identifier as a Key property', () => {
            let json = {
                $class: 'org.acme.sample.Concepts',
                dict: {
                    '$class': 'org.acme.sample.Dictionary',
                    '$namespace': 'com.reserved.property',
                    'Lorem': 'Ipsum'
                }
            };
            (() => {
                serializer.fromJSON(json);
            }).should.throw('Unexpected reserved properties for type org.acme.sample.Dictionary: $namespace');
        });

        it('should throw for Enums as Map key types', () => {

            let json = {
                $class: 'org.acme.sample.Concepts',
                stateLog: {
                    '$class': 'org.acme.sample.StateLog',
                    'ON': '2000-01-01T00:00:00.000Z',
                    'OFF': '2000-01-01T00:00:00.000Z',
                }
            };
            (() => {
                serializer.fromJSON(json);
            }).should.throw('TODO ADD CORRECT ERROR MESSAGE HERE');
        });
    });
});

