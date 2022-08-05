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

import { Field } from '@accordproject/concerto-core';
import { getClassDeclarationType } from '../compare-utils';
import { ComparerFactory } from '../comparer';

const fieldAdded: ComparerFactory = (context) => ({
    compareProperty: (a, b) => {
        if (a || !b) {
            return;
        } else if (!(b instanceof Field)) {
            return;
        }
        const isOptional = b.isOptional();
        const hasDefault = !!b.getDefaultValue();
        const required = !isOptional && !hasDefault;
        const classDeclarationType = getClassDeclarationType(b.getParent());
        if (required) {
            context.report({
                key: 'required-field-added',
                message: `The required field "${b.getName()}" was added to the ${classDeclarationType} "${b.getParent().getName()}"`,
                element: b,
            });
        } else {
            context.report({
                key: 'optional-field-added',
                message: `The optional field "${b.getName()}" was added to the ${classDeclarationType} "${b.getParent().getName()}"`,
                element: b,
            });
        }
    }
});

const fieldRemoved: ComparerFactory = (context) => ({
    compareProperty: (a, b) => {
        if (!a || b) {
            return;
        } else if (!(a instanceof Field)) {
            return;
        }
        const classDeclarationType = getClassDeclarationType(a.getParent());
        context.report({
            key: 'field-removed',
            message: `The field "${a.getName()}" was removed from the ${classDeclarationType} "${a.getParent().getName()}"`,
            element: a
        });
    }
});

export const fieldComparerFactories = [fieldAdded, fieldRemoved];
