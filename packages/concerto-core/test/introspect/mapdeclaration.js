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

const IllegalModelException = require('../../src/introspect/illegalmodelexception');

const MapDeclaration = require('../../src/introspect/mapdeclaration');
const MapKeyType = require('../../src/introspect/mapkeytype');
const MapValueType = require('../../src/introspect/mapvaluetype');

const IntrospectUtils = require('./introspectutils');
const ParserUtil = require('./parserutility');

const ModelManager = require('../../src/modelmanager');
const Util = require('../composer/composermodelutility');
const fs = require('fs');

const sinon = require('sinon');
const expect = require('chai').expect;


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

        it('should throw if ast contains no Map Key Type', () => {
            (() => {
                new MapDeclaration(modelFile, {
                    $class: 'concerto.metamodel@1.0.0.MapDeclaration',
                    name: 'MapPermutation1',
                    value: {
                        $class: 'concerto.metamodel@1.0.0.StringMapValueType'
                    }
                });
            }).should.throw(IllegalModelException);
        });

        it('should throw if ast contains no Map Value Property', () => {
            (() => {
                new MapDeclaration(modelFile, {
                    $class: 'concerto.metamodel@1.0.0.MapDeclaration',
                    name: 'MapPermutation1',
                    key: {
                        $class: 'concerto.metamodel@1.0.0.StringMapKeyType'
                    }
                });
            }).should.throw(IllegalModelException);
        });

        it('should throw if no feature flag', () => {
            process.env.ENABLE_MAP_TYPE = 'false';
            (() =>
            {
                new MapDeclaration(modelFile, {
                    $class: 'concerto.metamodel@1.0.0.MapDeclaration',
                    name: 'MapPermutation1',
                    key: {
                        $class: 'concerto.metamodel@1.0.0.StringMapKeyType'
                    },
                    value: {
                        $class: 'concerto.metamodel@1.0.0.StringMapValueType'
                    }
                });
            }).should.throw(/MapType feature is not enabled. Please set the environment variable "ENABLE_MAP_TYPE=true", or add {enableMapType: true} to the ModelManger options, to access this functionality/);
            process.env.ENABLE_MAP_TYPE = 'true'; // enable after the test run. This is necessary to ensure functioning of other tests.
        });

        it('should throw if Map Type not enabled in ModelManager options', () => {
            process.env.ENABLE_MAP_TYPE = 'false';
            const mm = new ModelManager({enableMapType: false});
            Util.addComposerModel(mm);
            const introspectUtils = new IntrospectUtils(mm);
            try {
                introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodkey.primitive.datetime.cto', MapDeclaration);
            } catch (error) {
                expect(error.message).to.equal('MapType feature is not enabled. Please set the environment variable "ENABLE_MAP_TYPE=true", or add {enableMapType: true} to the ModelManger options, to access this functionality.');
            }
        });

        it('should not throw if Map Type is enabled in ModelManager options', () => {
            const mm = new ModelManager({enableMapType: true});
            Util.addComposerModel(mm);
            const introspectUtils = new IntrospectUtils(mm);
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodkey.primitive.datetime.cto', MapDeclaration);
            decl.validate();
        });
    });

    describe('#validate success scenarios - Map Key', () => {
        it('should validate when map key is primitive type datetime', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodkey.primitive.datetime.cto', MapDeclaration);
            decl.validate();
        });

        it('should validate when map key is primitive type string', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodkey.primitive.string.cto', MapDeclaration);
            decl.validate();
        });

        it('should validate when map key is primitive type scalar datetime', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodkey.scalar.datetime.cto', MapDeclaration);
            decl.validate();
        });

        it('should validate when map key is primitive type scalar string', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodkey.scalar.string.cto', MapDeclaration);
            decl.validate();
        });

        it('should validate when map key is imported and is of valid map key type', () => {
            const base_cto = fs.readFileSync('test/data/parser/mapdeclaration/base.cto', 'utf-8');
            introspectUtils.modelManager.addCTOModel(base_cto, 'base.cto');
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodkey.imported.scalar.cto', MapDeclaration);
            decl.validate();
        });
    });

    describe('#validate success scenarios - Map Value', () => {
        it('should validate when map value is a concept declaration', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.declaration.concept.cto', MapDeclaration);
            decl.validate();
        });

        it('should validate when map value is an identified concept declaration', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.declaration.identified.concept.cto', MapDeclaration);
            decl.validate();
        });

        it('should validate when map value is an imported asset declaration', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.declaration.root.asset.cto', MapDeclaration);
            decl.validate();
        });

        it('should validate when map value is an imported concept declaration', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.declaration.root.concept.cto', MapDeclaration);
            decl.validate();
        });

        it('should validate when map value is an imported event declaration', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.declaration.root.event.cto', MapDeclaration);
            decl.validate();
        });

        it('should validate when map value is an imported participant declaration', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.declaration.root.participant.cto', MapDeclaration);
            decl.validate();
        });

        it('should validate when map value is an imported transaction declaration', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.declaration.root.transaction.cto', MapDeclaration);
            decl.validate();
        });

        it('should validate when map value is a concept derived from another concept declaration', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.declaration.derived.concept.cto', MapDeclaration);
            decl.validate();
        });

        it('should validate when map value is an event declaration', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.declaration.event.cto', MapDeclaration);
            decl.validate();
        });

        it('should validate when map value is an asset declaration', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.declaration.asset.cto', MapDeclaration);
            decl.validate();
        });

        it('should validate when map value is an transaction declaration', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.declaration.transaction.cto', MapDeclaration);
            decl.validate();
        });

        it('should validate when map value is an participant declaration', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.declaration.participant.cto', MapDeclaration);
            decl.validate();
        });

        it('should validate when map value is a primitive boolean', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.primitive.boolean.cto', MapDeclaration);
            decl.validate();
        });

        it('should validate when map value is a primitive string', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.primitive.string.cto', MapDeclaration);
            decl.validate();
        });

        it('should validate when map value is a primitive datetime', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.primitive.datetime.cto', MapDeclaration);
            decl.validate();
        });

        it('should validate when map value is a primitive double', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.primitive.double.cto', MapDeclaration);
            decl.validate();
        });

        it('should validate when map value is a primitive integer', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.primitive.integer.cto', MapDeclaration);
            decl.validate();
        });

        it('should validate when map value is a primitive long', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.primitive.long.cto', MapDeclaration);
            decl.validate();
        });

        it('should validate when map value is imported and is of valid map key type (Concept import)', () => {
            const base_cto = fs.readFileSync('test/data/parser/mapdeclaration/base.cto', 'utf-8');
            introspectUtils.modelManager.addCTOModel(base_cto, 'base.cto');
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.imported.concept.cto', MapDeclaration);
            decl.validate();
        });

        it('should validate when map value is imported and is of valid map key type (Scalar Import)', () => {
            const base_cto = fs.readFileSync('test/data/parser/mapdeclaration/base.cto', 'utf-8');
            introspectUtils.modelManager.addCTOModel(base_cto, 'base.cto');
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.imported.scalar.cto', MapDeclaration);
            decl.validate();
        });
    });

    describe('#validate failure scenarios - Map Key', () => {

        it('should throw if ast contains illegal Map Key Type - Concept', () => {
            (() =>  {
                let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.badkey.declaration.concept.cto', MapDeclaration);
                decl.validate().should.throw(IllegalModelException);
            });
        });

        it('should throw if ast contains illegal Map Key Type - Scalar Long', () => {
            (() =>  {
                let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.badkey.scalar.long.cto', MapDeclaration);
                decl.validate();
            });
        });

        it('should throw if ast contains illegal Map Key Type - Scalar Integer', () => {
            (() =>  {
                let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.badkey.scalar.integer.cto', MapDeclaration);
                decl.validate().should.throw(IllegalModelException);
            });
        });

        it('should throw if ast contains illegal Map Key Type - Scalar Double', () => {
            (() =>  {
                let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.badkey.scalar.double.cto', MapDeclaration);
                decl.validate().should.throw(IllegalModelException);
            });
        });

        it('should throw if ast contains illegal Map Key Type - Scalar Boolean', () => {
            (() =>  {
                let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.badkey.scalar.boolean.cto', MapDeclaration);
                decl.validate().should.throw(IllegalModelException);
            });
        });

        it('should throw when map key is imported and is an illegal Map Key Type', () => {
            (() =>  {
                const base_cto = fs.readFileSync('test/data/parser/mapdeclaration/base.cto', 'utf-8');
                introspectUtils.modelManager.addCTOModel(base_cto, 'base.cto');
                let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.badkey.imported.thing.cto', MapDeclaration);
                decl.validate().should.throw(IllegalModelException);
            });
        });
    });

    describe('#accept', () => {
        it('should call the visitor', () => {
            let clz = new MapDeclaration(modelFile, {
                $class: 'concerto.metamodel@1.0.0.MapDeclaration',
                name: 'MapPermutation1',
                key: {
                    $class: 'concerto.metamodel@1.0.0.StringMapKeyType'
                },
                value: {
                    $class: 'concerto.metamodel@1.0.0.StringMapValueType'
                }
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
        it('should return the Map Key Type', () => {
            let clz = new MapDeclaration(modelFile, {
                $class: 'concerto.metamodel@1.0.0.MapDeclaration',
                name: 'MapPermutation1',
                key: {
                    $class: 'concerto.metamodel@1.0.0.StringMapKeyType'
                },
                value: {
                    $class: 'concerto.metamodel@1.0.0.StringMapValueType'
                }
            });
            (clz.getKey() instanceof MapKeyType).should.be.equal(true);
            clz.getKey().getMetaType().should.equal('concerto.metamodel@1.0.0.StringMapKeyType');
        });

        it('should return the correct Type when called - String', () => {
            let clz = new MapDeclaration(modelFile, {
                $class: 'concerto.metamodel@1.0.0.MapDeclaration',
                name: 'MapPermutation1',
                key: {
                    $class: 'concerto.metamodel@1.0.0.StringMapKeyType'
                },
                value: {
                    $class: 'concerto.metamodel@1.0.0.StringMapValueType'
                }
            });
            clz.getKey().getMapKeyType().should.equal('String');
        });

        it('should return the correct Type when called - DateTime', () => {
            let clz = new MapDeclaration(modelFile, {
                $class: 'concerto.metamodel@1.0.0.MapDeclaration',
                name: 'MapPermutation1',
                key: {
                    $class: 'concerto.metamodel@1.0.0.DateTimeMapKeyType'
                },
                value: {
                    $class: 'concerto.metamodel@1.0.0.StringMapValueType'
                }
            });
            clz.getKey().getMapKeyType().should.equal('DateTime');
        });


        it('should return the correct Type when called - Scalar DateTime', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodkey.scalar.datetime.cto', MapDeclaration);
            decl.getKey().getMapKeyType().should.equal('DATE');
        });

        it('should return the correct Type when called - Scalar String', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodkey.scalar.string.cto', MapDeclaration);
            decl.getKey().getMapKeyType().should.equal('GUID');
        });

        it('should return the correct boolean value introspecting isValue or isKey', () => {
            let clz = new MapDeclaration(modelFile, {
                $class: 'concerto.metamodel@1.0.0.MapDeclaration',
                name: 'MapPermutation1',
                key: {
                    $class: 'concerto.metamodel@1.0.0.StringMapKeyType'
                },
                value: {
                    $class: 'concerto.metamodel@1.0.0.DoubleMapValueType'
                }
            });
            expect(clz.getKey().isMapKey()).to.be.true;
            expect(clz.getKey().isMapValue()).to.be.false;
        });
    });

    describe('#getValue', () => {
        it('should return the map value property', () => {
            let clz = new MapDeclaration(modelFile, {
                $class: 'concerto.metamodel@1.0.0.MapDeclaration',
                name: 'MapPermutation1',
                key: {
                    $class: 'concerto.metamodel@1.0.0.StringMapKeyType'
                },
                value: {
                    $class: 'concerto.metamodel@1.0.0.StringMapValueType'
                }
            });
            (clz.getValue() instanceof MapValueType).should.be.equal(true);
            clz.getValue().getMetaType().should.equal('concerto.metamodel@1.0.0.StringMapValueType');
        });

        it('should return the correct Type when called - Boolean', () => {
            let clz = new MapDeclaration(modelFile, {
                $class: 'concerto.metamodel@1.0.0.MapDeclaration',
                name: 'MapPermutation1',
                key: {
                    $class: 'concerto.metamodel@1.0.0.StringMapKeyType'
                },
                value: {
                    $class: 'concerto.metamodel@1.0.0.BooleanMapValueType'
                }
            });
            clz.getValue().getMapValueType().should.equal('Boolean');
        });

        it('should return the correct Type when called - DateTime', () => {
            let clz = new MapDeclaration(modelFile, {
                $class: 'concerto.metamodel@1.0.0.MapDeclaration',
                name: 'MapPermutation1',
                key: {
                    $class: 'concerto.metamodel@1.0.0.StringMapKeyType'
                },
                value: {
                    $class: 'concerto.metamodel@1.0.0.DateTimeMapValueType'
                }
            });
            clz.getValue().getMapValueType().should.equal('DateTime');
        });

        it('should return the correct Type when called - String', () => {
            let clz = new MapDeclaration(modelFile, {
                $class: 'concerto.metamodel@1.0.0.MapDeclaration',
                name: 'MapPermutation1',
                key: {
                    $class: 'concerto.metamodel@1.0.0.StringMapKeyType'
                },
                value: {
                    $class: 'concerto.metamodel@1.0.0.StringMapValueType'
                }
            });
            clz.getValue().getMapValueType().should.equal('String');
        });

        it('should return the correct Type when called - Integer', () => {
            let clz = new MapDeclaration(modelFile, {
                $class: 'concerto.metamodel@1.0.0.MapDeclaration',
                name: 'MapPermutation1',
                key: {
                    $class: 'concerto.metamodel@1.0.0.StringMapKeyType'
                },
                value: {
                    $class: 'concerto.metamodel@1.0.0.IntegerMapValueType'
                }
            });
            clz.getValue().getMapValueType().should.equal('Integer');
        });

        it('should return the correct Type when called - Long', () => {
            let clz = new MapDeclaration(modelFile, {
                $class: 'concerto.metamodel@1.0.0.MapDeclaration',
                name: 'MapPermutation1',
                key: {
                    $class: 'concerto.metamodel@1.0.0.StringMapKeyType'
                },
                value: {
                    $class: 'concerto.metamodel@1.0.0.LongMapValueType'
                }
            });
            clz.getValue().getMapValueType().should.equal('Long');
        });

        it('should return the correct Type when called - Double', () => {
            let clz = new MapDeclaration(modelFile, {
                $class: 'concerto.metamodel@1.0.0.MapDeclaration',
                name: 'MapPermutation1',
                key: {
                    $class: 'concerto.metamodel@1.0.0.StringMapKeyType'
                },
                value: {
                    $class: 'concerto.metamodel@1.0.0.DoubleMapValueType'
                }
            });
            clz.getValue().getMapValueType().should.equal('Double');
        });

        it('should return the correct values when called - Scalar DateTime', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.scalar.datetime.cto', MapDeclaration);
            decl.getValue().getMapValueType().should.equal('DATE');
        });

        it('should return the correct values when called - Scalar String', () => {
            let decl = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodvalue.scalar.string.cto', MapDeclaration);
            decl.getValue().getMapValueType().should.equal('GUID');
        });

        it('should return the correct boolean value introspecting isValue or isKey', () => {
            let clz = new MapDeclaration(modelFile, {
                $class: 'concerto.metamodel@1.0.0.MapDeclaration',
                name: 'MapPermutation1',
                key: {
                    $class: 'concerto.metamodel@1.0.0.StringMapKeyType'
                },
                value: {
                    $class: 'concerto.metamodel@1.0.0.DoubleMapValueType'
                }
            });
            expect(clz.getValue().isMapValue()).to.be.true;
            expect(clz.getValue().isMapKey()).to.be.false;
        });
    });

    describe('#Introspect', () => {
        it('should return the correct model file', () => {
            let clz = new MapDeclaration(modelFile, {
                $class: 'concerto.metamodel@1.0.0.MapDeclaration',
                name: 'MapPermutation1',
                key: {
                    $class: 'concerto.metamodel@1.0.0.StringMapKeyType'
                },
                value: {
                    $class: 'concerto.metamodel@1.0.0.DoubleMapValueType'
                }
            });
            clz.getModelFile().should.equal(modelFile);
            clz.getKey().getModelFile().should.equal(modelFile);
            clz.getValue().getModelFile().should.equal(modelFile);
        });

        it('should return the correct value on introspection', () => {
            let declaration = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodkey.primitive.string.cto', MapDeclaration);
            declaration.declarationKind().should.equal('MapDeclaration');
            declaration.getFullyQualifiedName().should.equal('com.acme@1.0.0.Dictionary');
            declaration.isMap().should.equal(true);
        });
    });

    describe('#getParent', () => {
        it('should return the correct parent MapDeclaration value ', () => {
            let declaration = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodkey.primitive.string.cto', MapDeclaration);
            declaration.getKey().getParent().should.equal(declaration);
            declaration.getValue().getParent().should.equal(declaration);
        });
    });

    describe('#getNamespace', () => {
        it('should return the correct namespace for a Map Declaration Key and Value', () => {
            let declaration = introspectUtils.loadLastDeclaration('test/data/parser/mapdeclaration/mapdeclaration.goodkey.primitive.string.cto', MapDeclaration);
            declaration.getKey().getNamespace().should.equal('com.acme@1.0.0');
            declaration.getValue().getNamespace().should.equal('com.acme@1.0.0');
        });
    });
});
