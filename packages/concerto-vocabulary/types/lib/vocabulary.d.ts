export = Vocabulary;
/**
* A vocabulary for a concerto model
* @class
* @memberof module:concerto-vocabulary
*/
declare class Vocabulary {
    /**
     * Validates a locale
     * @param {string} locale the locale to validate
     * @throws {Error} if the locale is invalid
     */
    static validateLocale(locale: string): void;
    /**
     * Create the Vocabulary
     * @constructor
     * @param {VocabularyManager} vocabularyManager - the manager for this vocabulary
     * @param {object} voc - the JSON representation of the vocabulary
     */
    constructor(vocabularyManager: VocabularyManager, voc: object);
    vocabularyManager: VocabularyManager;
    content: any;
    /**
     * Returns the namespace for the vocabulary
     * @returns {string} the namespace for this vocabulary
     */
    getNamespace(): string;
    /**
     * Returns the locale for the vocabulary
     * @returns {string} the locale for this vocabulary
     */
    getLocale(): string;
    /**
     * Returns the identifier for the vocabulary, composed of the namespace plus the locale
     * @returns {string} the identifier for this vocabulary
     */
    getIdentifier(): string;
    /**
     * Returns all the declarations for this vocabulary
     * @returns {Array} an array of objects
     */
    getTerms(): any[];
    /**
     * Gets the term for a concept, enum or property
     * @param {string} declarationName the name of a concept or enum
     * @param {string} [propertyName] the name of a property (optional)
     * @param {string} [identifier] the identifier of the term (optional)
     * @returns {string} the term or null if it does not exist
     */
    getTerm(declarationName: string, propertyName?: string, identifier?: string): string;
    /**
     * Gets the terms for a concept, enum or property
     * @param {string} declarationName the name of a concept or enum
     * @param {string} [propertyName] the name of a property (optional)
     * @returns {string} the term or null if it does not exist
     */
    getElementTerms(declarationName: string, propertyName?: string): string;
    /**
     * Validates a vocabulary against a ModelFile, returning errors for
     * missing and additional terms.
     * @param {ModelFile} modelFile the model file for this vocabulary
     * @returns {*} an object with missingTerms and additionalTerms properties
     */
    validate(modelFile: ModelFile): any;
    /**
     * Converts the object to JSON
     * @returns {*} the contens of this vocabulary
     */
    toJSON(): any;
}
import VocabularyManager = require("./vocabularymanager");
import { ModelFile } from "@accordproject/concerto-core";
