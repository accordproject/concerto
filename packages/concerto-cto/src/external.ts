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

import debug from 'debug';
import * as pathBrowserify from 'path-browserify';
import { DefaultFileLoader, FileDownloader } from '@accordproject/concerto-util';
import { MetaModelUtil, MetaModelNamespace } from '@accordproject/concerto-metamodel';

import Parser = require('./parser');

const debugLog = debug('concerto:ModelManager');

interface Model {
    namespace: string;
    [key: string]: any;
}

interface Models {
    $class: string;
    models: Model[];
}

/**
 * Update models with a new model
 * @param {*} models - existing models
 * @param {*} newModel - new model
 * @return {*} the updated models
 */
function updateModels(models: Models, newModel: Model): Models {
    const result: Models = {
        $class: `${MetaModelNamespace}.Models`,
        models: [],
    };
    const newNamespace = newModel.namespace;
    const priors = models.models;
    let found = false;
    priors.forEach((priorModel) => {
        if (priorModel.namespace === newNamespace) {
            result.models.push(newModel);
            found = true;
        } else {
            result.models.push(priorModel);
        }
    });
    if (!found) {
        result.models.push(newModel);
    }
    return result;
}

/**
 * Downloads all ModelFiles that are external dependencies and adds or
 * updates them in this ModelManager.
 * @param {*} models - the AST for all the known models
 * @param {Object} [options] - Options object passed to ModelFileLoaders
 * @param {FileDownloader} [fileDownloader] - an optional FileDownloader
 * @throws {IllegalModelException} if the models fail validation
 * @return {Promise} a promise when the download and update operation is completed.
 */
async function resolveExternal(models: Models, options?: any, fileDownloader?: FileDownloader): Promise<Models> {
    const NAME = 'updateExternalModels';
    debugLog(NAME, 'updateExternalModels', options);

    if(!fileDownloader) {
        // How to create a modelfile from the external content
        const processFile = (name: string, data: any): any => {
            // Note: JSON URLs seem to be already parsed in 'data'
            // return { ast: data, data, name };
            if (pathBrowserify.extname(name) === '.cto') {
                return Parser.parse(data);
            }
            throw new Error('External model file references are expected to have a .cto extension');
        };
        fileDownloader = new FileDownloader(new DefaultFileLoader(processFile), MetaModelUtil.getExternalImports);
    }

    const externalModelFiles = await fileDownloader.downloadExternalDependencies(models.models, options);

    let result = models;
    externalModelFiles.forEach((mf: Model) => {
        result = updateModels(result, mf);
    });

    return result;
}

export = {
    resolveExternal,
}; 