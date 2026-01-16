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

import * as fs from 'fs';
import { Parser } from '@accordproject/concerto-cto';
import { DefaultFileLoader } from '@accordproject/concerto-util';

// USE require syntax to handle the 'export =' from these files
import ModelFile = require('./introspect/modelfile');
import ModelManager = require('./modelmanager');

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
    static async addModel(modelFileLoader: any, modelManager: any, ctoFile: string) {
        let modelFile: any = null;
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
    * @param {number} [options.utcOffset] - UTC Offset for this execution
     * @return {Promise<ModelManager>} the model manager
     */
    static async loadModelManager(ctoFiles: string[], options: any = { offline: false }) {
        const opts = options || { offline: false };
        
        
        let modelManager = new (ModelManager as any)(opts);
        
        // How to create a modelfile from the external content
        const processFile = (name: any, data: any) => {
            const ast = Parser.parse(data);
            return new ModelFile(modelManager, ast, data, name);
        };
        const modelFileLoader = new DefaultFileLoader(processFile);

        // Load user models
        for(let ctoFile of ctoFiles) {
            modelManager = await ModelLoader.addModel(modelFileLoader,modelManager,ctoFile);
        }

        // Validate the models, either offline or with external model resolution
        if(opts && opts.offline) {
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
     * @param {number} [options.utcOffset] - UTC Offset for this execution
     * @return {Promise<ModelManager>} the model manager
     */
    static async loadModelManagerFromModelFiles(modelFiles: any[], fileNames?: string[], options: any = { offline: false }) {
        const opts = options || { offline: false };
        
        // FIX: Cast to 'any' to bypass strict constructor signature check
        let modelManager = new (ModelManager as any)(opts);

        // Load system model
        modelManager.addModelFiles(modelFiles, fileNames, true);

        // Validate the models, either offline or with external model resolution
        if(opts && opts.offline) {
            modelManager.validateModelFiles();
            return modelManager;
        } else {
            await modelManager.updateExternalModels();
            return modelManager;
        }
    }

}

export = ModelLoader;