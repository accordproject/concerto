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

import { EnumValueDeclaration, Field } from '@accordproject/concerto-core';
import { getClassDeclarationType, getPropertyType } from '../compare-utils';
import { ComparerFactory } from '../comparer';

const propertyAdded: ComparerFactory = (context) => ({
    compareProperty: (a, b) => {
        if (a || !b) {
            return;
        }
        const classDeclarationType = getClassDeclarationType(b.getParent());
        if (b instanceof EnumValueDeclaration) {
            context.report({
                key: 'enum-value-added',
                message: `The enum value "${b.getName()}" was added to the ${classDeclarationType} "${b.getParent().getName()}"`,
                element: b,
            });
            return;
        }
        const isOptional = b.isOptional();
        const hasDefault = b instanceof Field ? !!b.getDefaultValue() : false;
        const required = !isOptional && !hasDefault;
        const type = getPropertyType(b);
        if (required) {
            context.report({
                key: 'required-property-added',
                message: `The required ${type} "${b.getName()}" was added to the ${classDeclarationType} "${b.getParent().getName()}"`,
                element: b,
            });
        } else {
            context.report({
                key: 'optional-property-added',
                message: `The optional ${type} "${b.getName()}" was added to the ${classDeclarationType} "${b.getParent().getName()}"`,
                element: b,
            });
        }
    }
});

const propertyRemoved: ComparerFactory = (context) => ({
    compareProperty: (a, b) => {
        if (!a || b) {
            return;
        }
        const classDeclarationType = getClassDeclarationType(a.getParent());
        if (a instanceof EnumValueDeclaration) {
            context.report({
                key: 'enum-value-removed',
                message: `The enum value "${a.getName()}" was removed from the ${classDeclarationType} "${a.getParent().getName()}"`,
                element: b,
            });
            return;
        }
        const isOptional = a.isOptional();
        const hasDefault = a instanceof Field ? !!a.getDefaultValue() : false;
        const required = !isOptional && !hasDefault;
        const type = getPropertyType(a);
        if (required) {
            context.report({
                key: 'required-property-removed',
                message: `The required ${type} "${a.getName()}" was removed from the ${classDeclarationType} "${a.getParent().getName()}"`,
                element: a
            });
        } else {
            context.report({
                key: 'optional-property-removed',
                message: `The optional ${type} "${a.getName()}" was removed from the ${classDeclarationType} "${a.getParent().getName()}"`,
                element: a
            });
        }
    }
});

const propertyTypeChanged: ComparerFactory = (context) => ({
    compareProperty: (a, b) => {
        if (!a || !b) {
            return;
        }
        const aType = getPropertyType(a);
        const bType = getPropertyType(b);
        const classDeclarationType = getClassDeclarationType(a.getParent());
        if (aType !== bType) {
            context.report({
                key: 'property-type-changed',
                message: `The ${aType} "${a.getName()}" in the ${classDeclarationType} "${a.getParent().getName()}" changed type from ${aType} to ${bType}`,
                element: a
            });
            return;
        } else if (a instanceof EnumValueDeclaration || b instanceof EnumValueDeclaration) {
            return;
        }
        const aIsArray = a.isArray();
        const bIsArray = b.isArray();
        if (aIsArray && !bIsArray) {
            context.report({
                key: 'property-type-changed',
                message: `The array ${aType} "${a.getName()}" in the ${classDeclarationType} "${a.getParent().getName()}" changed type from an array ${aType} to a scalar ${aType}`,
                element: a
            });
        } else if (!aIsArray && bIsArray) {
            context.report({
                key: 'property-type-changed',
                message: `The scalar ${aType} "${a.getName()}" in the ${classDeclarationType} "${a.getParent().getName()}" changed type from a scalar ${aType} to an array ${aType}`,
                element: a
            });
        }
    },
});

export const propertyComparerFactories = [propertyAdded, propertyRemoved, propertyTypeChanged];
