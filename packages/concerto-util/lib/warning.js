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

let isWarningEmitted = false;

/**
 * Emits DeprecationWaring to stderr only once and can be caught using an warning event listener as well, please define the code
 * and document the deprecation code on https://concerto.accordproject.org/depreaction
 * @param {string} message - message of the deprecation warning
 * @param {string} type - type of the deprecation warning
 * @param {string} code - code of the deprecation warning
 * @param {string} detail - detail of the deprecation warning
 */
function printDeprecationWarning(message, type, code, detail) {
    if (!isWarningEmitted) {
        isWarningEmitted = true;
        process.emitWarning(message, {
            type,
            code,
            detail
        });
    }
}

module.exports = {
    printDeprecationWarning
};
