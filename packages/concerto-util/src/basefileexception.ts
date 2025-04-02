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

import BaseException from './baseexception';

/**
 * Base file exception class for Concerto Util.
 * @class
 * @memberof module:concerto-util
 */
class BaseFileException extends BaseException {
    private fileLocation: { start: number; end: number };
    private shortMessage: string;
    private fileName?: string;

    /**
     * Create a BaseFileException.
     * @param {string} shortMessage - The short exception message.
     * @param {{ start: number; end: number }} fileLocation - The location in the file.
     * @param {string} [fullMessage] - The full exception message.
     * @param {string} [fileName] - The name of the file.
     * @param {string} [component] - The optional component name.
     */
    constructor(shortMessage: string, fileLocation: { start: number; end: number }, fullMessage?: string, fileName?: string, component?: string) {
        super(fullMessage || shortMessage, component);
        this.name = this.constructor.name;
        this.shortMessage = shortMessage;
        this.fileLocation = fileLocation;
        this.fileName = fileName;
    }

    /**
     * Get the location in the file.
     * @returns {{ start: number; end: number }} The file location.
     */
    public getFileLocation(): { start: number; end: number } {
        return this.fileLocation;
    }

    /**
     * Get the short message.
     * @returns {string} The short message.
     */
    public getShortMessage(): string {
        return this.shortMessage;
    }

    /**
     * Get the file name.
     * @returns {string | undefined} The file name, or undefined if not set.
     */
    public getFileName(): string | undefined {
        return this.fileName;
    }
}

export default BaseFileException;