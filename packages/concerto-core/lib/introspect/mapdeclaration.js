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

const Declaration = require('./declaration');
const IllegalModelException = require('./illegalmodelexception');
const MapValueType = require('./mapvaluetype');
const MapKeyType = require('./mapkeytype');
const ModelUtil = require('../modelutil');

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
 * @extends Decorated
 * @see See {@link Decorated}
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
        if(process.env.ENABLE_MAP_TYPE !== 'true') {
            throw new Error('MapType feature is not enabled. Please set the environment variable "ENABLE_MAP_TYPE=true" to access this functionality.');
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

        if (!this.isValidMapKey(this.ast.key)) {
            throw new IllegalModelException(`MapDeclaration must contain valid MapKeyType  ${this.ast.name}`, this.modelFile, this.ast.location);
        }

        if (!this.isValidMapValue(this.ast.value)) {
            throw new IllegalModelException(`MapDeclaration must contain valid MapValueType, for MapDeclaration ${this.ast.name}` , this.modelFile, this.ast.location);
        }

        this.name = this.ast.name;
        this.key = new MapKeyType(this, this.ast.key);
        this.value = new MapValueType(this, this.ast.value);
        this.fqn = ModelUtil.getFullyQualifiedName(this.modelFile.getNamespace(), this.ast.name);
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
     * Returns the fully qualified name of this class.
     * The name will include the namespace if present.
     *
     * @return {string} the fully-qualified name of this class
     */
    getFullyQualifiedName() {
        return this.fqn;
    }

    /**
     * Returns the ModelFile that defines this class.
     *
     * @public
     * @return {ModelFile} the owning ModelFile
     */
    getModelFile() {
        return this.modelFile;
    }

    /**
     * Returns the short name of a class. This name does not include the
     * namespace from the owning ModelFile.
     *
     * @return {string} the short name of this class
     */
    getName() {
        return this.name;
    }

    /**
     * Returns the type of the Map key property.
     *
     * @return {string} the Map key property
     */
    getKey() {
        return this.key;
    }

    /**
     * Returns the type of the Map Value property.
     *
     * @return {string} the Map Value property
     */
    getValue() {
        return this.value;
    }

    /**
     * Returns the string representation of this class
     * @return {String} the string representation of the class
     */
    toString() {
        return 'MapDeclaration {id=' + this.getFullyQualifiedName() + '}';
    }

    /**
     * Returns the kind of declaration
     *
     * @return {string} what kind of declaration this is
     */
    declarationKind() {
        return 'MapDeclaration';
    }

    /**
     * Returns true if this class is the definition of a class declaration.
     *
     * @return {boolean} true if the class is a class
     */
    isMapDeclaration() {
        return true;
    }

    /**
     * Returns true if this Key is a valid Map Key.
     *
     * @param {Object} key - the Key of the Map Declaration
     * @return {boolean} true if the Key is a valid Map Key
    */
    isValidMapKey(key) {
        return [
            `${MetaModelNamespace}.StringMapKeyType`,
            `${MetaModelNamespace}.DateTimeMapKeyType`,
            `${MetaModelNamespace}.ObjectMapKeyType`,
        ].includes(key.$class);
    }

    /**
     * Returns true if this Value is a valid Map Value.
     *
     * @param {Object} value - the Value of the Map Declaration
     * @return {boolean} true if the Value is a valid Map Value
     */
    isValidMapValue(value) {
        return [
            `${MetaModelNamespace}.BooleanMapValueType`,
            `${MetaModelNamespace}.DateTimeMapValueType`,
            `${MetaModelNamespace}.StringMapValueType`,
            `${MetaModelNamespace}.IntegerMapValueType`,
            `${MetaModelNamespace}.LongMapValueType`,
            `${MetaModelNamespace}.DoubleMapValueType`,
            `${MetaModelNamespace}.ObjectMapValueType`
        ].includes(value.$class);
    }
}

module.exports = MapDeclaration;
