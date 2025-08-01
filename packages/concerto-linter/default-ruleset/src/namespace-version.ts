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
 * Rule: Namespace Should Specify a Version
 * ----------------------------------------
 * Ensures that the namespace declaration in the model includes a version number.
 * This rule enforces semantic versioning in namespaces, promoting clarity and compatibility management.
 */
export default {
    description: 'namespace should specify a version.',
    given: '$.models[0].namespace',
    message: 'namespace \'{{value}}\' should specify a version.',
    severity: 0, // 0 = error, 1 = warning, 2 = info, 3 = hint
    then: {
        function: pattern,
        functionOptions: {
            match: /@\d+\.\d+\.\d+/,
        },
    },
};

