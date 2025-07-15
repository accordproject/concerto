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

import { RulesetDefinition } from '@stoplight/spectral-core';
import { casing, pattern } from '@stoplight/spectral-functions';

const namingRules: RulesetDefinition = {
    rules: {
        'camel-case-declarations': {
            description: 'Declaration names (scalar, enum, concept, asset, participant, transaction, event) should be camelCase.',
            given: '$.models[*].declarations[*].name',
            message: 'Declaration \'{{value}}\' should be CamelCase (e.g. \'myDeclaration\')',
            severity: 'error',
            then: {
                function: casing,
                functionOptions: {
                    type: 'camel',
                },
            },
        },
        'pascal-case-properties': {
            description: 'Properties of type String, Double, Integer, Long, DateTime, Boolean should be PascalCase.',
            given: '$.models[*].declarations[?(@.$class && @.$class != "concerto.metamodel@1.0.0.EnumDeclaration")].properties[*].name',
            message: 'Property \'{{value}}\' should be PascalCase (e.g. \'MyProperty\')',
            severity: 'error',
            then: {
                function: casing,
                functionOptions: {
                    type: 'pascal',
                },
            },
        },
        'upper-snake-case-enum-constants': {
            description: 'Enum constants must use UPPER_SNAKE_CASE.',
            given: '$.models[*].declarations[?(@.$class == "concerto.metamodel@1.0.0.EnumDeclaration")].properties[*].name',
            message: 'Enum constant \'{{value}}\' should be UPPER_SNAKE_CASE (e.g. \'MY_CONSTANT\')',
            severity: 'error',
            then: {
                function: pattern,
                functionOptions: {
                    match: '^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$',
                },
            },
        }
    }
};
export default namingRules;