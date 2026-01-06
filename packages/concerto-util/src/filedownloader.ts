/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const debug = require('debug')('concerto:FileDownloader');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PromisePool = require('@supercharge/promise-pool');

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const flatten = <T>(arr: any[]): T[] => [].concat(...arr);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const filterUndefined = <T>(arr: any[]): T[] => arr.filter(Boolean);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleJobError = async (error: any, job: any) => {
    const badHttpResponse = error.response && error.response.status && error.response.status !== 200;
    const dnsFailure = error.code && error.code === 'ENOTFOUND';
    if(badHttpResponse || dnsFailure){
        const err = new Error(`Unable to download external model dependency '${job.url}'`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err as any).code = 'MISSING_DEPENDENCY';
        throw err;
    }
    throw new Error('Failed to load model file. Job: ' + job.url + ' Details: ' + error);
};

/**
 * Downloads the transitive closure of a set of model files.
 * @memberof module:concerto-core
 */
class FileDownloader {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public fileLoader: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public getExternalImports: any;
    public concurrency: number;

    /**
     * Create a FileDownloader and bind to a FileLoader.
     * @param fileLoader - the loader to use to download model files
     * @param getExternalImports - a function taking a file and returning new files
     * @param concurrency - the number of model files to download concurrently
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(fileLoader: any, getExternalImports: any, concurrency = 10) {
        this.fileLoader = fileLoader;
        this.concurrency = concurrency;
        this.getExternalImports = getExternalImports;
    }

    /**
     * Download all external dependencies for an array of model files
     * @param files - the model files
     * @param options - Options object passed to FileLoaders
     * @return a promise that resolves to Files[] for the external model files
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    downloadExternalDependencies(files: any[], options: any): Promise<any> {
        const method = 'downloadExternalDependencies';
        debug(method);

        const downloadedUris = new Set();

        if (!options) {
            options = {};
        }

        const jobs = flatten(files.map(file => {
            const externalImports = this.getExternalImports(file);
            return Object.keys(externalImports).map(importDeclaration => ({
                downloadedUris: downloadedUris,
                url: externalImports[importDeclaration],
                options: options
            }));
        }));

        return PromisePool
            .withConcurrency(this.concurrency)
            .for(jobs)
            .handleError(handleJobError)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .process((x: any) => this.runJob(x, this.fileLoader))
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .then(({ results }: any) => filterUndefined(flatten(results)));
    }

    /**
     * Execute a Job
     * @param job - the job to execute
     * @param fileLoader - the loader to use to download model files.
     * @return a promise to the job results
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    runJob(job: any, fileLoader: any): Promise<any> {
        const downloadedUris = job.downloadedUris;
        const options = job.options;
        const url = job.url;

        // cache the URI, so we don't download it again
        downloadedUris.add(url);

        debug('runJob', 'Loading', url);
        return fileLoader.load(url, options).
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            then(async (file: any) => {
                debug('runJob', 'Loaded', url, );

                // get the external imports
                const externalImports = this.getExternalImports(file);
                const importedUris = Array.from(
                    new Set(
                        Object.keys(externalImports)
                            .map((importDeclaration) => externalImports[importDeclaration])
                    )
                );
                debug('runJob', 'importedUris', importedUris);

                const externalImportsFiles = await PromisePool
                    .withConcurrency(this.concurrency)
                    .for(importedUris)
                    .handleError(handleJobError)
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .process((uri: any) => {
                        if (!downloadedUris.has(uri)) {
                            // recurse and add a new job for the referenced URI
                            return this.runJob({
                                options: options,
                                url: uri,
                                downloadedUris: downloadedUris
                            }, fileLoader);
                        }
                    })
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .then(({ results }: any) => filterUndefined(flatten(results)));

                return externalImportsFiles.concat([file]);
            });
    }
}

export = FileDownloader;
