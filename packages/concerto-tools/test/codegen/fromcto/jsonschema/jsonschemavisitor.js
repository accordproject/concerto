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
const fs = require('fs');
const path = require('path');
const { expect } = require('chai');
const chai = require('chai');
chai.should();

const FileWriter = require('@accordproject/concerto-util').FileWriter;
const ModelManager = require('@accordproject/concerto-core').ModelManager;
const JSONSchemaVisitor = require('../../../../lib/codegen/fromcto/jsonschema/jsonschemavisitor.js');
const RecursionDetectionVisitor = require('../../../../lib/codegen/fromcto/jsonschema/recursionvisitor.js');

const MODEL_BOUNDS = `
namespace test

concept Test {
  o String myString regex=/abc.*/
  o Integer intLowerUpper range=[-1,1]
  o Integer intLower range=[-1,]
  o Integer intUpper range=[,1]
  o Long longLowerUpper range=[-1,1]
  o Long longLower range=[-1,]
  o Long longUpper range=[,1]
  o Double doubleLowerUpper range=[-1.2,1.2]
  o Double doubleLower range=[-1.2,]
  o Double doubleUpper range=[,1.2]
}
`;

const MODEL_SIMPLE = `
namespace test

enum Color {
  o RED
  o GREEN
  o BLUE
}

scalar Email extends String

abstract transaction Base identified by id {
  o String id
}

concept Money {
  o Double value
  o String currencyCode
}

transaction MyRequest extends Base {
  o String name
  o DateTime date
  o Integer age
  o Money money
  o Color color
  o Email email
}
`;

const MODEL_SIMPLE_2 = `
namespace test2

concept Vehicle {
  o String model
  o String make
}
`;

const MODEL_RECURSIVE_COMPLEX = `
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
}`;

const MODEL_RECURSIVE_SIMPLE = `
namespace recursive

enum Role {
  o HR
  o MARKETING
  o ENGINEERING
}

asset Factory identified by id {
  o String id
  o Address address
}

concept Address {
  o String street
  o Person[] inhabitants
}

concept Person {
  o String name
  o Role role
  --> Factory factory
  o Address address
}
`;

const UUID_SCALAR = `
namespace concerto.scalar@1.0.0

scalar UUID extends String default="00000000-0000-0000-0000-000000000000" regex=/^[{]?[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}[}]?$/
`;

const MODEL_SIMPLE3 = `
namespace test

import concerto.scalar@1.0.0.{ UUID }

concept OtherThing identified by id {
    o UUID id
    o String someId
}
`;
const MODEL_RELATIONSHIP_SIMPLE = `
namespace test

import concerto.scalar@1.0.0.{ UUID }

concept OtherThing identified by id {
    o UUID id
    o String someId
}

concept SomeOtherThing identified {
    o Integer intField
    --> OtherThing otherThingId
}
`;

