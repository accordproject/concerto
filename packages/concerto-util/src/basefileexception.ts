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
const BaseException = require('./baseexception');

/**
 * Exception throws when a Concerto file is semantically invalid
 * @extends BaseException
 * @see See  {@link BaseException}
 * @class
 * @memberof module:concerto-core
 */
export class BaseFileException extends BaseException {
    private fileLocation?: any;
    private shortMessage: string;
    private fileName?: string;

    /**
     * Create an BaseFileException
     * @param message - the message for the exception
     * @param fileLocation - the file location
     * @param fullMessage - the full message text
     * @param fileName - the file name
     * @param component - the component which throws this exception
     */
    constructor(message: string, fileLocation?: any, fullMessage?: string, fileName?: string, component?: string) {
        let messageWithFileLocation = message;
        if (fileLocation && typeof fileLocation === 'string') {
            messageWithFileLocation += ' File location: ' + fileLocation;
        }
        super(messageWithFileLocation, component);
        this.fileLocation = fileLocation;
        this.shortMessage = message;
        this.fileName = fileName;

        if (fullMessage) {
            this.message = fullMessage;
        }
    }

    /**
     * Returns the file location associated with the exception or null
     * @returns the optional file location associated with the exception
     */
    getFileLocation(): any {
        return this.fileLocation;
    }

    /**
     * Returns the file name associated with the exception or null
     * @returns the optional file name associated with the exception
     */
    getFileName(): string | undefined {
        return this.fileName;
    }

    /**
     * Returns the shortened version of the error message (without the file location)
     * @returns the short error message
     */
    getShortMessage(): string {
        return this.shortMessage;
    }
}

module.exports = BaseFileException;
