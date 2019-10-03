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

const ModelManager = require('@accordproject/concerto').ModelManager;
const ModelFile = require('@accordproject/concerto').ModelFile;
const DefaultModelFileLoader = require('@accordproject/concerto').DefaultModelFileLoader;
const FileWriter = require('@accordproject/concerto').FileWriter;
const CodeGen = require('@accordproject/concerto-tools').CodeGen;

const GoLangVisitor = CodeGen.GoLangVisitor;
const JavaVisitor = CodeGen.JavaVisitor;
const JSONSchemaVisitor = CodeGen.JSONSchemaVisitor;
const PlantUMLVisitor = CodeGen.PlantUMLVisitor;
const TypescriptVisitor = CodeGen.TypescriptVisitor;
const XmlSchemaVisitor = CodeGen.XmlSchemaVisitor;

/**
 * Utility class that implements the commands exposed by the CLI.
 * @class
 * @memberof module:concerto-tools
 */
class Commands {

    /**
     * Converts the model for a template into code
     *
     * @param {string} format the format to generate
     * @param {string[]} ctoFiles the CTO files to convert to code
     * @param {string} outputDirectory the output directory
     * @returns {string} Result of code generation
     */
    static async generate(format, ctoFiles, outputDirectory) {

        const modelManager = new ModelManager();

        const modelFiles = ctoFiles.map((ctoFile) => {
            return fs.readFileSync(ctoFile, 'utf8');
        });
        modelManager.addModelFiles(modelFiles, ctoFiles, true);
        await modelManager.updateExternalModels();

        let visitor = null;

        switch(format) {
        case 'Go':
            visitor = new GoLangVisitor();
            break;
        case 'PlantUML':
            visitor = new PlantUMLVisitor();
            break;
        case 'Typescript':
            visitor = new TypescriptVisitor();
            break;
        case 'Java':
            visitor = new JavaVisitor();
            break;
        case 'JSONSchema':
            visitor = new JSONSchemaVisitor();
            break;
        case 'XMLSchema':
            visitor = new XmlSchemaVisitor();
            break;
        }

        if(visitor) {
            let parameters = {};
            parameters.fileWriter = new FileWriter(outputDirectory);
            modelManager.accept(visitor, parameters);
            return `Generated ${format} code.`;
        }
        else {
            return 'Unrecognized code generator: ' + format;
        }
    }

    /**
     * Fetches all external for a set of models dependencies and
     * saves all the models to a target directory
     *
     * @param {string[]} ctoFiles the CTO files (can be local file paths or URLs)
     * @param {string} outputDirectory the output directory
     */
    static async getExternalModels(ctoFiles, outputDirectory) {

        const modelManager = new ModelManager();
        const modelFileLoader = new DefaultModelFileLoader(modelManager);

        for( let ctoFile of ctoFiles ) {
            let modelFile = null;
            if(modelFileLoader.accepts(ctoFile)) {
                modelFile = await modelFileLoader.load(ctoFile);
            } else {
                const content = fs.readFileSync(ctoFile, 'utf8');
                modelFile = new ModelFile(modelManager, content, ctoFile);
            }

            modelManager.addModelFile(modelFile, modelFile.getName(), true);
        }

        await modelManager.updateExternalModels();
        modelManager.writeModelsToFileSystem(outputDirectory);
    }
}

module.exports = Commands;