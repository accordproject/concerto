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

const BaseException = require('@accordproject/concerto-util').BaseException;

/**
 * Exception thrown when a resource fails to model against the model
 * @extends BaseException
 * @see See {@link  BaseException}
 * @class
 * @memberof module:concerto-core
 * @private
 */
class ValidationException extends BaseException {

    /**
     * Create a ValidationException
     * @param {string} message - the message for the exception
     * @param {string} component - the optional component which throws this error
     * @param {string} [code] - the optional code of the error
     * @param {string} [status] - the optional status of the error
     */
    constructor(message, component,code, status) {
        code = code || ErrorCodes.DEFAULT_VALIDATOR_EXCEPTION.code;
        status = status || ErrorCodes.DEFAULT_VALIDATOR_EXCEPTION.status;
        super(message, component, code, status);
    }
}

module.exports = ValidationException;
