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

const BaseException = require('@accordproject/concerto-util').BaseException;

/**
 * Optional structured details for a validation failure.
 * Intended for conversion to Diagnostic objects by higher-level validation APIs.
 * @typedef {Object} ValidationExceptionDetails
 * @property {string} [path] - JSON path to the invalid value (e.g. `$.declarations[0].name`)
 * @property {string} [code] - Machine-readable code (e.g. `UNKNOWN_PROPERTY`, `TYPE_VIOLATION`)
 * @property {string} [expected] - Expected type or value description
 * @property {string} [actual] - Actual type or value description
 */

/**
 * Exception thrown when a resource fails to model against the model
 * @extends BaseException
 * @see See {@link  BaseException}
 * @class
 * @memberof module:concerto-core
 * @private
 */
class ValidationException extends BaseException {
    details?: {
        path?: string;
        code?: string;
        expected?: string;
        actual?: string;
    };

    /**
     * Create a ValidationException
     * @param {string} message - the message for the exception
     * @param {string} [component] - the optional component which throws this error
     * @param {ValidationExceptionDetails} [details] - optional structured details for diagnostic conversion
     */
    constructor(message, component?, details?) {
        super(message, component);
        if (details) {
            this.details = details;
        }
    }
}

export = ValidationException;
