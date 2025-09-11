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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const axios = require('axios');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const url = require('url');

/**
 * Loads Files from an HTTP(S) URL using the axios library.
 * @class
 * @private
 * @memberof module:concerto-util
 */
class HTTPFileLoader {
    private processFile: any;

    /**
     * Create the HTTPFileLoader.
     * @param processFile - a function to apply to the content of the file
     */
    constructor(processFile: any) {
        this.processFile = processFile;
    }

    /**
     * Returns true if this ModelLoader can process the URL
     * @param url - the URL
     * @returns true if this ModelLoader accepts the URL
     * @abstract
     */
    accepts(url: string): boolean {
        return url.startsWith('http://') || url.startsWith('https://');
    }

    /**
     * Load a File from a URL and return it
     * @param requestUrl - the url to get
     * @param options - additional options
     * @returns a promise to the File
     */
    load(requestUrl: string, options?: any): Promise<any> {

        if(!options) {
            options = {};
        }

        const request = JSON.parse(JSON.stringify(options));
        request.url = requestUrl;
        request.method = 'get';
        request.responseType = 'text';
        return axios(request)
            .then((response: any) => {
                const parsedUrl = url.parse(requestUrl);
                // external Files have a name that starts with '@'
                // (so that they are identified as external when an archive is read back in)
                const name = '@' + (parsedUrl.host + parsedUrl.pathname).replace(/\//g, '.');
                return this.processFile(name, response.data);
            });
    }
}

export { HTTPFileLoader };
module.exports = HTTPFileLoader;
