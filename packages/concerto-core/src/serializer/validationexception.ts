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

import { BaseException } from '@accordproject/concerto-util';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type { ValidationDiagnostic } from '../types';
/* eslint-enable no-unused-vars */

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
     * The structured violations behind the exception, when it is about an
     * instance (accordproject/concerto#1325): the same diagnostics
     * `validateInstance` reports for it, whose `code`, `path`, `expected`
     * and `severity` carry no value from the instance. Not enumerable.
     */
    declare details?: ValidationDiagnostic[];

    /**
     * Create a ValidationException
     * @param {string} message - the message for the exception
     * @param {string} component - the optional component which throws this error
     */
    constructor(message, component?) {
        super(message, component);
    }
}

export { ValidationException };
export default ValidationException;
