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
const { MetaModelUtil } = require('@accordproject/concerto-metamodel');
const semver = require('semver');
const Globalize = require('./globalize');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const ModelFile = require('../lib/introspect/modelfile');
}

const ID_REGEX = /^(\p{Lu}|\p{Ll}|\p{Lt}|\p{Lm}|\p{Lo}|\p{Nl}|\$|_|\\u[0-9A-Fa-f]{4})(?:\p{Lu}|\p{Ll}|\p{Lt}|\p{Lm}|\p{Lo}|\p{Nl}|\$|_|\\u[0-9A-Fa-f]{4}|\p{Mn}|\p{Mc}|\p{Nd}|\p{Pc}|\u200C|\u200D)*$/u;

const privateReservedProperties = [
    // Internal use only
    '$classDeclaration',    // Used to cache a reference to theClass Declaration instance
    '$namespace',           // Used to cache the namespace for a type
    '$type',                // Used to cache the type for a type
    '$modelManager',        // Used to cache a reference to the ModelManager instance
    '$validator',           // Used to cache a reference to the ResourceValidator instance
    '$identifierFieldName', // Used for caching the identifier field name

    '$imports',             // Reserved for future use
    '$superTypes',          // Reserved for future use

    // Included in serialization
    '$id',                  // Used for URI identifier
];

const assignableReservedProperties = [
    // Included in serialization
    '$identifier',          // Used for shadowing the identifier field, or where a system identifier is required
    '$timestamp'            // Used in Event and Transaction prototype classes
];

const reservedProperties = [
    // Included in serialization
    '$class',               // Used for discriminating between instances of different classes

    ...assignableReservedProperties,
    ...privateReservedProperties
];

/**
 * Internal Model Utility Class
 * <p><a href="./diagrams-private/modelutil.svg"><img src="./diagrams-private/modelutil.svg" style="height:100%;"/></a></p>
 * @private
 * @class
 * @memberof module:concerto-core
 */
class ModelUtil {
    /**
     * Returns everything after the last dot, if present, of the source string
     * @param {string} fqn - the source string
     * @return {string} - the string after the last dot
     */
    static getShortName(fqn) {
        let result = fqn;
        let dotIndex = fqn.lastIndexOf('.');
        if (dotIndex > -1) {
            result = fqn.substr(dotIndex + 1);
        }

        return result;
    }

    /**
     * Returns the namespace for the fully qualified name of a type
     * @param {string} fqn - the fully qualified identifier of a type
     * @return {string} - namespace of the type (everything before the last dot)
     * or the empty string if there is no dot
     */
    static getNamespace(fqn) {
        if (!fqn) {
            throw new Error(Globalize.formatMessage('modelutil-getnamespace-nofnq'));
        }

        let result = '';
        let dotIndex = fqn.lastIndexOf('.');
        if (dotIndex > -1) {
            result = fqn.substr(0, dotIndex);
        }

        return result;
    }

    /**
     * @typedef ParseNamespaceResult
     * @property {string} name the name of the namespace
     * @property {string} escapedNamespace the escaped namespace
     * @property {string} version the version of the namespace
     * @property {object} versionParsed the parsed semantic version of the namespace
     */

    /**
     * Parses a potentially versioned namespace into
     * its name and version parts. The version of the namespace
     * (if present) is parsed using semver.parse.
     * @param {string} ns the namespace to parse
     * @param {object} options optional parsing options
     * @param {boolean} options.disableVersionValidation if false, the version will be validated
     * @returns {ParseNamespaceResult} the result of parsing
     */
    static parseNamespace(ns, options) {
        if(!ns) {
            throw new Error('Namespace is null or undefined.');
        }

        const parts = ns.split('@');
        let version = parts[1];
        if(parts.length > 2) {
            throw new Error(`Invalid namespace ${ns}`);
        }

        if(parts.length === 2 && !options?.disableVersionValidation) {
            // Validate the version using semver
            if(!semver.valid(parts[1])) {
                throw new Error(`Invalid namespace ${ns}`);
            }
            version = semver.parse(parts[1]);
        }

        return {
            name: parts[0],
            escapedNamespace: ns.replace('@', '_'),
            version: parts.length > 1 ? parts[1] : null,
            versionParsed: parts.length > 1 ? version : null
        };
    }

    /**
     * Return the fully qualified name for an import
     * @param {object} imp - the import
     * @return {string[]} - the fully qualified names for that import
     * @private
     */
    static importFullyQualifiedNames(imp) {
        return MetaModelUtil.importFullyQualifiedNames(imp);
    }

    /**
     * Returns true if the type is a primitive type
     * @param {string} typeName - the name of the type
     * @return {boolean} - true if the type is a primitive
     * @private
     */
    static isPrimitiveType(typeName) {
        const primitiveTypes = ['Boolean', 'String', 'DateTime', 'Double', 'Integer', 'Long'];
        return (primitiveTypes.indexOf(typeName) >= 0);
    }

