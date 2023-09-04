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
const ModelManager = require('../../lib/modelmanager');
const ParserUtil = require('./parserutility');
const fs = require('fs');

require('chai').should();

describe('EnumDeclaration', () => {

    let modelManager;

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
            const modelFile = ParserUtil.newModelFile(modelManager, modelDefinitions);
            modelFiles.push(modelFile);
        }
        modelManager.addModelFiles(modelFiles, modelFileNames);
        return modelFiles;
    };

    const loadModelFile = (modelFileName) => {
        return loadModelFiles([modelFileName], modelManager)[0];
    };

    const loadLastDeclaration = (modelFileName, type) => {
        const modelFile = loadModelFile(modelFileName);
        const declarations = modelFile.getDeclarations(type);
        return declarations[declarations.length - 1];
    };

    beforeEach(() => {
        modelManager = new ModelManager();
    });

    afterEach(() => {
    });

    describe('#toString', () => {
        it('should give the correct value', () => {
            let declaration = loadLastDeclaration('test/data/model/enum.cto', EnumDeclaration);
            declaration.toString().should.equal('EnumDeclaration {id=org.acme@1.0.0.ConcreteEnum}');
        });
    });

    describe('#isEnum and isEnumValue', () => {
        it('should return true for a valid Enum Declaration', () => {
            let declaration = loadLastDeclaration('test/data/model/enum.cto', EnumDeclaration);
            (declaration.isEnum()).should.be.true;

            let value = declaration.getProperties();
            (value[0].isEnumValue()).should.be.true;
        });
    });

    describe('#declarationKind', () => {
        it('should return that is is an Enum Declaration', () => {
            let declaration = loadLastDeclaration('test/data/model/enum.cto', EnumDeclaration);
            (declaration.declarationKind()).should.equal('EnumDeclaration');
        });
    });

});
