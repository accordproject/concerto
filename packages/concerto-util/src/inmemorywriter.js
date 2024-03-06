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

const Writer = require('./writer');

/**
 * InMemoryWriter stores string representation of files in a map structure.
 * The Map key is the filename, and the value are its string contents.
 *
 * @private
 * @extends Writer
 * @see See {@link Writer}
 * @class
 * @memberof module:concerto-core
 */
class InMemoryWriter extends Writer {

    /**
     * Create a FileWriter.
     *
     */
    constructor() {
        super();
        this.fileName = '';
        this.data = new Map();
    }

    /**
     * Creates the filename which will be used for association with its string content.
     *
     * @param {string} fileName - the name of the file.
     */
    openFile(fileName) {
        this.fileName = fileName;
    }

    /**
     * Writes the contents of the buffer to the Map store.
     */
    closeFile() {
        this.data.set(this.fileName, this.getBuffer());
        this.clearBuffer();
    }

    /**
     * Returns the content of the Map store.
     *
     * @return {Map} - a Map containing the string representation of files. (k,v) => (filename, file content).
     */
    getFilesInMemory() {
        return this.data;
    }
}
module.exports = InMemoryWriter;