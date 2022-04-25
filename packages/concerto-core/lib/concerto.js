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

const URIJS = require('urijs');
const RESOURCE_SCHEME = 'resource';
const { TypedStack } = require('@accordproject/concerto-util');
const ObjectValidator = require('./serializer/objectvalidator');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const ModelManager = require('./modelmanager');
}
/* eslint-enable no-unused-vars */

/**
 * Runtime API for Concerto.
 *
 * @class
 * @memberof module:concerto-core
 */
class Concerto {
    /**
     * Create a Concerto instance.
     * @param {ModelManager} modelManager - The this.modelManager to use for validation etc.
     */
    constructor(modelManager) {
        this.modelManager = modelManager;
    }

    /**
     * Validates the instance against its model.
     * @param {*} obj the input object
     * @param {*} [options] the validation options
     * @throws {Error} - if the instance if invalid with respect to the model
     */
    validate(obj, options) {
        const classDeclaration = this.getTypeDeclaration(obj);
        const parameters = {};
        parameters.stack = new TypedStack(obj);
        const objectValidator = new ObjectValidator(this, options);
        classDeclaration.accept(objectValidator, parameters);
    }

    /**
     * Returns the model manager
     * @returns {ModelManager} the model manager associated with this Concerto class
     */
    getModelManager() {
        return this.modelManager;
    }

    /**
     * Returns true if the input object is a Concerto object
     * @param {*} obj the input object
     * @return {boolean} true if the object has a $class attribute
     */
    isObject(obj) {
        return typeof obj === 'object' && obj.$class;
    }

    /**
     * Returns the ClassDeclaration for an object, or throws an exception
     * @param {*} obj the input object
     * @throw {Error} an error if the object does not have a $class attribute
     * @return {*} the ClassDeclaration for the type
     */
    getTypeDeclaration(obj) {
        if (!obj.$class) {
            throw new Error('Input object does not have a $class attribute.');
        }

        const typeDeclaration = this.modelManager.getType(obj.$class);

        if (!typeDeclaration) {
            throw new Error(`Type ${obj.$class} is not declared in the model manager`);
        }

        return typeDeclaration;
    }

    /**
     * Gets the identifier for an object
     * @param {*} obj the input object
     * @return {string} The identifier for this object
     */
    getIdentifier(obj) {
        const typeDeclaration = this.getTypeDeclaration(obj);
        const idField = typeDeclaration.getIdentifierFieldName();
        if (!idField) {
            throw new Error(`Object does not have an identifier: ${JSON.stringify(obj)}`);
        }
        return obj[idField];
    }

    /**
     * Returns true if the object has an identifier
     * @param {*} obj the input object
     * @return {boolean} is the object has been defined with an identifier in the model
     */
    isIdentifiable(obj) {
        const typeDeclaration = this.getTypeDeclaration(obj);
        return !typeDeclaration.isSystemIdentified() && typeDeclaration.getIdentifierFieldName() !== null;
    }

    /**
     * Returns true if the object is a relationship. Relationships are strings
     * of the form: 'resource:org.accordproject.Order#001' (a relationship)
     * to the 'Order' identifiable, with the id 001.
     * @param {*} obj the input object
     * @return {boolean} true if the object is a relationship
     */
    isRelationship(obj) {
        return typeof obj === 'string' && obj.startsWith(`${RESOURCE_SCHEME}:`);
    }

    /**
     * Set the identifier for an object. This method does *not* mutate the
     * input object, use the return object.
     * @param {*} obj the input object
     * @param {string} id the new identifier
     * @returns {*} the input object with the identifier set
     */
    setIdentifier(obj, id) {
        const typeDeclaration = this.getTypeDeclaration(obj);
        const idField = typeDeclaration.getIdentifierFieldName();
        const clone = JSON.parse(JSON.stringify(obj));
        clone[idField] = id;
        return clone;
    }

    /**
     * Returns the fully qualified identifier for an object
     * @param {*} obj the input object
     * @returns {string} the fully qualified identifier
     */
    getFullyQualifiedIdentifier(obj) {
        this.getTypeDeclaration(obj);
        return `${obj.$class}#${this.getIdentifier(obj)}`;
    }

    /**
     * Returns a URI for an object
     * @param {*} obj the input object
     * @return {string} the URI for the object
     */
    toURI(obj) {
        this.getTypeDeclaration(obj);
        return `${RESOURCE_SCHEME}:${obj.$class}#${encodeURI(this.getIdentifier(obj))}`;
    }

    /**
     * Parses a resource URI into typeDeclaration and id components.
     *
     * @param {string} uri the input URI
     * @returns {*} an object with typeDeclaration and id attributes
     * @throws {Error} if the URI is invalid or the type does not exist
     * in the model manager
     */
    fromURI(uri) {
        let uriComponents;
        try {
            uriComponents = URIJS.parse(uri);
        } catch (err) {
            throw new Error('Invalid URI: ' + uri);
        }

        const scheme = uriComponents.protocol;
        if (scheme && scheme !== RESOURCE_SCHEME) {
            throw new Error('Invalid URI scheme: ' + uri);
        }
        if (uriComponents.username || uriComponents.password || uriComponents.port || uriComponents.query) {
            throw new Error('Invalid resource URI format: ' + uri);
        }

        return {
            typeDeclaration: this.getTypeDeclaration({
                $class: uriComponents.path
            }),
            id: decodeURIComponent(uriComponents.fragment)
        };
    }

    /**
     * Returns the short type name
     * @param {*} obj the input object
     * @returns {string} the short type name
     */
    getType(obj) {
        return this.getTypeDeclaration(obj).getName();
    }

    /**
     * Returns the namespace for the object
     * @param {*} obj the input object
     * @returns {string} the namespace
     */
    getNamespace(obj) {
        return this.getTypeDeclaration(obj).getNamespace();
    }
}

module.exports = Concerto;
