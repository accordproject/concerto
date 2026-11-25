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

import { pattern } from '@stoplight/spectral-functions';

/**
 * The types declared in the Concerto system namespace (concerto@1.0.0).
 * Every user model imports them implicitly.
 */
export const RESERVED_SYSTEM_TYPE_NAMES = ['Concept', 'Asset', 'Participant', 'Transaction', 'Event'];

/**
 * Rule: No Reserved System Type Names
 *
 * Reports declarations whose name is exactly the name of a Concerto system type
 * (Concept, Asset, Participant, Transaction or Event).
 *
 * Concerto 4 and later rejects such a declaration when the model is loaded, because it
 * clashes with the implicitly imported system type. The ModelManager option
 * `dangerouslyAllowReservedSystemTypeNamesInUserModels` suppresses that check so older
 * (Concerto 3) models can be migrated, but the name stays ambiguous. The rule therefore
 * reports the declaration whatever runtime or options will load the model.
 */
export default {
    description: 'Declaration names should not clash with Concerto system types.',
    given: '$.models[*].declarations[*].name',
    message: 'Declaration "{{value}}" clashes with the Concerto system type concerto@1.0.0.{{value}}. ' +
        'Concerto 4+ rejects this model unless dangerouslyAllowReservedSystemTypeNamesInUserModels is enabled, ' +
        'and with that option (or in Concerto 3) the name is ambiguous. ' +
        'Rename the declaration, for example to "My{{value}}", so the model no longer depends on that option.',
    severity: 0, // 0 = error, 1 = warning, 2 = info, 3 = hint
    then: {
        function: pattern,
        functionOptions: {
            notMatch: `/^(${RESERVED_SYSTEM_TYPE_NAMES.join('|')})$/`
        },
    },
};
