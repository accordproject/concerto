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

const Decorated = require('./decorated');
const IllegalModelException = require('./illegalmodelexception');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const ModelFile = require('./modelfile');
    const MapDeclaration = require('./mapdeclaration');
}

/**
 * MapKeyType defines a Key type of an MapDeclaration.
 *
 * @extends Decorated
 * @see See {@link Decorated}
 * @class
 * @memberof module:concerto-core
 */
class MapKeyType extends Decorated {
    /**
     * Create an MapKeyType.
     * @param {MapDeclaration} parent - The owner of this property
     * @param {Object} ast - The AST created by the parser
     * @param {ModelFile} modelFile - the ModelFile for the Map class
     * @throws {IllegalModelException}
     */
    constructor(parent, ast) {
        super(ast);
        this.parent = parent;
        this.type = this.ast.name;
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
    }

    /**
     * Semantic validation of the structure of this class.
     *
     * @throws {IllegalModelException}
     * @protected
     */
    validate() {
        const declaration = this.getModelFile().getAllDeclarations();
        const key = declaration.find(decl => decl.name === this.type);

        if (!key?.isConcept?.()           &&
            !key?.isEnum?.()              &&
            !key?.isScalarDeclaration?.() &&
            !['String', 'DateTime'].includes(this.type)) {
            throw new IllegalModelException(`MapKeyType has invalid Type: ${this.type}`);
        }

        if (key?.isConcept?.() && !key.isIdentified()) {
            throw new IllegalModelException(
                `ConceptDeclaration must be identified in context of MapKeyType: ${this.type}`
            );
        }

        if (key?.isScalarDeclaration?.() &&
            !(key?.ast.$class === `${MetaModelNamespace}.StringScalar`)  &&
            !(key?.ast.$class === `${MetaModelNamespace}.DateTimeScalar` )) {
            throw new IllegalModelException(
                `Scalar must be one of StringScalar, DateTimeScalar in context of MapKeyType. Invalid Scalar: ${this.type}`
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
    * Returns the owner of this property
     * @public
     * @return {MapDeclaration} the parent map declaration
     */
    getParent() {
        return this.parent;
    }

    /**
     * Returns the Type of the MapKey. This name does not include the
     * namespace from the owning ModelFile.
     *
     * @return {string} the short name of this class
     */
    getType() {
        return this.type;
    }

    /**
     * Returns the string representation of this class
     * @return {String} the string representation of the class
     */
    toString() {
        return 'MapKeyType {id=' + this.getType() + '}';
    }
}

module.exports = MapKeyType;
