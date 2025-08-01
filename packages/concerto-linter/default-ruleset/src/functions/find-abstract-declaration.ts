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
  isAbstract?: boolean;
  superType?: { name: string };
}

interface Model {
  declarations: Declaration[];
}

/**
 * Checks if each abstract declaration in the model has at least one concrete subclass.
 *
 * Iterates through the model's declarations, collects all abstract types,
 * and removes any abstract type that is extended by a concrete subclass.
 * Returns a result for each abstract type without a concrete subclass.
 *
 * @param {unknown} targetVal The AST model object containing declarations.
 * @returns {IFunctionResult[] | void} An array of results for abstract declarations lacking concrete subclasses.
 * @throws {Error} If the input is not a valid model AST.
 */
export const hasConcreteSubclass: IFunction = (
    targetVal,
): IFunctionResult[] | void => {
    const results: IFunctionResult[] = [];

    // Validate that targetVal is a non-null object
    if (typeof targetVal !== 'object' || !targetVal || !Array.isArray((targetVal as Model).declarations)) {
        throw new Error(`${targetVal} must be a valid AST for concerto model`);
    }

    const abstractNames = new Map<string, number>();
    const allDeclarations = (targetVal as Model).declarations;

    for (const [index, decl] of allDeclarations.entries()) {
        if (decl && decl.isAbstract && typeof decl.name === 'string') {
            abstractNames.set(decl.name, index);
        }
    }

    for (const decl of allDeclarations) {
        if (decl && !decl.isAbstract && decl.superType && typeof decl.superType.name === 'string') {
            abstractNames.delete(decl.superType.name);
        }
    }
    if (abstractNames.size > 0) {
        for (const [abstractName] of abstractNames) {
            results.push({
                message: `Abstract declaration '${abstractName}' must have concrete subclasses`,
            });
        }
    }
    return results;
};
