export = ModelLoader;
/**
 * Create a ModelManager from model files, with an optional system model.
 *
 * If a ctoFile is not provided, the Accord Project system model is used.
 *
 * @class
 * @memberof module:concerto-core
 */
declare class ModelLoader {
    /**
     * Add model file
     *
     * @param {object} modelFileLoader - the model loader
     * @param {object} modelManager - the model manager
     * @param {string} ctoFile - the model file
     * @return {Promise<ModelManager>} the model manager
     * @private
     */
    private static addModel;
    /**
     * Load models in a new model manager
     *
     * @param {string[]} ctoFiles - the CTO files (can be local file paths or URLs)
     * @param {object} options - optional parameters
     * @param {boolean} [options.offline] - do not resolve external models
    * @param {number} [options.utcOffset] - UTC Offset for this execution
     * @return {Promise<ModelManager>} the model manager
     */
    static loadModelManager(ctoFiles: string[], options?: {
        offline?: boolean;
        utcOffset?: number;
    }): Promise<ModelManager>;
    /**
     * Load system and models in a new model manager from model files objects
     *
     * @param {object[]} modelFiles - An array of Concerto files as strings or ModelFile objects.
     * @param {string[]} [fileNames] - An optional array of file names to associate with the model files
     * @param {object} options - optional parameters
     * @param {boolean} [options.offline] - do not resolve external models
     * @param {number} [options.utcOffset] - UTC Offset for this execution
     * @return {Promise<ModelManager>} the model manager
     */
    static loadModelManagerFromModelFiles(modelFiles: object[], fileNames?: string[], options?: {
        offline?: boolean;
        utcOffset?: number;
    }): Promise<ModelManager>;
}
import ModelManager = require("./modelmanager");
