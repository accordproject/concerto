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

const { MetaModelNamespace } = require('@accordproject/concerto-metamodel');

const Parser = require('./parser');
const ParseException = require('./parseexception');

/**
 * Create a metamodel instance (i.e. JSON AST) object from a CTO string
 * @param {string} cto - the Concerto string
 * @param {string} [fileName] - an optional file name
 * @param {Object} [options] - an optional options parameter or filename
 * @param {boolean} [options.skipLocationNodes] - when true location nodes will be skipped in the metamodel AST
 * @return {object} the metamodel instance for the cto argument
 */
function parse(cto, fileName, options) {
    try {
        return Parser.parse(cto, options);
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
 * Parses an array of model files
 * @param {string[]} files - array of cto files
 * @param {Object} [options] - an optional options parameter
 * @param {boolean} [options.skipLocationNodes] - when true location nodes will be skipped in the metamodel AST
 * @return {Object} an object with:
 *   - `$class` {string}: the AST/metamodel namespace
 *   - `models` {Object[]}: successfully parsed metamodels
 *   - `errors` {Object[]}: parse errors, each containing:
 *       - `file` {string}: file identifier
 *       - `message` {string}: error message
 *       - `location` {Object} [optional]: error location, if available
 */
function parseModels(files, options) {
    const result = {
        $class: `${MetaModelNamespace}.Models`,
        models: [],
        errors: [],
    };
    files.forEach((modelFile, index) => {
        const fileId = `file_${index}`; // for unique file id
        try {
            let metaModel = parse(modelFile, fileId, options);
            result.models.push(metaModel);
        } catch (err) {
            const errorDetails = {
                file: err.fileName || fileId,
                message: err.message,
            };
            if (err.fileLocation) {
                errorDetails.location = err.fileLocation;
            }
            result.errors.push(errorDetails);
        }
    });
    return result;
}

module.exports = {
    parse,
    parseModels,
};
