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

import HTTPFileLoader = require('./httpfileloader');

/**
 * Loads Files from an external source, such as a URL.
 *
 * @class
 * @private
 * @memberof module:concerto-util
 */
class GitHubFileLoader<T> extends HTTPFileLoader<T> {
    /**
     * Create the GitHubFileLoader.
     * @param processFile - a function to apply to the content of the file
     */
    constructor(processFile: (name: string, text: string) => T) {
        super(processFile);
    }

    /**
     * Returns true if this ModelLoader can process the URL
     * @param url - the URL
     * @return true if this ModelLoader accepts the URL
     * @abstract
     */
    accepts(url: string): boolean {
        return url.startsWith('github://');
    }

    /**
     * Load a File from a URL and return it
     * @param url - the url to get
     * @param options - additional options
     * @return a promise to the File
     */
    load(url: string, options?: RequestInit): Promise<T> {
        const rewrittenUrl = 'https://raw.githubusercontent.com/' + url.substring(9);
        const result = super.load(rewrittenUrl, options);
        return result;
    }
}

export = GitHubFileLoader;