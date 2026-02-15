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

const ModelUtil = require('../modelutil');
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
        this.modelFile = parent.getModelFile();
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
        this.processType(this.ast);
    }

    /**
     * Semantic validation of the structure of this class.
     *
     * @throws {IllegalModelException}
     * @protected
     */
    validate() {
        if (!ModelUtil.isPrimitiveType(this.type)) {
            const decl = this.modelFile.getType(this.ast.type.name);
            // All but StringScalar & DateTimeScalar are unsupported.
            if  (!ModelUtil.isValidMapKeyScalar(decl)) {
                throw new IllegalModelException(
                    `Scalar must be one of StringScalar, DateTimeScalar in context of MapKeyType. Invalid Scalar: ${this.type}, for MapDeclaration ${this.parent.name}`
                );
            }
        }
    }

    /**
     * Sets the Type name for the Map Key
     *
     * @param {Object} ast - The AST created by the parser
     * @private
     */
    processType(ast) {
        switch(ast.$class) {
        case `${MetaModelNamespace}.DateTimeMapKeyType`:
            this.type = 'DateTime';
            break;
        case `${MetaModelNamespace}.StringMapKeyType`:
            this.type = 'String';
            break;
        case `${MetaModelNamespace}.ObjectMapKeyType`:
            this.type = String(this.ast.type.name);
            break;
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

    /**
     * Returns true if this class is the definition of a Map Key.
     *
     * @return {boolean} true if the class is a Map Key
     */
    isKey() {
        return true;
    }

    /**
     * Returns true if this class is the definition of a Map Value.
     *
     * @return {boolean} true if the class is a Map Value
     */
    isValue() {
        return false;
    }

    /**
     * Return the namespace of this map key.
     * @return {string} namespace - a namespace.
     */
    getNamespace() {
        return this.modelFile.getNamespace();
    }
}

export = MapKeyType;
