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

/**
* A base class for all Composer exceptions
* @extends Error
* @class
* @memberof module:composer-common
* @private
*/
class BaseException extends Error {

    /**
     * Create the BaseException.
     * @param {string} message - The exception message.
     * @param {string} component - The optional component which throws this error.
     */
    constructor(message, component) {
        super(message);
        this.component = component || packageJson.name;
        this.name = this.constructor.name;
        this.message = message;
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        }
    }

}

module.exports = BaseException;
