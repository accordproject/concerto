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
 * Rule: No Reserved Keywords with Declarations, Properties, and Decorators
 *
 * This rule enforces that names used for declarations, properties, and decorators
 * in Concerto models do not use reserved keywords. Reserved keywords are language-specific
 * terms that may cause conflicts or unexpected behavior if used as identifiers.
 * If a name matches any of the reserved keywords (case-insensitive), the linter will
 * report an error to prevent its usage.
 */
export default {
    description: 'Names should not be reserved words.',
    given: [
        '$.models[*].declarations[*].name',
        '$.models[*].declarations[*].properties[*].name',
        '$.models[*].decorators[*].name',
        '$.models[*].declarations[*].decorators[*].name',
        '$.models[*].declarations[*].properties[*].decorators[*].name'
    ],
    message: 'Name "{{value}}" is a reserved keyword.',
    severity: 0, // 0 = error, 1 = warning, 2 = info, 3 = hint
    then: {
        function: pattern,
        functionOptions: {
            notMatch: '/^(String|Double|Integer|Long|DateTime|Boolean|scalar|concept|enum|asset|participant|transaction|event|map|optional|length|regex|range|default)$/i'
        },
    },
};