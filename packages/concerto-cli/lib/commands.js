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

const { ModelManager, Factory, Serializer } = require('@accordproject/concerto-core');
const ModelFile = require('@accordproject/concerto-core').ModelFile;
const DefaultModelFileLoader = require('@accordproject/concerto-core').DefaultModelFileLoader;
const FileWriter = require('@accordproject/concerto-core').FileWriter;
const CodeGen = require('@accordproject/concerto-tools').CodeGen;

const GoLangVisitor = CodeGen.GoLangVisitor;
const JavaVisitor = CodeGen.JavaVisitor;
const JSONSchemaVisitor = CodeGen.JSONSchemaVisitor;
const PlantUMLVisitor = CodeGen.PlantUMLVisitor;
const TypescriptVisitor = CodeGen.TypescriptVisitor;
const XmlSchemaVisitor = CodeGen.XmlSchemaVisitor;

const defaultSystemContent = `namespace org.accordproject.base
abstract asset Asset {  }
abstract participant Participant {  }
abstract transaction Transaction identified by transactionId {
  o String transactionId
}
abstract event Event identified by eventId {
  o String eventId
}`;
const defaultSystemName = `@org.accordproject.base`

/**
 * Utility class that implements the commands exposed by the CLI.
 * @class
 * @memberof module:concerto-cli
 */
class Commands {

    /**
     * Add model file
     * 
     * @param {object} modelFileLoader the model loader
     * @param {object} modelManager the model manager
     * @param {string} ctoFile the model file
     * @param {boolean} system whether this is a system model
     * @return {object} the model manager
     */
    static async addModel(modelFileLoader, modelManager, ctoFile, system) {
        let modelFile = null;
        if (system && !ctoFile) {
            modelFile = new ModelFile(modelManager, defaultSystemContent, defaultSystemName, true);
        } else if(modelFileLoader.accepts(ctoFile)) {
            modelFile = await modelFileLoader.load(ctoFile);
        } else {
            const content = fs.readFileSync(ctoFile, 'utf8');
            modelFile = new ModelFile(modelManager, content, ctoFile);
        }

        if (system) {
            modelManager.addModelFile(modelFile, modelFile.getName(), false, true);
        } else {
            modelManager.addModelFile(modelFile, modelFile.getName(), true, false);
        }

        return modelManager;
    }
    
    /**
     * Load system and models in a new model manager
     * 
     * @param {string} ctoSystemFile the system model
     * @param {string[]} ctoFiles the CTO files (can be local file paths or URLs)
     * @return {object} the model manager
     */
    static async loadModelManager(ctoSystemFile, ctoFiles) {
        let modelManager = new ModelManager();
        const modelFileLoader = new DefaultModelFileLoader(modelManager);

        // Load system model
        modelManager = await Commands.addModel(modelFileLoader,modelManager,ctoSystemFile,true);

        // Load user models
        for( let ctoFile of ctoFiles ) {
            modelManager = await Commands.addModel(modelFileLoader,modelManager,ctoFile,false);
        }

        // Validate update models
        await modelManager.updateExternalModels();
        return modelManager;
    }

    /**
     * Validate a sample JSON against the model
     *
     * @param {string} sample the sample to validate
     * @param {string} ctoSystem the system model
     * @param {string[]} ctoFiles the CTO files to convert to code
     * @returns {string} serialized form of the validated JSON
     */
    static async validate(sample, ctoSystemFile, ctoFiles, out) {
        const json = JSON.parse(fs.readFileSync(sample, 'utf8'));

        const modelManager = await Commands.loadModelManager(ctoSystemFile, ctoFiles);
        const factory = new Factory(modelManager);
        const serializer = new Serializer(factory, modelManager);

        const object = serializer.fromJSON(json);
        return JSON.stringify(serializer.toJSON(object));
    }

    /**
     * Generate code from models for a given format
     *
     * @param {string} the format of the code to generate
     * @param {string} ctoSystem the system model
     * @param {string[]} ctoFiles the CTO files to convert to code
     * @param {string} outputDirectory the output directory
     */
    static async generate(format, ctoSystemFile, ctoFiles, outputDirectory) {
        const modelManager = await Commands.loadModelManager(ctoSystemFile, ctoFiles);

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
            return `Generated ${format} code in '${outputDirectory}'.`;
        }
        else {
            return 'Unrecognized code generator: ' + format;
        }
    }

    /**
     * Fetches all external for a set of models dependencies and
     * saves all the models to a target directory
     *
     * @param {string} ctoSystemFile the system model
     * @param {string[]} ctoFiles the CTO files (can be local file paths or URLs)
     * @param {string} outputDirectory the output directory
     */
    static async getExternalModels(ctoSystemFile, ctoFiles, outputDirectory) {
        const modelManager = await Commands.loadModelManager(ctoSystemFile, ctoFiles);
        mkdirp.sync(outputDirectory);
        modelManager.writeModelsToFileSystem(outputDirectory);
        return `Loaded external models in '${outputDirectory}'.`;
    }
}

module.exports = Commands;
