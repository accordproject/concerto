export = FileDownloader;
/**
 * Downloads the transitive closure of a set of model files.
 * @memberof module:concerto-core
 */
declare class FileDownloader {
    /**
     * Create a FileDownloader and bind to a FileLoader.
     * @param {*} fileLoader - the loader to use to download model files
     * @param {*} getExternalImports - a function taking a file and returning new files
     * @param {Number} concurrency - the number of model files to download concurrently
     */
    constructor(fileLoader: any, getExternalImports: any, concurrency?: number);
    fileLoader: any;
    concurrency: number;
    getExternalImports: any;
    /**
     * Download all external dependencies for an array of model files
     * @param {File[]} files - the model files
     * @param {Object} [options] - Options object passed to FileLoaders
     * @return {Promise} a promise that resolves to Files[] for the external model files
     */
    downloadExternalDependencies(files: File[], options?: any): Promise<any>;
    /**
     * Execute a Job
     * @param {Object} job - the job to execute
     * @param {Object} fileLoader - the loader to use to download model files.
     * @return {Promise} a promise to the job results
     */
    runJob(job: any, fileLoader: any): Promise<any>;
}
