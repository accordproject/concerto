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

import { MetaModelUtil } from '@accordproject/concerto-metamodel';

import ModelManager from '../modelmanager';
import Factory from '../factory';
import Serializer from '../serializer';
import ModelFile from '../introspect/modelfile';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type { AstNode } from './decorated';
/* eslint-enable no-unused-vars */

/**
 * Create a metamodel manager (for validation against the metamodel)
 * @return {ModelManager} the metamodel manager
 */
function newMetaModelManager() {
    const metaModelManager = new ModelManager();
    const mf = new ModelFile(
        metaModelManager,
        MetaModelUtil.metaModelAst as AstNode,
        MetaModelUtil.metaModelCto,
        'concerto.metamodel'
    );
    metaModelManager.addModelFile(mf, MetaModelUtil.metaModelCto, 'concerto.metamodel');
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

    // validate the metaModel
    serializer.fromJSON(input);

    return input;
}
/**
 * Import metamodel to a model manager
 * @param {object} metaModel - the metamodel
 * @param {boolean} [validate] - whether to perform validation
 * @return {ModelManager} the metamodel for this model manager
 */
function modelManagerFromMetaModel(metaModel, validate = true) {
    // First, validate the JSON metaModel
    const mm = validate ? validateMetaModel(metaModel) : metaModel;

    const modelManager = new ModelManager();

    mm.models.forEach((mm) => {
        const mf = new ModelFile(modelManager, mm, null, null);
        modelManager.addModelFile(mf, null, null);
    });

    modelManager.validateModelFiles();
    return modelManager;
}

export { newMetaModelManager, validateMetaModel, modelManagerFromMetaModel };
export default { newMetaModelManager, validateMetaModel, modelManagerFromMetaModel };
