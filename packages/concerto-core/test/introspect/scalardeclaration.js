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

const ScalarDeclaration = require('../../src/introspect/scalardeclaration');
const IntrospectUtils = require('./introspectutils');
const ParserUtil = require('./parserutility');

const ModelManager = require('../../src/modelmanager');
const Util = require('../composer/composermodelutility');

const should = require('chai').should();
const sinon = require('sinon');

describe('ScalarDeclaration', () => {

    let modelManager;
    let modelFile;
    let introspectUtils;

    beforeEach(() => {
        modelManager = new ModelManager();
        Util.addComposerModel(modelManager);
        introspectUtils = new IntrospectUtils(modelManager);
        modelFile = ParserUtil.newModelFile(modelManager, 'namespace com.hyperledger.testing@1.0.0', 'org.acme.cto');
    });

    describe('#validate', () => {
        it('should throw when scalar name is duplicted in a modelfile', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/scalardeclaration.dupeboolean.cto', ScalarDeclaration);
            (() => {
                asset.validate();
            }).should.throw(/Duplicate class/);
        });
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
            clz.toString().should.equal('ScalarDeclaration {id=com.hyperledger.testing@1.0.0.suchName}');
        });

    });

    describe('#getNamespace', () => {
        const modelFileName = 'test/data/parser/scalardeclaration.ssn.cto';

        beforeEach(() => {
            const modelFiles = introspectUtils.loadModelFiles([modelFileName], modelManager);
            modelManager.addModelFiles(modelFiles);
        });
        it('should return null', () => {
            const testClass = modelManager.getType('com.testing@1.0.0.SSN');
            should.equal(testClass.getNamespace(), 'com.testing@1.0.0');
        });
    });

    describe('#getFullyQualifiedName', () => {
        it('should return the fully qualified name if function is in a namespace', () => {
            let clz = new ScalarDeclaration(modelFile, {
                name: 'suchName',
            });
            clz.getFullyQualifiedName().should.equal('com.hyperledger.testing@1.0.0.suchName');
        });

    });

    describe('#getSuperType', () => {
        const modelFileName = 'test/data/parser/scalardeclaration.ssn.cto';

        beforeEach(() => {
            const modelFiles = introspectUtils.loadModelFiles([modelFileName], modelManager);
            modelManager.addModelFiles(modelFiles);
        });
        it('should return null', () => {
            const testClass = modelManager.getType('com.testing@1.0.0.SSN');
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
            const testClass = modelManager.getType('com.testing@1.0.0.SSN');
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
            const testClass = modelManager.getType('com.testing@1.0.0.SSN');
            should.equal(testClass.getValidator().validator.pattern, '\\d{3}-\\d{2}-\\{4}+');
        });
    });

    describe('#getDefaultValue', () => {
        it('should return the default value', () => {
            const modelFiles = introspectUtils.loadModelFiles(['test/data/parser/scalardeclaration.ssn.cto'], modelManager);
            modelManager.addModelFiles(modelFiles);
            const testClass = modelManager.getType('com.testing@1.0.0.SSN');
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
            const testClass = modelManager.getType('com.testing@1.0.0.StringScalar');
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
            const testClass = modelManager.getType('com.testing@1.0.0.SSN');
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
            const testClass = modelManager.getType('com.testing@1.0.0.SSN');
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
            const testClass = modelManager.getType('com.testing@1.0.0.SSN');
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
            const testClass = modelManager.getType('com.testing@1.0.0.SSN');
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
            const testClass = modelManager.getType('com.testing@1.0.0.SSN');
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
            const testClass = modelManager.getType('com.testing@1.0.0.SSN');
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
            const testClass = modelManager.getType('com.testing@1.0.0.SSN');
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
            const testClass = modelManager.getType('com.testing@1.0.0.SSN');
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
            const testClass = modelManager.getType('com.testing@1.0.0.SSN');
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
            const testClass = modelManager.getType('com.testing@1.0.0.SSN');
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
            const testClass = modelManager.getType('com.testing@1.0.0.SSN');
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
            const testClass = modelManager.getType('com.testing@1.0.0.SSN');
            testClass.isClassDeclaration().should.be.false;
        });
    });
});
