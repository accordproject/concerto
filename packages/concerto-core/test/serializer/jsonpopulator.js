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
const Field = require('../../lib/introspect/field');
const JSONPopulator = require('../../lib/serializer/jsonpopulator');
const ModelManager = require('../../lib/modelmanager');
const Relationship = require('../../lib/model/relationship');
const Resource = require('../../lib/model/resource');
const TypedStack = require('../../lib/serializer/typedstack');
const ValidationException = require('../../lib/serializer/validationexception');
const TypeNotFoundException = require('../../lib/typenotfoundexception');
const Util = require('../composer/composermodelutility');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);

require('chai').should();
const sinon = require('sinon');

describe('JSONPopulator', () => {

    let modelManager;
    let mockFactory;
    let jsonPopulator;
    let ergoJsonPopulator;
    let sandbox;
    let assetDeclaration1;
    let relationshipDeclaration1;
    let relationshipDeclaration2;

    before(() => {
        modelManager = new ModelManager();
        Util.addComposerModel(modelManager);
        modelManager.addModelFile(`
            namespace org.acme
            asset MyAsset1 identified by assetId {
                o String assetId
                o Integer assetValue optional
            }
            asset MyAsset2 identified by assetId {
                o String assetId
                o Integer integerValue
            }
            asset MyContainerAsset1 identified by assetId {
                o String assetId
                o MyAsset1 myAsset
            }
            asset MyContainerAsset2 identified by assetId {
                o String assetId
                o MyAsset1[] myAssets
            }
            transaction MyTx1 {
                --> MyAsset1 myAsset
            }
            transaction MyTx2 {
                --> MyAsset1[] myAssets
            }
        `);
        modelManager.addModelFile(`
            namespace org.acme.different
            asset MyAsset1 identified by assetId {
                o String assetId
            }
        `);
        assetDeclaration1 = modelManager.getType('org.acme.MyContainerAsset1').getProperty('myAsset');
        relationshipDeclaration1 = modelManager.getType('org.acme.MyTx1').getProperty('myAsset');
        relationshipDeclaration2 = modelManager.getType('org.acme.MyTx2').getProperty('myAssets');
    });

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        mockFactory = sinon.createStubInstance(Factory);
        jsonPopulator = new JSONPopulator();
        ergoJsonPopulator = new JSONPopulator(null,true);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#visit', () => {

        it('should throw an error for an unrecognized type', () => {
            (() => {
                jsonPopulator.visit(3.142, {});
            }).should.throw(/Unrecognised/);
        });

    });

    describe('#convertToObject', () => {

        it('should convert to dates from ISO8601 strings', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('DateTime');
            let value = jsonPopulator.convertToObject(field, '2016-10-20T05:34:03.519Z');
            value.format('YYYY-MM-DDTHH:mm:ss.SSS[Z]').should.equal(dayjs.utc('2016-10-20T05:34:03.519Z').format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'));
        });

        it('should convert to dates from dayjs objects', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('DateTime');
            let value = jsonPopulator.convertToObject(field, dayjs.utc('2016-10-20T05:34:03Z'));
            value.format('YYYY-MM-DDTHH:mm:ss.SSS[Z]').should.equal(dayjs.utc('2016-10-20T05:34:03.000Z').format('YYYY-MM-DDTHH:mm:ss.SSS[Z]'));
        });

        it('should not convert to dates from invalid dayjs objects', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('DateTime');
            (() => {
                jsonPopulator.convertToObject(field, 'foo');
            }).should.throw(ValidationException, /Expected value "foo" to be of type DateTime/);
        });

        it('should not convert to dates from null', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('DateTime');
            (() => {
                jsonPopulator.convertToObject(field, null);
            }).should.throw(ValidationException, /Expected value null to be of type DateTime/);
        });

        it('should not convert to dates from undefined', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('DateTime');
            (() => {
                jsonPopulator.convertToObject(field, undefined);
            }).should.throw(ValidationException, /Expected value undefined to be of type DateTime/);
        });

        it('should not convert to dates when not in ISO 8601 format', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('DateTime');
            (() => {
                jsonPopulator.convertToObject(field, 'abc');
            }).should.throw(ValidationException, /Expected value "abc" to be of type DateTime/);
        });

        it('should not convert to integers from strings', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('Integer');
            (() => {
                jsonPopulator.convertToObject(field, '32768');
            }).should.throw(ValidationException, /Expected value "32768" to be of type Integer/);
        });

        it('should not convert to integer from null', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('Integer');
            (() => {
                jsonPopulator.convertToObject(field, null);
            }).should.throw(ValidationException, /Expected value null to be of type Integer/);
        });

        it('should not convert to integer from undefined', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('Integer');
            (() => {
                jsonPopulator.convertToObject(field, undefined);
            }).should.throw(ValidationException, /Expected value undefined to be of type Integer/);
        });

        it('should convert to integers from numbers', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('Integer');
            let value = jsonPopulator.convertToObject(field, 32768);
            value.should.equal(32768);
            value = ergoJsonPopulator.convertToObject(field, {'$nat':32768});
            value.should.equal(32768);
        });

        it('should not convert to longs from strings', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('Long');
            (() => {
                jsonPopulator.convertToObject(field, '32768');
            }).should.throw(ValidationException, /Expected value "32768" to be of type Long/);
        });

        it('should not convert to long from null', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('Long');
            (() => {
                jsonPopulator.convertToObject(field, null);
            }).should.throw(ValidationException, /Expected value null to be of type Long/);
        });

        it('should not convert to long from undefined', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('Long');
            (() => {
                jsonPopulator.convertToObject(field, undefined);
            }).should.throw(ValidationException, /Expected value undefined to be of type Long/);
        });

        it('should convert to longs from numbers', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('Long');
            let value = jsonPopulator.convertToObject(field, 32768);
            value.should.equal(32768);
            value = ergoJsonPopulator.convertToObject(field, {'$nat':32768});
            value.should.equal(32768);
        });

        it('should not convert to longs from numbers that are not integers', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('Long');
            (() => {
                jsonPopulator.convertToObject(field, 32.768);
            }).should.throw(ValidationException, /Expected value 32.768 to be of type Long/);
        });

        it('should not convert to doubles from strings', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('Double');
            (() => {
                jsonPopulator.convertToObject(field, '32.768');
            }).should.throw(ValidationException, /Expected value "32.768" to be of type Double/);
        });

        it('should not convert to double from null', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('Double');
            (() => {
                jsonPopulator.convertToObject(field, null);
            }).should.throw(ValidationException, /Expected value null to be of type Double/);
        });

        it('should not convert to double from undefined', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('Double');
            (() => {
                jsonPopulator.convertToObject(field, undefined);
            }).should.throw(ValidationException, /Expected value undefined to be of type Double/);
        });

        it('should convert to doubles from numbers', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('Double');
            let value = jsonPopulator.convertToObject(field, 32.768);
            value.should.equal(32.768);
        });

        it('should convert to booleans from true', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('Boolean');
            let value = jsonPopulator.convertToObject(field, true);
            value.should.equal(true);
        });

        it('should not convert to booleans from strings', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('Boolean');
            (() => {
                jsonPopulator.convertToObject(field, 'true');
            }).should.throw(ValidationException, /Expected value "true" to be of type Boolean/);
        });

        it('should not convert to booleans from numbers', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('Boolean');
            (() => {
                jsonPopulator.convertToObject(field, 32.768);
            }).should.throw(ValidationException, /Expected value 32.768 to be of type Boolean/);
        });

        it('should not convert to boolean from null', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('Boolean');
            (() => {
                jsonPopulator.convertToObject(field, null);
            }).should.throw(ValidationException, /Expected value null to be of type Boolean/);
        });

        it('should not convert to boolean from undefined', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('Boolean');
            (() => {
                jsonPopulator.convertToObject(field, undefined);
            }).should.throw(ValidationException, /Expected value undefined to be of type Boolean/);
        });

        it('should convert to strings from strings', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('String');
            let value = jsonPopulator.convertToObject(field, 'hello world');
            value.should.equal('hello world');
        });

        it('should not convert to strings from numbers', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('String');
            (() => {
                jsonPopulator.convertToObject(field, 32.768);
            }).should.throw(ValidationException, /Expected value 32.768 to be of type String/);
        });

        it('should not convert to string from null', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('String');
            (() => {
                jsonPopulator.convertToObject(field, null);
            }).should.throw(ValidationException, /Expected value null to be of type String/);
        });

        it('should not convert to string from undefined', () => {
            let field = sinon.createStubInstance(Field);
            field.getType.returns('String');
            (() => {
                jsonPopulator.convertToObject(field, undefined);
            }).should.throw(ValidationException, /Expected value undefined to be of type String/);
        });

    });

    describe('#convertItem', () => {

        it('should throw an error if the $class value does not match a class defined in the model', () => {
            let options = {
                jsonStack: new TypedStack({}),
                resourceStack: new TypedStack({}),
                factory: mockFactory,
                modelManager: modelManager
            };
            let mockResource = sinon.createStubInstance(Resource);
            mockFactory.newResource.withArgs('org.acme', 'MyAsset1', 'asset1').returns(mockResource);
            (() => {
                jsonPopulator.convertItem(assetDeclaration1, {
                    $class: 'org.acme.NOTAREALTYPE',
                    assetId: 'asset1'
                }, options);
            }).should.throw(TypeNotFoundException, /NOTAREALTYPE/);
        });

        it('should create a new resource from an object using a $class value that matches the model', () => {
            let options = {
                jsonStack: new TypedStack({}),
                resourceStack: new TypedStack({}),
                factory: mockFactory,
                modelManager: modelManager
            };
            let mockResource = sinon.createStubInstance(Resource);
            mockFactory.newResource.withArgs('org.acme', 'MyAsset1', 'asset1').returns(mockResource);
            let resource = jsonPopulator.convertItem(assetDeclaration1, {
                $class: 'org.acme.MyAsset1',
                assetId: 'asset1'
            }, options);
            resource.should.be.an.instanceOf(Resource);
            sinon.assert.calledWith(mockFactory.newResource, 'org.acme', 'MyAsset1', 'asset1');
        });

        it('should create a new resource from an object using a $class value that matches the model with optional integer', () => {
            let options = {
                jsonStack: new TypedStack({}),
                resourceStack: new TypedStack({}),
                factory: mockFactory,
                modelManager: modelManager
            };
            let mockResource = sinon.createStubInstance(Resource);
            mockFactory.newResource.withArgs('org.acme', 'MyAsset1', 'asset1').returns(mockResource);
            let resource = jsonPopulator.convertItem(assetDeclaration1, {
                $class: 'org.acme.MyAsset1',
                assetId: 'asset1',
                assetValue: 1
            }, options);
            resource.should.be.an.instanceOf(Resource);
            sinon.assert.calledWith(mockFactory.newResource, 'org.acme', 'MyAsset1', 'asset1');
        });

        it('should create a new resource from an object using a $class value that matches the model with optional intege (Ergo)', () => {
            let options = {
                jsonStack: new TypedStack({}),
                resourceStack: new TypedStack({}),
                factory: mockFactory,
                modelManager: modelManager
            };
            let mockResource = sinon.createStubInstance(Resource);
            mockFactory.newResource.withArgs('org.acme', 'MyAsset1', 'asset1').returns(mockResource);
            let resource = ergoJsonPopulator.convertItem(assetDeclaration1, {
                $class: 'org.acme.MyAsset1',
                assetId: 'asset1',
                assetValue: { '$left' : { '$nat' : 1 } }
            }, options);
            resource.should.be.an.instanceOf(Resource);
            sinon.assert.calledWith(mockFactory.newResource, 'org.acme', 'MyAsset1', 'asset1');
        });

        it('should create a new resource from an object using a $class value that matches the model with optional integer (null)', () => {
            let options = {
                jsonStack: new TypedStack({}),
                resourceStack: new TypedStack({}),
                factory: mockFactory,
                modelManager: modelManager
            };
            let mockResource = sinon.createStubInstance(Resource);
            mockFactory.newResource.withArgs('org.acme', 'MyAsset1', 'asset1').returns(mockResource);
            let resource = jsonPopulator.convertItem(assetDeclaration1, {
                $class: 'org.acme.MyAsset1',
                assetId: 'asset1',
                assetValue: null
            }, options);
            resource.should.be.an.instanceOf(Resource);
            sinon.assert.calledWith(mockFactory.newResource, 'org.acme', 'MyAsset1', 'asset1');
        });

        it('should create a new resource from an object using a $class value that matches the model with optional integer (null) (Ergo)', () => {
            let options = {
                jsonStack: new TypedStack({}),
                resourceStack: new TypedStack({}),
                factory: mockFactory,
                modelManager: modelManager
            };
            let mockResource = sinon.createStubInstance(Resource);
            mockFactory.newResource.withArgs('org.acme', 'MyAsset1', 'asset1').returns(mockResource);
            let resource = ergoJsonPopulator.convertItem(assetDeclaration1, {
                $class: 'org.acme.MyAsset1',
                assetId: 'asset1',
                assetValue: { '$right' : null }
            }, options);
            resource.should.be.an.instanceOf(Resource);
            sinon.assert.calledWith(mockFactory.newResource, 'org.acme', 'MyAsset1', 'asset1');
        });

        it('should create a new resource from an object using a $class value even if it does not match the model', () => {
            let options = {
                jsonStack: new TypedStack({}),
                resourceStack: new TypedStack({}),
                factory: mockFactory,
                modelManager: modelManager
            };
            let mockResource = sinon.createStubInstance(Resource);
            mockFactory.newResource.withArgs('org.acme', 'MyAsset2', 'asset2').returns(mockResource);
            let resource = jsonPopulator.convertItem(assetDeclaration1, {
                $class: 'org.acme.MyAsset2',
                assetId: 'asset2'
            }, options);
            resource.should.be.an.instanceOf(Resource);
            sinon.assert.calledWith(mockFactory.newResource, 'org.acme', 'MyAsset2', 'asset2');
        });

        it('should create a new resource from an object using the model if no $class value is specified', () => {
            let options = {
                jsonStack: new TypedStack({}),
                resourceStack: new TypedStack({}),
                factory: mockFactory,
                modelManager: modelManager
            };
            let mockResource = sinon.createStubInstance(Resource);
            mockFactory.newResource.withArgs('org.acme', 'MyAsset1', 'asset1').returns(mockResource);
            let resource = jsonPopulator.convertItem(assetDeclaration1, {
                assetId: 'asset1'
            }, options);
            resource.should.be.an.instanceOf(Resource);
            sinon.assert.calledWith(mockFactory.newResource, 'org.acme', 'MyAsset1', 'asset1');
        });

    });

    describe('#visitRelationshipDeclaration', () => {

        it('should create a new relationship from a string', () => {
            let options = {
                jsonStack: new TypedStack('asset1'),
                resourceStack: new TypedStack({}),
                factory: mockFactory,
                modelManager: modelManager
            };
            let mockRelationship = sinon.createStubInstance(Relationship);
            mockFactory.newRelationship.withArgs('org.acme', 'MyAsset1', 'asset1').returns(mockRelationship);
            let relationship = jsonPopulator.visitRelationshipDeclaration(relationshipDeclaration1, options);
            relationship.should.be.an.instanceOf(Relationship);
        });

        it('should get the relationship namespace if required', () => {
            let options = {
                jsonStack: new TypedStack('asset1'),
                resourceStack: new TypedStack({}),
                factory: mockFactory,
                modelManager: modelManager
            };
            sandbox.stub(relationshipDeclaration1, 'getFullyQualifiedTypeName').returns('MyAsset1');
            sandbox.stub(relationshipDeclaration1, 'getNamespace').returns('org.acme.different');
            let mockRelationship = sinon.createStubInstance(Relationship);
            mockFactory.newRelationship.withArgs('org.acme.different', 'MyAsset1', 'asset1').returns(mockRelationship);
            let relationship = jsonPopulator.visitRelationshipDeclaration(relationshipDeclaration1, options);
            relationship.should.be.an.instanceOf(Relationship);
        });

        it('should not create a new relationship from an object if not permitted', () => {
            let options = {
                jsonStack: new TypedStack({
                    $class: 'org.acme.MyAsset1',
                    assetId: 'asset1'
                }),
                resourceStack: new TypedStack({}),
                factory: mockFactory,
                modelManager: modelManager
            };
            let mockResource = sinon.createStubInstance(Resource);
            mockFactory.newResource.withArgs('org.acme', 'MyAsset1', 'asset1').returns(mockResource);
            (() => {
                jsonPopulator.visitRelationshipDeclaration(relationshipDeclaration1, options);
            }).should.throw(/Invalid JSON data/);
        });

        it('should create a new relationship from an object if permitted', () => {
            jsonPopulator = new JSONPopulator(true); // true to enable acceptResourcesForRelationships
            let options = {
                jsonStack: new TypedStack({
                    $class: 'org.acme.MyAsset1',
                    assetId: 'asset1'
                }),
                resourceStack: new TypedStack({}),
                factory: mockFactory,
                modelManager: modelManager
            };
            let mockResource = sinon.createStubInstance(Resource);
            mockFactory.newResource.withArgs('org.acme', 'MyAsset1', 'asset1').returns(mockResource);
            let subResource = jsonPopulator.visitRelationshipDeclaration(relationshipDeclaration1, options);
            subResource.should.be.an.instanceOf(Resource);
        });

        it('should throw if the JSON data is not a string or an object', () => {
            let options = {
                jsonStack: new TypedStack(3.142),
                resourceStack: new TypedStack({}),
                factory: mockFactory,
                modelManager: modelManager
            };
            (() => {
                jsonPopulator.visitRelationshipDeclaration(relationshipDeclaration1, options);
            }).should.throw(/Invalid JSON data/);
        });

        it('should throw if the JSON data is an object without a class', () => {
            jsonPopulator = new JSONPopulator(true); // true to enable acceptResourcesForRelationships
            let options = {
                jsonStack: new TypedStack({}),
                resourceStack: new TypedStack({}),
                factory: mockFactory,
                modelManager: modelManager
            };
            (() => {
                jsonPopulator.visitRelationshipDeclaration(relationshipDeclaration1, options);
            }).should.throw(/Invalid JSON data/);
        });

        it('should throw if the JSON data is an object with a class that causes an error to be thrown', () => {
            jsonPopulator = new JSONPopulator(true); // true to enable acceptResourcesForRelationships
            let options = {
                jsonStack: new TypedStack({
                    $class: 'org.acme.NoSuchClass'
                }),
                resourceStack: new TypedStack({}),
                factory: mockFactory,
                modelManager: modelManager
            };
            (() => {
                jsonPopulator.visitRelationshipDeclaration(relationshipDeclaration1, options);
            }).should.throw(TypeNotFoundException, /NoSuchClass/);
        });

        it('should throw if the JSON data is an object with a class that does not exist', () => {
            jsonPopulator = new JSONPopulator(true); // true to enable acceptResourcesForRelationships
            let options = {
                jsonStack: new TypedStack({
                    $class: 'org.acme.NoSuchClass'
                }),
                resourceStack: new TypedStack({}),
                factory: mockFactory,
                modelManager: modelManager
            };
            sandbox.stub(modelManager, 'getType').withArgs('org.acme.NoSuchClass').throws(new TypeNotFoundException('org.acme.NoSuchClass'));
            (() => {
                jsonPopulator.visitRelationshipDeclaration(relationshipDeclaration1, options);
            }).should.throw(TypeNotFoundException, /NoSuchClass/);
        });

        it('should create a new relationship from an array of strings', () => {
            let options = {
                jsonStack: new TypedStack(['asset1', 'asset2']),
                resourceStack: new TypedStack({}),
                factory: mockFactory,
                modelManager: modelManager
            };
            let mockRelationship1 = sinon.createStubInstance(Relationship);
            mockFactory.newRelationship.withArgs('org.acme', 'MyAsset1', 'asset1').returns(mockRelationship1);
            let mockRelationship2 = sinon.createStubInstance(Relationship);
            mockFactory.newRelationship.withArgs('org.acme', 'MyAsset1', 'asset2').returns(mockRelationship2);
            let relationships = jsonPopulator.visitRelationshipDeclaration(relationshipDeclaration2, options);
            relationships.should.have.length.of(2);
            relationships[0].should.be.an.instanceOf(Relationship);
            relationships[1].should.be.an.instanceOf(Relationship);
        });

        it('should not create a new relationship from an array of objects if not permitted', () => {
            let options = {
                jsonStack: new TypedStack([{
                    $class: 'org.acme.MyAsset1',
                    assetId: 'asset1'
                }, {
                    $class: 'org.acme.MyAsset1',
                    assetId: 'asset2'
                }]),
                resourceStack: new TypedStack({}),
                factory: mockFactory,
                modelManager: modelManager
            };
            let mockResource1 = sinon.createStubInstance(Resource);
            mockFactory.newResource.withArgs('org.acme', 'MyAsset1', 'asset1').returns(mockResource1);
            let mockResource2 = sinon.createStubInstance(Resource);
            mockFactory.newResource.withArgs('org.acme', 'MyAsset1', 'asset2').returns(mockResource2);
            (() => {
                jsonPopulator.visitRelationshipDeclaration(relationshipDeclaration2, options);
            }).should.throw(/Invalid JSON data/);
        });

        it('should create a new relationship from an array of objects if permitted', () => {
            jsonPopulator = new JSONPopulator(true); // true to enable acceptResourcesForRelationships
            let options = {
                jsonStack: new TypedStack([{
                    $class: 'org.acme.MyAsset1',
                    assetId: 'asset1'
                }, {
                    $class: 'org.acme.MyAsset1',
                    assetId: 'asset2'
                }]),
                resourceStack: new TypedStack({}),
                factory: mockFactory,
                modelManager: modelManager
            };
            let mockResource1 = sinon.createStubInstance(Resource);
            mockFactory.newResource.withArgs('org.acme', 'MyAsset1', 'asset1').returns(mockResource1);
            let mockResource2 = sinon.createStubInstance(Resource);
            mockFactory.newResource.withArgs('org.acme', 'MyAsset1', 'asset2').returns(mockResource2);
            let subResources = jsonPopulator.visitRelationshipDeclaration(relationshipDeclaration2, options);
            subResources.should.have.length.of(2);
            subResources[0].should.be.an.instanceOf(Resource);
            subResources[1].should.be.an.instanceOf(Resource);
        });

        it('should throw if the JSON data in the array is not a string or an object', () => {
            let options = {
                jsonStack: new TypedStack([3.142]),
                resourceStack: new TypedStack({}),
                factory: mockFactory,
                modelManager: modelManager
            };
            (() => {
                jsonPopulator.visitRelationshipDeclaration(relationshipDeclaration2, options);
            }).should.throw(/Invalid JSON data/);
        });

        it('should throw if the JSON data in the array is an object without a class', () => {
            jsonPopulator = new JSONPopulator(true); // true to enable acceptResourcesForRelationships
            let options = {
                jsonStack: new TypedStack([{}]),
                resourceStack: new TypedStack({}),
                factory: mockFactory,
                modelManager: modelManager
            };
            (() => {
                jsonPopulator.visitRelationshipDeclaration(relationshipDeclaration2, options);
            }).should.throw(/Invalid JSON data/);
        });

        it('should throw if the JSON data in the array is an object with a class that causes an error to be thrown', () => {
            jsonPopulator = new JSONPopulator(true); // true to enable acceptResourcesForRelationships
            let options = {
                jsonStack: new TypedStack([{
                    $class: 'org.acme.NoSuchClass'
                }]),
                resourceStack: new TypedStack({}),
                factory: mockFactory,
                modelManager: modelManager
            };
            (() => {
                jsonPopulator.visitRelationshipDeclaration(relationshipDeclaration2, options);
            }).should.throw(TypeNotFoundException, /NoSuchClass/);
        });

        it('should throw if the JSON data in the array is an object with a class that does not exist', () => {
            jsonPopulator = new JSONPopulator(true); // true to enable acceptResourcesForRelationships
            let options = {
                jsonStack: new TypedStack([{
                    $class: 'org.acme.NoSuchClass'
                }]),
                resourceStack: new TypedStack({}),
                factory: mockFactory,
                modelManager: modelManager
            };
            sandbox.stub(modelManager, 'getType').withArgs('org.acme.NoSuchClass').throws(new TypeNotFoundException('org.acme.NoSuchClass'));
            (() => {
                jsonPopulator.visitRelationshipDeclaration(relationshipDeclaration2, options);
            }).should.throw(TypeNotFoundException, /NoSuchClass/);
        });

    });

});
