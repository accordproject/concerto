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

import { ComparerFactory } from '../comparer.js';

const mapDeclarationTypeChanged: ComparerFactory = (context) => ({
    compareMapDeclaration: (a, b) => {

        if (!a || !b) {
            return;
        }

        if(a.getKey().getType() !== b.getKey().getType()) {
            context.report({
                key: 'map-key-type-changed',
                message: `The map key type was changed to "${b.getKey().getType()}"`,
                element: b
            });
        }

        if(a.getValue().getType() !== b.getValue().getType()) {
            context.report({
                key: 'map-value-type-changed',
                message: `The map value type was changed to "${b.getValue().getType()}"`,
                element: b
            });
        }
    },
});

export const mapDeclarationComparerFactories = [mapDeclarationTypeChanged];
