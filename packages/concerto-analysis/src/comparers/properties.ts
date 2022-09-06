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

import { EnumValueDeclaration, Field, ModelUtil } from '@accordproject/concerto-core';
import * as semver from 'semver';
import { getClassDeclarationType, getPropertyType, getValidatorType } from '../compare-utils';
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
            return;
        } else {
            context.report({
                key: 'optional-property-added',
                message: `The optional ${type} "${b.getName()}" was added to the ${classDeclarationType} "${b.getParent().getName()}"`,
                element: b,
            });
            return;
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
            return;
        } else {
            context.report({
                key: 'optional-property-removed',
                message: `The optional ${type} "${a.getName()}" was removed from the ${classDeclarationType} "${a.getParent().getName()}"`,
                element: a
            });
            return;
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
            return;
        } else if (!aIsArray && bIsArray) {
            context.report({
                key: 'property-type-changed',
                message: `The scalar ${aType} "${a.getName()}" in the ${classDeclarationType} "${a.getParent().getName()}" changed type from a scalar ${aType} to an array ${aType}`,
                element: a
            });
            return;
        }
        const aFQTN = a.getFullyQualifiedTypeName();
        const bFQTN = b.getFullyQualifiedTypeName();
        const aTypeName = ModelUtil.getShortName(aFQTN);
        const bTypeName = ModelUtil.getShortName(bFQTN);
        if (aTypeName !== bTypeName) {
            context.report({
                key: 'property-type-changed',
                message: `The ${aType} "${a.getName()}" in the ${classDeclarationType} "${a.getParent().getName()}" changed type from "${aFQTN}" to "${bFQTN}" (type name differs)`,
                element: a
            });
            return;
        }
        const aTypeFullNamespace = ModelUtil.getNamespace(aFQTN);
        const bTypeFullNamespace = ModelUtil.getNamespace(bFQTN);
        if (!aTypeFullNamespace && !bTypeFullNamespace) {
            return;
        }
        // Removing until we support type aliasing. Until then it's not possible to have an empty namespace
        // (i.e. a primitive type) and to have the namespace change between versions
        // else if (!aTypeFullNamespace || !bTypeFullNamespace) {
        //     context.report({
        //         key: 'property-type-changed',
        //         message: `The ${aType} "${a.getName()}" in the ${classDeclarationType} "${a.getParent().getName()}" changed type from "${aFQTN}" to "${bFQTN}" (type namespace differs)`,
        //         element: a
        //     });
        //     return;
        // }
        const { name: aTypeNamespace, version: aTypeVersion } = ModelUtil.parseNamespace(aTypeFullNamespace);
        const { name: bTypeNamespace, version: bTypeVersion } = ModelUtil.parseNamespace(bTypeFullNamespace);
        if (aTypeNamespace !== bTypeNamespace) {
            context.report({
                key: 'property-type-changed',
                message: `The ${aType} "${a.getName()}" in the ${classDeclarationType} "${a.getParent().getName()}" changed type from "${aFQTN}" to "${bFQTN}" (type namespace differs)`,
                element: a
            });
            return;
        }
        // Removing until the Compare.compare function supports a non-strict modelManager
        // if (!aTypeVersion && !bTypeVersion) {
        //     return;
        // } else if (!aTypeVersion || !bTypeVersion) {
        //     context.report({
        //         key: 'property-type-changed',
        //         message: `The ${aType} "${a.getName()}" in the ${classDeclarationType} "${a.getParent().getName()}" changed type from "${aFQTN}" to "${bFQTN}" (type version incompatible)`,
        //         element: a
        //     });
        //     return;
        // }
        const versionDiff = semver.diff(aTypeVersion, bTypeVersion);
        if (!versionDiff) {
            return;
        } else if (versionDiff === 'major' || versionDiff === 'premajor') {
            context.report({
                key: 'property-type-changed',
                message: `The ${aType} "${a.getName()}" in the ${classDeclarationType} "${a.getParent().getName()}" changed type from "${aFQTN}" to "${bFQTN}" (type version incompatible)`,
                element: a
            });
            return;
        }
    },
});

const propertyValidatorChanged: ComparerFactory = (context) => ({
    compareProperty: (a, b) => {
        if (!a || !b) {
            return;
        } else if (!(a instanceof Field)) {
            return;
        } else if (!(b instanceof Field)) {
            return;
        }
        const aValidator = a.getValidator();
        const bValidator = b.getValidator();
        const classDeclarationType = getClassDeclarationType(a.getParent());
        if (!aValidator && !bValidator) {
            return;
        } else if (!aValidator && bValidator) {
            const bValidatorType = getValidatorType(bValidator);
            context.report({
                key: 'property-validator-added',
                message: `A ${bValidatorType} validator was added to the field "${a.getName()}" in the ${classDeclarationType} "${a.getParent().getName()}"`,
                element: a
            });
            return;
        } else if (aValidator && !bValidator) {
            const aValidatorType = getValidatorType(aValidator);
            context.report({
                key: 'property-validator-removed',
                message: `A ${aValidatorType} validator was removed from the field "${a.getName()}" in the ${classDeclarationType} "${a.getParent().getName()}"`,
                element: a
            });
            return;
        } else if (!aValidator.compatibleWith(bValidator)) {
            const aValidatorType = getValidatorType(aValidator);
            context.report({
                key: 'property-validator-changed',
                message: `A ${aValidatorType} validator for the field "${a.getName()}" in the ${classDeclarationType} "${a.getParent().getName()}" was changed and is no longer compatible`,
                element: a
            });
            return;
        }
    }
});

export const propertyComparerFactories = [propertyAdded, propertyRemoved, propertyTypeChanged, propertyValidatorChanged];
