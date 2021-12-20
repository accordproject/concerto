export = VocabularyManager;
/**
* A vocabulary manager for concerto models. The vocabulary manager
* stores and provides API access to a set of vocabulary files, where each file
* is associated with a BCP-47 language tag and a Concerto namespace.
* @see https://datatracker.ietf.org/doc/html/rfc5646#section-2
* @class
* @memberof module:concerto-vocabulary
*/
declare class VocabularyManager {
    /**
     * Finds the vocabulary for a requested locale, removing language
     * identifiers from the locale until the locale matches, or if no
     * vocabulary is found, null is returned
     * @param {string} requestedLocale the BCP-47 locale identifier
     * @param {Vocabulary[]} vocabularies the vocabularies to match against
     * @param {*} [options] options to configure vocabulary lookup
     * @param {*} [options.localeMatcher] Pass 'lookup' to find a general vocabulary, if available
     * @returns {Vocabulary} the most specific vocabulary, or null
     */
    static findVocabulary(requestedLocale: string, vocabularies: Vocabulary[], options?: any): Vocabulary;
    vocabularies: {};
    /**
     * Removes all vocabularies
     */
    clear(): void;
    /**
     * Removes a vocabulary from the vocabulary manager
     * @param {string} namespace the namespace for the vocabulary
     * @param {string} locale the BCP-47 locale identifier
     */
    removeVocabulary(namespace: string, locale: string): void;
    /**
     * Adds a vocabulary to the vocabulary manager
     * @param {string} contents the YAML string for the vocabulary
     */
    addVocabulary(contents: string): void;
    /**
     * Gets a vocabulary for a given namespace plus locale
     * @param {string} namespace the namespace for the vocabulary
     * @param {string} locale the BCP-47 locale identifier
     * @param {*} [options] options to configure vocabulary lookup
     * @param {*} [options.localeMatcher] Pass 'lookup' to find a general vocabulary, if available
     * @returns {Vocabulary} the vocabulary or null if no vocabulary exists for the locale
     */
    getVocabulary(namespace: string, locale: string, options?: any): Vocabulary;
    /**
     * Gets all the vocabulary files for a given namespace
     * @param {string} namespace the namespace
     * @returns {Vocabulary[]} the array of vocabularies
     */
    getVocabulariesForNamespace(namespace: string): Vocabulary[];
    /**
     * Gets all the vocabulary files for a given locale
     * @param {string} locale the BCP-47 locale identifier
     * @returns {Vocabulary[]} the array of vocabularies
     */
    getVocabulariesForLocale(locale: string): Vocabulary[];
    /**
     * Gets the term for a concept, enum or property, looking up terms
     * from a more general vocabulary if required
     * @param {string} namespace the namespace
     * @param {string} locale the BCP-47 locale identifier
     * @param {string} declarationName the name of a concept or enum
     * @param {string} [propertyName] the name of a property (optional)
     * @returns {string} the term or null if it does not exist
     */
    getTerm(namespace: string, locale: string, declarationName: string, propertyName?: string): string;
    /**
     * Validates the terms in the vocabulary against the namespaces and declarations
     * within a ModelManager
     * @param {ModelManager} modelManager - the Model Manager
     * @returns {*} the result of validation
     */
    validate(modelManager: ModelManager): any;
}
import Vocabulary = require("./vocabulary");
