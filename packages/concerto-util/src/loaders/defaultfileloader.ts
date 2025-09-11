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
const CompositeFileLoader = require('./compositefileloader');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const HTTPFileLoader = require('./httpfileloader');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const GitHubFileLoader = require('./githubfileloader');

/**
 * <p>
 * A default CompositeFileLoader implementation which supports
 * github://, http:// and https:// URLs.
 * </p>
 * @private
 * @class
 * @see See {@link CompositeFileLoader}
 * @memberof module:concerto-util
 */
class DefaultFileLoader extends CompositeFileLoader {
    /**
     * Create the DefaultFileLoader.
     * @param processFile - a function to apply to the content of the file
     */
    constructor(processFile: any) {
        super();
        const http = new HTTPFileLoader(processFile);
        const github = new GitHubFileLoader(processFile);
        this.addFileLoader(github);
        this.addFileLoader(http);
    }
}

export { DefaultFileLoader };
module.exports = DefaultFileLoader;