    /**
     * Returns true if the type is assignable to the propertyType.
     *
     * @param {ModelFile} modelFile - the ModelFile that owns the Property
     * @param {string} typeName - the FQN of the type we are trying to assign
     * @param {Property} property - the property that we'd like to store the
     * type in.
     * @return {boolean} - true if the type can be assigned to the property
     * @private
     */
    static isAssignableTo(modelFile, typeName, property) {
        const propertyTypeName = property.getFullyQualifiedTypeName();

        const isDirectMatch = (typeName === propertyTypeName);
        if (isDirectMatch || ModelUtil.isPrimitiveType(typeName) || ModelUtil.isPrimitiveType(propertyTypeName)) {
            return isDirectMatch;
        }

        const typeDeclaration = modelFile.getType(typeName);
        if (!typeDeclaration) {
            throw new Error('Cannot find type ' + typeName);
        }

        return typeDeclaration.getAllSuperTypeDeclarations().
            some(type => type.getFullyQualifiedName() === propertyTypeName);
    }

    /**
     * Returns the passed string with the first character capitalized
     * @param {string} string - the string
     * @return {string} the string with the first letter capitalized
     * @private
     */
    static capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    /**
     * Returns true if the given field is an enumerated type
     * @param {Field} field - the string
     * @return {boolean} true if the field is declared as an enumeration
     * @private
     */
    static isEnum(field) {
        const modelFile = field.getParent().getModelFile();
        const typeDeclaration = modelFile.getType(field.getType());
        return typeDeclaration?.isEnum();
    }

    /**
     * Returns true if the given field is an map type
     * @param {Field} field - the string
     * @return {boolean} true if the field is declared as an map
     * @private
     */
    static isMap(field) {
        const modelFile = field.getParent().getModelFile();
        const typeDeclaration = modelFile.getType(field.getType());
        return typeDeclaration?.isMapDeclaration?.();
    }

    /**
     * Returns true if the given field is a Scalar type
     * @param {Field} field - the Field to test
     * @return {boolean} true if the field is declared as an scalar
     * @private
     */
    static isScalar(field) {
        const modelFile = field.getParent().getModelFile();
        const declaration = modelFile.getType(field.getType());
        return declaration?.isScalarDeclaration?.();
    }

    /**
     * Return true if the name is a valid Concerto identifier
     * @param {string} name - the name of the identifier to test.
     * @returns {boolean} true if the identifier is valid.
     */
    static isValidIdentifier(name) {
        return ID_REGEX.test(name);
    }

    /**
     * Get the fully qualified name of a type.
     * @param {string} namespace - namespace of the type.
     * @param {string} type - short name of the type.
     * @returns {string} the fully qualified type name.
     */
    static getFullyQualifiedName(namespace, type) {
        if (namespace) {
            return `${namespace}.${type}`;
        } else {
            return type;
        }
    }

    /**
     * Converts a fully qualified type name to a FQN without a namespace version.
     * If the FQN is a primitive type it is returned unchanged.
     * @param {string} fqn fully qualified name of a type
     * @returns {string} the fully qualified name minus the namespace version
     */
    static removeNamespaceVersionFromFullyQualifiedName(fqn) {
        if(ModelUtil.isPrimitiveType(fqn)) {
            return fqn;
        }
        const ns = ModelUtil.getNamespace(fqn);
        const { name: namespace } = ModelUtil.parseNamespace(ns);
        const typeName = ModelUtil.getShortName(fqn);
        return ModelUtil.getFullyQualifiedName(namespace, typeName);
    }

    /**
     * Returns true if the property is a system property.
     * System properties are not declared in the model.
     * @param {String} propertyName - the name of the property
     * @return {Boolean} true if the property is a system property
     * @private
     */
    static isSystemProperty(propertyName) {
        return reservedProperties.includes(propertyName);
    }

    /**
     * Returns true if the property is an system property that can be set in serialized JSON.
     * System properties are not declared in the model.
     * @param {String} propertyName - the name of the property
     * @return {Boolean} true if the property is a system property
     * @private
     */
    static isPrivateSystemProperty(propertyName) {
        return privateReservedProperties.includes(propertyName);
    }

    /**
     * Returns true if this Key is a valid Map Key.
     *
     * @param {Object} key - the Key of the Map Declaration
     * @return {boolean} true if the Key is a valid Map Key
    */
    static isValidMapKey(key) {
        return [
            `${MetaModelNamespace}.StringMapKeyType`,
            `${MetaModelNamespace}.DateTimeMapKeyType`,
            `${MetaModelNamespace}.ObjectMapKeyType`,
        ].includes(key.$class);
    }

    /**
     * Returns true if this Key is a valid Map Key Scalar Value.
     *
     * @param {Object} decl - the Map Key Scalar declaration
     * @return {boolean} true if the Key is a valid Map Key Scalar type
    */
    static isValidMapKeyScalar(decl) {
        return (decl?.isScalarDeclaration?.() && decl?.ast.$class === `${MetaModelNamespace}.StringScalar`)  ||
        (decl?.isScalarDeclaration?.() && decl?.ast.$class === `${MetaModelNamespace}.DateTimeScalar`);
    }

    /**
     * Returns true if this Value is a valid Map Value.
     *
     * @param {Object} value - the Value of the Map Declaration
     * @return {boolean} true if the Value is a valid Map Value
     */
    static isValidMapValue(value) {
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

module.exports = ModelUtil;
