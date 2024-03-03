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

const { BaseException, ErrorCodes } = require('@accordproject/concerto-util');

/**
* Class representing an invalid Metamodel instance (JSON AST)
* @extends BaseException
* @see See {@link BaseException}
* @class
* @memberof module:concerto-core
*/
class MetamodelException extends BaseException {
    /**
     * Create the MetamodelException.
     * @param {string} message - The exception message.
     * @param {string} [code] - the optional code of the error
     * @param {string} [status] - the optional status of the error
     */
    constructor(message, code, status) {
        code = code || ErrorCodes.METAMODEL_EXCEPTION.code;
        status = status || ErrorCodes.METAMODEL_EXCEPTION.status;
        super(message,'',code, status);
    }

}

module.exports = MetamodelException;
