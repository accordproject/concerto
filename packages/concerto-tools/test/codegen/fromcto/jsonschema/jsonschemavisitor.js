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

const Ajv = require('ajv');
const { expect } = require('chai');
const chai = require('chai');
chai.should();

const ModelManager = require('@accordproject/concerto-core').ModelManager;
const JSONSchemaVisitor = require('../../../../lib/codegen/fromcto/jsonschema/jsonschemavisitor.js');

describe('JSONSchema (samples)', function () {

    describe('samples', () => {

        it('should generate JSON schema for recursive schema with decorators and validators', () => {
            const modelManager = new ModelManager();
            modelManager.addModelFile( `
namespace org.accordproject.ergo.monitor

@Important
enum Color {
  o RED
  o GREEN
  o BLUE
}

participant Person identified by ssn {
  o String ssn
}

asset Car identified by vin {
  o String vin
}

transaction SellCar identified by id {
  o String id
  --> Car car
  --> Person seller
  --> Person buyer
}

/**
 * CPU time for a compilation phase (single phase, cummulative for that phase, total since process started)
 */
@Test("one", true, "two", 2, "three", 3.14)
concept Phase {
  @Name
  o String name regex=/abc.*/
  o Double single default=5.0 range=[0.0,10.5]
  o Double cummulative range=[0.0,100.0]
  o Double total range=[50.0,]
  o Integer test range=[-10,10] optional
  o Phase[] subphases
  o Boolean myBoolean
  o DateTime myDateTime
  o Color myColor
  @Friend
  --> Person[] friends
  o Car myCar
}

/**
 * Monitor
 */
concept Monitor {
  @MonitorDecorator("test")
  o Phase[] phases
}`);

            const visitor = new JSONSchemaVisitor();
            const monitorSchema = modelManager.accept(visitor, { rootType: 'org.accordproject.ergo.monitor.Monitor'});
            expect(monitorSchema.title).equal('Monitor');
            console.log(JSON.stringify(monitorSchema, null, 2));

            const phaseSchema = modelManager.accept(visitor, { rootType: 'org.accordproject.ergo.monitor.Phase'});
            expect(phaseSchema.title).equal('Phase');

            // check that the generated schema validates a valid instance
            const instance =
            {
                '$class' : 'org.accordproject.ergo.monitor.Monitor',
                'phases' : [
                    {
                        '$class' : 'org.accordproject.ergo.monitor.Phase',
                        'name' : 'abcde',
                        'single' : 10.5,
                        'total' : 51,
                        'test' : 10,
                        'cummulative' : 100,
                        'subphases' : [],
                        'myBoolean' : true,
                        'myDateTime' : '2011-10-05T14:48:00.000Z',
                        'myColor' : 'RED',
                        'myCar' : {
                            '$class' : 'org.accordproject.ergo.monitor.Car',
                            'vin' : '123'
                        },
                        'friends' : ['ann', 'isaac']
                    }
                ]
            };

            const ajv = new Ajv();
            expect( ajv.validate(monitorSchema, instance)).equals(true);
        });
    });
});