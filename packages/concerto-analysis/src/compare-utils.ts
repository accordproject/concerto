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

import { ClassDeclaration, Declaration, EnumValueDeclaration, Field, MapDeclaration, ScalarDeclaration, NumberValidator, Property, RelationshipDeclaration, StringValidator, Validator } from '@accordproject/concerto-core';

interface DuckProperty {
    isField?: () => boolean;
    isRelationship?: () => boolean;
    isEnumValue?: () => boolean;
}

interface DuckValidator {
    getLowerBound?: () => number | null;
    getUpperBound?: () => number | null;
    getRegex?: () => RegExp | null;
    getMinLength?: () => number | null | undefined;
}

export function isClassDeclaration(declaration: Declaration): declaration is ClassDeclaration {
    return Boolean(declaration?.isClassDeclaration?.() || declaration instanceof ClassDeclaration);
}

export function isMapDeclaration(declaration: Declaration): declaration is MapDeclaration {
    return Boolean(declaration?.isMapDeclaration?.() || declaration instanceof MapDeclaration);
}

export function isScalarDeclaration(declaration: Declaration): declaration is ScalarDeclaration {
    return Boolean(declaration?.isScalarDeclaration?.() || declaration instanceof ScalarDeclaration);
}

export function isField(property: Property): property is Field {
    return Boolean((property as DuckProperty)?.isField?.() || property instanceof Field);
}

export function isRelationship(property: Property): property is RelationshipDeclaration {
    return Boolean((property as DuckProperty)?.isRelationship?.() || property instanceof RelationshipDeclaration);
}

export function isEnumValue(property: Property): property is EnumValueDeclaration {
    return Boolean((property as DuckProperty)?.isEnumValue?.() || property instanceof EnumValueDeclaration);
}

export function isNumberValidator(validator: Validator): validator is NumberValidator {
    return Boolean(validator instanceof NumberValidator || (typeof (validator as DuckValidator)?.getLowerBound === 'function' && typeof (validator as DuckValidator)?.getUpperBound === 'function'));
}

export function isStringValidator(validator: Validator): validator is StringValidator {
    return Boolean(validator instanceof StringValidator || (typeof (validator as DuckValidator)?.getRegex === 'function' || typeof (validator as DuckValidator)?.getMinLength === 'function'));
}

export function getDeclarationType(declaration: Declaration) {
    if (isClassDeclaration(declaration)) {
        if (declaration.isAsset()) {
            return 'asset';
        } else if (declaration.isConcept()) {
            return 'concept';
        } else if (declaration.isEnum()) {
            return 'enum';
        } else if (declaration.isEvent()) {
            return 'event';
        } else if (declaration.isParticipant()) {
            return 'participant';
        } else if (declaration.isTransaction()) {
            return 'transaction';
        } else {
            throw new Error(`unknown class declaration type "${declaration}"`);
        }
    } else if (isMapDeclaration(declaration)) {
        return 'map';
    } else if (isScalarDeclaration(declaration)) {
        return 'scalar';
    }
    else {
        throw new Error(`unknown declaration type "${declaration}"`);
    }
}

export function getPropertyType(property: Property) {
    if (isField(property)) {
        return 'field';
    } else if (isRelationship(property)) {
        return 'relationship';
    } else if (isEnumValue(property)) {
        return 'enum value';
    } else {
        throw new Error(`unknown property type "${property}"`);
    }
}

export function getValidatorType(validator: Validator) {
    if (isNumberValidator(validator)) {
        return 'number';
    } else if (isStringValidator(validator)) {
        return 'string';
    } else {
        throw new Error(`unknown validator type "${validator}"`);
    }
}
