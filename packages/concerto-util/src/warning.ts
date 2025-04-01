/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * You may not use this file except in compliance with the License.
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
 * Emits a deprecation warning message to stderr only once.
 * This function ensures that the warning is not emitted multiple times in a single execution.
 * 
 * @param message - The message of the deprecation warning.
 * @param type - The type of the deprecation warning.
 * @param code - The code identifier for the deprecation warning.
 * @param detail - Additional details regarding the deprecation.
 */
export function printDeprecationWarning(message: string, type: string, code: string, detail: string): void {
    // Prevent duplicate warnings
    if (isWarningEmitted) return;

    isWarningEmitted = true;

    // Use process.emitWarning if available, otherwise fallback to console.warn
    if (typeof process.emitWarning === 'function') {
        process.emitWarning(`DEPRECATED: ${message}`, { type, code, detail });
    } else {
        console.warn(`DEPRECATED: ${message} (Type: ${type}, Code: ${code}, Detail: ${detail})`);
    }
}

/**
 * Resets the warning flag. This is useful for testing purposes to ensure
 * each test case runs in isolation.
 */
export function resetWarningFlag(): void {
    isWarningEmitted = false;
}
