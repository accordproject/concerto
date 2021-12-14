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

        if(!voc.locale) {
            throw new Error('A vocabulary must specify a locale');
        }
        if(!voc.namespace) {
            throw new Error('A vocabulary must specify a namespace');
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
     * Gets the term for a concept, enum or property
     * @param {string} declarationName the name of a concept or enum
     * @param {string} [propertyName] the name of a property (optional)
     * @returns {string} the term or null if it does not exist
     */
    getTerm(declarationName, propertyName) {
        const decl = this.content.declarations.find( d => d[declarationName] !== null);
        if(!decl) {
            return null;
        }
        if(!propertyName) {
            return decl[declarationName];
        }
        else {
            const property = decl.properties.find( d => d[propertyName] !== null);
            return property ? property[propertyName] : null;
        }
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