describe('JSONSchema (samples)', function () {

    describe('samples', () => {

        it('should detect simple recursive model', () => {
            const modelManager = new ModelManager();
            modelManager.addCTOModel( MODEL_RECURSIVE_SIMPLE );
            const visitor = new RecursionDetectionVisitor();
            const type = modelManager.getType('recursive.Person');
            const result = type.accept(visitor, {stack: []});
            expect(result).equal(true);
        });

        it('should detect simple recursive model 2', () => {
            const modelManager = new ModelManager();
            modelManager.addCTOModel( MODEL_RECURSIVE_SIMPLE );
            const visitor = new RecursionDetectionVisitor();
            const type = modelManager.getType('recursive.Factory');
            const result = type.accept(visitor, {stack: []});
            expect(result).equal(true);
        });

        it('should detect simple recursive model 3', () => {
            const modelManager = new ModelManager();
            modelManager.addCTOModel( MODEL_RECURSIVE_SIMPLE );
            const visitor = new RecursionDetectionVisitor();
            const type = modelManager.getType('recursive.Address');
            const result = type.accept(visitor, {stack: []});
            expect(result).equal(true);
        });

        it('should reference types for simple model', () => {
            const modelManager = new ModelManager();
            modelManager.addCTOModel( MODEL_SIMPLE );
            const visitor = new JSONSchemaVisitor();
            const schema = modelManager.accept(visitor, { rootType: 'test.MyRequest'});
            expect(schema.properties.money.$ref).equal('#/definitions/test.Money');
        });

        it('should handle multiple model files', () => {
            const modelManager = new ModelManager();
            modelManager.addCTOModel( MODEL_SIMPLE );
            modelManager.addCTOModel( MODEL_SIMPLE_2 );
            const visitor = new JSONSchemaVisitor();
            const schema = modelManager.accept(visitor, {rootType: 'test.MyRequest' });
            // console.log(JSON.stringify(schema, null, 2));
            expect(schema.definitions['test.Money']).to.not.be.undefined;
            expect(schema.definitions['test2.Vehicle']).to.not.be.undefined;
            expect(schema.title).equal('MyRequest');
        });

        it('should generate regex and bounds', () => {
            const modelManager = new ModelManager();
            modelManager.addCTOModel( MODEL_BOUNDS );
            const visitor = new JSONSchemaVisitor();
            const schema = modelManager.accept(visitor, { rootType: 'test.Test'});
            expect(schema.properties.myString.pattern).equal('abc.*');
        });

        it('should inline types for simple model', () => {
            const modelManager = new ModelManager();
            modelManager.addCTOModel( MODEL_SIMPLE );
            const visitor = new JSONSchemaVisitor();
            const schema = modelManager.accept(visitor, { rootType: 'test.MyRequest', inlineTypes: true});
            expect(schema.properties.money.$ref).to.be.undefined;
            expect(schema.properties.money.title).equal('Money');
        });

        it('should use format uuid if relationship identifier is UUID type', () => {
            const modelManager = new ModelManager();
            modelManager.addCTOModel( UUID_SCALAR );
            modelManager.addCTOModel( MODEL_RELATIONSHIP_SIMPLE );
            const visitor = new JSONSchemaVisitor();
            const schema = modelManager.accept(visitor, { rootType: 'test.SomeOtherThing', inlineTypes: true});
            expect(schema.properties.intField.$ref).to.be.undefined;
            expect(schema.properties.otherThingId.$ref).to.be.undefined;
            expect(schema.properties.otherThingId.type).equal('string');
            expect(schema.properties.otherThingId.format).equal('uuid');
        });

        it('should use format uuid for scalar uuid data type', () => {
            const modelManager = new ModelManager();
            modelManager.addCTOModel( UUID_SCALAR );
            modelManager.addCTOModel( MODEL_SIMPLE3 );
            const visitor = new JSONSchemaVisitor();
            const schema = modelManager.accept(visitor, { rootType: 'test.OtherThing'});
            expect(schema.properties.id.$ref).to.be.undefined;
            expect(schema.properties.id.type).equal('string');
            expect(schema.properties.id.format).equal('uuid');
            expect(schema.properties.someId.type).equal('string');
            expect(schema.properties.someId.format).to.be.undefined;
        });

        it('should write to disk', () => {
            const modelManager = new ModelManager();
            modelManager.addCTOModel( MODEL_SIMPLE );
            const visitor = new JSONSchemaVisitor();
            const fileWriter = new FileWriter('./output');
            modelManager.accept(visitor, { fileWriter, rootType: 'test.MyRequest', inlineTypes: true});
            const contents = JSON.parse(fs.readFileSync( path.join('./output', 'test.MyRequest.json'), 'utf-8' ));
            expect(contents.title).equal('MyRequest');
        });

        it('should only return definitions', () => {
            const modelManager = new ModelManager();
            modelManager.addCTOModel( MODEL_SIMPLE );
            const visitor = new JSONSchemaVisitor();
            const schema = modelManager.accept(visitor, {});
            expect(schema.title).to.be.undefined;
        });

        it('should detect complex recursive model', () => {
            const modelManager = new ModelManager();
            modelManager.addCTOModel( MODEL_RECURSIVE_COMPLEX );
            const visitor = new RecursionDetectionVisitor();
            const type = modelManager.getType('org.accordproject.ergo.monitor.Monitor');
            const result = type.accept(visitor, {stack: []});
            expect(result).equal(true);
        });

        it('should generate JSON schema for recursive schema with decorators and validators', () => {
            const modelManager = new ModelManager();
            modelManager.addCTOModel( MODEL_RECURSIVE_COMPLEX );

            const visitor = new JSONSchemaVisitor();
            const monitorSchema = modelManager.accept(visitor, { rootType: 'org.accordproject.ergo.monitor.Monitor'});
            expect(monitorSchema.title).equal('Monitor');

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

            const ajv = new Ajv({ strict: false });
            expect( ajv.validate(monitorSchema, instance)).equals(true);
        });

        it('should generate JSON schema for simple schema', () => {
            const modelManager = new ModelManager();
            modelManager.addCTOModel( MODEL_SIMPLE );

            const visitor = new JSONSchemaVisitor();
            const schema = modelManager.accept(visitor, { rootType: 'test.MyRequest'});
            expect(schema.title).equal('MyRequest');

            // check that the generated schema validates a valid instance
            const instance =
          {
              $class : 'test.MyRequest',
              id: '001',
              age : 10,
              name: 'Dan',
              color: 'RED',
              money : {
                  $class : 'test.Money',
                  value: 100.5,
                  currencyCode: 'GBP'
              },
              email: 'hello@example.com',
              date: new Date().toISOString(),
          };

            const ajv = new Ajv({ strict: false });
            expect( ajv.validate(schema, instance)).equals(true);
        });
    });
});
