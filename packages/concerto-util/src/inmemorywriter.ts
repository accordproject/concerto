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

import Writer from './writer';

/**
 * Writes text to an in-memory buffer instead of a file.
 * @class
 * @memberof module:concerto-util
 */
class InMemoryWriter extends Writer {
    public fileName?: string;
    public data: Map<string, string>;

    /**
     * Create an InMemoryWriter.
     */
    constructor() {
        super();
        this.data = new Map();
    }

    /**
     * Opens a file for writing.
     * @param {string} fileName - The name of the file to open.
     */
    openFile(fileName: string): void {
        this.fileName = fileName;
    }

    /**
     * Writes a line to the file.
     * @param {number} tabs - The number of tab characters for indentation.
     * @param {string} text - The text to write.
     */
    writeLine(tabs: number, text: string): void {
        if (!this.fileName) {
            throw new Error('File has not been opened');
        }
        super.writeLine(tabs, text);
    }

    /**
     * Writes a line before the current line in the file.
     * @param {number} tabs - The number of tab characters for indentation.
     * @param {string} text - The text to write.
     */
    writeBeforeLine(tabs: number, text: string): void {
        if (!this.fileName) {
            throw new Error('File has not been opened');
        }
        super.writeBeforeLine(tabs, text);
    }

    /**
     * Closes the current file and stores it in memory.
     */
    closeFile(): void {
        if (!this.fileName) {
            throw new Error('No file open');
        }

        const buffer = this.getBuffer();
        this.data.set(this.fileName, buffer);
        this.clearBuffer();
        this.fileName = undefined;
    }

    /**
     * Gets the files stored in memory.
     * @returns {Map<string, string>} A map of filenames to their contents.
     */
    getFilesInMemory(): Map<string, string> {
        return this.data;
    }
}

export default InMemoryWriter;