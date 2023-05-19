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

const IllegalModelException = require('../../lib/introspect/illegalmodelexception');

const MapDeclaration = require('../../lib/introspect/mapdeclaration');
const MapKeyType = require('../../lib/introspect/mapkeytype');
const MapValueType = require('../../lib/introspect/mapvaluetype');

const IntrospectUtils = require('./introspectutils');
const ParserUtil = require('./parserutility');

const ModelManager = require('../../lib/modelmanager');
const Util = require('../composer/composermodelutility');

const sinon = require('sinon');


describe('MapDeclaration', () => {

    let modelManager;
    let modelFile;
    let introspectUtils;

    beforeEach(() => {
        modelManager = new ModelManager();
        Util.addComposerModel(modelManager);
        introspectUtils = new IntrospectUtils(modelManager);
        modelFile = ParserUtil.newModelFile(modelManager, 'namespace com.test', 'mapdeclaration.cto');
        process.env.ENABLE_MAP_TYPE = 'true'; // TODO Remove on release of MapType.
    });

    describe('#constructor', () => {

        it('should throw if ast contains no MapKeyType', () => {
            (() => {
                new MapDeclaration(modelFile, {
                    name: 'MapTest',
                    properties: [
                        {
                            '$class': 'concerto.metamodel@1.0.0.MapKeyType',
                            name: 'String'
                        }
                    ]
                });
            }).should.throw(IllegalModelException);
        });

        it('should throw if ast contains no MapValueType', () => {
            (() => {
                new MapDeclaration(modelFile, {
                    name: 'MapTest',
                    properties: [
                        {
                            '$class': 'concerto.metamodel@1.0.0.MapKeyType',
                            name: 'Integer'
                        }]
                });
            }).should.throw(IllegalModelException);
        });

        it('should throw if ast does not contain exactly two properties', () => {
            (() => {
                new MapDeclaration(modelFile, {
                    name: 'MapTest',
                    properties: [
                        {
                            '$class': 'concerto.metamodel@1.0.0.MapKeyType',
                            name: 'String'
                        },
                        {
                            '$class': 'concerto.metamodel@1.0.0.AggregateValueType',
                            name: 'String'
                        },
                        {
                            '$class': 'concerto.metamodel@1.0.0.StringProperty',
                            name: 'String'
                        }
                    ]
                });
            }).should.throw(IllegalModelException);
        });

        it('should throw if no feature flag', () => {
            process.env.ENABLE_MAP_TYPE = 'false';
            (() =>
            {
                new MapDeclaration(modelFile, {
                    name: 'MapTest',
                    properties: [
                        {
                            '$class': 'concerto.metamodel@1.0.0.MapKeyType',
                            name: 'String'
                        },
                        {
                            '$class': 'concerto.metamodel@1.0.0.AggregateValueType',
                            name: 'String'
                        }
                    ]
                });
            }).should.throw(/MapType feature is not enabled. Please set the environment variable "ENABLE_MAP_TYPE=true" to access this functionality./);
            process.env.ENABLE_MAP_TYPE = 'true'; // enable after the test run. This is necessary to ensure functioning of other tests.
        });

        it('should throw if ast contains properties other than MapKeyType, AggregateValueType & AggregateRelationshipValueType', () => {
            (() => {
                new MapDeclaration(modelFile, {
                    name: 'MapTest',
                    properties: [
                        {
                            '$class': 'concerto.metamodel@1.0.0.StringProperty',
                            name: 'String'
                        },
                        {
                            '$class': 'concerto.metamodel@1.0.0.StringProperty',
                            name: 'String'
                        }
                    ]
                });
            }).should.throw(IllegalModelException);
        });
    });

    describe('#validate success scenarios', () => {

        it('should not throw when map key is an identified concept declaration', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodkey.declaration.concept.cto', MapDeclaration);
            asset.validate();
        });

        it('should not throw when map key is an enum declaration', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodkey.declaration.enum.cto', MapDeclaration);
            asset.validate();
        });

        it('should not throw when map key is primitive type boolean', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodkey.primitive.boolean.cto', MapDeclaration);
            asset.validate();
        });

        it('should not throw when map key is primitive type datetime', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodkey.primitive.datetime.cto', MapDeclaration);
            asset.validate();
        });

        it('should not throw when map key is primitive type string', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodkey.primitive.string.cto', MapDeclaration);
            asset.validate();
        });

        it('should not throw when map key is primitive type scalar boolean', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodkey.scalar.boolean.cto', MapDeclaration);
            asset.validate();
        });

        it('should not throw when map key is primitive type string datetime', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodkey.scalar.datetime.cto', MapDeclaration);
            asset.validate();
        });

        it('should not throw when map key is primitive type scalar string', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodkey.scalar.string.cto', MapDeclaration);
            asset.validate();
        });

        it('should not throw when map value is an identified concept declaration', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.declaration.concept.cto', MapDeclaration);
            asset.validate();
        });

        it('should not throw when map value is a concept derived from another concept declaration', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.declaration.derived.concept.cto', MapDeclaration);
            asset.validate();
        });

        it('should not throw when map value is an event declaration', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.declaration.event.cto', MapDeclaration);
            asset.validate();
        });

        it('should not throw when map value is an asset declaration', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.declaration.asset.cto', MapDeclaration);
            asset.validate();
        });

        it('should not throw when map value is an transaction declaration', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.declaration.transaction.cto', MapDeclaration);
            asset.validate();
        });

        it('should not throw when map value is an participant declaration', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.declaration.participant.cto', MapDeclaration);
            asset.validate();
        });

        it('should not throw when map value is a map declaration', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.declaration.map.cto', MapDeclaration);
            asset.validate();
        });

        it('should not throw when map value is a relationship', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.declaration.relationship.cto', MapDeclaration);
            asset.validate();
        });

        it('should not throw when map value is a primitive string', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.primitive.string.cto', MapDeclaration);
            asset.validate();
        });

        it('should not throw when map value is a primitive datetime', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.primitive.datetime.cto', MapDeclaration);
            asset.validate();
        });

        it('should not throw when map value is a primitive double', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.primitive.double.cto', MapDeclaration);
            asset.validate();
        });

        it('should not throw when map value is a primitive integer', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.primitive.integer.cto', MapDeclaration);
            asset.validate();
        });

        it('should not throw when map value is a primitive long', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.primitive.long.cto', MapDeclaration);
            asset.validate();
        });

    });

    describe('#validate failure scenarios', () => {
        it('should throw validating with a non-identified concept declaration as key', function() {
            (() => {
                let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.badkey.declaration.concept.cto', MapDeclaration);
                asset.validate();
            }).should.throw(/ConceptDeclaration must be identified in context of MapKeyType: NotIdentified/);
        });

        it('should throw when an enum key declaration missing', function() {
            (() => {
                let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.badkey.declaration.enum.cto', MapDeclaration);
                asset.validate();
            }).should.throw(/MapKeyType has invalid Type: NotDeclared/);
        });

        it('should throw when map key is an event declaration', function() {
            (() => {
                let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.badkey.declaration.event.cto', MapDeclaration);
                asset.validate();
            }).should.throw(/MapKeyType has invalid Type: Activity/);
        });

        it('should throw when map key is of type MapDeclaration', function() {
            (() => {
                let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.badkey.declaration.map.cto', MapDeclaration);
                asset.validate();
            }).should.throw(/MapKeyType has invalid Type: IllegalMapKey/);
        });

        it('should throw when map key is of primitive type Double', function() {
            (() => {
                let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.badkey.primitive.double.cto', MapDeclaration);
                asset.validate();
            }).should.throw(/MapKeyType has invalid Type: Double/);
        });

        it('should throw when map key is of primitive type Integer', function() {
            (() => {
                let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.badkey.primitive.integer.cto', MapDeclaration);
                asset.validate();
            }).should.throw(/MapKeyType has invalid Type: Integer/);
        });

        it('should throw when map key is of primitive type Long', function() {
            (() => {
                let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.badkey.primitive.long.cto', MapDeclaration);
                asset.validate();
            }).should.throw(/MapKeyType has invalid Type: Long/);
        });

        it('should throw when map key is of scalar type Double', function() {
            (() => {
                let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.badkey.scalar.double.cto', MapDeclaration);
                asset.validate();
            }).should.throw(/Scalar must be one of StringScalar, BooleanScalar, DateTimeScalar in context of MapKeyType. Invalid Scalar: BAD/);
        });

        it('should throw when map key is of scalar type Integer', function() {
            (() => {
                let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.badkey.scalar.integer.cto', MapDeclaration);
                asset.validate();
            }).should.throw(/Scalar must be one of StringScalar, BooleanScalar, DateTimeScalar in context of MapKeyType. Invalid Scalar: BAD/);
        });

        it('should throw when map key is of scalar type Long', function() {
            (() => {
                let asset = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.badkey.scalar.long.cto', MapDeclaration);
                asset.validate();
            }).should.throw(/Scalar must be one of StringScalar, BooleanScalar, DateTimeScalar in context of MapKeyType. Invalid Scalar: BAD/);
        });
    });

    describe('#accept', () => {
        it('should call the visitor', () => {
            let clz = new MapDeclaration(modelFile, {
                name: 'MapTest',
                properties: [
                    {
                        '$class': 'concerto.metamodel@1.0.0.MapKeyType',
                        name: 'String'
                    },
                    {
                        '$class': 'concerto.metamodel@1.0.0.AggregateValueType',
                        name: 'String'
                    }
                ]
            });
            let visitor = {
                visit: sinon.stub()
            };
            clz.accept(visitor, ['some', 'args']);
            sinon.assert.calledOnce(visitor.visit);
            sinon.assert.calledWith(visitor.visit, clz, ['some', 'args']);
        });

    });

    describe('#getKey', () => {
        it('should return the map key property', () => {
            let clz = new MapDeclaration(modelFile, {
                name: 'MapTest',
                properties: [
                    {
                        '$class': 'concerto.metamodel@1.0.0.MapKeyType',
                        name: 'DateTime'
                    },
                    {
                        '$class': 'concerto.metamodel@1.0.0.AggregateValueType',
                        name: 'String'
                    }
                ]
            });
            (clz.getKey() instanceof MapKeyType).should.be.equal(true);
            clz.getKey().ast.$class.should.equal('concerto.metamodel@1.0.0.MapKeyType');
            clz.getKey().ast.name.should.equal('DateTime');
        });

        it('should return the correct values when called', () => {
            let clz = new MapDeclaration(modelFile, {
                name: 'MapTest',
                properties: [
                    {
                        '$class': 'concerto.metamodel@1.0.0.MapKeyType',
                        name: 'DateTime'
                    },
                    {
                        '$class': 'concerto.metamodel@1.0.0.AggregateValueType',
                        name: 'String'
                    }
                ]
            });
            clz.getKey().getType().should.equal('DateTime');
        });
    });

    describe('#getValue', () => {
        it('should return the map value property', () => {
            let clz = new MapDeclaration(modelFile, {
                name: 'MapTest',
                properties: [
                    {
                        '$class': 'concerto.metamodel@1.0.0.MapKeyType',
                        name: 'DateTime'
                    },
                    {
                        '$class': 'concerto.metamodel@1.0.0.AggregateValueType',
                        name: 'String'
                    }
                ]
            });
            (clz.getValue() instanceof MapValueType).should.be.equal(true);
            clz.getValue().ast.$class.should.equal('concerto.metamodel@1.0.0.AggregateValueType');
            clz.getValue().ast.name.should.equal('String');
        });

        it('should return the correct values when called', () => {
            let clz = new MapDeclaration(modelFile, {
                name: 'MapTest',
                properties: [
                    {
                        '$class': 'concerto.metamodel@1.0.0.MapKeyType',
                        name: 'DateTime'
                    },
                    {
                        '$class': 'concerto.metamodel@1.0.0.AggregateValueType',
                        name: 'String'
                    }
                ]
            });
            clz.getValue().getType().should.equal('String');
        });
    });

    describe('#getProperties', () => {
        it('should return the map properties', () => {
            let clz = new MapDeclaration(modelFile, {
                name: 'MapTest',
                properties: [
                    {
                        '$class': 'concerto.metamodel@1.0.0.MapKeyType',
                        'name': 'String'
                    },
                    {
                        '$class': 'concerto.metamodel@1.0.0.AggregateValueType',
                        'name': 'String'
                    }
                ]
            });
            clz.getProperties().length.should.be.equal(2);
        });
    });


    describe('#Introspect', () => {
        it('should return the correct model file', () => {
            let clz = new MapDeclaration(modelFile, {
                name: 'MapTest',
                properties: [
                    {
                        '$class': 'concerto.metamodel@1.0.0.MapKeyType',
                        'name': 'String'
                    },
                    {
                        '$class': 'concerto.metamodel@1.0.0.AggregateValueType',
                        'name': 'String'
                    }
                ]
            });
            clz.getModelFile().should.equal(modelFile);
            clz.getKey().getModelFile().should.equal(modelFile);
            clz.getValue().getModelFile().should.equal(modelFile);
        });

        it('should return the correct value on introspection', () => {
            let declaration = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodkey.declaration.concept.cto', MapDeclaration);
            declaration.declarationKind().should.equal('MapDeclaration');
            declaration.getFullyQualifiedName().should.equal('com.testing@1.0.0.Dictionary');
            declaration.isMapDeclaration().should.equal(true);
        });
    });

    describe('#toString', () => {
        it('should give the correct value for Map Declaration', () => {
            let declaration = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodkey.declaration.concept.cto', MapDeclaration);
            declaration.toString().should.equal('MapDeclaration {id=com.testing@1.0.0.Dictionary}');
            declaration.getKey().toString().should.equal('MapKeyType {id=Person}');
            declaration.getValue().toString().should.equal('MapValueType {id=String}');
        });
    });
});
