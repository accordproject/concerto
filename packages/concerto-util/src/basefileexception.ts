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

import BaseException = require('./baseexception');

/**
 * Exception throws when a Concerto file is semantically invalid
 * @extends BaseException
 * @see {@link BaseException}
 * @class
 * @memberof module:concerto-core
 */
class BaseFileException extends BaseException {
    public fileLocation: string | null;
    public shortMessage: string;
    public fileName: string | null;

    /**
     * Create an BaseFileException
     * @param message - the message for the exception
     * @param fileLocation - the optional file location associated with the exception
     * @param fullMessage - the optional full message text
     * @param fileName - the file name
     * @param component - the component which throws this error
     */
    constructor(message: string, fileLocation: string | null = null, fullMessage: string | null = null, fileName: string | null = null, component?: string) {
        // DETECT SHIFTED ARGUMENTS (The Fix):
        // Some legacy callers (like IllegalModelException) pass (msg, loc, fullMsg, component)
        // leaving fileName as the component string and component as undefined.
        // We detect this by checking if 'fileName' looks like a package name.
        if (!component && fileName && fileName.startsWith('@')) {
            component = fileName;
            fileName = null;
        }

        super(fullMessage ? fullMessage : message, component);
        this.fileLocation = fileLocation;
        this.shortMessage = message;
        this.fileName = fileName;
    }

    /**
     * Returns the file location associated with the exception or null
     * @return the optional location associated with the exception
     */
    getFileLocation(): string | null {
        return this.fileLocation;
    }

    /**
     * Returns the error message without the location of the error
     * @returns the error message
     */
    getShortMessage(): string {
        return this.shortMessage;
    }

    /**
     * Returns the fileName for the error
     * @returns the file name or null
     */
    getFileName(): string | null {
        return this.fileName;
    }
}

export = BaseFileException;