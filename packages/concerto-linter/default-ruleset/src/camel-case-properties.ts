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
 * Rule: Camel Case Properties
 * ---------------------------
 * Ensures that properties of type String, Double, Integer, Long, DateTime, and Boolean
 * are named using camelCase. This promotes consistency and readability in property naming
 * conventions across the model.
 */
export default {
    description: 'Properties of type String, Double, Integer, Long, DateTime, Boolean should be camelCase.',
    given: '$.models[*].declarations[?(@.$class && @.$class != "concerto.metamodel@1.0.0.EnumDeclaration")].properties[*].name',
    message: 'Property \'{{value}}\' should be camelCase (e.g. \'myProperty\')',
    severity: 0, // 0 = error, 1 = warning, 2 = info, 3 = hint
    then: {
        function: casing,
        functionOptions: {
            type: 'camel',
        },
    },
};
