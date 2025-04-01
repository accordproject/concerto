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

/**
 * A base class for all Concerto exceptions
 * @extends Error
 * @class
 * @memberof module:concerto-core
 */
import packageJson from '../package.json';
import ErrorCodes from './errorcodes';

 class BaseException extends Error {
    name: string;
    message: string;
    errorType: string;
    component: string;

    /**
     * Create the BaseException.
     * @param message - The exception message.
     * @param component - The optional component which throws this error.
     * @param errorType - The optional error code regarding the error.
     */
    constructor(message: string, component?: string, errorType?: string) {
        super(message);
        this.name = this.constructor.name;
        this.message = message;
        this.errorType = errorType ?? ErrorCodes.DEFAULT_BASE_EXCEPTION;
        this.component = component ?? packageJson.name ?? 'unknown-component';

        // Capture stack trace if the method is available (for better debugging)
        if (typeof Error.captureStackTrace === 'function') {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

export default BaseException;