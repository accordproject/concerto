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

const DefaultModelFileLoader = require('./introspect/loaders/defaultmodelfileloader');
const ModelFile = require('./introspect/modelfile');
const ModelManager = require('./modelmanager');

const defaultSystemContent = `namespace org.accordproject.base
abstract asset Asset {  }
abstract participant Participant {  }
abstract transaction Transaction identified by transactionId {
  o String transactionId
}
abstract event Event identified by eventId {
  o String eventId
}`;
const defaultSystemName = '@org.accordproject.base';

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
     * @param {boolean} system - whether this is a system model
     * @return {object} the model manager
     * @private
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
     * @param {string} ctoSystemFile - the system model file
     * @param {string[]} ctoFiles - the CTO files (can be local file paths or URLs)
     * @return {object} the model manager
     */
    static async loadModelManager(ctoSystemFile, ctoFiles) {
        let modelManager = new ModelManager();
        const modelFileLoader = new DefaultModelFileLoader(modelManager);

        // Load system model
        modelManager = await ModelLoader.addModel(modelFileLoader,modelManager,ctoSystemFile,true);

        // Load user models
        for(let ctoFile of ctoFiles) {
            modelManager = await ModelLoader.addModel(modelFileLoader,modelManager,ctoFile,false);
        }

        // Validate update models
        await modelManager.updateExternalModels();
        return modelManager;
    }

    /**
     * Load system and models in a new model manager from model files objects
     *
     * @param {string} ctoSystemFile - the system model file
     * @param {object[]} modelFiles - An array of Concerto files as strings or ModelFile objects.
     * @param {string[]} [fileNames] - An optional array of file names to associate with the model files
     * @return {object} the model manager
     */
    static async loadModelManagerFromModelFiles(ctoSystemFile, modelFiles, fileNames) {
        let modelManager = new ModelManager();
        const modelFileLoader = new DefaultModelFileLoader(modelManager);

        // Load system model
        modelManager = await ModelLoader.addModel(modelFileLoader,modelManager,ctoSystemFile,true);
        modelManager.addModelFiles(modelFiles, fileNames);

        // Load user models

        // Validate update models
        await modelManager.updateExternalModels();
        return modelManager;
    }

}

module.exports = ModelLoader;
