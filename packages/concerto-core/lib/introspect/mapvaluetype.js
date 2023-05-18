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

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const ModelFile = require('./modelfile');
}

/**
 * MapValueType defines a Value type of MapDeclaration.
 *
 * @extends Decorated
 * @see See {@link Decorated}
 * @class
 * @memberof module:concerto-core
 */
class MapValueType extends Declaration {
    /**
     * Create an MapValueType.
     * @param {MapDeclaration} parent - The owner of this property
     * @param {Object} ast - The AST created by the parser
     * @param {ModelFile} modelFile - the ModelFile for the Map class
     * @throws {IllegalModelException}
     */
    constructor(parent, ast, modelFile) {
        super(modelFile, ast);
        this.modelFile = modelFile;
        this.parent = parent;
        this.name = null;
        this.type = null;
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
        this.name = this.ast.name;
        this.type = this.ast.name;
    }

    /**
     * Semantic validation of the structure of this class.
     *
     * @throws {IllegalModelException}
     * @protected
     */
    validate() {
        const declarations = this.getModelFile().getAllDeclarations();

        const value = declarations.find(decl => decl.name === this.name);

        if (!value?.isConcept?.()           &&
            !value?.isEnum?.()              &&
            !value?.isEvent?.()             &&
            !value?.isMapDeclaration?.()    &&
            !value?.isScalarDeclaration?.() &&
            !['String', 'Long', 'Integer', 'Double', 'Boolean', 'DateTime'].includes(this.type)) {
            throw new IllegalModelException(
                `MapPropertyType has invalid Type: ${this.type}`
            );
        }
    }

    /**
     * Returns the ModelFile that defines this class.
     *
     * @public
     * @return {ModelFile} the owning ModelFile
     */
    getModelFile() {
        return this.parent.getModelFile();
    }

    /**
     * Returns the name of the MapValue. This name does not include the
     * namespace from the owning ModelFile.
     *
     * @return {string} the short name of this class
     */
    getName() {
        return this.ast.name;
    }

    /**
     * Returns the Type of the MapValue. This name does not include the
     * namespace from the owning ModelFile.
     *
     * @return {string} the short name of this class
     */
    getType() {
        return this.ast.name;
    }

    /**
     * Returns the string representation of this class
     * @return {String} the string representation of the class
     */
    toString() {
        return 'MapValueType {id=' + this.getFullyQualifiedName() + '}';
    }

}

module.exports = MapValueType;
