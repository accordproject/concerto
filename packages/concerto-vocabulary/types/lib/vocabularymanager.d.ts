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
     * Computes a term in English based on declaration and property name.
     * @param {string} namespace the namespace
     * @param {string} locale the BCP-47 locale identifier
     * @param {string} declarationName the name of a concept or enum
     * @param {string} [propertyName] the name of a property (optional)
     * @returns {string} the term or null if it does not exist
     */
    static englishMissingTermGenerator(namespace: string, locale: string, declarationName: string, propertyName?: string): string;
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
    /**
     * Create the VocabularyManager
     * @param {*} [options] options to configure vocabulary lookup
     * @param {*} [options.missingTermGenerator] A function to call for missing terms. The function
     * should accept namespace, locale, declarationName, propertyName as arguments
     * @constructor
     */
    constructor(options?: any);
    vocabularies: {};
    missingTermGenerator: any;
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
     * @returns {Vocabulary} the vocabulary the was added
     */
    addVocabulary(contents: string): Vocabulary;
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
     * Resolve the term for a property, looking up terms from a more general vocabulary
     * if required, and resolving properties using an object manager, allowing terms defined
     * on super types to be automatically resolved.
     * @param {ModelManager} modelManager the model manager
     * @param {string} namespace the namespace
     * @param {string} locale the BCP-47 locale identifier
     * @param {string} declarationName the name of a concept or enum
     * @param {string} [propertyName] the name of a property (optional)
     * @param {string} [identifier] the identifier of the term (optional)
     * @returns {string} the term or null if it does not exist
     */
    resolveTerm(modelManager: ModelManager, namespace: string, locale: string, declarationName: string, propertyName?: string, identifier?: string): string;
    /**
     * Resolve the terms for a property, looking up terms from a more general vocabulary
     * if required, and resolving properties using an object manager, allowing terms defined
     * on super types to be automatically resolved.
     * @param {ModelManager} modelManager the model manager
     * @param {string} namespace the namespace
     * @param {string} locale the BCP-47 locale identifier
     * @param {string} declarationName the name of a concept or enum
     * @param {string} [propertyName] the name of a property (optional)
     * @returns {*} the terms or null if it does not exist
     */
    resolveTerms(modelManager: ModelManager, namespace: string, locale: string, declarationName: string, propertyName?: string): any;
    /**
     * Gets the term for a concept, enum or property, looking up terms
     * from a more general vocabulary if required
     * @param {string} namespace the namespace
     * @param {string} locale the BCP-47 locale identifier
     * @param {string} declarationName the name of a concept or enum
     * @param {string} [propertyName] the name of a property (optional)
     * @param {string} [identifier] the identifier of the term (optional)
     * @returns {string} the term or null if it does not exist
     */
    getTerm(namespace: string, locale: string, declarationName: string, propertyName?: string, identifier?: string): string;
    /**
     * Gets the term for a concept, enum or property, looking up terms
     * from a more general vocabulary if required
     * @param {string} namespace the namespace
     * @param {string} locale the BCP-47 locale identifier
     * @param {string} declarationName the name of a concept or enum
     * @param {string} [propertyName] the name of a property (optional)
     * @returns {*} the terms or null if it does not exist
     */
    getTerms(namespace: string, locale: string, declarationName: string, propertyName?: string): any;
    /**
     * Creates a DecoractorCommandSet with @Term decorators
     * to decorate all model elements based on the vocabulary for a locale.
     * Pass the return value to the DecoratorManager.decorateModel to apply
     * the decorators to a ModelManager.
     * @param {ModelManager} modelManager - the Model Manager
     * @param {string} locale the BCP-47 locale identifier
     * @returns {*} the decorator command set used to decorate the model.
     */
    generateDecoratorCommands(modelManager: ModelManager, locale: string): any;
    /**
     * Validates the terms in the vocabulary against the namespaces and declarations
     * within a ModelManager
     * @param {ModelManager} modelManager - the Model Manager
     * @param {string} locale the BCP-47 locale identifier
     * @returns {*} the result of validation
     */
    validate(modelManager: ModelManager): any;
}
import Vocabulary = require("./vocabulary");
import { ModelManager } from "@accordproject/concerto-core";
