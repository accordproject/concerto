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

/**
 * <p>
 * Manages a set of model file loaders, delegating to the first model file
 * loader that accepts a URL.
 * </p>
 * @private
 * @class
 * @memberof module:concerto-util
 */
class CompositeFileLoader<T = unknown> {
    public fileLoaders: Array<FileLoader<T>>;

    /**
     * Create the CompositeFileLoader. Used to delegate to a set of FileLoaders.
     */
    constructor() {
        this.fileLoaders = [];
    }

    /**
     * Adds a FileLoader implemenetation to the FileLoader
     * @param fileLoader - The script to add to the ScriptManager
     */
    addFileLoader(fileLoader: FileLoader<T>): void {
        this.fileLoaders.push(fileLoader);
    }

    /**
     * Get the array of FileLoader instances
     * @return The FileLoader registered
     * @private
     */
    getFileLoaders(): Array<FileLoader<T>> {
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
     * @param url - the URL
     * @return true if this ModelLoader accepts the URL
     * @abstract
     */
    accepts(url: string): boolean {
        for (let n = 0; n < this.fileLoaders.length; n++) {
            const ml = this.fileLoaders[n];

            if (ml.accepts(url)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Load a File from a URL and return it
     * @param url - the url to get
     * @param options - additional options
     * @return a promise to the File
     */
    load(url: string, options?: RequestInit): Promise<T> {
        for (let n = 0; n < this.fileLoaders.length; n++) {
            const ml = this.fileLoaders[n];

            if (ml.accepts(url)) {
                return ml.load(url, options);
            }
        }

        throw new Error('Failed to find a model file loader that can handle: ' + url);
    }
}

export = CompositeFileLoader;
