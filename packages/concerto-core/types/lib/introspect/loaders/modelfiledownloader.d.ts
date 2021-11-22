export = ModelFileDownloader;
/**
 * Downloads the transitive closure of a set of model files.
 * @class
 * @memberof module:concerto-core
 */
declare class ModelFileDownloader {
    /**
     * Create a ModelFileDownloader and bind to a ModelFileLoader.
     * @param {ModelFileLoader} modelFileLoader - the loader to use to download model files
     * @param {Number} concurrency - the number of model files to download concurrently
     */
    constructor(modelFileLoader: ModelFileLoader, concurrency?: number);
    modelFileLoader: ModelFileLoader;
    concurrency: number;
    /**
     * Download all external dependencies for an array of model files
     * @param {ModelFile[]} modelFiles - the model files
     * @param {Object} [options] - Options object passed to ModelFileLoaders
     * @return {Promise} a promise that resolves to ModelFiles[] for the external model files
     */
    downloadExternalDependencies(modelFiles: ModelFile[], options?: any): Promise<any>;
    /**
     * Execute a Job
     * @param {Object} job - the job to execute
     * @param {Object} modelFileLoader - the loader to use to download model files.
     * @return {Promise} a promise to the job results
     */
    runJob(job: any, modelFileLoader: any): Promise<any>;
}
