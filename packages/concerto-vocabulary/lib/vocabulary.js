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

const { DecoratorManager } = require('@accordproject/concerto-core');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const VocabularyManager = require('./vocabularymanager');
    const { ModelFile } = require('@accordproject/concerto-core');
}
/* eslint-enable no-unused-vars */

/**
* A vocabulary for a concerto model
* @class
* @memberof module:concerto-vocabulary
*/
class Vocabulary {
    /**
     * Create the Vocabulary
     * @constructor
     * @param {VocabularyManager} vocabularyManager - the manager for this vocabulary
     * @param {object} voc - the JSON representation of the vocabulary
     */
    constructor(vocabularyManager, voc) {
        if(!vocabularyManager) {
            throw new Error('VocabularyManager must be specified');
        }
        if(!voc) {
            throw new Error('Vocabulary object must be specified');
        }

        if(!voc.declarations) {
            throw new Error('Vocabulary object must have declarations');
        }

        if(!voc.namespace) {
            throw new Error('A vocabulary must specify a namespace');
        }

        if(!voc.locale) {
            throw new Error('A vocabulary must specify a locale');
        }

        Vocabulary.validateLocale(voc.locale);

        this.vocabularyManager = vocabularyManager;
        this.content = voc;
    }

    /**
     * Returns the namespace for the vocabulary
     * @returns {string} the namespace for this vocabulary
     */
    getNamespace() {
        return this.content.namespace;
    }

    /**
     * Validates a locale
     * @param {string} locale the locale to validate
     * @throws {Error} if the locale is invalid
     */
    static validateLocale(locale) {
        new Intl.Locale(locale);
        if(locale !== locale.toLowerCase()) {
            throw new Error('Locale should be lowercase with dashes');
        }
    }

    /**
     * Returns the locale for the vocabulary
     * @returns {string} the locale for this vocabulary
     */
    getLocale() {
        return this.content.locale;
    }

    /**
     * Returns the identifier for the vocabulary, composed of the namespace plus the locale
     * @returns {string} the identifier for this vocabulary
     */
    getIdentifier() {
        return `${this.getNamespace()}/${this.content.locale}`;
    }

    /**
     * Returns all the declarations for this vocabulary
     * @returns {Array} an array of objects
     */
    getTerms() {
        return this.content.declarations;
    }

    /**
     * Gets the term for a concept, enum or property
     * @param {string} declarationName the name of a concept or enum
     * @param {string} [propertyName] the name of a property (optional)
     * @param {string} [identifier] the identifier of the term (optional)
     * @returns {string} the term or null if it does not exist
     */
    getTerm(declarationName, propertyName, identifier) {
        if(!declarationName){
            const namespaceTerms = Object.entries(this.content).filter(([key]) => key !== 'namespace' && key !== 'locale' && key !== 'declarations');
            return namespaceTerms.length > 0 ? identifier ? Object.fromEntries(namespaceTerms)[identifier]:Object.fromEntries(namespaceTerms).term : null;
        }
        const decl = this.content.declarations.find(d => Object.keys(d)[0] === declarationName);
        if(!decl) {
            return null;
        }
        if(!propertyName) {
            return identifier ? decl[identifier] : decl[declarationName];
        }
        else {
            const property = decl.properties ? decl.properties.find(d => d[propertyName]) : null;
            return property ? identifier ? property[identifier] : property[propertyName] : null;
        }
    }

    /**
     * Gets the terms for a concept, enum or property
     * @param {string} declarationName the name of a concept or enum
     * @param {string} [propertyName] the name of a property (optional)
     * @returns {string} the term or null if it does not exist
     */
    getElementTerms(declarationName, propertyName) {
        if(!declarationName){
            const namespaceTerms = Object.entries(this.content).filter(([key]) => key !== 'namespace' && key !== 'locale' && key !== 'declarations');
            return namespaceTerms.length > 0 ? Object.fromEntries(namespaceTerms) : null;
        }
        const decl = this.content.declarations.find(d => Object.keys(d)[0] === declarationName);
        if(!decl) {
            return null;
        }
        if(!propertyName) {
            return decl;
        }
        else {
            const property = decl.properties ? decl.properties.find(d => d[propertyName]) : null;
            return property;
        }
    }

    /**
     * Validates a vocabulary against a ModelFile, returning errors for
     * missing and additional terms.
     * @param {ModelFile} modelFile the model file for this vocabulary
     * @returns {*} an object with missingTerms and additionalTerms properties
     */
    validate(modelFile) {
        const getOwnProperties = (declaration) => {
            // ensures we have a valid return, even for scalars and map-declarations
            if(declaration.isMapDeclaration()) {
                return [declaration.getKey(), declaration.getValue()];
            } else {
                return declaration.getOwnProperties?.() ? declaration.getOwnProperties?.() : [];
            }
        };

        const getPropertyName = (property) => {
            if(property.isKey?.()) {
                return 'KEY';
            } else if(property.isValue?.()) {
                return 'VALUE';
            } else {
                return property.getName();
            }
        };

        const checkPropertyExists = (k, p) => {
            const declaration = modelFile.getLocalType(Object.keys(k)[0]);
            const property = Object.keys(p)[0];
            if(declaration.isMapDeclaration()) {
                if (property === 'KEY') {
                    return true;
                } else if(property === 'VALUE') {
                    return true;
                } else {
                    return false;
                }
            } else {
                return declaration.getOwnProperty(Object.keys(p)[0]);
            }
        };

        const result = {
            missingTerms: modelFile.getAllDeclarations().flatMap( d => this.getTerm(d.getName())
                ? getOwnProperties(d).flatMap( p => this.getTerm(d.getName(), getPropertyName(p)) ? null : `${d.getName()}.${getPropertyName(p)}`)
                : d.getName() ).filter( i => i !== null),
            additionalTerms: this.content.declarations.flatMap( k => modelFile.getLocalType(Object.keys(k)[0])
                ? Array.isArray(k.properties) ? k.properties.flatMap( p => checkPropertyExists(k, p) ? null : `${Object.keys(k)[0]}.${Object.keys(p)[0]}`) : null
                : k ).filter( i => i !== null)
        };

        if(DecoratorManager.isNamespaceTargetEnabled() && !this.content.term){
            result.missingTerms.push('namespace');
        }

        return result;
    }

    /**
     * Converts the object to JSON
     * @returns {*} the contens of this vocabulary
     */
    toJSON() {
        return this.content;
    }
}

module.exports = Vocabulary;
