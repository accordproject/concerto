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

const Parser = require('@accordproject/concerto-cto').Parser;

const BaseModelManager = require('./basemodelmanager');

const debug = require('debug')('concerto:BaseModelManager');

// How to create a modelfile from a cto file
const ctoProcessFile = (name, data) => {
    return {
        ast: Parser.parse(data, name),
        definitions: data,
        fileName: name,
    };
};

/**
 * Manages the Concerto model files in CTO format.
 *
 * The structure of {@link Resource}s (Assets, Transactions, Participants) is modelled
 * in a set of Concerto files. The contents of these files are managed
 * by the {@link ModelManager}. Each Concerto file has a single namespace and contains
 * a set of asset, transaction and participant type definitions.
 *
 * Concerto applications load their Concerto files and then call the {@link ModelManager#addModelFile addModelFile}
 * method to register the Concerto file(s) with the ModelManager.
 *
 * @memberof module:concerto-core
 */
class ModelManager extends BaseModelManager {
    /**
     * Create the ModelManager.
     * @constructor
     * @param {object} [options] - Serializer options
     * @param {*} [processFile] - how to obtain a concerto AST from an input to the model manager
     */
    constructor(options) {
        super(options, ctoProcessFile);
    }

    /**
     * Adds a model in CTO format to the ModelManager.
     * This is a convenience function equivalent to `addModel` but useful since it avoids having to copy the input CTO.
     * @param {string} cto - a cto string
     * @param {string} fileName - an optional file name to associate with the model file
     * @param {boolean} [disableValidation] - If true then the model files are not validated
     * @throws {IllegalModelException}
     * @return {Object} The newly added model file (internal).
     */
    addCTOModel(cto, fileName, disableValidation) {
        const NAME = 'addCTOModel';
        debug(NAME, 'addCTOModel', cto, fileName);

        return this.addModel(cto, cto, fileName, disableValidation);
    }

}

module.exports = ModelManager;
