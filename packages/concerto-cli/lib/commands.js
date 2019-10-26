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
const mkdirp = require('mkdirp');

const ModelLoader = require('@accordproject/concerto-core').ModelLoader;
const Factory = require('@accordproject/concerto-core').Factory;
const Serializer = require('@accordproject/concerto-core').Serializer;
const FileWriter = require('@accordproject/concerto-tools').FileWriter;
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
 * @memberof module:concerto-cli
 */
class Commands {
    /**
     * Validate a sample JSON against the model
     *
     * @param {string} sample - the sample to validate
     * @param {string} ctoSystemFile - the system model file
     * @param {string[]} ctoFiles - the CTO files to convert to code
     * @returns {string} serialized form of the validated JSON
     */
    static async validate(sample, ctoSystemFile, ctoFiles) {
        const json = JSON.parse(fs.readFileSync(sample, 'utf8'));

        const modelManager = await ModelLoader.loadModelManager(ctoSystemFile, ctoFiles);
        const factory = new Factory(modelManager);
        const serializer = new Serializer(factory, modelManager);

        const object = serializer.fromJSON(json);
        return JSON.stringify(serializer.toJSON(object));
    }

    /**
     * Compile the model for a given target
     *
     * @param {string} target - the target of the code to compile
     * @param {string} ctoSystemFile - the system model file
     * @param {string[]} ctoFiles - the CTO files to convert to code
     * @param {string} output the output directory
     */
    static async compile(target, ctoSystemFile, ctoFiles, output) {
        const modelManager = await ModelLoader.loadModelManager(ctoSystemFile, ctoFiles);

        let visitor = null;

        switch(target) {
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
            parameters.fileWriter = new FileWriter(output);
            modelManager.accept(visitor, parameters);
            return `Compiled to ${target} in '${output}'.`;
        }
        else {
            return 'Unrecognized target: ' + target;
        }
    }

    /**
     * Fetches all external for a set of models dependencies and
     * saves all the models to a target directory
     *
     * @param {string} ctoSystemFile the system model
     * @param {string[]} ctoFiles the CTO files (can be local file paths or URLs)
     * @param {string} output the output directory
     */
    static async get(ctoSystemFile, ctoFiles, output) {
        const modelManager = await ModelLoader.loadModelManager(ctoSystemFile, ctoFiles);
        mkdirp.sync(output);
        modelManager.writeModelsToFileSystem(output);
        return `Loaded external models in '${output}'.`;
    }
}

module.exports = Commands;
