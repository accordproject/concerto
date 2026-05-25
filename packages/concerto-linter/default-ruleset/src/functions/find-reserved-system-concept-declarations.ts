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
import semver from 'semver';

const RESERVED_SYSTEM_CONCEPT_NAMES = new Set([
    'Concept',
    'Asset',
    'Transaction',
    'Participant',
    'Event',
]);

interface Declaration {
    name?: string;
}

interface Model {
    namespace?: string;
    declarations?: Declaration[];
    concertoVersion?: string;
}

interface ReservedSystemConceptOptions {
    dangerouslyAllowReservedSystemTypeNamesInUserModels?: boolean;
}

function isLegacyOrV3Model(model: Model): boolean {
    if (typeof model.concertoVersion === 'string') {
        const minimumVersion = semver.minVersion(model.concertoVersion);
        if (minimumVersion) {
            return minimumVersion.major === 3;
        }
    }

    return typeof model.namespace === 'string' && !model.namespace.includes('@');
}

/**
 * Finds declaration names that collide with reserved Concerto system concepts
 * in risky compatibility contexts.
 *
 * @param {unknown} targetVal The AST node to check, expected to be a Concerto model.
 * @param {ReservedSystemConceptOptions} options Rule options controlling v4 dangerous mode behavior.
 * @returns {IFunctionResult[]} A result for each matching declaration.
 */
export const findReservedSystemConceptDeclarations: IFunction = (
    targetVal,
    options?: unknown,
): IFunctionResult[] => {
    if (typeof targetVal !== 'object' || targetVal === null) {
        throw new Error('Value must be a valid AST object for a Concerto model.');
    }

    const model = targetVal as Model;
    if (!Array.isArray(model.declarations)) {
        return [];
    }

    const functionOptions = options as ReservedSystemConceptOptions | undefined;
    const dangerousModeEnabled = Boolean(functionOptions?.dangerouslyAllowReservedSystemTypeNamesInUserModels);
    const shouldReport = isLegacyOrV3Model(model) || dangerousModeEnabled;

    if (!shouldReport) {
        return [];
    }

    return model.declarations.reduce<IFunctionResult[]>((results, declaration) => {
        if (!declaration?.name || !RESERVED_SYSTEM_CONCEPT_NAMES.has(declaration.name)) {
            return results;
        }

        results.push({
            message: `Declaration '${declaration.name}' collides with a reserved Concerto system concept. Rename the declaration, disable dangerouslyAllowReservedSystemTypeNamesInUserModels, or migrate safely before relying on this model.`,
        });

        return results;
    }, []);
};
