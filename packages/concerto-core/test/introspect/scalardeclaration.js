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

const ScalarDeclaration = require('../../lib/introspect/scalardeclaration');
const IntrospectUtils = require('./introspectutils');
const ParserUtil = require('./parserutility');

const ModelManager = require('../../lib/modelmanager');
const Util = require('../composer/composermodelutility');

const should = require('chai').should();
const sinon = require('sinon');
const ModelFile = require('../../lib/introspect/modelfile');

const fs = require('fs');
const path = require('path');

describe('ScalarDeclaration', () => {

    let modelManager;
    let modelFile;
    let introspectUtils;

    beforeEach(() => {
        modelManager = new ModelManager();
        Util.addComposerModel(modelManager);
        introspectUtils = new IntrospectUtils(modelManager);
        modelFile = ParserUtil.newModelFile(modelManager, 'namespace com.hyperledger.testing', 'org.acme.cto');
    });

    describe('#accept', () => {
        it('should call the visitor', () => {
            let clz = new ScalarDeclaration(modelFile, {
                name: 'suchName'
            });
            let visitor = {
                visit: sinon.stub()
            };
            clz.accept(visitor, ['some', 'args']);
            sinon.assert.calledOnce(visitor.visit);
            sinon.assert.calledWith(visitor.visit, clz, ['some', 'args']);
        });

    });

    describe('#getName', () => {
        it('should return the scalar name', () => {
            let clz = new ScalarDeclaration(modelFile, {
                name: 'suchName'
            });
            clz.getName().should.equal('suchName');
            clz.toString().should.equal('ScalarDeclaration {id=com.hyperledger.testing.suchName}');
        });

    });

    describe('#getNamespace', () => {
        const modelFileName = 'test/data/parser/scalardeclaration.ssn.cto';

        beforeEach(() => {
            const modelFiles = introspectUtils.loadModelFiles([modelFileName], modelManager);
            modelManager.addModelFiles(modelFiles);
        });
        it('should return null', () => {
            const testClass = modelManager.getType('com.testing.SSN');
            should.equal(testClass.getNamespace(), 'com.testing');
        });
    });

    describe('#getFullyQualifiedName', () => {
        it('should return the fully qualified name if function is in a namespace', () => {
            let clz = new ScalarDeclaration(modelFile, {
                name: 'suchName',
            });
            clz.getFullyQualifiedName().should.equal('com.hyperledger.testing.suchName');
        });

    });

    describe('#getSuperType', () => {
        const modelFileName = 'test/data/parser/scalardeclaration.ssn.cto';

        beforeEach(() => {
            const modelFiles = introspectUtils.loadModelFiles([modelFileName], modelManager);
            modelManager.addModelFiles(modelFiles);
        });
        it('should return null', () => {
            const testClass = modelManager.getType('com.testing.SSN');
            should.equal(testClass.getSuperType(), null);
        });
    });

    describe('#getSuperTypeDeclaration', () => {
        const modelFileName = 'test/data/parser/scalardeclaration.ssn.cto';

        beforeEach(() => {
            const modelFiles = introspectUtils.loadModelFiles([modelFileName], modelManager);
            modelManager.addModelFiles(modelFiles);
        });
        it('should return null', () => {
            const testClass = modelManager.getType('com.testing.SSN');
            should.equal(testClass.getSuperTypeDeclaration(), null);
        });
    });

    describe('#getValidator', () => {
        const modelFileName = 'test/data/parser/scalardeclaration.ssn.cto';

        beforeEach(() => {
            const modelFiles = introspectUtils.loadModelFiles([modelFileName], modelManager);
            modelManager.addModelFiles(modelFiles);
        });
        it('should return the validator', () => {
            const testClass = modelManager.getType('com.testing.SSN');
            should.equal(testClass.getValidator().validator.pattern, '\\d{3}-\\d{2}-\\{4}+');
        });
    });

    describe('#getDefaultValue', () => {
        it('should return the default value', () => {
            const modelFiles = introspectUtils.loadModelFiles(['test/data/parser/scalardeclaration.ssn.cto'], modelManager);
            modelManager.addModelFiles(modelFiles);
            const testClass = modelManager.getType('com.testing.SSN');
            should.equal(testClass.getDefaultValue(), '000-00-0000');
        });

        it('should return the default value for falsy cases', () => {
            const modelFiles = introspectUtils.loadModelFiles(['test/data/parser/scalardeclaration.ssn.cto'], modelManager);
            modelManager.addModelFiles(modelFiles);
            const testClass = modelManager.getType('com.testing.BoolWithDefault');
            should.equal(testClass.getDefaultValue(), false);
        });

        it('should return null', () => {
            const modelFiles = introspectUtils.loadModelFiles(['test/data/parser/scalardeclaration.permutations.cto'], modelManager);
            modelManager.addModelFiles(modelFiles);
            const testClass = modelManager.getType('com.testing.StringScalar');
            should.equal(testClass.getDefaultValue(), null);
        });
    });

    describe('#isIdentified', () => {
        const modelFileName = 'test/data/parser/scalardeclaration.ssn.cto';

        beforeEach(() => {
            const modelFiles = introspectUtils.loadModelFiles([modelFileName], modelManager);
            modelManager.addModelFiles(modelFiles);
        });
        it('should return false', () => {
            const testClass = modelManager.getType('com.testing.SSN');
            testClass.isIdentified().should.be.false;
        });
    });

    describe('#isAsset', () => {
        const modelFileName = 'test/data/parser/scalardeclaration.ssn.cto';

        beforeEach(() => {
            const modelFiles = introspectUtils.loadModelFiles([modelFileName], modelManager);
            modelManager.addModelFiles(modelFiles);
        });
        it('should return false', () => {
            const testClass = modelManager.getType('com.testing.SSN');
            testClass.isAsset().should.be.false;
        });
    });

    describe('#isSystemIdentified', () => {
        const modelFileName = 'test/data/parser/scalardeclaration.ssn.cto';

        beforeEach(() => {
            const modelFiles = introspectUtils.loadModelFiles([modelFileName], modelManager);
            modelManager.addModelFiles(modelFiles);
        });
        it('should return false', () => {
            const testClass = modelManager.getType('com.testing.SSN');
            testClass.isSystemIdentified().should.be.false;
        });
    });

    describe('#getIdentifierFieldName', () => {
        const modelFileName = 'test/data/parser/scalardeclaration.ssn.cto';

        beforeEach(() => {
            const modelFiles = introspectUtils.loadModelFiles([modelFileName], modelManager);
            modelManager.addModelFiles(modelFiles);
        });
        it('should return null', () => {
            const testClass = modelManager.getType('com.testing.SSN');
            should.equal(testClass.getIdentifierFieldName(), null);
        });
    });

    describe('#isAbstract', () => {
        const modelFileName = 'test/data/parser/scalardeclaration.ssn.cto';

        beforeEach(() => {
            const modelFiles = introspectUtils.loadModelFiles([modelFileName], modelManager);
            modelManager.addModelFiles(modelFiles);
        });
        it('should return true', () => {
            const testClass = modelManager.getType('com.testing.SSN');
            testClass.isAbstract().should.be.true;
        });
    });

    describe('#isAsset', () => {
        const modelFileName = 'test/data/parser/scalardeclaration.ssn.cto';

        beforeEach(() => {
            const modelFiles = introspectUtils.loadModelFiles([modelFileName], modelManager);
            modelManager.addModelFiles(modelFiles);
        });
        it('should return false', () => {
            const testClass = modelManager.getType('com.testing.SSN');
            testClass.isAsset().should.be.false;
        });
    });

    describe('#isParticipant', () => {
        const modelFileName = 'test/data/parser/scalardeclaration.ssn.cto';

        beforeEach(() => {
            const modelFiles = introspectUtils.loadModelFiles([modelFileName], modelManager);
            modelManager.addModelFiles(modelFiles);
        });
        it('should return false', () => {
            const testClass = modelManager.getType('com.testing.SSN');
            testClass.isParticipant().should.be.false;
        });
    });

    describe('#isTransaction', () => {
        const modelFileName = 'test/data/parser/scalardeclaration.ssn.cto';

        beforeEach(() => {
            const modelFiles = introspectUtils.loadModelFiles([modelFileName], modelManager);
            modelManager.addModelFiles(modelFiles);
        });
        it('should return false', () => {
            const testClass = modelManager.getType('com.testing.SSN');
            testClass.isTransaction().should.be.false;
        });
    });

    describe('#isEvent', () => {
        const modelFileName = 'test/data/parser/scalardeclaration.ssn.cto';

        beforeEach(() => {
            const modelFiles = introspectUtils.loadModelFiles([modelFileName], modelManager);
            modelManager.addModelFiles(modelFiles);
        });
        it('should return false', () => {
            const testClass = modelManager.getType('com.testing.SSN');
            testClass.isEvent().should.be.false;
        });
    });

    describe('#isConcept', () => {
        const modelFileName = 'test/data/parser/scalardeclaration.ssn.cto';

        beforeEach(() => {
            const modelFiles = introspectUtils.loadModelFiles([modelFileName], modelManager);
            modelManager.addModelFiles(modelFiles);
        });
        it('should return false', () => {
            const testClass = modelManager.getType('com.testing.SSN');
            testClass.isConcept().should.be.false;
        });
    });

    describe('#isEnum', () => {
        const modelFileName = 'test/data/parser/scalardeclaration.ssn.cto';

        beforeEach(() => {
            const modelFiles = introspectUtils.loadModelFiles([modelFileName], modelManager);
            modelManager.addModelFiles(modelFiles);
        });
        it('should return false', () => {
            const testClass = modelManager.getType('com.testing.SSN');
            testClass.isEnum().should.be.false;
        });
    });

    describe('#isClassDeclaration', () => {
        const modelFileName = 'test/data/parser/scalardeclaration.ssn.cto';

        beforeEach(() => {
            const modelFiles = introspectUtils.loadModelFiles([modelFileName], modelManager);
            modelManager.addModelFiles(modelFiles);
        });
        it('should return false', () => {
            const testClass = modelManager.getType('com.testing.SSN');
            testClass.isClassDeclaration().should.be.false;
        });
    });
});

