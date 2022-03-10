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

const MetaModelUtil = require('@accordproject/concerto-metamodel').MetaModelUtil;

const ModelManager = require('../modelmanager');
const Factory = require('../factory');
const Serializer = require('../serializer');

/**
 * Create a metamodel manager (for validation against the metamodel)
 * @return {*} the metamodel manager
 */
function createMetaModelManager() {
    const metaModelManager = new ModelManager();
    metaModelManager.addModelFile(MetaModelUtil.metaModelAst, MetaModelUtil.metaModelCto, 'concerto.metamodel');
    return metaModelManager;
}
const metaModelManager = createMetaModelManager();

/**
 * Validate metamodel instance against the metamodel
 * @param {object} input - the metamodel instance in JSON
 * @return {object} the validated metamodel instance in JSON
 */
function validateMetaModel(input) {
    const factory = new Factory(metaModelManager);
    const serializer = new Serializer(factory, metaModelManager);
    // First validate the metaModel
    const object = serializer.fromJSON(input);
    return serializer.toJSON(object);
}

/**
 * Class to work with the Concerto metamodel
 */
class MetaModel {
    /**
     * Resolve the namespace for names in the metamodel
     * @param {object} modelManager - the ModelManager
     * @param {object} metaModel - the MetaModel
     * @param {boolean} [validate] - whether to perform validation
     * @return {object} the resolved metamodel
     */
    static resolveMetaModel(modelManager, metaModel, validate = true) {
        // First, validate the JSON metaModel
        const mm = validate ? validateMetaModel(metaModel) : metaModel;

        const priorModels = modelManager.getAst();
        return MetaModelUtil.resolveLocalNames(priorModels, mm);
    }

    /**
     * Export metamodel from a model file
     * @param {object} modelFile - the ModelFile
     * @param {boolean} [validate] - whether to perform validation
     * @return {object} the metamodel for this model
     */
    static modelFileToMetaModel(modelFile, validate = true) {
        // Last, validate the JSON metaModel
        return validate ? validateMetaModel(modelFile.ast) : modelFile.ast;
    }

    /**
     * Export metamodel from a model manager
     * @param {object} modelManager - the ModelManager
     * @param {boolean} [resolve] - whether to resolve names
     * @param {boolean} [validate] - whether to perform validation
     * @return {object} the metamodel for this model manager
     */
    static modelManagerToMetaModel(modelManager, resolve, validate = true) {
        const result = {
            $class: 'concerto.metamodel.Models',
            models: [],
        };
        modelManager.getModelFiles().forEach((modelFile) => {
            let metaModel = modelFile.ast;
            if (resolve) {
                // No need to re-validate when models are obtained from model manager
                metaModel = MetaModel.resolveMetaModel(modelManager, metaModel, false);
            }
            result.models.push(metaModel);
        });
        return result;
    }

    /**
     * Import metamodel to a model manager
     * @param {object} metaModel - the metamodel
     * @param {boolean} [validate] - whether to perform validation
     * @return {object} the metamodel for this model manager
     */
    static modelManagerFromMetaModel(metaModel, validate = true) {
        // First, validate the JSON metaModel
        const mm = validate ? validateMetaModel(metaModel) : metaModel;

        const modelManager = new ModelManager();

        mm.models.forEach((mm) => {
            modelManager.addModelFile(mm, null, null, false);
        });

        modelManager.validateModelFiles();
        return modelManager;
    }
}

module.exports = { MetaModel, validateMetaModel };