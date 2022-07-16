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

/**
 * Create a metamodel instance (i.e. JSON AST) object from a CTO string
 * @param {string} cto - the Concerto string
 * @param {string | Object} [options] - an optional options parameter or filename
 * @param {string} [options.skipLocationNodes] - when true location nodes will be skipped in the metamodel AST
 * @param {string} [options.fileName] - when true location nodes will be skipped in the metamodel AST
 * @return {object} the metamodel instance for the cto argument
 */
function parse(cto, options) {
    const fileName = typeof options === 'string' ? options : options?.fileName;
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
 * @param {string} [options.skipLocationNodes] - when true location nodes will be skipped in the metamodel AST
 * @return {*} the AST / metamodel
 */
function parseModels(files, options) {
    const result = {
        $class: 'concerto.metamodel.Models',
        models: [],
    };
    files.forEach((modelFile) => {
        let metaModel = Parser.parse(modelFile, options);
        result.models.push(metaModel);
    });
    return result;
}

module.exports = {
    parse,
    parseModels,
};
