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

let isWarningEmitted: boolean = false;

/**
 * Emits a DeprecationWarning to stderr only once. The warning can be caught using a warning event listener.
 * Please document the deprecation code on https://concerto.accordproject.org/deprecation.
 * @param message - The message of the deprecation warning.
 * @param type - The type of the deprecation warning.
 * @param code - The code of the deprecation warning.
 * @param detail - The detail of the deprecation warning.
 */
export function printDeprecationWarning(message: string, type: string, code: string, detail: string): void {
    // This will get polyfilled in the webpack.config.js as process.emitWarning is not available in the browser
    const customEmitWarning: typeof process.emitWarning = process.emitWarning;
    if (!isWarningEmitted) {
        isWarningEmitted = true;
        customEmitWarning(`DEPRECATED: ${message}`, {
            type,
            code,
            detail,
        });
    }
}