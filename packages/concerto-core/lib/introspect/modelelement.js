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

const ModelUtil = require('../modelutil');
const IllegalModelException = require('./illegalmodelexception');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const ModelFile = require('./modelfile');
}
/* eslint-enable no-unused-vars */

/**
 * ModelElement defines an element of a model file. It has a type
 * and provides a set of useful methods for type introspection.
 *
 * @private
 * @abstract
 * @class
 * @memberof module:concerto-core
 */
class ModelElement {
    /**
     * Create a ModelElement from an Abstract Syntax Tree. The AST is the
     * result of parsing.
     * @param {ModelFile} modelFile - the ModelFile for this class
     * @param {string} ast - the AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile, ast) {
        if (!modelFile) {
            throw new Error('ModelFile not specified');
        }
        this.modelFile = modelFile;
        if (!ast) {
            throw new Error('ast not specified');
        }
        this.ast = ast;
        if (!ast.$class) {
            throw new Error(
                'Invalid ModelElement; must have a $class attribute'
            );
        }
        const { name } = ModelUtil.parseNamespace(MetaModelNamespace);
        if(!ast.$class.startsWith(name)) {
            throw new Error(
                `Invalid ModelElement; must have a $class attribute that is in the metamodel namespace. Found ${name}.`
            );
        }
        this.type = this.ast.$class;

        if (!ModelUtil.isValidIdentifier(this.ast.name)) {
            throw new IllegalModelException(
                `Invalid model element name '${this.ast.name}'`,
                this.modelFile,
                this.ast.location
            );
        }

        // if(!this.ast.name) {
        //     throw new Error('No name for type ' + JSON.stringify(this.ast));
        // }

        if(this.ast.name) {
            this.name = this.ast.name;
            this.fqn = ModelUtil.getFullyQualifiedName(
                this.modelFile.getNamespace(),
                this.name
            );
        }
        else {
            this.name = null;
            this.fqn = null;
        }
    }

    /**
     * Returns the ModelFile that owns this model element.
     *
     * @public
     * @return {ModelFile} the owning ModelFile
     */
    getModelFile() {
        return this.modelFile;
    }

    /**
     * Return the namespace of this class.
     * @return {string} namespace - a namespace.
     */
    getNamespace() {
        return this.modelFile.getNamespace();
    }

    /**
     * Returns the metamodel fully-qualified type name for this declaration.
     * @deprecated replaced by getMetaType
     * @return {string} the metamodel fully-qualified type name for this type.
     */
    getType() {
        return this.getMetaType();
    }

    /**
     * Returns the metamodel fully-qualified type name for this declaration.
     *
     * @return {string} the metamodel fully-qualified type name for this type.
     */
    getMetaType() {
        return this.type;
    }

    /**
     * Returns the name of a mode element
     * @return {string|null} the name of this model element or null
     */
    getName() {
        return this.name;
    }

    /**
     * Returns the fully qualified name of this model element.
     * The name will include the namespace if present.
     *
     * @return {string|null} the fully-qualified name of this model element
     */
    getFullyQualifiedName() {
        return this.fqn;
    }

    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    accept(visitor, parameters) {
        return visitor.visit(this, parameters);
    }

    /**
     * Returns true if this class is the definition of an enum.
     * @return {boolean} true if the class is an enum
     */
    isEnum() {
        return this.type === `${MetaModelNamespace}.EnumDeclaration`;
    }

    /**
     * Returns true if this model element is the definition of a class declaration.
     * @deprecated replaced by isDeclaration
     * @return {boolean} true if the class is a class
     */
    isClassDeclaration() {
        return this.isDeclaration();
    }

    /**
     * Returns true if this model element is the definition of a class declaration,
     * one of: concept, enum, asset, participant, event, transaction, scalar.
     * @return {boolean} true if this is an instance of a declaration
     */
    isDeclaration() {
        return this.declarationKind().endsWith('Declaration');
    }

    /**
     * Returns the short name of the metamodel type for the model element
     *
     * @return {string} what kind of model element this is
     */
    declarationKind() {
        return ModelUtil.getShortName(this.type);
    }

    /**
     * Returns true if this model element is the definition of a scalar declaration.
     * @deprecated replaced by isScalar
     * @return {boolean} true if the class is a scalar
     */
    isScalarDeclaration() {
        return this.isScalar();
    }

    /**
     * Returns true if this model element is the definition of a scalar declaration.
     *
     * @return {boolean} true if the model element is a scalar
     */
    isScalar() {
        return this.declarationKind().endsWith('Scalar');
    }

    /**
     * Returns true if this model element is the definition of an asset.
     *
     * @return {boolean} true if the model element is an asset
     */
    isAsset() {
        return this.type === `${MetaModelNamespace}.AssetDeclaration`;
    }

    /**
     * Returns true if this model element is the definition of a participant.
     *
     * @return {boolean} true if the model element is an asset
     */
    isParticipant() {
        return this.type === `${MetaModelNamespace}.ParticipantDeclaration`;
    }

    /**
     * Returns true if this model element is the definition of a transaction.
     *
     * @return {boolean} true if the model element is an asset
     */
    isTransaction() {
        return this.type === `${MetaModelNamespace}.TransactionDeclaration`;
    }

    /**
     * Returns true if this model element  is the definition of an event.
     *
     * @return {boolean} true if the model element is an asset
     */
    isEvent() {
        return this.type === `${MetaModelNamespace}.EventDeclaration`;
    }

    /**
     * Returns true if this model element  is the definition of a concept.
     * @return {boolean} true if the model element  is an concept
     */
    isConcept() {
        return this.type === `${MetaModelNamespace}.ConceptDeclaration`;
    }

    /**
     * Returns true if this model element  is the definition of a map.
     * @deprecated replaced by isMap
     * @return {boolean} true if the model element  is a map
     */
    isMapDeclaration() {
        return this.isMap();
    }

    /**
     * Returns true if this model element  is the definition of a map.
     *
     * @return {boolean} true if the model element  is a map
     */
    isMap() {
        return this.type === `${MetaModelNamespace}.MapDeclaration`;
    }

    /**
     * Returns true if this model element  is the definition of a property.
     *
     * @return {boolean} true if the model element  is a property
     */
    isProperty() {
        return this.declarationKind().endsWith('Property');
    }

    /**
     * Returns true if this model element  is the definition of a relationship property.
     *
     * @return {boolean} true if the model element  is a relationship property
     */
    isRelationship() {
        return this.declarationKind() === 'RelationshipProperty';
    }

    /**
     * Returns true if this model element  is the definition of a field. A field
     * is a property that is not a relationship.
     *
     * @return {boolean} true if the model element  is a field
     */
    isField() {
        return this.isProperty() && !this.isRelationship();
    }

    /**
     * Returns true if this model element is the definition of an enum value.
     *
     * @return {boolean} true if the model element  is an enum value
     */
    isEnumValue() {
        return this.declarationKind() === 'EnumProperty';
    }

    /**
     * Returns true if this model element is the definition of a decorator.
     *
     * @return {boolean} true if the class is a decorator
     */
    isDecorator() {
        return this.declarationKind() === 'Decorator';
    }
}

module.exports = ModelElement;
