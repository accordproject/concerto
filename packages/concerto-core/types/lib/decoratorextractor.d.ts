export = DecoratorExtractor;
/**
 * Utility functions to work with
 * [DecoratorCommandSet](https://models.accordproject.org/concerto/decorators.cto)
 * @memberof module:concerto-core
 */
declare class DecoratorExtractor {
    /**
     * Create the DecoratorExtractor.
     * @constructor
     * @param {boolean} removeDecoratorsFromModel - flag to determine whether to remove decorators from source model
     * @param {string} locale - locale for extracted vocabularies
     * @param {string} dcs_version - version string
     * @param {Object} sourceModelAst - the ast of source models
     */
    constructor(removeDecoratorsFromModel: boolean, locale: string, dcs_version: string, sourceModelAst: any);
    extractionDictionary: {};
    removeDecoratorsFromModel: boolean;
    locale: string;
    dcs_version: string;
    sourceModelAst: any;
    updatedModelAst: any;
    /**
    * Adds a key-value pair to a dictionary (object) if the key exists,
    * or creates a new key with the provided value.
    *
    * @param {string} key - The key to add or update.
    * @param {any} value - The value to add or update.
    * @param {Object} options - options containing target
    * @param {string} options.declaration - Target declaration
    * @param {string} options.property - Target property
    * @param {string} options.mapElement - Target map element
    * @private
    */
    private constructDCSDictionary;
    /**
     * Transforms the collected decorators into proper decorator command sets
     * @param {Array<Object>} dcsObjects - the collection of collected decorators
     * @param {string} namespace - the current namespace
     * @param {Array<Object>} decoratorData - the collection of existing decorator command sets
     * @returns {Array<Object>} - the collection of decorator command sets
     * @private
     */
    private transformNonVocabularyDecorators;
    /**
     * Transforms the collected vocabularies into proper vocabulary command sets
     * @param {Array<Object>} vocabObject - the collection of collected vocabularies
     * @param {string} namespace - the current namespace
     * @param {Array<Object>} vocabData - the collection of existing vocabularies command sets
     * @returns {Array<Object>} - the collection of vocabularies command sets
     * @private
     */
    private transformVocabularyDecorators;
    /**
     * Constructs Target object for a given model
     * @param {string} namespace - the current namespace
     * @param {Object} obj - the ast of the model
     * @returns {Object} - the target object
     * @private
     */
    private constructTarget;
    /**
     * Parses the dict data into an array of decorator jsons
     * @param {Array<Object>} dcsObjects - the array of collected dcs objects
     * @param {Object} dcs - the current dcs json to be parsed
     * @param {String} DCS_VERSION - the version string
     * @param {Object} target - target object for the command
     * @returns {Array<Object>} - the array of collected dcs objects with the current dcs
     * @private
     */
    private parseNonVocabularyDecorators;
    /**
     * @param {Object} dictVoc - the collection of collected vocabularies
     * @param {Object} decl - the declaration object
     * @param {Object} dcs - the current dcs json to be parsed
     * @returns {Object} - the collection of collected vocabularies with current dcs
     * @private
     */
    private parseVocabularies;
    /**
    * parses the extracted decorators and generates arrays of decorator command set and vocabularies
    *
    * @returns {Object} - constructed DCS Dict and processed models ast
    * @private
    */
    private transformDecoratorsAndVocabularies;
    /**
    * Process the map declarations to extract the decorators.
    *
    * @param {Object} declaration - The source AST of the model
    * @param {string} namespace - namespace of the model
    * @returns {Object} - processed map declarations ast
    * @private
    */
    private processMapDeclaration;
    /**
    * Process the properties to extract the decorators.
    *
    * @param {Object} sourceProperties - The source AST of the property
    * @param {string} declarationName - The name of source declaration
    * @param {string} namespace - namespace of the model
    * @returns {Object} - processed properties ast
    * @private
    */
    private processProperties;
    /**
    * Process the declarations to extract the decorators.
    *
    * @param {Object} sourceDecl - The source AST of the model
    * @param {string} namespace - namespace of the model
    * @returns {Object} - processed declarations ast
    * @private
    */
    private processDeclarations;
    /**
    * Process the models to extract the decorators.
    *
    * @private
    */
    private processModels;
    /**
    * Collects the decorators and vocabularies and updates the modelManager depending
    * on the options.
    *
    * @returns {Object} - constructed DCS Dict and processed models ast
    * @private
    */
    private extract;
}
