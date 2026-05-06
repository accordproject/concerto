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

import { findDuplicateProperties } from './functions/find-duplicate-properties';

/**
 * Rule: No Duplicate Properties
 * -----------------------------
 * Ensures that no declaration contains duplicate property names.
 * Duplicate properties can lead to silent overwrites and inconsistent
 * model behavior, as the parser does not reject them at parse time.
 */
export default {
    given: '$.models[*].declarations[*]',
    severity: 0, // 0 = error, 1 = warning, 2 = info, 3 = hint
    then: {
        function: findDuplicateProperties,
    },
};
