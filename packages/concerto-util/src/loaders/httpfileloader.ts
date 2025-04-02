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

import { URL } from 'url';

/**
 * Loads Files from an HTTP(S) URL using fetch.
 * @class
 * @private
 * @memberof module:concerto-util
 */
class HTTPFileLoader {
    private processFile: (content: string) => any;

    /**
     * Create the HTTPFileLoader.
     * @param {(content: string) => any} processFile - a function to apply to the content of the file
     */
    constructor(processFile: (content: string) => any) {
        this.processFile = processFile;
    }

    /**
     * Returns true if this ModelLoader can process the URL
     * @param {string} url - the URL
     * @return {boolean} true if this ModelLoader accepts the URL
     * @abstract
     */
    accepts(url: string): boolean {
        return url.startsWith('http://') || url.startsWith('https://');
    }

    /**
     * Load a text File from a URL and return it
     * @param {string} requestUrl - the url to get
     * @param {object} options - additional options
     * @return {Promise} a promise to the File
     */
    async load(requestUrl: string, options?: object): Promise<any> {
        if (!options) {
            options = {
                method: 'GET',
                headers: {
                    'Content-Type': 'text/plain',
                }
            };
        }

        console.log(requestUrl);
        const response = await fetch(requestUrl, options);
        if (!response.ok) {
            throw new Error(`HTTP request failed with status: ${response.status}`);
        }
        const text = await response.text();
        const urlObj = new URL(requestUrl);
        const name = `@${urlObj.hostname}${urlObj.pathname.replace(/\//g, '.')}`;
        return this.processFile(text);
    }
}

export default HTTPFileLoader;