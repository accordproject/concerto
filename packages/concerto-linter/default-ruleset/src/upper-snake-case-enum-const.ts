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
 * Rule: Enum Constants Must Use UPPER_SNAKE_CASE
 * ----------------------------------------------
 * Enforces that all enum constant names follow the UPPER_SNAKE_CASE convention.
 * This rule checks each enum property name and reports an error if it does not match the required pattern.
 * Ensures consistency and readability in enum naming across the model.
 */
export default {

    description: 'Enum constants must use UPPER_SNAKE_CASE.',
    given: '$.models[*].declarations[?(@.$class == "concerto.metamodel@1.0.0.EnumDeclaration")].properties[*].name',
    message: 'Enum constant \'{{value}}\' should be UPPER_SNAKE_CASE (e.g. \'MY_CONSTANT\')',
    severity: 0, // 0 = error, 1 = warning, 2 = info, 3 = hint
    then: {
        function: pattern,
        functionOptions: {
            match: '^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$',
        },
    },
};
