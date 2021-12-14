export = Vocabulary;
/**
* A vocabulary for a concerto model
* @class
* @memberof module:concerto-vocabulary
*/
declare class Vocabulary {
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
     * Gets the term for a concept, enum or property
     * @param {string} declarationName the name of a concept or enum
     * @param {string} [propertyName] the name of a property (optional)
     * @returns {string} the term or null if it does not exist
     */
    getTerm(declarationName: string, propertyName?: string): string;
    /**
     * Converts the object to JSON
     * @returns {*} the contens of this vocabulary
     */
    toJSON(): any;
}
