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

const Declaration = require('./declaration');
const IllegalModelException = require('./illegalmodelexception');
const MapValueType = require('./mapvaluetype');
const MapKeyType = require('./mapkeytype');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const ModelFile = require('./modelfile');
}

/**
 * MapDeclaration defines a Map data structure, which allows storage of a collection
 * of values, where each value is associated and indexed with a unique key.
 *
 * @extends Declaration
 * @see See {@link Declaration}
 * @class
 * @memberof module:concerto-core
 */
class MapDeclaration extends Declaration {
    /**
     * Create an MapDeclaration.
     * @param {ModelFile} modelFile - the ModelFile for this class
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile, ast) {
        // TODO remove on full release.
        const mm = modelFile.getModelManager();
        if(process.env.ENABLE_MAP_TYPE !== 'true' && !mm.enableMapType) {
            throw new Error('MapType feature is not enabled. Please set the environment variable "ENABLE_MAP_TYPE=true", or add {enableMapType: true} to the ModelManger options, to access this functionality.');
        }

        super(modelFile, ast);
        this.modelFile = modelFile;
        this.process();
    }

    /**
     * Process the AST and build the model
     *
     * @throws {IllegalModelException}
     * @private
     */
    process() {
        super.process();

        if (!this.ast.key || !this.ast.value) {
            throw new IllegalModelException(`MapDeclaration must contain Key & Value properties ${this.ast.name}`, this.modelFile, this.ast.location);
        }

        this.key = new MapKeyType(this, this.ast.key);
        this.value = new MapValueType(this, this.ast.value);
    }

    /**
     * Semantic validation of the structure of this class.
     *
     * @throws {IllegalModelException}
     * @protected
     */
    validate() {
        super.validate();
        this.key.validate();
        this.value.validate();
    }

    /**
     * Returns the type of the Map key property.
     *
     * @return {MapKeyType} the Map key property
     */
    getKey() {
        return this.key;
    }

    /**
     * Returns the type of the Map Value property.
     *
     * @return {MapValueType} the Map Value property
     */
    getValue() {
        return this.value;
    }
}

module.exports = MapDeclaration;
