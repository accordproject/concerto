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

interface Declaration {
    name: string;
    properties?: unknown[];
}

/**
 * Finds and reports empty Concerto Declarations (i.e., declarations with no properties).
 *
 * @param {unknown} targetVal The AST node to check, expected to be a Concerto Declaration object.
 * @returns {IFunctionResult[]} An array of results indicating declarations that are empty.
 * @throws {Error} If the input is not a valid object.
 */
export const findEmptyDeclarations: IFunction = (
    targetVal,
): IFunctionResult[] => {
    const results: IFunctionResult[] = [];

    // Validate that targetVal is a non-null object
    if (typeof targetVal !== 'object' || targetVal === null) {
        throw new Error('Value must be a valid AST object for a Concerto Declaration.');
    }

    // Ensure targetVal is a Declaration with a 'properties' field (not a scalar)
    if (!(targetVal as Declaration).properties)
    {
        return results;
    }

    const declaration = targetVal as Declaration;
    const properties = declaration.properties;

    // If 'properties' is missing, not an array, or empty, report an error
    if (!Array.isArray(properties) || properties.length === 0) {
        results.push({
            message: `Declaration '${declaration.name}' should not be empty and must declare at least one property.`,
        });
    }

    return results;
};
