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

interface ScalarDeclaration {
    name?: string;
    validator?: unknown;
    defaultValue?: unknown;
    lengthValidator?: unknown;
}

/**
 * Checks if a scalar declaration is redundant by verifying the absence of enriching properties.
 *
 * A scalar is considered redundant if it does not define a validator, defaultValue, or lengthValidator.
 * If redundant, returns a result indicating that the scalar can be replaced by its primitive type.
 *
 * @param {unknown} targetVal The value to check, expected to be a scalar declaration object.
 * @return {IFunctionResult[]} An array of results indicating redundancy, or empty if not redundant.
 * @throws {Error} If the input is not a valid scalar declaration object.
 */
export const checkRedundantScalar: IFunction = (
    targetVal,
): IFunctionResult[] => {
    const results: IFunctionResult[] = [];

    // Validate that targetVal is a non-null object
    if (typeof targetVal !== 'object' || targetVal === null) {
        throw new Error('Value must be a scalar declaration object.');
    }
    const scalar = targetVal as ScalarDeclaration;

    // If any of the enriching properties are present, the scalar is NOT redundant.
    if (scalar.validator !== undefined || scalar.defaultValue !== undefined || scalar.lengthValidator !== undefined) {
        return results;
    }

    results.push({
        message: `Scalar '${scalar.name}' is redundant. Use the primitive type directly.`,
    });

    return results;
};
