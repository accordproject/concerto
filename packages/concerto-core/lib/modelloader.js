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

const Parser = require('@accordproject/concerto-cto').Parser;
const DefaultFileLoader = require('@accordproject/concerto-util').DefaultFileLoader;
const ModelFile = require('./introspect/modelfile');
const ModelManager = require('./modelmanager');

/**
 * Create a ModelManager from model files, with an optional system model.
 *
 * If a ctoFile is not provided, the Accord Project system model is used.
 *
 * @class
 * @memberof module:concerto-core
 */
class ModelLoader {
    /**
     * Add model file
     *
     * @param {object} modelFileLoader - the model loader
     * @param {object} modelManager - the model manager
     * @param {string} ctoFile - the model file
     * @return {Promise<ModelManager>} the model manager
     * @private
     */
    static async addModel(modelFileLoader, modelManager, ctoFile) {
        let modelFile = null;
        if (modelFileLoader.accepts(ctoFile)) {
            modelFile = await modelFileLoader.load(ctoFile);
        } else {
            const content = fs.readFileSync(ctoFile, 'utf8');
            const ast = Parser.parse(content, ctoFile);
            modelFile = new ModelFile(modelManager, ast, content, ctoFile);
        }

        modelManager.addModelFile(modelFile, null, modelFile.getName(), true);

        return modelManager;
    }

    /**
     * Load models in a new model manager
     *
     * @param {string[]} ctoFiles - the CTO files (can be local file paths or URLs)
     * @param {object} options - optional parameters
     * @param {boolean} [options.offline] - do not resolve external models
     * @param {boolean} [options.versionedNamespacesStrict] - disallow unversioned namespaces
    * @param {number} [options.utcOffset] - UTC Offset for this execution
     * @return {Promise<ModelManager>} the model manager
     */
    static async loadModelManager(ctoFiles, options = { offline: false, versionedNamespacesStrict: false }) {
        let modelManager = new ModelManager(options);
        // How to create a modelfile from the external content
        const processFile = (name, data) => {
            const ast = Parser.parse(data);
            return new ModelFile(modelManager, ast, data, name);
        };
        const modelFileLoader = new DefaultFileLoader(processFile);

        // Load user models
        for(let ctoFile of ctoFiles) {
            modelManager = await ModelLoader.addModel(modelFileLoader,modelManager,ctoFile);
        }

        // Validate the models, either offline or with external model resolution
        if(options && options.offline) {
            modelManager.validateModelFiles();
            return modelManager;
        } else {
            await modelManager.updateExternalModels();
            return modelManager;
        }
    }

    /**
     * Load system and models in a new model manager from model files objects
     *
     * @param {object[]} modelFiles - An array of Concerto files as strings or ModelFile objects.
     * @param {string[]} [fileNames] - An optional array of file names to associate with the model files
     * @param {object} options - optional parameters
     * @param {boolean} [options.offline] - do not resolve external models
     * @param {boolean} [options.versionedNamespacesStrict] - disallow unversioned namespaces
     * @param {number} [options.utcOffset] - UTC Offset for this execution
     * @return {Promise<ModelManager>} the model manager
     */
    static async loadModelManagerFromModelFiles(modelFiles, fileNames, options = { offline: false, versionedNamespacesStrict: false }) {
        let modelManager = new ModelManager(options);

        // Load system model
        modelManager.addModelFiles(modelFiles, fileNames, true);

        // Validate the models, either offline or with external model resolution
        if(options && options.offline) {
            modelManager.validateModelFiles();
            return modelManager;
        } else {
            await modelManager.updateExternalModels();
            return modelManager;
        }
    }

}

module.exports = ModelLoader;
