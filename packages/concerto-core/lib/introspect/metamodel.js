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
function newMetaModelManager() {
    const metaModelManager = new ModelManager();
    metaModelManager.addModelFile(MetaModelUtil.metaModelAst, MetaModelUtil.metaModelCto, 'concerto.metamodel', true);
    return metaModelManager;
}

/**
 * Validate metamodel instance against the metamodel
 * @param {object} input - the metamodel instance in JSON
 * @return {object} the validated metamodel instance in JSON
 */
function validateMetaModel(input) {
    const metaModelManager = newMetaModelManager();
    const factory = new Factory(metaModelManager);
    const serializer = new Serializer(factory, metaModelManager);
    // First validate the metaModel
    const object = serializer.fromJSON(input);
    return serializer.toJSON(object);
}

/**
 * Import metamodel to a model manager
 * @param {object} metaModel - the metamodel
 * @param {boolean} [validate] - whether to perform validation
 * @return {object} the metamodel for this model manager
 */
function modelManagerFromMetaModel(metaModel, validate = true) {
    // First, validate the JSON metaModel
    const mm = validate ? validateMetaModel(metaModel) : metaModel;

    const modelManager = new ModelManager();

    mm.models.forEach((mm) => {
        modelManager.addModelFile(mm, null, null, false);
    });

    modelManager.validateModelFiles();
    return modelManager;
}

module.exports = {
    newMetaModelManager,
    validateMetaModel,
    modelManagerFromMetaModel
};
