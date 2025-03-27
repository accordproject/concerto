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

import packageJson from '../package.json';
import ErrorCodes from './errorcodes';

/**
* A base class for all Concerto exceptions
* @extends Error
* @class
* @memberof module:concerto-core
*/
class BaseException extends Error {
    public component: string;

    /**
     * Create a BaseException.
     * @param {string} message - The exception message.
     * @param {string} [component] - The optional component name.
     */
    constructor(message: string, component?: string) {
        super(message);
        this.name = this.constructor.name;
        this.message = message;
        this.component = component || '@accordproject/concerto-util';

        // Ensure stack is always defined
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        } else {
            // Fallback: manually set the stack property
            const error = new Error(message);
            this.stack = error.stack || '';
        }
    }
}

export default BaseException;