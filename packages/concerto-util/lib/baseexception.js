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



const packageJson = require('../package.json');
const ErrorCodes  = require('./errorcodes');

/**
* A base class for all Concerto exceptions
* @extends Error
* @class
* @memberof module:concerto-core
*/
class BaseException extends Error {
    /**
     * Create the BaseException.
     * @param {string} message - The exception message.
     * @param {string} component - The optional component which throws this error.
     * @param {string} [errorCode] - The optional error code regarding the error
     * @param {string} [errorStatus] - The optional error status regarding the error
     */
    constructor(message, component, errorCode, errorStatus) {
        super(message);
        this.component = component || packageJson.name;
        this.name = this.constructor.name;
        this.message = message;
        this.code = errorCode || ErrorCodes.DEFAULT_BASE_EXCEPTION.code;
        this.status = errorStatus || ErrorCodes.DEFAULT_BASE_EXCEPTION.status;
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        }
    }

}

module.exports = BaseException;
