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

const { BaseFileException } = require('@accordproject/concerto-util');

/**
 * Exception throws when a Concerto file is syntactically invalid
 * @extends BaseFileException
 * @see See {@link BaseFileException}
 * @class
 * @memberof module:concerto-core
 * @private
 */
class ParseException extends BaseFileException {
    /**
     * Create an ParseException
     * @param {string} message - the message for the exception
     * @param {string | object} [fileLocation] - the file location associated with the exception
     * @param {string} [fileName] - the file name associated with the exception
     * @param {string} [fullMessageOverride] - the pre-existing full message
     * @param {string} [component] - the component which throws this error
     */
    constructor(message: string, fileLocation?: {
        start: {
            line: number;
            column: number;
            offset: number;
        };
        end?: {
            line: number;
            column: number;
            offset: number;
        };
    }, fileName?: string, fullMessageOverride?: string, component?: string) {
        let fullMessage = message;
        let suffix = '';

        // Add the file name onto the message if it has been set.
        if (fileName) {
            suffix += ' File ' + fileName;
        }

        // The parser does not give us back the end location of an invalid token.
        // Making the end column equal to the start column makes use of
        // vscodes default behaviour of selecting an entire word
        if (fileLocation) {
            if (fileLocation.end && fileLocation.start) {
                if (fileLocation.end.offset && fileLocation.start.offset) {
                    if (fileLocation.end.offset - fileLocation.start.offset === 1) {
                        fileLocation.end.column = fileLocation.start.column;
                        fileLocation.end.offset = fileLocation.start.offset;
                    }
                }
            }
            if (suffix) {
                suffix+= ' line ' + fileLocation.start.line + ' column ' + fileLocation.start.column;
            } else {
                suffix+= ' Line ' + fileLocation.start.line + ' column ' + fileLocation.start.column;
            }
        }

        fullMessage += suffix;
        super(message, fileLocation, fullMessageOverride || fullMessage, fileName, component);
    }
}

export = ParseException; 