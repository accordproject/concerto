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

import * as fs from 'fs';
import * as path from 'path';
import Writer = require('./writer');

/**
 * FileWriter buffers text to be written to a file.
 * @private
 * @class
 * @memberof module:concerto-util
 */
class FileWriter extends Writer {
    public outputDirectory: string;
    public fileName: string | null = null;
    public relativeDir: string | null = null;

    /**
     * Create a FileWriter.
     * @param outputDirectory - the output directory
     */
    constructor(outputDirectory: string) {
        super();
        this.outputDirectory = outputDirectory;
        this.relativeDir = null;
        this.fileName = null;
        fs.mkdirSync(outputDirectory, {recursive:true});
    }

    /**
     * Open a file for writing. The file is created in the
     * output directory.
     * @param fileName - the name of the file to open
     */
    openFile(fileName: string): void {
        this.fileName = fileName;
        this.relativeDir = null;
    }

    /**
     * Open a file for writing. The file is created in the
     * output directory, plus the relative directory path.
     * @param relativeDir - the relative directory
     * @param fileName - the name of the file to open
     */
    openRelativeFile(relativeDir: string, fileName: string): void {
        this.fileName = fileName;
        this.relativeDir = relativeDir;
        this.clearBuffer();
    }

    /**
     * Writes text to the current open file
     * @param tabs - the number of tabs to use
     * @param text - the text to write
     */
    writeLine(tabs: number, text: string): void {
        if (this.fileName) {
            super.writeLine(tabs,text);
        } else {
            throw new Error('File has not been opened!');
        }
    }

    /**
     * Writes text to the start of the current open file
     * @param tabs - the number of tabs to use
     * @param text - the text to write
     */
    writeBeforeLine(tabs: number, text: string): void {
        if (this.fileName) {
            super.writeBeforeLine(tabs,text);
        } else {
            throw new Error('File has not been opened!');
        }
    }

    /**
     * Closes the file, flushing the buffer to disk.
     */
    closeFile(): void {
        if (!this.fileName) {
            throw new Error('No file open');
        }

        let filePath = this.outputDirectory;
        if (this.relativeDir) {
            filePath = path.resolve(filePath, this.relativeDir);
        }
        filePath = path.resolve(filePath, this.fileName);

        //console.log('Writing to ' + filePath );
        fs.mkdirSync(path.dirname(filePath), {recursive:true});
        fs.writeFileSync(filePath, this.getBuffer());

        this.fileName = null;
        this.relativeDir = null;
        this.clearBuffer();
    }
}

export = FileWriter;
