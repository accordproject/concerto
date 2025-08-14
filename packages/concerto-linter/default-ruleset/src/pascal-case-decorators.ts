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

import { casing } from '@stoplight/spectral-functions';

/**
 * Rule: Pascal Case Decorators
 * ------------------------------
 * Ensures that decorator names follow PascalCase naming convention (e.g., 'MyDecorator').
 * This promotes consistency and readability across model decorators.
 */
export default {
    description: 'Decorators names should be PascalCase.',
    given: [
        '$.models[*].decorators[*].name',
        '$.models[*].declarations[*].decorators[*].name',
        '$.models[*].declarations[*].properties[*].decorators[*].name'
    ],
    message: 'Decorator \'{{value}}\' should be PascalCase (e.g. \'MyDecorator\')',
    severity: 0, // 0 = error, 1 = warning, 2 = info, 3 = hint
    then: {
        function: casing,
        functionOptions: {
            type: 'pascal',
        },
    },
};
