/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * You may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import debug from 'debug';
import PromisePool from '@supercharge/promise-pool';

const debugLog = debug('concerto:FileDownloader');
const flatten = (arr: any[]): any[] => [].concat(...arr);
const filterUndefined = (arr: any[]): any[] => arr.filter(Boolean);

interface FileLoader {
    load(url: string, options?: object): Promise<any>;
}

interface DownloadError extends Error {
    code?: string;
}

class FileDownloader {
    private fileLoader: FileLoader;
    private concurrency: number;
    private getExternalImports: (file: string) => Record<string, string>;

    constructor(fileLoader: FileLoader, getExternalImports: (file: string) => Record<string, string>, concurrency: number = 10) {
        this.fileLoader = fileLoader;
        this.concurrency = concurrency;
        this.getExternalImports = getExternalImports;
    }

    async downloadExternalDependencies(files: string[], options: object = {}): Promise<string[]> {
        debugLog('downloadExternalDependencies');

        const downloadedUris = new Set<string>();
        const jobs = flatten(files.map(file => {
            const externalImports = this.getExternalImports(file);
            return Object.keys(externalImports).map(importDeclaration => ({
                downloadedUris,
                url: externalImports[importDeclaration],
                options,
            }));
        }));

        const { results } = await PromisePool
            .withConcurrency(this.concurrency)
            .for(jobs)
            .handleError(this.handleJobError.bind(this)) // Corrected binding
            .process(job => this.runJob(job, this.fileLoader));

        return filterUndefined(flatten(results));
    }

    private hasResponse(error: unknown): error is { response: { status: number } } {
        return typeof error === 'object' && error !== null && 'response' in error && typeof (error as any).response.status === 'number';
    }

    private async handleJobError(error: unknown, job: any) {
        const url = typeof job === 'string' ? job : job.url;
        
        const badHttpResponse = this.hasResponse(error) && error.response.status !== 200;
        const dnsFailure = error instanceof Error && 'code' in error && (error as any).code === 'ENOTFOUND';

        if (badHttpResponse || dnsFailure) {
            const err: DownloadError = new Error(`Unable to download external model dependency '${url}'`);
            err.code = 'MISSING_DEPENDENCY';
            throw err;
        }
        throw new Error(`Failed to load model file. Job: ${url} Details: ${error}`);
    }

    private async runJob(job: { downloadedUris: Set<string>, url: string, options: object }, fileLoader: FileLoader): Promise<string[]> {
        const { downloadedUris, options, url } = job;
        downloadedUris.add(url);
        debugLog('runJob', 'Loading', url);

        const file = await fileLoader.load(url, options);
        debugLog('runJob', 'Loaded', url);

        const externalImports = this.getExternalImports(file);
        const importedUris = Array.from(new Set(Object.keys(externalImports).map(importDeclaration => externalImports[importDeclaration])));
        debugLog('runJob', 'importedUris', importedUris);

        const externalImportsFiles = await PromisePool
            .withConcurrency(this.concurrency)
            .for(importedUris)
            .handleError(this.handleJobError.bind(this)) // Corrected binding
            .process(uri => {
                if (!downloadedUris.has(uri)) {
                    return this.runJob({ options, url: uri, downloadedUris }, fileLoader);
                }
                return [];
            })
            .then(({ results }) => filterUndefined(flatten(results)));

        return externalImportsFiles.concat([file]);
    }
}

export default FileDownloader;