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

import type { IFunction, IFunctionResult } from '@stoplight/spectral-core';

interface StringLengthValidator {
  $class: 'concerto.metamodel@1.0.0.StringLengthValidator';
  minLength: number;
  maxLength: number;
}

interface StringObject {
  name: string;
  lengthValidator?: StringLengthValidator;
}

/**
 * Checks if a String object has a length validator.
 *
 * @param {unknown} targetVal The AST node to check, expected to be a StringProperty or StringScalar object.
 * @returns {IFunctionResult[] | void} An array of results indicating declarations that lack a length validator.
 * @throws {Error} If the input is not a valid object.
 */
export const checkLengthValidator: IFunction = (targetVal): IFunctionResult[] => {
    // Validate that targetVal is a non-null object
    if (targetVal === null || typeof targetVal !== 'object') {
        throw new Error('Input must be a valid String AST object.');
    }

    const stringObject = targetVal as StringObject;
    const results: IFunctionResult[] = [];

    // Check for missing length validator
    if (!stringObject.lengthValidator) {
        results.push({
            message: `String '${stringObject.name}' must have a length validator.`,
        });
    }

    return results;
};