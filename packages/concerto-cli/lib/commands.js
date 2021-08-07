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
const path = require('path');
const mkdirp = require('mkdirp');

const Logger = require('@accordproject/concerto-core').Logger;
const ModelLoader = require('@accordproject/concerto-core').ModelLoader;
const Factory = require('@accordproject/concerto-core').Factory;
const Serializer = require('@accordproject/concerto-core').Serializer;
const Concerto = require('@accordproject/concerto-core').Concerto;
const MetaModel = require('@accordproject/concerto-core').MetaModel;
const FileWriter = require('@accordproject/concerto-tools').FileWriter;
const CodeGen = require('@accordproject/concerto-tools').CodeGen;

const GoLangVisitor = CodeGen.GoLangVisitor;
const JavaVisitor = CodeGen.JavaVisitor;
const JSONSchemaVisitor = CodeGen.JSONSchemaVisitor;
const PlantUMLVisitor = CodeGen.PlantUMLVisitor;
const TypescriptVisitor = CodeGen.TypescriptVisitor;
const XmlSchemaVisitor = CodeGen.XmlSchemaVisitor;
const GraphQLVisitor = CodeGen.GraphQLVisitor;

/**
 * Utility class that implements the commands exposed by the CLI.
 * @class
 * @memberof module:concerto-cli
 */
class Commands {
    /**
     * Set a default for a file argument
     *
     * @param {object} argv - the inbound argument values object
     * @param {string} argName - the argument name
     * @param {string} argDefaultName - the argument default name
     * @param {Function} argDefaultFun - how to compute the argument default
     * @param {object} argDefaultValue - an optional default value if all else fails
     * @returns {object} a modified argument object
     */
    static setDefaultFileArg(argv, argName, argDefaultName, argDefaultFun) {
        if(!argv[argName]){
            Logger.info(`Loading a default ${argDefaultName} file.`);
            argv[argName] = argDefaultFun(argv, argDefaultName);
        }

        let argExists = true;
        if (Array.isArray(argv[argName])) {
            // All files should exist
            for (let i = 0; i < argv[argName].length; i++) {
                if (fs.existsSync(argv[argName][i]) && argExists) {
                    argExists = true;
                } else {
                    argExists = false;
                }
            }
        } else {
            // This file should exist
            argExists = fs.existsSync(argv[argName]);
        }

        if (!argExists){
            throw new Error(`A ${argDefaultName} file is required. Try the --${argName} flag or create a ${argDefaultName} file.`);
        } else {
            return argv;
        }
    }

    /**
     * Set default params before we parse a sample text using a template
     *
     * @param {object} argv - the inbound argument values object
     * @returns {object} a modfied argument object
     */
    static validateValidateArgs(argv) {
        argv = Commands.setDefaultFileArg(argv, 'input', 'input.json', ((argv, argDefaultName) => { return path.resolve('.',argDefaultName); }));
        argv = Commands.setDefaultFileArg(argv, 'model', 'model.cto', ((argv, argDefaultName) => { return [path.resolve('.',argDefaultName)]; }));

        if(argv.verbose) {
            Logger.info(`validate ${argv.input} using a model ${argv.model}`);
        }

        return argv;
    }

    /**
     * Validate a sample JSON against the model
     *
     * @param {string} sample - the sample to validate
     * @param {string[]} ctoFiles - the CTO files to convert to code
     * @param {object} options - optional parameters
     * @param {boolean} [options.offline] - do not resolve external models
     * @returns {string} serialized form of the validated JSON
     */
    static async validate(sample, ctoFiles, options) {
        const json = JSON.parse(fs.readFileSync(sample, 'utf8'));

        const modelManager = await ModelLoader.loadModelManager(ctoFiles, options);

        if (options.functional) {
            const concerto = new Concerto(modelManager);

            concerto.validate(json);
        } else {
            const factory = new Factory(modelManager);
            const serializer = new Serializer(factory, modelManager);

            const object = serializer.fromJSON(json);
            return JSON.stringify(serializer.toJSON(object, options));
        }
    }

    /**
     * Compile the model for a given target
     *
     * @param {string} target - the target of the code to compile
     * @param {string[]} ctoFiles - the CTO files to convert to code
     * @param {string} output the output directory
     * @param {object} options - optional parameters
     * @param {boolean} [options.offline] - do not resolve external models
     */
    static async compile(target, ctoFiles, output, options) {
        const modelManager = await ModelLoader.loadModelManager(ctoFiles, options);

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
        case 'GraphQL':
            visitor = new GraphQLVisitor();
            break;
        }

        if(visitor) {
            let parameters = {};
            parameters.fileWriter = new FileWriter(output);
            modelManager.accept(visitor, parameters);
            return `Compiled to ${target} in '${output}'.`;
        } else {
            return 'Unrecognized target: ' + target;
        }
    }

    /**
     * Fetches all external for a set of models dependencies and
     * saves all the models to a target directory
     *
     * @param {string[]} ctoFiles the CTO files (can be local file paths or URLs)
     * @param {string} output the output directory
     */
    static async get(ctoFiles, output) {
        const modelManager = await ModelLoader.loadModelManager(ctoFiles);
        mkdirp.sync(output);
        modelManager.writeModelsToFileSystem(output);
        return `Loaded external models in '${output}'.`;
    }

    /**
     * Import a CTO string to its metamodel
     *
     * @param {string} input - CTO
     * @param {string[]} [ctoFiles] - the CTO files used for import resolution
     * @param {boolean} resolve - whether to resolve the names
     * @param {string} outputPath to an output file
     * @param {string} the metamodel
     */
    static async import(input, ctoFiles = [], resolve = false, outputPath) {
        // Add input to ctoFiles for convenience
        if (!ctoFiles.includes(input)) {
            ctoFiles.push(input);
        }
        const inputString = fs.readFileSync(input, 'utf8');
        let result;
        if (resolve) {
            const modelManager = await ModelLoader.loadModelManager(ctoFiles);
            result = MetaModel.ctoToMetaModelAndResolve(modelManager, inputString);
        } else {
            result = MetaModel.ctoToMetaModel(inputString);
        }
        if (outputPath) {
            Logger.info('Creating file: ' + outputPath);
            fs.writeFileSync(outputPath, JSON.stringify(result));
            return;
        }
        return JSON.stringify(result);
    }

    /**
     * Export a metamodel to a CTO string
     *
     * @param {string} input metamodel
     * @param {string} outputPath to an output file
     * @param {string} transformed (meta)model
     */
    static async export(input, outputPath) {
        const inputString = fs.readFileSync(input, 'utf8');
        const json = JSON.parse(inputString);
        const result = MetaModel.ctoFromMetaModel(json);
        if (outputPath) {
            Logger.info('Creating file: ' + outputPath);
            fs.writeFileSync(outputPath, result);
            return;
        }
        return result;
    }
}

module.exports = Commands;
