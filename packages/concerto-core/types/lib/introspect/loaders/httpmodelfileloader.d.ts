export = HTTPModelFileLoader;
/**
 * Loads ModelFiles from an HTTP(S) URL using the axios library.
 * @class
 * @private
 * @memberof module:concerto-core
 */
declare class HTTPModelFileLoader {
    /**
     * Create the ModelLoader.
     * @param {ModelManager} modelManager - the modelManager for the modelFile
     * @private
     */
    private constructor();
    modelManager: ModelManager;
    /**
     * Returns true if this ModelLoader can process the URL
     * @param {string} url - the URL
     * @return {boolean} true if this ModelLoader accepts the URL
     * @abstract
     */
    accepts(url: string): boolean;
    /**
     * Load a ModelFile from a URL and return it
     * @param {string} requestUrl - the url to get
     * @param {object} options - additional options
     * @return {Promise} a promise to the ModelFile
     */
    load(requestUrl: string, options: object): Promise<any>;
}