describe('ScalarDeclaration -  - Test for declarations using Import Aliasing', () => {

    let modelManager;
    let resolvedModelManager;

    beforeEach(() => {
        modelManager = new ModelManager({ strict: true, importAliasing: true, enableMapType: true});

        const childModelCTO = fs.readFileSync(path.resolve(__dirname, '../data/aliasing/child.cto'), 'utf8');
        const parentModelCTO = fs.readFileSync(path.resolve(__dirname, '../data/aliasing/parent.cto'), 'utf8');

        modelManager.addCTOModel(childModelCTO, 'child@1.0.0.cto');
        modelManager.addCTOModel(parentModelCTO, 'parent@1.0.0.cto');
        const resolvedMetamodelChild = modelManager.resolveMetaModel(modelManager.getAst().models[0]);
        const resolvedMetamodelParent = modelManager.resolveMetaModel(modelManager.getAst().models[1]);
        resolvedModelManager = new ModelManager({ strict: true, importAliasing: true, enableMapType: true});
        const resolvedModelFileChild = new ModelFile(resolvedModelManager, resolvedMetamodelChild, 'child@1.0.0.cto');
        const resolvedModelFileParent = new ModelFile(resolvedModelManager, resolvedMetamodelParent, 'parent@1.0.0.cto');
        resolvedModelManager.addModelFiles([resolvedModelFileChild, resolvedModelFileParent], ['child@1.0.0.cto', 'parent@1.0.0.cto']);
    });

    // describe.only('#getName', () => {
    //     it('should return the scalar name', () => {
    //         // This fails, current imports are not declared within a namespace. Is this a bug?
    //         // Why are we treating imported declrations as foreign objects? Shouldn't they be treated as part of the namespace and declared?
    //         // Extend this test to map keys and value as well
    //         const classDeclaration = resolvedModelManager.getType('parent@1.0.0.Child');
    //         const property = classDeclaration.getProperty('str');
    //         const type = property.getType();
    //         const namespce = property.getNamespace();
    //         const scalarDeclarationFQN = `${namespce}.${type}`;
    //         const scalarDeclaration = resolvedModelManager.getType(scalarDeclarationFQN);
    //         console.log(scalarDeclaration);
    //     });

    // });

    // describe('#getNamespace', () => {
    //     const modelFileName = 'test/data/parser/scalardeclaration.ssn.cto';

    //     beforeEach(() => {
    //         const modelFiles = introspectUtils.loadModelFiles([modelFileName], modelManager);
    //         modelManager.addModelFiles(modelFiles);
    //     });
    //     it('should return null', () => {
    //         const testClass = modelManager.getType('com.testing.SSN');
    //         should.equal(testClass.getNamespace(), 'com.testing');
    //     });
    // });

    // describe('#getFullyQualifiedName', () => {
    //     it('should return the fully qualified name if function is in a namespace', () => {
    //         let clz = new ScalarDeclaration(modelFile, {
    //             name: 'suchName',
    //         });
    //         clz.getFullyQualifiedName().should.equal('com.hyperledger.testing.suchName');
    //     });

    // });
});
