export = HTTPFileLoader;
/**
 * Loads Files from an HTTP(S) URL using the axios library.
 * @class
 * @private
 * @memberof module:concerto-util
 */
declare class HTTPFileLoader {
    /**
     * Create the HTTPFileLoader.
     * @param {*} processFile - a function to apply to the content of the file
     */
    constructor(processFile: any);
    processFile: any;
    /**
     * Returns true if this ModelLoader can process the URL
     * @param {string} url - the URL
     * @return {boolean} true if this ModelLoader accepts the URL
     * @abstract
     */
    accepts(url: string): boolean;
    /**
     * Load a File from a URL and return it
     * @param {string} requestUrl - the url to get
     * @param {object} options - additional options
     * @return {Promise} a promise to the File
     */
    load(requestUrl: string, options: object): Promise<any>;
}
