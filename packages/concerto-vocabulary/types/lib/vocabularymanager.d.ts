export = VocabularyManager;
/**
* A vocabulary manager for concerto models
* @class
* @memberof module:concerto-vocabulary
*/
declare class VocabularyManager {
    vocabularies: {};
    /**
     * Adds a vocabulary to the vocabulary manager
     * @param {string} contents the YAML string for the vocabulary
     */
    addVocabulary(contents: string): void;
    /**
     * Gets a vocabulary for a given namespace plus locale
     * @param {string} namespace the namespace for the vocabulary
     * @param {string} locale the locale identifier, as defined via Intl.Locale
     * @returns {Vocabulary} the vocabulary or null if no vocabulary exists for the locale
     */
    getVocabulary(namespace: string, locale: string): Vocabulary;
    /**
     * Gets all the vocabulary files for a given namespace
     * @param {string} namespace the namespace
     * @returns {Vocabulary[]} the array of vocabularies
     */
    getVocabulariesForNamespace(namespace: string): Vocabulary[];
    /**
     * Gets all the vocabulary files for a given locale
     * @param {string} locale the locale
     * @returns {Vocabulary[]} the array of vocabularies
     */
    getVocabulariesForLocale(locale: string): Vocabulary[];
    /**
     * Validates the terms in the vocabulary against the namespaces and declarations
     * within a ModelManager
     * @param {ModelManager} modelManager - the Model Manager
     * @returns {*} the result of validation
     */
    validate(modelManager: ModelManager): any;
}
import Vocabulary = require("./vocabulary");
