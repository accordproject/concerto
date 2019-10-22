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

const BaseException = require('./baseexception');

/**
 * Exception throws when a Concerto file is semantically invalid
 * @extends BaseException
 * @see {@link BaseException}
 * @class
 * @memberof module:concerto-core
 */
class BaseFileException extends BaseException {

    /**
     * Create an BaseFileException
     * @param {string} message - the message for the exception
     * @param {string} fileLocation - the optional file location associated with the exception
     * @param {string} fullMessage - the optional full message text
     * @param {string} fileName - the optional file name
      * @param {string} component - the optional component which throws this error
     */
    constructor(message, fileLocation, fullMessage, fileName, component) {
        super(fullMessage ? fullMessage : message, component);
        this.fileLocation = fileLocation;
        this.shortMessage = message;
        this.fileName = fileName;
    }

    /**
     * Returns the file location associated with the exception or null
     * @return {string} the optional location associated with the exception
     */
    getFileLocation() {
        return this.fileLocation;
    }

    /**
     * Returns the error message without the location of the error
     * @returns {string} the error message
     */
    getShortMessage() {
        return this.shortMessage;
    }

    /**
     * Returns the fileName for the error
     * @returns {string} the file name or null
     */
    getFileName() {
        return this.fileName;
    }
}

module.exports = BaseFileException;
