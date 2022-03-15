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
}

module.exports = ModelManager;
