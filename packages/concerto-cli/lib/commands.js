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

const Logger = require('@accordproject/concerto-util').Logger;
const FileWriter = require('@accordproject/concerto-util').FileWriter;

const MetaModelUtil = require('@accordproject/concerto-metamodel').MetaModelUtil;

const Printer = require('@accordproject/concerto-cto').Printer;
const Parser = require('@accordproject/concerto-cto').Parser;
const External = require('@accordproject/concerto-cto').External;

const ModelLoader = require('@accordproject/concerto-core').ModelLoader;
const Factory = require('@accordproject/concerto-core').Factory;
const Serializer = require('@accordproject/concerto-core').Serializer;
const Concerto = require('@accordproject/concerto-core').Concerto;
const CodeGen = require('@accordproject/concerto-tools').CodeGen;

const GoLangVisitor = CodeGen.GoLangVisitor;
const JavaVisitor = CodeGen.JavaVisitor;
const JSONSchemaVisitor = CodeGen.JSONSchemaVisitor;
const PlantUMLVisitor = CodeGen.PlantUMLVisitor;
const TypescriptVisitor = CodeGen.TypescriptVisitor;
const XmlSchemaVisitor = CodeGen.XmlSchemaVisitor;
const GraphQLVisitor = CodeGen.GraphQLVisitor;
const CSharpVisitor = CodeGen.CSharpVisitor;
const ODataVisitor = CodeGen.ODataVisitor;

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
     * @param {boolean} [options.useSystemTextJson] - compile for System.Text.Json library
     * @param {boolean} [options.useNewtonsoftJson] - compile for Newtonsoft.Json library
     */
    static async compile(target, ctoFiles, output, options) {
        const modelManagerOptions = { offline: options && options.offline };
        const visitorOptions = {
            useSystemTextJson: options && options.useSystemTextJson,
            useNewtonsoftJson: options && options.useNewtonsoftJson
        };

        const modelManager = await ModelLoader.loadModelManager(ctoFiles, modelManagerOptions);

        let visitor = null;

        switch(target.toLowerCase()) {
        case 'go':
            visitor = new GoLangVisitor();
            break;
        case 'plantuml':
            visitor = new PlantUMLVisitor();
            break;
        case 'typescript':
            visitor = new TypescriptVisitor();
            break;
        case 'java':
            visitor = new JavaVisitor();
            break;
        case 'jsonschema':
            visitor = new JSONSchemaVisitor();
            break;
        case 'xmlschema':
            visitor = new XmlSchemaVisitor();
            break;
        case 'graphql':
            visitor = new GraphQLVisitor();
            break;
        case 'csharp':
            visitor = new CSharpVisitor();
            break;
        case 'odata':
            visitor = new ODataVisitor();
            break;
        }

        if(visitor) {
            let parameters = visitorOptions;
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
     * Parse a cto string to a JSON syntax tree
     *
     * @param {string[]} [ctoFiles] - the CTO files used for import resolution
     * @param {boolean} resolve - whether to resolve the names
     * @param {boolean} all - whether to import all models
     * @param {string} outputPath to an output file
     * @param {string} the metamodel
     */
    static async parse(ctoFiles, resolve = false, all = false, outputPath) {
        let result;

        const allFiles = [];
        ctoFiles.forEach((file) => {
            const content = fs.readFileSync(file, 'utf8');
            allFiles.unshift(content);
        });

        const allModels = Parser.parseModels(allFiles);
        if (resolve) {
            // First resolve external models
            const allResolvedModels = await External.resolveExternal(allModels, {}, null);
            result = allResolvedModels;
            // Second resolve fully qualified names
            result = MetaModelUtil.resolveLocalNamesForAll(result);
        } else {
            result = allModels;
        }

        // Validate the model
        // await ModelLoader.loadModelManagerFromMetaModel(result);

        if (!all) {
            result = result.models[0];
        }
        if (outputPath) {
            Logger.info('Creating file: ' + outputPath);
            fs.writeFileSync(outputPath, JSON.stringify(result));
            return;
        }
        return JSON.stringify(result);
    }

    /**
     * Print a JSON syntax tree to a cto string
     *
     * @param {string} input metamodel
     * @param {string} outputPath to an output file
     * @param {string} transformed (meta)model
     */
    static async print(input, outputPath) {
        const inputString = fs.readFileSync(input, 'utf8');
        const json = JSON.parse(inputString);
        const result = Printer.toCTO(json);
        if (outputPath) {
            Logger.info('Creating file: ' + outputPath);
            fs.writeFileSync(outputPath, result);
            return;
        }
        return result;
    }
}

module.exports = Commands;
