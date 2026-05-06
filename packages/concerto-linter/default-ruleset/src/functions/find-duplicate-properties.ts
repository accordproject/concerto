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

interface Property {
    name: string;
}

interface Declaration {
    name: string;
    properties?: Property[];
}

/**
 * Finds and reports duplicate property names within a Concerto Declaration.
 *
 * Iterates through the declaration's properties and reports an error for each
 * property name that appears more than once. This prevents silent overwrites
 * and ensures each property within a declaration is uniquely named.
 *
 * @param {unknown} targetVal The AST node to check, expected to be a Concerto Declaration object.
 * @returns {IFunctionResult[]} An array of results indicating declarations with duplicate properties.
 * @throws {Error} If the input is not a valid object.
 */
export const findDuplicateProperties: IFunction = (
    targetVal,
): IFunctionResult[] => {
    const results: IFunctionResult[] = [];

    // Validate that targetVal is a non-null object
    if (typeof targetVal !== 'object' || targetVal === null) {
        throw new Error('Value must be a valid AST object for a Concerto Declaration.');
    }

    const declaration = targetVal as Declaration;

    // Skip declarations without properties (e.g., enums, scalars)
    if (!Array.isArray(declaration.properties)) {
        return results;
    }

    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const property of declaration.properties) {
        if (property && typeof property.name === 'string') {
            if (seen.has(property.name)) {
                duplicates.add(property.name);
            }
            seen.add(property.name);
        }
    }

    for (const name of duplicates) {
        results.push({
            message: `Declaration '${declaration.name}' has duplicate property '${name}'.`,
        });
    }

    return results;
};
