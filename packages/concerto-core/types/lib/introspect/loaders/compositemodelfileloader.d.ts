export = CompositeModelFileLoader;
/**
 * <p>
 * Manages a set of model file loaders, delegating to the first model file
 * loader that accepts a URL.
 * </p>
 * @private
 * @class
 * @memberof module:concerto-core
 */
declare class CompositeModelFileLoader {
    modelFileLoaders: any[];
    /**
     * Adds a ModelFileLoader implemenetation to the ModelFileLoader
     * @param {ModelFileLoader} modelFileLoader - The script to add to the ScriptManager
     */
    addModelFileLoader(modelFileLoader: ModelFileLoader): void;
    /**
     * Get the array of ModelFileLoader instances
     * @return {ModelFileLoaders[]} The ModelFileLoader registered
     * @private
     */
    private getModelFileLoaders;
    /**
     * Remove all registered ModelFileLoaders
     */
    clearModelFileLoaders(): void;
    /**
     * Returns true if this ModelLoader can process the URL
     * @param {string} url - the URL
     * @return {boolean} true if this ModelLoader accepts the URL
     * @abstract
     */
    accepts(url: string): boolean;
    /**
     * Load a ModelFile from a URL and return it
     * @param {string} url - the url to get
     * @param {object} options - additional options
     * @return {Promise} a promise to the ModelFile
     */
    load(url: string, options: object): Promise<any>;
}
