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
import { RESERVED_SYSTEM_TYPE_NAMES } from '../no-reserved-system-type-names';

const RESERVED_KEYWORDS = /^(String|Double|Integer|Long|DateTime|Boolean|scalar|concept|enum|asset|participant|transaction|event|map|optional|length|regex|range|default)$/i;

/**
 * Reports names that match a reserved keyword (case-insensitive).
 *
 * A declaration named exactly like a Concerto system type (for example `Asset`)
 * is left to the `no-reserved-system-type-names` rule, which explains the clash,
 * so that the same name is not reported twice.
 * @param {unknown} targetVal - the name being checked
 * @param {unknown} _options - unused
 * @param {object} context - Spectral context, used for the path of the name
 * @returns {IFunctionResult[]} the violations, if any
 */
export const findReservedKeywords: IFunction = (targetVal, _options, context): IFunctionResult[] => {
    if (typeof targetVal !== 'string' || !RESERVED_KEYWORDS.test(targetVal)) {
        return [];
    }

    const path = context.path;
    const isDeclarationName = path.length === 5 && path[2] === 'declarations' && path[4] === 'name';
    if (isDeclarationName && RESERVED_SYSTEM_TYPE_NAMES.includes(targetVal)) {
        return [];
    }

    return [{ message: `Name "${targetVal}" is a reserved keyword.` }]; // overridden by the rule's message
};
