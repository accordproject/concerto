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

const path = require('path');

const DefaultFileLoader = require('@accordproject/concerto-util').DefaultFileLoader;
const FileDownloader = require('@accordproject/concerto-util').FileDownloader;

const debug = require('debug')('concerto:ModelManager');

const Parser = require('./parser');

/**
 * Return the fully qualified name for an import
 * @param {object} imp - the import
 * @return {string} - the fully qualified name for that import
 * @private
 */
function importFullyQualifiedName(imp) {
    return imp.$class === 'concerto.metamodel.ImportAll' ? `${imp.namespace}.*` : `${imp.namespace}.${imp.name}`;
}

/**
 * Returns an object that maps from the import declarations to the URIs specified
 * @param {*} ast - the model ast
 * @return {Object} keys are import declarations, values are URIs
 * @private
 */
function getExternalImports(ast) {
    const uriMap = {};
    if (ast.imports) {
        ast.imports.forEach((imp) => {
            const fqn = importFullyQualifiedName(imp);
            if(imp.uri) {
                uriMap[fqn] = imp.uri;
            }
        });
    }
    return uriMap;
}

/**
 * Update models with a new model
 * @param {*} models - existing models
 * @param {*} newModel - new model
 * @return {*} the updated models
 */
function updateModels(models, newModel) {
    const result = {
        $class: 'concerto.metamodel.Models',
        models: [],
    };
    const newNamespace = newModel.namespace;
    const priors = models.models;
    let found = false;
    priors.forEach((priorModel, index) => {
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
async function resolveExternal(models, options, fileDownloader) {
    const NAME = 'updateExternalModels';
    debug(NAME, 'updateExternalModels', options);

    if(!fileDownloader) {
        // How to create a modelfile from the external content
        const processFile = (name, data) => {
            // Note: JSON URLs seem to be already parsed in 'data'
            // return { ast: data, data, name };
            if (path.extname(name) === '.cto') {
                return Parser.parse(data);
            }
            return data;
        };
        fileDownloader = new FileDownloader(new DefaultFileLoader(processFile), getExternalImports);
    }

    const externalModelFiles = await fileDownloader.downloadExternalDependencies(models.models, options);

    let result = models;
    externalModelFiles.forEach((mf) => {
        result = updateModels(result, mf);
    });

    return result;
}

module.exports = {
    resolveExternal,
};
