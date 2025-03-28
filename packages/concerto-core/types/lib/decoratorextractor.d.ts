export = DecoratorExtractor;
/**
 * Utility functions to work with
 * [DecoratorCommandSet](https://models.accordproject.org/concerto/decorators.cto)
 * @memberof module:concerto-core
 * @private
 */
declare class DecoratorExtractor {
    /**
     * The action to be performed to extract all, only vocab or only non-vocab decorators
     */
    static Action: {
        EXTRACT_ALL: number;
        EXTRACT_VOCAB: number;
        EXTRACT_NON_VOCAB: number;
    };
    /**
     * Create the DecoratorExtractor.
     * @constructor
     * @param {boolean} removeDecoratorsFromModel - flag to determine whether to remove decorators from source model
     * @param {string} locale - locale for extracted vocabularies
     * @param {string} dcs_version - version string
     * @param {Object} sourceModelAst - the ast of source models
     * @param {int} [action=DecoratorExtractor.Action.EXTRACT_ALL]  - the action to be performed
     * @param {boolean} enableDcsNamespaceTarget - flag to control applying namespace targeted decorators on top of the namespace instead of all declarations in that namespace
     */
    constructor(removeDecoratorsFromModel: boolean, locale: string, dcs_version: string, sourceModelAst: any, action?: int, enableDcsNamespaceTarget: boolean);
    extractionDictionary: {};
    removeDecoratorsFromModel: boolean;
    locale: string;
    enableDcsNamespaceTarget: boolean;
    dcs_version: string;
    sourceModelAst: any;
    updatedModelAst: any;
    action: any;
    /**
     * Returns if the decorator is vocab or not
     * @param {string} decoractorName - the name of decorator
     * @returns {boolean} - returns true if the decorator is a vocabulary decorator else false
     * @private
     */
    private isVocabDecorator;
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
     * Transforms the collected vocabularies into proper vocabulary command sets
     * @param {Array<Object>} vocabObject - the collection of collected vocabularies
     * @param {string} namespace - the current namespace
     * @param {Array<Object>} vocabData - the collection of existing vocabularies command sets
     * @returns {Array<Object>} - the collection of vocabularies command sets
     * @private
     */
    private transformVocabularyDecoratorsV2;
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
     * @param {Object} vocabObject - the collection of collected vocabularies
     * @param {Object} vocabTarget - the declaration object
     * @param {Object} dcs - the current dcs json to be parsed
     * @returns {Object} - the collection of collected vocabularies with current dcs
     * @private
     */
    private parseVocabulariesV2;
    /**
    * parses the extracted decorators and generates arrays of decorator command set and vocabularies
    *
    * @returns {Object} - constructed DCS Dict and processed models ast
    * @private
    */
    private transformDecoratorsAndVocabularies;
    /**
     * Filter vocab or non-vocab decorators
     * @param {Object} decorators - the collection of decorators
     * @returns {Object} - the collection of filtered decorators
     * @private
     */
    private filterOutDecorators;
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
