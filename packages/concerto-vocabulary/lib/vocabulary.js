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

// const {validate} = require('bcp47-validate');

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

        if(!voc.locale) {
            throw new Error('A vocabulary must specify a locale');
        }
        if(!voc.namespace) {
            throw new Error('A vocabulary must specify a namespace');
        }

        // validate the locale
        new Intl.Locale(voc.locale);
        if(voc.locale !== voc.locale.toLowerCase()) {
            throw new Error('Locale should be lowercase with dashes');
        }

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
        return `${this.getNamespace()}/${new Intl.Locale(this.content.locale).toString()}`;
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
     * @returns {string} the term or null if it does not exist
     */
    getTerm(declarationName, propertyName) {
        const decl = this.content.declarations.find(d => Object.keys(d)[0] === declarationName);
        if(!decl) {
            return null;
        }
        if(!propertyName) {
            return decl[declarationName];
        }
        else {
            const property = decl.properties ? decl.properties.find( d => d[propertyName] !== null) : null;
            return property ? property[propertyName] : null;
        }
    }

    /**
     * Validates a vocabulary against a ModelFile, returning errors for
     * missing and additional terms.
     * @param {ModelFile} modelFile the model file for this vocabulary
     * @returns {*} an object with missingTerms and additionalTerms properties
     */
    validate(modelFile) {
        const result = {
            missingTerms: modelFile.getAllDeclarations().flatMap( d => this.getTerm(d.getName())
                ? d.getOwnProperties().flatMap( p => this.getTerm(d.getName(), p.getName()) ? null : `${d.getName()}.${p.getName()}`)
                : d.getName() ).filter( i => i !== null),
            additionalTerms: this.content.declarations.flatMap( k => modelFile.getLocalType(Object.keys(k)[0])
                ? k.properties ? k.properties.flatMap( p => this.getTerm(Object.keys(k)[0], Object.keys(p)[0]) ? null : `${Object.keys(k)[0]}.${Object.keys(p)[0]}`) : null
                : Object.keys(k)[0] ).filter( i => i !== null)
        };

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
