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

const Parser = require('./parser');
const ParseException = require('./parseexception');

const DefaultFileLoader = require('@accordproject/concerto-util').DefaultFileLoader;
const FileDownloader = require('@accordproject/concerto-util').FileDownloader;

/**
 * Create decorator argument string from a metamodel
 * @param {string} cto - the Concerto string
 * @param {string} [fileName] - an optional file name
 * @return {object} the string for the decorator argument
 */
function parse(cto, fileName) {
    try {
        return Parser.parse(cto);
    } catch(err) {
        if(err.location && err.location.start) {
            throw new ParseException(err.message, err.location, fileName);
        }
        else {
            throw err;
        }
    }
}

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
 * @param {*} the model ast
 * @return {Object} keys are import declarations, values are URIs
 * @private
 */
function getExternalImports(ast) {
    const uriMap = {};
    ast.imports.forEach((imp) => {
        const fqn = importFullyQualifiedName(imp);
        if(imp.uri) {
            uriMap[fqn] = imp.uri;
        }
    });
    return uriMap;
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
async function resolve(options, fileDownloader) {
    const NAME = 'updateExternalModels';
    debug(NAME, 'updateExternalModels', options);

    if(!fileDownloader) {
        // How to create a modelfile from the external content
        const processFile = (name, data) => {
            const ast = Parser.parse(data);
            return { ast, data, name };
        };
        fileDownloader = new FileDownloader(new DefaultFileLoader(processFile), getExternalImports);
    }

    const externalModelFiles = await fileDownloader.downloadExternalDependencies(models, options)
          .catch(error => {
              // If we're not able to download the latest dependencies, see whether the models all validate based on the available cached models.
              if(error.code === 'MISSING_DEPENDENCY'){
                  try {
                      // this.validateModelFiles();
                      return [];
                  } catch (validationError) {
                      // The validation error tells us the first model that is missing from the model manager, but the dependency download
                      // will fail at the first external model, regardless of whether there is already a local copy.
                      // As a hint to the user we display the URL of the external model that can't be found.
                      /* XXX
                      const modelFile = this.getModelFileByFileName(validationError.fileName);
                      const namespaces = modelFile.getExternalImports();
                      const missingNs = Object.keys(namespaces).find((ns) => validationError.shortMessage.includes(ns));
                      const url = modelFile.getImportURI(missingNs);
                      const err = new Error(`Unable to download external model dependency '${url}'`);
                      err.code = 'MISSING_DEPENDENCY';
                      throw err;
                      */
                      throw validationError;
                  }
              } else {
                  throw error;
              }
          });
    const originalModelFiles = {};
    Object.assign(originalModelFiles, models);

    try {
        externalModelFiles.forEach((mf) => {
            const existing = this.modelFiles[mf.getNamespace()];

            if (existing) {
                this.updateModelFile(mf, mf.getName(), true); // disable validation
            } else {
                this.addModelFile(mf, mf.getName(), true); // disable validation
            }
        });

        // now everything is applied, we need to revalidate all models
        this.validateModelFiles();
        return externalModelFiles;
    } catch (err) {
        this.modelFiles = {};
        Object.assign(this.modelFiles, originalModelFiles);
        throw err;
    }
}

module.exports = {
    parse,
};
