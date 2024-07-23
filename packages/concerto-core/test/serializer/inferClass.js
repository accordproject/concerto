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
const fs = require('fs');
const Factory = require('../../lib/factory');
const Serializer = require('../../lib/serializer');
const ModelManager = require('../../lib/modelmanager');
const ModelFile = require('../../lib/introspect/modelfile');

describe('InferClass Serialization', () => {

    let modelManager;
    let factory;
    let serializer;
    let serializerV2;

    before(() => {
        modelManager = new ModelManager({ addMetamodel: true, strict: true });
        modelManager.addCTOModel(`
            namespace org.acme.zoo@1.0.0

            abstract concept Animal {
               o String name
            }

            concept Address {
               o String line1
               o String line2 optional
               o String city
               o String state
               o String country
            }

            // a type that extends Animal, in the same ns as Animal
            concept Dog extends Animal{}

            abstract concept Person {
               o Address address optional
               o String name
            }

            concept Owner extends Person {
               o Integer age
            }

            concept Zoo {
               o Person person // $class can be inferred from model, there is one 1 class (Owner)
               o Animal[] animals // $class cannot be inferred from model
            }
        `);

        modelManager.addCTOModel(`
            namespace org.acme.cat@1.0.0
            import org.acme.zoo@1.0.0.{Animal}
            // a type that extends Animal in a different namespace
            concept Cat extends Animal{}
        `);

        // const mm = fs.readFileSync('./test/data/model/metamodel@1.0.0.cto', 'utf8');
        // modelManager.addCTOModel(mm, 'metamodel.cto');

        factory = new Factory(modelManager);
        serializer = new Serializer(factory, modelManager);
        serializerV2 = new Serializer(factory, modelManager, { inferClass: true });
    });

    beforeEach(() => {
    });

    afterEach(() => {
    });

    describe.only('#inferClass (metamodel)', () => {
        it('should deserialize a metamodel instance', () => {
            const json = JSON.parse(fs.readFileSync('./test/serializer/sampleMetamodel.json', 'utf-8'));
            const resource = serializerV2.fromJSON(json);
            resource.should.not.be.null;
        });
        it('should create a ModelFile from a metamodel instance', () => {
            const json = JSON.parse(fs.readFileSync('./test/serializer/sampleMetamodel.json', 'utf-8'));
            const mm = new ModelManager();
            const mf = new ModelFile(mm, json, undefined, 'sampleMetamodel.json');
            mf.should.not.be.null;
        });
    });

    describe('#inferClass (true)', () => {
        it('should support short names for nested objects', () => {
            const resource = serializerV2.fromJSON({
                $class: 'org.acme.zoo@1.0.0.Zoo',
                person: {
                    $class: 'Owner',
                    name: 'Dan',
                    age: 42,
                    address: {
                        line1: '1 Main Street',
                        city: 'Boston',
                        state: 'MA',
                        country: 'USA'
                    }
                },
                animals: [
                    {
                        $class: 'Dog',
                        name: 'fido'
                    }
                ]
            });
            resource.animals[0].getFullyQualifiedType().should.be.equal('org.acme.zoo@1.0.0.Dog');
            const json = serializerV2.toJSON(resource);
            console.log(JSON.stringify(json, null, 2));
            json.should.deep.equal({
                $class: 'org.acme.zoo@1.0.0.Zoo',
                person: {
                    $class: 'Owner',
                    name: 'Dan',
                    age: 42,
                    address: {
                        line1: '1 Main Street',
                        city: 'Boston',
                        state: 'MA',
                        country: 'USA'
                    }
                },
                animals: [
                    { $class: 'Dog', name: 'fido' }
                ]
            });
        });
        it('should support long names for nested objects', () => {
            const resource = serializerV2.fromJSON({
                $class: 'org.acme.zoo@1.0.0.Zoo',
                person: {
                    $class: 'org.acme.zoo@1.0.0.Owner',
                    name: 'Dan',
                    age: 42
                },
                animals: [
                    {
                        $class: 'org.acme.zoo@1.0.0.Dog',
                        name: 'fido'
                    }
                ]
            });
            resource.animals[0].getFullyQualifiedType().should.be.equal('org.acme.zoo@1.0.0.Dog');
            const json = serializerV2.toJSON(resource);
            json.should.deep.equal({
                $class: 'org.acme.zoo@1.0.0.Zoo',
                person: {
                    $class: 'Owner',
                    name: 'Dan',
                    age: 42
                },
                animals: [
                    { $class: 'Dog', name: 'fido' }
                ]
            });
        });
        it('should use FQNs for nested objects in a different ns', () => {
            const resource = serializerV2.fromJSON({
                $class: 'org.acme.zoo@1.0.0.Zoo',
                person: {
                    $class: 'Owner',
                    name: 'Dan',
                    age: 42
                },
                animals: [
                    {
                        $class: 'org.acme.cat@1.0.0.Cat',
                        name: 'tiddles'
                    },
                    { $class: 'Dog', name: 'fido' }
                ]
            });
            resource.animals[0].getFullyQualifiedType().should.be.equal('org.acme.cat@1.0.0.Cat');
            const json = serializerV2.toJSON(resource);
            json.should.deep.equal({
                $class: 'org.acme.zoo@1.0.0.Zoo',
                person: {
                    $class: 'Owner',
                    name: 'Dan',
                    age: 42
                },
                animals: [
                    { $class: 'org.acme.cat@1.0.0.Cat', name: 'tiddles' },
                    { $class: 'Dog', name: 'fido' }
                ]
            });
        });
    });
    describe('#inferClass (false)', () => {
        it('should support short names for nested objects', () => {
            const resource = serializer.fromJSON({
                $class: 'org.acme.zoo@1.0.0.Zoo',
                person: {
                    $class: 'Owner',
                    name: 'Dan',
                    age: 42
                },
                animals: [
                    {
                        $class: 'Dog',
                        name: 'fido'
                    }
                ]
            });
            resource.animals[0].getFullyQualifiedType().should.be.equal('org.acme.zoo@1.0.0.Dog');
            const json = serializer.toJSON(resource);
            json.should.deep.equal({
                $class: 'org.acme.zoo@1.0.0.Zoo',
                person: {
                    $class: 'org.acme.zoo@1.0.0.Owner',
                    name: 'Dan',
                    age: 42
                },
                animals: [
                    { $class: 'org.acme.zoo@1.0.0.Dog', name: 'fido' }
                ]
            });
        });
        it('should support long names for nested objects', () => {
            const resource = serializer.fromJSON({
                $class: 'org.acme.zoo@1.0.0.Zoo',
                person: {
                    $class: 'Owner',
                    name: 'Dan',
                    age: 42
                },
                animals: [
                    {
                        $class: 'org.acme.zoo@1.0.0.Dog',
                        name: 'fido'
                    }
                ]
            });
            resource.animals[0].getFullyQualifiedType().should.be.equal('org.acme.zoo@1.0.0.Dog');
            const json = serializer.toJSON(resource);
            json.should.deep.equal({
                $class: 'org.acme.zoo@1.0.0.Zoo',
                person: {
                    $class: 'org.acme.zoo@1.0.0.Owner',
                    name: 'Dan',
                    age: 42
                },
                animals: [
                    { $class: 'org.acme.zoo@1.0.0.Dog', name: 'fido' }
                ]
            });
        });
        it('should use FQNs for nested objects in a different ns', () => {
            const resource = serializer.fromJSON({
                $class: 'org.acme.zoo@1.0.0.Zoo',
                person: {
                    $class: 'Owner',
                    name: 'Dan',
                    age: 42
                },
                animals: [
                    {
                        $class: 'org.acme.cat@1.0.0.Cat',
                        name: 'tiddles'
                    }
                ]
            });
            resource.animals[0].getFullyQualifiedType().should.be.equal('org.acme.cat@1.0.0.Cat');
            const json = serializer.toJSON(resource);
            json.should.deep.equal({
                $class: 'org.acme.zoo@1.0.0.Zoo',
                person: {
                    $class: 'org.acme.zoo@1.0.0.Owner',
                    name: 'Dan',
                    age: 42
                },
                animals: [
                    { $class: 'org.acme.cat@1.0.0.Cat', name: 'tiddles' }
                ]
            });
        });
    });
});
