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

const TypedStack = require('@accordproject/concerto-util').TypedStack;
const Factory = require('../../lib/factory');
const InstanceGenerator = require('../../lib/serializer/instancegenerator');
const ModelManager = require('../../lib/modelmanager');
const ValueGenerator = require('../../lib/serializer/valuegenerator');
const Util = require('../composer/composermodelutility');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

const chai = require('chai');
const should = chai.should();

describe('InstanceGenerator', () => {
    let factory;
    let modelManager;
    let parameters;
    let visitor;

    const useEmptyGenerator = () => {
        parameters.valueGenerator = ValueGenerator.empty();
    };

    const useSampleGenerator = () => {
        parameters.valueGenerator = ValueGenerator.sample();
    };

    beforeEach(() => {
        modelManager = new ModelManager();
        Util.addComposerModel(modelManager);
        factory = new Factory(modelManager);
        parameters = {
            modelManager: modelManager,
            factory: factory,
        };
        useSampleGenerator();
        visitor = new InstanceGenerator();
    });

    const test = (modelFile) => {
        modelManager.addCTOModel(modelFile);
        let resource = factory.newResource('org.acme.test', 'MyAsset', 'asset1');
        parameters.stack = new TypedStack(resource);
        parameters.seen = [resource.getFullyQualifiedType()];
        let classDeclaration = resource.getClassDeclaration();
        return classDeclaration.accept(visitor, parameters);
    };

    describe('#visit', () => {

        it('should throw on unrecognized thing', () => {
            (() => {
                visitor.visit(dayjs.utc(), {});
            }).should.throw(/Unrecognised/);
        });

        it('should generate a default value for a string property', () => {
            let resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                o String theValue
            }`);
            resource.theValue.should.be.a('string');
        });

        it('should generate a default value for a string property with a regex', () => {
            let resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                o String theValue regex = /foo/
            }`);
            resource.theValue.should.be.a('string');
        });

        it('should generate default value for a Map', function () {
            let resource = test(`namespace org.acme.test

            map Foo {
                o String
                o String
            }

            concept MyAsset identified by assetId {
                o String assetId
                o Foo bar
            }
            `);
            resource.bar.should.be.an.instanceOf(Map);
            resource.bar.size.should.be.equal(1);

            const iterator1 = resource.bar.entries();
            let values = iterator1.next().value;

            values[0].should.be.a('string');
            values[1].should.be.a('string');
        });

        it('should generate a value with specified lentgh constraint for a string property', () => {
            useSampleGenerator();
            let resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                o String valueWithRegexAndLength regex = /^[a-zA-Z0-9_]*$/ length=[1,100]
                o String valueWthLength length=[1,100]
                o String valueWithMinLength length=[1,]
                o String valueWithMaxLength length=[,100]
                o String valueWithExactLength length=[100,100]
            }`);
            resource.valueWithRegexAndLength.should.be.a('string');
            resource.valueWithRegexAndLength.length.should.be.below(101).and.to.be.above(0);
            resource.valueWthLength.should.be.a('string');
            resource.valueWthLength.length.should.be.below(101).and.to.be.above(0);
            resource.valueWithMinLength.should.be.a('string');
            resource.valueWithMinLength.length.should.be.above(0);
            resource.valueWithMaxLength.should.be.a('string');
            resource.valueWithMaxLength.length.should.be.below(101);
            resource.valueWithExactLength.should.be.a('string');
            resource.valueWithExactLength.should.have.lengthOf(100);
        });

        it('should not throw a recursion error', () => {
            let resource = test(`namespace org.acme.test
            participant MyParticipant identified by participantId{
                o String participantId
                o String value
            }
            asset MyAsset identified by assetId {
                o String assetId
                o String theValue
                o MyParticipant test1
                o MyParticipant test2
            }`);
            should.exist(resource.theValue);
        });

        it('should generate empty array value for array property with empty generator ', () => {
            useEmptyGenerator();
            let resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                o String[] theValues
            }`);
            resource.theValues.should.be.a('Array').that.is.empty;
        });
        it('should return null for optional recursive field ', () => {
            parameters.includeOptionalFields = true;
            let resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                o MyAsset theValues optional
            }`);
            should.not.exist(resource.theValues);
        });

        it('should generate one default value for a string array property with sample generator ', () => {
            useSampleGenerator();
            let resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                o String[] theValues
            }`);
            resource.theValues.should.be.a('Array').and.have.lengthOf(1);
            resource.theValues[0].should.be.a('String');
        });
        it('should return an empty array with sample generator, when empty array is recursive ', () => {
            useSampleGenerator();
            let resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                o MyAsset[] theValues
            }`);
            resource.theValues.should.be.a('Array').and.have.lengthOf(0);
        });
        it('should throw an error when field is recursive ', () => {
            try {

                test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                o MyAsset theValues
            }`);

            } catch (error) {
                error.should.match(/Model is recursive./);
            }

        });
        it('should generate a default value for a date/time property', () => {
            let resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                o DateTime theValue
            }`);
            resource.theValue.should.be.an.instanceOf(dayjs);
        });

        it('should generate one default value for a date/time array property', () => {
            let resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                o DateTime[] theValues
            }`);
            resource.theValues.should.be.a('Array').and.have.lengthOf(1);
            resource.theValues[0].should.be.an.instanceOf(dayjs);
        });

        it('should generate a default value for an integer property', () => {
            let resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                o Integer theValue
            }`);
            resource.theValue.should.be.a('number');
        });

        it('should generate a default value for an integer property with a range', () => {
            let resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                o Integer theValue range = [-1,1]
            }`);
            resource.theValue.should.be.a('number');
        });

        it('should generate a default value for an integer array property', () => {
            let resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                o Integer[] theValues
            }`);
            resource.theValues.should.be.a('Array').and.have.lengthOf(1);
            resource.theValues[0].should.be.a('Number');
        });

        it('should generate a default value for a long property', () => {
            let resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                o Long theValue
            }`);
            resource.theValue.should.be.a('number');
        });

        it('should generate a default value for a long property with a range', () => {
            let resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                o Long theValue range = [-1,1]
            }`);
            resource.theValue.should.be.a('number');
        });

        it('should generate a default value for a long array property', () => {
            let resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                o Long[] theValues
            }`);
            resource.theValues.should.be.a('Array').and.have.lengthOf(1);
            resource.theValues[0].should.be.a('Number');
        });

        it('should generate a default value for a double property', () => {
            let resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                o Double theValue
            }`);
            resource.theValue.should.be.a('number');
        });

        it('should generate a default value for a double property with a range', () => {
            let resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                o Double theValue range = [-3.142, 3.143]
            }`);
            resource.theValue.should.be.a('number');
        });

        it('should generate a default value for a double array property', () => {
            let resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                o Double[] theValues
            }`);
            resource.theValues.should.be.a('Array').and.have.lengthOf(1);
            resource.theValues[0].should.be.a('Number');
        });

        it('should generate a default value for a boolean property', () => {
            let resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                o Boolean theValue
            }`);
            resource.theValue.should.be.a('boolean');
        });

        it('should generate a default value for a boolean array property', () => {
            let resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                o Boolean[] theValues
            }`);
            resource.theValues.should.be.a('Array').and.have.lengthOf(1);
            resource.theValues[0].should.be.a('Boolean');
        });

        it('should generate a default value for an enum property', () => {
            let resource = test(`namespace org.acme.test
            enum MyEnum {
                o ENUM_VAL1
                o ENUM_VAL2
                o ENUM_VAL3
            }
            asset MyAsset identified by assetId {
                o String assetId
                o MyEnum theValue
            }`);
            resource.theValue.should.be.oneOf(['ENUM_VAL1', 'ENUM_VAL2', 'ENUM_VAL3']);
        });

        it('should generate a default value for an enum array property', () => {
            let resource = test(`namespace org.acme.test
            enum MyEnum {
                o ENUM_VAL1
                o ENUM_VAL2
                o ENUM_VAL3
            }
            asset MyAsset identified by assetId {
                o String assetId
                o MyEnum[] theValues
            }`);
            resource.theValues.should.be.a('Array').and.have.lengthOf(1);
            resource.theValues[0].should.be.oneOf(['ENUM_VAL1', 'ENUM_VAL2', 'ENUM_VAL3']);
        });

        it('should generate a default value for a relationship property', () => {
            let resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                --> MyAsset theValue
            }`);
            resource.theValue.getIdentifier().should.match(/^\d{4}$/);
        });

        it('should generate a default value for a relationship array property', () => {
            let resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                --> MyAsset[] theValues
            }`);
            resource.theValues.should.be.a('Array').and.have.lengthOf(1);
            resource.theValues[0].getIdentifier().should.match(/^\d{4}$/);
        });

        it('should generate a default value for a resource property', () => {
            let resource = test(`namespace org.acme.test
            asset MyInnerAsset identified by innerAssetId {
                o String innerAssetId
                o String theValue
            }
            asset MyAsset identified by assetId {
                o String assetId
                o MyInnerAsset theValue
            }`);
            resource.theValue.getIdentifier().should.match(/^\d{4}$/);
            resource.theValue.theValue.should.be.a('string');
        });

        it('should generate a default value for a resource array property', () => {
            let resource = test(`namespace org.acme.test
            asset MyInnerAsset identified by innerAssetId {
                o String innerAssetId
                o String theValue
            }
            asset MyAsset identified by assetId {
                o String assetId
                o MyInnerAsset[] theValues
            }`);
            resource.theValues.should.be.a('Array').and.have.lengthOf(1);
            resource.theValues[0].getIdentifier().should.match(/^\d{4}$/);
            resource.theValues[0].theValue.should.be.a('string');
        });

        it('should generate a default value for base class properties', () => {
            let resource = test(`namespace org.acme.test
            abstract asset BaseAsset {
                o String inheritedValue
            }
            asset MyAsset identified by assetId extends BaseAsset {
                o String assetId
            }`);
            resource.inheritedValue.should.be.a('string');
        });

        it('should generate a concrete class for an abstract type if one is available', () => {
            let resource = test(`namespace org.acme.test
            abstract concept BaseConcept {
                o String inheritedValue
            }
            concept MyConcept extends BaseConcept {
                o String concreteConceptValue
            }
            asset MyAsset identified by id {
                o String id
                o BaseConcept aConcept
            }`);
            resource.aConcept.getType().should.equal('MyConcept');
        });

        it('should throw an error when trying to generate a resource from a model that uses an Abstract type with no concrete Implementing type', () => {
            try {
                test(`namespace org.acme.test
                    abstract concept BaseConcept {
                        o String inheritedValue
                    }
                    asset MyAsset identified by id {
                        o String id
                        o BaseConcept aConcept
                    }`);
            } catch (error) {
                error.should.match(/^Error: No concrete extending type for "org.acme.test.BaseConcept".$/);
            }
        });

        it('should not generate default value for optional property if not requested', () => {
            parameters.includeOptionalFields = false;
            const resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                o String theValue optional
            }`);
            should.equal(resource.theValue, undefined);
        });

        it('should generate default value for optional property if requested', () => {
            parameters.includeOptionalFields = true;
            const resource = test(`namespace org.acme.test
            asset MyAsset identified by assetId {
                o String assetId
                o String theValue optional
            }`);
            resource.theValue.should.be.a('String');
        });

        it('should generate concrete subclass for abstract reference', function () {
            let resource = test(`namespace org.acme.test
            event MyEvent identified by eventId {
                o String eventId
            }
            asset MyAsset identified by id {
                o String id
                --> MyEvent theValue
            }`);
            resource.theValue.getType().should.equal('MyEvent');
        });

        it('should generate default value for a Scalar field', function () {
            let resource = test(`namespace org.acme.test

            scalar SSN extends String regex=/^\\d{3}-\\d{2}-\\d{4}$/
            scalar ScalarWithDefault extends String default="000-00-0000"

            asset MyAsset identified by id {
                o String id
                o SSN ssn
                o ScalarWithDefault ssn2
            }`);
            resource.ssn.should.be.a('String');
            resource.ssn2.should.be.a('String');
            resource.ssn.should.match(/^\d{3}-\d{2}-\d{4}$/);
            resource.ssn2.should.equal('000-00-0000');
        });

        it('should generate with appropritate string length value for a Scalar field', function () {
            let resource = test(`namespace org.acme.test

            scalar ScalarValueWithRegexAndLength extends String regex=/^[a-zA-Z0-9_]*$/ length=[1,100]
            scalar ScalarValueWthLength extends String length=[1,100]
            scalar ScalarValueWithMinLength extends String length=[1,]
            scalar ScalarValueWithMaxLength extends String length=[,100]
            scalar ScalarValueWithExactLength extends String length=[100,100]

            asset MyAsset identified by id {
                o String id
                o ScalarValueWithRegexAndLength scalarValueWithRegexAndLength
                o ScalarValueWthLength scalarValueWthLength
                o ScalarValueWithMinLength scalarValueWithMinLength
                o ScalarValueWithMaxLength scalarValueWithMaxLength
                o ScalarValueWithExactLength scalarValueWithExactLength
            }`);
            resource.scalarValueWithRegexAndLength.should.be.a('String');
            resource.scalarValueWithRegexAndLength.should.match(/^[a-zA-Z0-9_]*$/);
            resource.scalarValueWithRegexAndLength.length.should.be.below(101).and.to.be.above(0);
            resource.scalarValueWthLength.should.be.a('string');
            resource.scalarValueWthLength.length.should.be.below(101).and.to.be.above(0);
            resource.scalarValueWithMinLength.should.be.a('string');
            resource.scalarValueWithMinLength.length.should.be.above(0);
            resource.scalarValueWithMaxLength.should.be.a('string');
            resource.scalarValueWithMaxLength.length.should.be.below(101);
            resource.scalarValueWithExactLength.should.be.a('string');
            resource.scalarValueWithExactLength.should.have.lengthOf(100);
        });

        it('should throw an error when id provided does not match regex on id field', function () {
            (() => test(`namespace org.acme.test

            scalar SSN extends String regex=/^\\d{3}-\\d{2}-\\d{4}$/

            asset MyAsset identified by ssn {
                o String id
                o SSN ssn
            }`)).should.throw(/Provided id does not match regex/);
        });
    });

    describe('#findConcreteSubclass', () => {
        it('should return the same declaration if it is abstract', () => {
            const declaration = {
                isAbstract: () => {
                    return false;
                }
            };
            visitor.findConcreteSubclass(declaration).should.deep.equal(declaration);
        });
    });
});
