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

const { ErrorCodes } = require('@accordproject/concerto-util');
const { BaseFileException } = require('@accordproject/concerto-util');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const ModelFile = require('./modelfile');
}
/* eslint-enable no-unused-vars */

/**
 * Exception throws when a composer file is semantically invalid
 * @extends BaseFileException
 * @see See  {@link BaseFileException}
 * @class
 * @memberof module:concerto-core
 */
class IllegalModelException extends BaseFileException {
    /**
     * Create an IllegalModelException.
     * @param {string} message - the message for the exception
     * @param {ModelFile} [modelFile] - the modelfile associated with the exception
     * @param {Object} [fileLocation] - location details of the error within the model file.
     * @param {number} fileLocation.start.line - start line of the error location.
     * @param {number} fileLocation.start.column - start column of the error location.
     * @param {number} fileLocation.end.line - end line of the error location.
     * @param {number} fileLocation.end.column - end column of the error location.
     * @param {string} [component] - the component which throws this error
     * @param {string} [code] - the optional code of the error
     * @param {string} [status] - the optional status of the error
     */
    constructor(message, modelFile, fileLocation, component, code, status) {

        let messageSuffix = '';
        let fileName = null;
        if(modelFile && modelFile.getName()) {
            fileName = modelFile.getName();
            messageSuffix = 'File \'' + fileName + '\': ' ;
        }

        if(fileLocation) {
            messageSuffix = messageSuffix + 'line ' + fileLocation.start.line + ' column ' +
                fileLocation.start.column + ', to line ' + fileLocation.end.line + ' column ' +
                fileLocation.end.column + '. ';
        }

        // First character to be uppercase
        messageSuffix = messageSuffix.charAt(0).toUpperCase() + messageSuffix.slice(1);

        code = code || ErrorCodes.ILLEGAL_MODEL_EXCEPTION.code;
        status = status || ErrorCodes.ILLEGAL_MODEL_EXCEPTION.status;

        super(message, fileLocation, message + ' ' + messageSuffix, fileName, component,code, status);
    }
}

module.exports = IllegalModelException;
