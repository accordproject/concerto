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

import debug from 'debug';
import PromisePool from '@supercharge/promise-pool';

const debugLog = debug('concerto:FileDownloader');
const flatten = (arr: any[]): any[] => [].concat(...arr);
const filterUndefined = (arr: any[]): any[] => arr.filter(Boolean);

interface DownloadError extends Error {
    code?: string;
}

interface FileLoader {
    load(url: string, options?: object): Promise<any>;
}

/**
 * Downloads the transitive closure of a set of model files.
 * @class
 * @memberof module:concerto-util
 */
class FileDownloader {
    private fileLoader: FileLoader;
    private concurrency: number;
    private getExternalImports: (file: string) => Record<string, string>;

    /**
     * Create a FileDownloader and bind to a FileLoader.
     * @param {FileLoader} fileLoader - The loader to use to download model files.
     * @param {(file: string) => Record<string, string>} getExternalImports - A function taking a file and returning new files.
     * @param {number} [concurrency=10] - The number of model files to download concurrently.
     */
    constructor(fileLoader: FileLoader, getExternalImports: (file: string) => Record<string, string>, concurrency: number = 10) {
        this.fileLoader = fileLoader;
        this.concurrency = concurrency;
        this.getExternalImports = getExternalImports;
    }

    /**
     * Download all external dependencies for an array of model files.
     * @param {string[]} files - The model files.
     * @param {object} [options] - Options object passed to FileLoaders.
     * @returns {Promise<string[]>} A promise that resolves to an array of external model files.
     */
    async downloadExternalDependencies(files: string[], options: object = {}): Promise<string[]> {
        const method = 'downloadExternalDependencies';
        debugLog(method);

        const downloadedUris = new Set<string>();

        const jobs = flatten(files.map(file => {
            const externalImports = this.getExternalImports(file);
            return Object.keys(externalImports).map(importDeclaration => ({
                downloadedUris: downloadedUris,
                url: externalImports[importDeclaration],
                options
            }));
        }));

        const { results } = await PromisePool
            .withConcurrency(this.concurrency)
            .for(jobs)
            .handleError(async (error: unknown, item) => {
                const url = typeof item === 'string' ? item : item.url;
                const badHttpResponse = error instanceof Error && 'response' in error && error.response && (error.response as any).status && (error.response as any).status !== 200;
                const dnsFailure = error instanceof Error && 'code' in error && (error as any).code === 'ENOTFOUND';
                if (badHttpResponse || dnsFailure) {
                    const err: DownloadError = new Error(`Unable to download external model dependency '${url}'`);
                    err.code = 'MISSING_DEPENDENCY';
                    throw err;
                }
                throw new Error('Failed to load model file. Job: ' + url + ' Details: ' + error);
            })
            .process(x => this.runJob(x, this.fileLoader));

        return filterUndefined(flatten(results));
    }

    /**
     * Execute a Job.
     * @param {{ downloadedUris: Set<string>, url: string, options: object }} job - The job to execute.
     * @param {FileLoader} fileLoader - The loader to use to download model files.
     * @returns {Promise<string[]>} A promise to the job results.
     */
    private async runJob(job: { downloadedUris: Set<string>, url: string, options: object }, fileLoader: FileLoader): Promise<string[]> {
        const { downloadedUris, options, url } = job;

        downloadedUris.add(url);

        debugLog('runJob', 'Loading', url);
        const file = await fileLoader.load(url, options);
        debugLog('runJob', 'Loaded', url);

        const externalImports = this.getExternalImports(file);
        const importedUris = Array.from(
            new Set(
                Object.keys(externalImports)
                    .map((importDeclaration) => externalImports[importDeclaration])
            )
        );
        debugLog('runJob', 'importedUris', importedUris);

        const externalImportsFiles = await PromisePool
            .withConcurrency(this.concurrency)
            .for(importedUris)
            .handleError(async (error: unknown, item) => {
                const url = typeof item === 'string' ? item : item;
                const badHttpResponse = error instanceof Error && 'response' in error && error.response && (error.response as any).status && (error.response as any).status !== 200;
                const dnsFailure = error instanceof Error && 'code' in error && (error as any).code === 'ENOTFOUND';
                if (badHttpResponse || dnsFailure) {
                    const err: DownloadError = new Error(`Unable to download external model dependency '${url}'`);
                    err.code = 'MISSING_DEPENDENCY';
                    throw err;
                }
                throw new Error('Failed to load model file. Job: ' + url + ' Details: ' + error);
            })
            .process(uri => {
                if (!downloadedUris.has(uri)) {
                    return this.runJob({
                        options,
                        url: uri,
                        downloadedUris
                    }, fileLoader);
                }
                return [];
            })
            .then(({ results }) => filterUndefined(flatten(results)));

        return externalImportsFiles.concat([file]);
    }
}

export default FileDownloader;