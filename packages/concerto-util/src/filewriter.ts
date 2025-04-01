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



import * as fs from 'fs';
import * as path from 'path';
import Writer from './writer';

/**
 * Writes text to a file.
 * @class
 * @memberof module:concerto-util
 */
class FileWriter extends Writer {
    public outputDirectory: string;
    public fileName?: string;
    public relativeDir?: string;

    /**
     * Create a FileWriter.
     * @param {string} outputDir - The output directory.
     */
    constructor(outputDir: string) {
        super();
        this.outputDirectory = outputDir;
        fs.mkdirSync(outputDir, { recursive: true });
    }

    /**
     * Opens a file for writing.
     * @param {string} fileName - The name of the file to open.
     */
    openFile(fileName: string): void {
        this.fileName = fileName;
        this.relativeDir = undefined;
    }

    /**
     * Opens a file for writing in a relative directory.
     * @param {string} relativeDir - The relative directory.
     * @param {string} fileName - The name of the file to open.
     */
    openRelativeFile(relativeDir: string, fileName: string): void {
        this.fileName = fileName;
        this.relativeDir = relativeDir;
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
     * Closes the current file and writes it to disk.
     */
    closeFile(): void {
        if (!this.fileName) {
            throw new Error('No file open');
        }

        let filePath: string;
        if (this.relativeDir) {
            const relativePath = path.resolve(this.outputDirectory, this.relativeDir!); // Non-null assertion
            fs.mkdirSync(relativePath, { recursive: true });
            filePath = path.resolve(relativePath, this.fileName!); // Non-null assertion
        } else {
            filePath = path.resolve(this.outputDirectory, this.fileName!); // Non-null assertion
        }

        const dir = path.dirname(filePath);
        fs.mkdirSync(dir, { recursive: true });
        const buffer = this.getBuffer();
        const content = Array.isArray(buffer) ? buffer.join('') : buffer; // Ensure buffer is handled correctly
        fs.writeFileSync(filePath, content);
        this.clearBuffer();
        this.fileName = undefined;
        this.relativeDir = undefined;
    }
}

export default FileWriter;