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

const YAML = require('yaml');

const Vocabulary = require('./vocabulary');

/**
* A vocabulary manager for concerto models
* @class
* @memberof module:concerto-vocabulary
*/
class VocabularyManager {
    /**
     * Create the VocabularyManager
     * @constructor
     */
    constructor() {
        this.vocabularies = {}; // key is locale, value is a Vocabulary object
    }

    /**
     * Adds a vocabulary to the vocabulary manager
     * @param {string} contents the YAML string for the vocabulary
     */
    addVocabulary(contents) {
        if(!contents) {
            throw new Error('Vocabulary contents must be specified');
        }
        const voc = new Vocabulary(this, YAML.parse(contents));
        this.vocabularies[voc.getIdentifier()] = voc;
    }

    /**
     * Gets a vocabulary for a given namespace plus locale
     * @param {string} namespace the namespace for the vocabulary
     * @param {string} locale the locale identifier, as defined via Intl.Locale
     * @returns {Vocabulary} the vocabulary or null if no vocabulary exists for the locale
     */
    getVocabulary(namespace, locale) {
        const loc = new Intl.Locale(locale).toString();
        return Object.values(this.vocabularies).find( v => v.getIdentifier() === `${namespace}/${loc}`);
    }

    /**
     * Gets all the vocabulary files for a given namespace
     * @param {string} namespace the namespace
     * @returns {Vocabulary[]} the array of vocabularies
     */
    getVocabulariesForNamespace(namespace) {
        return Object.values(this.vocabularies).filter( v => v.getNamespace() === namespace);
    }

    /**
     * Gets all the vocabulary files for a given locale
     * @param {string} locale the locale
     * @returns {Vocabulary[]} the array of vocabularies
     */
    getVocabulariesForLocale(locale) {
        const loc = new Intl.Locale(locale).toString();
        return Object.values(this.vocabularies).filter( v => v.getLocale() === loc);
    }

    /**
     * Validates the terms in the vocabulary against the namespaces and declarations
     * within a ModelManager
     * @param {ModelManager} modelManager - the Model Manager
     * @returns {*} the result of validation
     */
    validate(modelManager) {
        // missing vocabularies
        const missingVocabularies = modelManager.getModelFiles()
            .map( m => this.getVocabulariesForNamespace(m.getNamespace()).length === 0 ? m.getNamespace() : null)
            .filter( m => m !== null);

        // additional vocabularies
        const additionalVocabularies = Object.values(this.vocabularies)
            .filter( v => !modelManager.getModelFile(v.getNamespace()));

        const result = {
            missingVocabularies,
            additionalVocabularies,
            vocabularies: {}
        };

        // validate the models against the vocs
        Object.values(this.vocabularies)
            .forEach(voc => {
                const vocResult = {
                    locale: voc.getLocale(),
                    namespace: voc.getNamespace(),
                    missingTerms: [],
                    additionalTerms: []
                };

                const model = modelManager.getModelFile(voc.getNamespace());
                if(model) {
                    const errors = voc.validate(model);
                    if(errors.missingTerms) {
                        vocResult.missingTerms = vocResult.missingTerms.concat(errors.missingTerms);
                    }
                    if(errors.additionalTerms) {
                        vocResult.additionalTerms = vocResult.additionalTerms.concat(errors.additionalTerms);
                    }

                    result.vocabularies[`${vocResult.namespace}/${vocResult.locale}`] = vocResult;
                }
            });
        return result;
    }
}

module.exports = VocabularyManager;
