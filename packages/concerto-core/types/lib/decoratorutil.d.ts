export = DecoratorUtil;
/**
 * Internal Decorator Utility Class
 * @private
 * @class
 * @memberof module:concerto-core
 */
declare class DecoratorUtil {
    /**
     * Parses the dict data into an array of decorator jsons
     * @param {Object} jsonData - the model ast for a particular namespace
     * @param {String} namespace - the namespace for which parsing is to be done
     * @param {String} DCS_VERSION - the version string
     * @returns {Array<Object>} - the parsed decorator command set array
     * @private
     */
    private static parseNonVocabularyDecorators;
    /**
     * @param {Object} jsonData - the model ast for a particular namespace
     * @returns {Object} - the parsed vocab set object
     * @private
     */
    private static parseVocabularies;
    /**
    * Adds a key-value pair to a dictionary (object) if the key exists,
    * or creates a new key with the provided value.
    *
    * @param {Object} dictionary - The dictionary (object) to which to add the key-value pair.
    * @param {string} key - The key to add or update.
    * @param {any} value - The value to add or update.
    * @param {Object} options - options containing target
    * @param {string} options.declaration - Target declaration
    * @param {string} options.property - Target property
    * @param {string} options.mapElement - Target map element
    * @returns {Object} - constructed DCS Dict
    * @private
    */
    private static constructDCSDictionary;
    /**
    * Adds a key-value pair to a dictionary (object) if the key exists,
    * or creates a new key with the provided value.
    *
    * @param {Object} extractionDictionary - extracted decorators and vocabularies
    * @param {String} DCS_VERSION - dcs_version
    * @param {String} locale - locale for vocabularies
    * @returns {Object} - constructed DCS Dict and processed models ast
    * @private
    */
    private static parseDecosAndVocabs;
    /**
    * Collects the decorators and vocabularies and updated the modelManager depending
    * on the options passed.
    *
    * @param {ModelManager} modelManager - Source modelManager
    * @param {boolean} removeDecoratorsFromModel - flag to remove decorators from source
    * @param {String} locale - locale for vocabularies
    * @param {String} DCS_VERSION - dcs_version
    * @returns {Object} - constructed DCS Dict and processed models ast
    * @private
    */
    private static collectExtractedDecoratorsAndProcessedModels;
}
