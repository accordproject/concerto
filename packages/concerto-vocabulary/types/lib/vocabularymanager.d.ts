export = VocabularyManager;
/**
* A vocabulary manager for concerto models
* @class
* @memberof module:concerto-vocabulary
*/
declare class VocabularyManager {
    /**
     * Create the BaseException.
     * @constructor
     * @param {ModelManager} modelManager - the Model Manager
     */
    constructor(modelManager: ModelManager);
    modelManager: ModelManager;
}
