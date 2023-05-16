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

const Decorated = require('./decorated');
const IllegalModelException = require('./illegalmodelexception');
const MapPropertyType = require('./mapvaluetype');
const MapKeyType = require('./mapkeytype');
const ModelUtil = require('../modelutil');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const ModelFile = require('./modelfile');
}

/**
 * MapDeclaration defines an MapType of Key & Value pair.
 *
 * @extends Decorated
 * @see See {@link Decorated}
 * @class
 * @memberof module:concerto-core
 */
class MapDeclaration extends Decorated {
    /**
     * Create an MapDeclaration.
     * @param {ModelFile} modelFile the ModelFile for this class
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile, ast) {
        super(ast);
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

        if (this.ast.properties.length !== 2) {
            throw new IllegalModelException(`MapDeclaration must contain exactly two properties -  MapKeyType & MapyValueType ${this.ast.name}`, this.modelFile, this.ast.location);
        }

        const k = this.ast.properties.find(p => p.$class === 'concerto.metamodel@1.0.0.MapKeyType');
        const v = this.ast.properties.find(p => p.$class === 'concerto.metamodel@1.0.0.AggregateValueType' || p.$class === 'concerto.metamodel@1.0.0.AggregateRelationshipValueType');

        if (!k) {
            throw new IllegalModelException(`MapDeclaration must contain MapKeyType  ${this.ast.name}`, this.modelFile, this.ast.location);
        }

        if (!v) {
            throw new IllegalModelException(`MapDeclaration must contain AggregateValueType  ${this.ast.name}`, this.modelFile, this.ast.location);
        }

        this.name = this.ast.name;
        this.key = new MapKeyType(this, k);
        this.value = new MapPropertyType(this, v);
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
     * @return {string} the short name of this class
     */
    getKey() {
        return this.key;
    }

    /**
     * Returns the type of the Map Value property.
     *
     * @return {string} the short name of this class
     */
    getValue() {
        return this.value;
    }

    /**
     * Returns the MapDeclaration properties
     *
     * @return {array} the short name of this class
     */
    getProperties() {
        return this.ast.properties;
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
     * Returns true if this class is abstract.
     *
     * @return {boolean} true if the class is abstract
     */
    isAbstract() {
        return false;
    }

    /**
     * Returns true if this class is the definition of an asset.
     *
     * @return {boolean} true if the class is an asset
     */
    isAsset() {
        return false;
    }

    /**
     * Returns true if this class is the definition of a participant.
     *
     * @return {boolean} true if the class is a participant
     */
    isParticipant() {
        return false;
    }

    /**
     * Returns true if this class is the definition of a transaction.
     *
     * @return {boolean} true if the class is a transaction
     */
    isTransaction() {
        return false;
    }

    /**
     * Returns true if this class is the definition of an event.
     *
     * @return {boolean} true if the class is an event
     */
    isEvent() {
        return false;
    }

    /**
     * Returns true if this class is the definition of a concept.
     *
     * @return {boolean} true if the class is a concept
     */
    isConcept() {
        return false;
    }

    /**
     * Returns true if this class is the definition of an enum.
     *
     * @return {boolean} true if the class is an enum
     */
    isEnum() {
        return false;
    }

    /**
     * Returns true if this class is the definition of a scalar declaration.
     *
     * @return {boolean} true if the class is a scalar
     */
    isScalarDeclaration() {
        return false;
    }

    /**
     * Returns true if this class is the definition of a class declaration.
     *
     * @return {boolean} true if the class is a class
     */
    isMapDeclaration() {
        return true;
    }
}

module.exports = MapDeclaration;
