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

/**
 * Interface defining the contract for FileLoader implementations
 */
interface FileLoader {
    accepts(url: string): boolean;
    load(url: string, options?: object): Promise<any>;
}

/**
 * Manages a set of model file loaders, delegating to the first model file
 * loader that accepts a URL.
 * @private
 * @class
 * @memberof module:concerto-util
 */
class CompositeFileLoader {
    private fileLoaders: FileLoader[];

    /**
     * Create the CompositeFileLoader. Used to delegate to a set of FileLoaders.
     */
    constructor() {
        this.fileLoaders = [];
    }

    /**
     * Adds a FileLoader implementation to the FileLoader
     * @param {FileLoader} fileLoader - The script to add to the ScriptManager
     */
    addFileLoader(fileLoader: FileLoader): void {
        this.fileLoaders.push(fileLoader);
    }

    /**
     * Get the array of FileLoader instances
     * @return {FileLoader[]} The FileLoader registered
     * @private
     */
    public getFileLoaders(): FileLoader[] {
        return this.fileLoaders;
    }

    /**
     * Remove all registered FileLoaders
     */
    clearFileLoaders(): void {
        this.fileLoaders = [];
    }

    /**
     * Returns true if this ModelLoader can process the URL
     * @param {string | { url: string }} url - the URL
     * @return {boolean} true if this ModelLoader accepts the URL
     */
    accepts(url: string | { url: string }): boolean {
        const actualUrl = typeof url === 'string' ? url : url.url;
        for (let n = 0; n < this.fileLoaders.length; n++) {
            const ml = this.fileLoaders[n];
            if (ml.accepts(actualUrl)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Load a File from a URL and return it
     * @param {string | { url: string }} url - the url to get
     * @param {object} [options] - additional options
     * @return {Promise<any>} a promise to the File
     */
    load(url: string | { url: string }, options?: object): Promise<any> {
        const actualUrl = typeof url === 'string' ? url : url.url;
        for (let n = 0; n < this.fileLoaders.length; n++) {
            const ml = this.fileLoaders[n];
            if (ml.accepts(actualUrl)) {
                return ml.load(actualUrl, options);
            }
        }
        throw new Error(`Failed to find a model file loader that can handle: ${actualUrl}`);
    }
}

export default CompositeFileLoader;