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

import CompositeFileLoader from './compositefileloader';
import HTTPFileLoader from './httpfileloader';
import GitHubFileLoader from './githubfileloader';

class DefaultFileLoader {
    private compositeFileLoader: CompositeFileLoader;

    constructor() {
        this.compositeFileLoader = new CompositeFileLoader();
        // Provide a processFile function that simply returns the content
        const processFile = (content: string) => content;
        this.compositeFileLoader.addFileLoader(new HTTPFileLoader(processFile));
        this.compositeFileLoader.addFileLoader(new GitHubFileLoader(processFile));
    }

    getFileLoaders(): FileLoader[] {
        return this.compositeFileLoader.getFileLoaders();
    }

    accepts(url: string | { url: string }): boolean {
        return this.compositeFileLoader.accepts(url);
    }

    load(url: string | { url: string }, options?: object): Promise<any> {
        return this.compositeFileLoader.load(url, options);
    }
}

interface FileLoader {
    accepts(url: string): boolean;
    load(url: string, options?: object): Promise<any>;
}

export default DefaultFileLoader;