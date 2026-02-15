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

import type { FileLoader } from './fileloader';
const debug = require('debug')('concerto:HTTPFileLoader');

// Ensure fetch is recognized if not in global types
declare const fetch: (input: string | URL, init?: RequestInit) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

/**
 * Loads Files from an HTTP(S) URL using fetch.
 * @class
 * @private
 * @memberof module:concerto-util
 */
class HTTPFileLoader<T> implements FileLoader<T> {
    public processFile: (name: string, text: string) => T;

    /**
     * Create the HTTPFileLoader.
     * @param processFile - a function to apply to the content of the file
     */
    constructor(processFile: (name: string, text: string) => T) {
        this.processFile = processFile;
    }

    /**
     * Returns true if this ModelLoader can process the URL
     * @param url - the URL
     * @return true if this ModelLoader accepts the URL
     * @abstract
     */
    accepts(url: string): boolean {
        return url.startsWith('http://') || url.startsWith('https://');
    }

    /**
     * Load a text File from a URL and return it
     * @param requestUrl - the url to get
     * @param options - additional options
     * @return a promise to the File
     */
    async load(requestUrl: string, options?: RequestInit): Promise<T> {
        if (!options) {
            options = {
                method: 'GET',
                headers: {
                    'Content-Type': 'text/plain',
                }
            };
        }

        debug('loading', requestUrl);
        const response = await fetch(requestUrl, options);
        if (!response.ok) {
            throw new Error(`HTTP request failed with status: ${response.status}`);
        }
        const text = await response.text();
        const url = new URL(requestUrl);
        // external Files have a name that starts with '@'
        // (so that they are identified as external when an archive is read back in)
        const name = '@' + (url.host + url.pathname).replace(/\//g, '.');
        return this.processFile(name, text);
    }
}

export = HTTPFileLoader;
