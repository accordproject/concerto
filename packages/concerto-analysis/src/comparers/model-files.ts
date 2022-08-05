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

import { ModelUtil } from '@accordproject/concerto-core';
import { ComparerFactory } from '../comparer';

const namespaceChanged: ComparerFactory = (context) => ({
    compareModelFiles: (a, b) => {
        const { name: aName } = ModelUtil.parseNamespace(a.getNamespace());
        const { name: bName } = ModelUtil.parseNamespace(b.getNamespace());
        if (aName !== bName) {
            context.report({
                key: 'namespace-changed',
                message: `The namespace was changed from "${aName}" to "${bName}"`,
                element: a
            });
            return;
        }
    }
});

export const modelFileComparerFactories = [namespaceChanged];
