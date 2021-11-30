export = CompositeFileLoader;
/**
 * <p>
 * Manages a set of model file loaders, delegating to the first model file
 * loader that accepts a URL.
 * </p>
 * @private
 * @class
 * @memberof module:concerto-util
 */
declare class CompositeFileLoader {
    fileLoaders: any[];
    /**
     * Adds a FileLoader implemenetation to the FileLoader
     * @param {FileLoader} fileLoader - The script to add to the ScriptManager
     */
    addFileLoader(fileLoader: FileLoader): void;
    /**
     * Get the array of FileLoader instances
     * @return {FileLoaders[]} The FileLoader registered
     * @private
     */
    private getFileLoaders;
    /**
     * Remove all registered FileLoaders
     */
    clearFileLoaders(): void;
    /**
     * Returns true if this ModelLoader can process the URL
     * @param {string} url - the URL
     * @return {boolean} true if this ModelLoader accepts the URL
     * @abstract
     */
    accepts(url: string): boolean;
    /**
     * Load a File from a URL and return it
     * @param {string} url - the url to get
     * @param {object} options - additional options
     * @return {Promise} a promise to the File
     */
    load(url: string, options: object): Promise<any>;
}
