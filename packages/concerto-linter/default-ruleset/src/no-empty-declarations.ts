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

import { findEmptyDeclarations } from './functions/find-empty-declarations';

/**
 * Rule: No Empty Declarations
 * ---------------------------
 * Detects and reports any model declarations that are empty.
 * This rule helps maintain model integrity by ensuring that all declarations contain meaningful content,
 * preventing the inclusion of unused or placeholder declarations in the model.
 */
export default {
    given: '$.models[*].declarations[*]',
    severity: 0, // 0 = error, 1 = warning, 2 = info, 3 = hint
    then: {
        function: findEmptyDeclarations
    },
};

