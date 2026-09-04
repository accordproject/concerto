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

import createDebug from 'debug';
import PromisePool from '@supercharge/promise-pool';

import type { FileLoader } from './loaders/fileloader';

const debug = createDebug('concerto:FileDownloader');

type ExternalImportMap = Record<string, string>;
type DownloadJob<TFile> = {
    downloadedUris: Set<string>;
    url: string;
    options: RequestInit;
};

function flatten<T>(arr: T[][]): T[];
function flatten<T>(arr: Array<T[] | undefined>): Array<T | undefined>;
function flatten<T>(arr: Array<T[] | undefined>): Array<T | undefined> {
    return ([] as Array<T | undefined>).concat(...arr);
}
const filterUndefined = <T>(arr: Array<T | undefined | null>): T[] => arr.filter((value): value is T => Boolean(value));

// Used as the PromisePool error handler for both the outer pool (whose items are
// DownloadJob objects) and the inner recursive pool (whose items are plain URI
// strings), hence the union.
const handleJobError = async (error: unknown, job: DownloadJob<unknown> | string): Promise<never> => {
    const errLike = error as { response?: { status?: number }; code?: string };
    const badHttpResponse = errLike.response && errLike.response.status && errLike.response.status !== 200;
    const dnsFailure = errLike.code && errLike.code === 'ENOTFOUND';
    // undefined for the inner pool's string jobs, as it has always been
    const jobUrl = (job as DownloadJob<unknown>).url;
    if(badHttpResponse || dnsFailure){
        const err = new Error(`Unable to download external model dependency '${jobUrl}'`);
        (err as { code?: string }).code = 'MISSING_DEPENDENCY';
        throw err;
    }
    throw new Error('Failed to load model file. Job: ' + jobUrl + ' Details: ' + error);
};

/**
 * Downloads the transitive closure of a set of model files.
 *
 * The files handed in to start the walk are not necessarily the same type as the files
 * the loader produces: a caller may seed the walk with model files it has already parsed
 * into its own representation, while everything downloaded from a URI is whatever the
 * bound FileLoader returns. TSeed is the former, TFile the latter, and both are only ever
 * inspected through getExternalImports. TSeed defaults to TFile for the common case where
 * a caller seeds the walk with files of the same type the loader produces.
 * @memberof module:concerto-core
 */
class FileDownloader<TFile = unknown, TSeed = TFile> {
    public fileLoader: FileLoader<TFile>;
    public getExternalImports: (file: TFile | TSeed) => ExternalImportMap;
    public concurrency: number;

    /**
     * Create a FileDownloader and bind to a FileLoader.
     * @param fileLoader - the loader to use to download model files
     * @param getExternalImports - a function taking a file and returning new files
     * @param concurrency - the number of model files to download concurrently
     */
    constructor(fileLoader: FileLoader<TFile>, getExternalImports: (file: TFile | TSeed) => ExternalImportMap, concurrency = 10) {
        this.fileLoader = fileLoader;
        this.concurrency = concurrency;
        this.getExternalImports = getExternalImports;
    }

    /**
     * Download all external dependencies for an array of model files
     * @param files - the model files to start the walk from
     * @param options - Options object passed to FileLoaders
     * @return a promise that resolves to Files[] for the external model files
     */
    downloadExternalDependencies(files: TSeed[], options: RequestInit = {} as RequestInit): Promise<TFile[]> {
        const method = 'downloadExternalDependencies';
        debug(method);

        const downloadedUris = new Set<string>();

        // several import declarations, in one file or across files, can share a
        // URI, so the URIs are deduplicated before jobs are created for them
        const importedUris = Array.from(
            new Set(
                flatten(files.map(file => {
                    const externalImports = this.getExternalImports(file);
                    return Object.keys(externalImports).map(importDeclaration => externalImports[importDeclaration]);
                }))
            )
        );

        const jobs: Array<DownloadJob<TFile>> = importedUris.map(url => ({
            downloadedUris: downloadedUris,
            url: url,
            options: options
        }));

        return PromisePool
            .withConcurrency(this.concurrency)
            .for(jobs)
            .handleError(handleJobError)
            .process((x: DownloadJob<TFile>) => this.runJob(x, this.fileLoader))
            .then(({ results }) => filterUndefined(flatten(results)));
    }

    /**
     * Execute a Job
     * @param job - the job to execute
     * @param fileLoader - the loader to use to download model files.
     * @return a promise to the job results
     */
    runJob(job: DownloadJob<TFile>, fileLoader: FileLoader<TFile>): Promise<TFile[]> {
        const downloadedUris = job.downloadedUris;
        const options = job.options;
        const url = job.url;

        // cache the URI, so we don't download it again
        downloadedUris.add(url);

        debug('runJob', 'Loading', url);
        return fileLoader.load(url, options).
            then(async (file: TFile) => {
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
                    .process((uri: string) => {
                        if (!downloadedUris.has(uri)) {
                            // recurse and add a new job for the referenced URI
                            return this.runJob({
                                options: options,
                                url: uri,
                                downloadedUris: downloadedUris
                            }, fileLoader);
                        }
                        return undefined;
                    })
                    .then(({ results }) => filterUndefined(flatten(results)));

                return externalImportsFiles.concat([file]);
            });
    }
}

export { FileDownloader };
export default FileDownloader;
