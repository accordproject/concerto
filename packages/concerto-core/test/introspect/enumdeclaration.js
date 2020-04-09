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

const EnumDeclaration = require('../../lib/introspect/enumdeclaration');
const EnumValueDeclaration = require('../../lib/introspect/enumvaluedeclaration');
const ModelFile = require('../../lib/introspect/modelfile');
const ModelManager = require('../../lib/modelmanager');
const fs = require('fs');

require('chai').should();
const sinon = require('sinon');

describe('EnumDeclaration', () => {

    let mockModelManager;

    /**
     * Load an arbitrary number of model files.
     * @param {String[]} modelFileNames array of model file names.
     * @param {ModelManager} modelManager the model manager to which the created model files will be registered.
     * @return {ModelFile[]} array of loaded model files, matching the supplied arguments.
     */
    const loadModelFiles = (modelFileNames, modelManager) => {
        const modelFiles = [];
        for (let modelFileName of modelFileNames) {
            const modelDefinitions = fs.readFileSync(modelFileName, 'utf8');
            const modelFile = new ModelFile(modelManager, modelDefinitions);
            modelFiles.push(modelFile);
        }
        modelManager.addModelFiles(modelFiles, modelFileNames);
        return modelFiles;
    };

    const loadModelFile = (modelFileName) => {
        return loadModelFiles([modelFileName], mockModelManager)[0];
    };

    const loadLastDeclaration = (modelFileName, type) => {
        const modelFile = loadModelFile(modelFileName);
        const declarations = modelFile.getDeclarations(type);
        return declarations[declarations.length - 1];
    };

    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        mockModelManager = sinon.createStubInstance(ModelManager);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#toString', () => {
        it('should give the correct value', () => {
            let declaration = loadLastDeclaration('test/data/model/enum.cto', EnumDeclaration);
            declaration.toString().should.equal('EnumDeclaration {id=org.acme.ConcreteEnum}');
        });
    });

    describe('#hasInstance', () => {
        it('should return true for a valid Enum Declaration', () => {
            let declaration = loadLastDeclaration('test/data/model/enum.cto', EnumDeclaration);
            (declaration instanceof EnumDeclaration).should.be.true;

            let value = declaration.getProperties();
            (value[0] instanceof EnumValueDeclaration).should.be.true;
        });
    });
});
