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

import { Type, TypeHelpOptions } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsDate,
    IsEnum,
    IsInstance,
    IsInt,
    IsNumber,
    IsOptional,
    IsString,
    Matches,
    Max,
    Min,
    ValidateNested
} from 'class-validator';
import { findType } from './types';

interface StringPropertyOptions {
    optional?: boolean;
    regex?: RegExp;
}

export function StringProperty(
    options?: StringPropertyOptions
): PropertyDecorator {
    return function (target, propertyKey) {
        IsString()(target, propertyKey);
        if (options?.optional) {
            IsOptional()(target, propertyKey);
        }
        if (options?.regex) {
            Matches(options.regex)(target, propertyKey);
        }
    };
}

interface StringArrayPropertyOptions {
    optional?: boolean;
    regex?: RegExp;
}

export function StringArrayProperty(
    options?: StringArrayPropertyOptions
): PropertyDecorator {
    return function (target, propertyKey) {
        IsArray()(target, propertyKey);
        IsString({ each: true })(target, propertyKey);
        if (options?.optional) {
            IsOptional()(target, propertyKey);
        }
        if (options?.regex) {
            Matches(options.regex, { each: true })(target, propertyKey);
        }
    };
}

interface DoublePropertyOptions {
    optional?: boolean;
    minimum?: number;
    maximum?: number;
}

export function DoubleProperty(
    options?: DoublePropertyOptions
): PropertyDecorator {
    return function (target, propertyKey) {
        IsNumber()(target, propertyKey);
        if (options?.optional) {
            IsOptional()(target, propertyKey);
        }
        if (typeof options?.minimum === 'number') {
            Min(options.minimum)(target, propertyKey);
        }
        if (typeof options?.maximum === 'number') {
            Max(options.maximum)(target, propertyKey);
        }
    };
}

interface DoubleArrayPropertyOptions {
    optional?: boolean;
    minimum?: number;
    maximum?: number;
}

export function DoubleArrayProperty(
    options?: DoubleArrayPropertyOptions
): PropertyDecorator {
    return function (target, propertyKey) {
        IsArray()(target, propertyKey);
        IsNumber(undefined, { each: true })(target, propertyKey);
        if (options?.optional) {
            IsOptional()(target, propertyKey);
        }
        if (typeof options?.minimum === 'number') {
            Min(options.minimum, { each: true })(target, propertyKey);
        }
        if (typeof options?.maximum === 'number') {
            Max(options.maximum, { each: true })(target, propertyKey);
        }
    };
}

interface IntegerPropertyOptions {
    optional?: boolean;
    minimum?: number;
    maximum?: number;
}

export function IntegerProperty(
    options?: IntegerPropertyOptions
): PropertyDecorator {
    return function (target, propertyKey) {
        IsInt()(target, propertyKey);
        if (options?.optional) {
            IsOptional()(target, propertyKey);
        }
        if (typeof options?.minimum === 'number') {
            Min(options.minimum)(target, propertyKey);
        }
        if (typeof options?.maximum === 'number') {
            Max(options.maximum)(target, propertyKey);
        }
    };
}

interface IntegerArrayPropertyOptions {
    optional?: boolean;
    minimum?: number;
    maximum?: number;
}

export function IntegerArrayProperty(
    options?: IntegerArrayPropertyOptions
): PropertyDecorator {
    return function (target, propertyKey) {
        IsArray()(target, propertyKey);
        IsInt({ each: true })(target, propertyKey);
        if (options?.optional) {
            IsOptional()(target, propertyKey);
        }
        if (typeof options?.minimum === 'number') {
            Min(options.minimum, { each: true })(target, propertyKey);
        }
        if (typeof options?.maximum === 'number') {
            Max(options.maximum, { each: true })(target, propertyKey);
        }
    };
}

interface LongPropertyOptions {
    optional?: boolean;
    minimum?: number;
    maximum?: number;
}

export function LongProperty(options?: LongPropertyOptions): PropertyDecorator {
    return function (target, propertyKey) {
        IsInt()(target, propertyKey);
        if (options?.optional) {
            IsOptional()(target, propertyKey);
        }
        if (typeof options?.minimum === 'number') {
            Min(options.minimum)(target, propertyKey);
        }
        if (typeof options?.maximum === 'number') {
            Max(options.maximum)(target, propertyKey);
        }
    };
}

interface LongArrayPropertyOptions {
    optional?: boolean;
    minimum?: number;
    maximum?: number;
}

export function LongArrayProperty(
    options?: LongArrayPropertyOptions
): PropertyDecorator {
    return function (target, propertyKey) {
        IsArray()(target, propertyKey);
        IsInt({ each: true })(target, propertyKey);
        if (options?.optional) {
            IsOptional()(target, propertyKey);
        }
        if (typeof options?.minimum === 'number') {
            Min(options.minimum, { each: true })(target, propertyKey);
        }
        if (typeof options?.maximum === 'number') {
            Max(options.maximum, { each: true })(target, propertyKey);
        }
    };
}

interface DateTimePropertyOptions {
    optional?: boolean;
}

export function DateTimeProperty(
    options?: DateTimePropertyOptions
): PropertyDecorator {
    return function (target, propertyKey) {
        Type(() => Date)(target, propertyKey);
        IsDate()(target, propertyKey);
        if (options?.optional) {
            IsOptional()(target, propertyKey);
        }
    };
}

interface DateTimeArrayPropertyOptions {
    optional?: boolean;
}

export function DateTimeArrayProperty(
    options?: DateTimeArrayPropertyOptions
): PropertyDecorator {
    return function (target, propertyKey) {
        IsArray()(target, propertyKey);
        Type(() => Date)(target, propertyKey);
        IsDate({ each: true })(target, propertyKey);
        if (options?.optional) {
            IsOptional()(target, propertyKey);
        }
    };
}

interface BooleanPropertyOptions {
    optional?: boolean;
}

export function BooleanProperty(
    options?: BooleanPropertyOptions
): PropertyDecorator {
    return function (target, propertyKey) {
        IsBoolean()(target, propertyKey);
        if (options?.optional) {
            IsOptional()(target, propertyKey);
        }
    };
}

interface BooleanArrayPropertyOptions {
    optional?: boolean;
}

export function BooleanArrayProperty(
    options?: BooleanArrayPropertyOptions
): PropertyDecorator {
    return function (target, propertyKey) {
        IsArray()(target, propertyKey);
        IsBoolean({ each: true })(target, propertyKey);
        if (options?.optional) {
            IsOptional()(target, propertyKey);
        }
    };
}

interface ConstructorType<InstanceType> {
    new (): InstanceType;
}

interface ConceptPropertyOptions {
    optional?: boolean;
    type: ConstructorType<unknown>;
}

// eslint-disable-next-line @typescript-eslint/ban-types
function resolveConceptType(typeHelpOptions: TypeHelpOptions | undefined, expectedType: Function): Function {
    if (!typeHelpOptions) {
        // As far as I can tell this never happens.
        return expectedType;
    }
    const object = typeHelpOptions.object;
    const property = typeHelpOptions.property;
    const item = object[property];
    const $class: string | undefined = item.$class;
    if (!$class) {
        // Assume that the expected type is correct.
        return expectedType;
    }
    const namespace = $class.slice(0, $class.lastIndexOf('.'));
    const name = $class.slice($class.lastIndexOf('.') + 1);
    const type = findType(namespace, name);
    return type.constructor;
}

// eslint-disable-next-line @typescript-eslint/ban-types
function resolveConceptArrayType(typeHelpOptions: TypeHelpOptions | undefined, expectedType: Function): Function {
    if (!typeHelpOptions) {
        // As far as I can tell this never happens.
        return expectedType;
    }
    const object = typeHelpOptions.object;
    const $class: string | undefined = object.$class;
    if (!$class) {
        // Assume that the expected type is correct.
        return expectedType;
    }
    const namespace = $class.slice(0, $class.lastIndexOf('.'));
    const name = $class.slice($class.lastIndexOf('.') + 1);
    const type = findType(namespace, name);
    return type.constructor;
}

export function ConceptProperty(
    options: ConceptPropertyOptions
): PropertyDecorator {
    return function (target, propertyKey) {
        Type(type => resolveConceptType(type, options.type))(target, propertyKey);
        IsInstance(options.type)(target, propertyKey);
        ValidateNested()(target, propertyKey);
        if (options?.optional) {
            IsOptional()(target, propertyKey);
        }
    };
}

interface ConceptArrayPropertyOptions {
    optional?: boolean;
    type: ConstructorType<unknown>;
}

export function ConceptArrayProperty(
    options: ConceptArrayPropertyOptions
): PropertyDecorator {
    return function (target, propertyKey) {
        Type(type => resolveConceptArrayType(type, options.type), {
            discriminator: {
                property: '$class',
                subTypes: []
            },
            keepDiscriminatorProperty: true,
        })(target, propertyKey);
        IsArray()(target, propertyKey);
        IsInstance(options.type, { each: true })(target, propertyKey);
        ValidateNested({ each: true })(target, propertyKey);
        if (options?.optional) {
            IsOptional()(target, propertyKey);
        }
    };
}

interface EnumPropertyOptions {
    optional?: boolean;
    type: Record<string, string>;
}

export function EnumProperty(options: EnumPropertyOptions): PropertyDecorator {
    return function (target, propertyKey) {
        IsEnum(options.type)(target, propertyKey);
        if (options?.optional) {
            IsOptional()(target, propertyKey);
        }
    };
}

interface EnumArrayPropertyOptions {
    optional?: boolean;
    type: Record<string, string>;
}

export function EnumArrayProperty(
    options: EnumArrayPropertyOptions
): PropertyDecorator {
    return function (target, propertyKey) {
        IsArray()(target, propertyKey);
        IsEnum(options.type, { each: true })(target, propertyKey);
        if (options?.optional) {
            IsOptional()(target, propertyKey);
        }
    };
}

interface RelationshipPropertyOptions {
    optional?: boolean;
    type: ConstructorType<unknown>;
}

export function RelationshipProperty(
    options: RelationshipPropertyOptions
): PropertyDecorator {
    return function (target, propertyKey) {
        IsString()(target, propertyKey);
        if (options?.optional) {
            IsOptional()(target, propertyKey);
        }
    };
}

interface RelationshipArrayPropertyOptions {
    optional?: boolean;
    type: ConstructorType<unknown>;
}

export function RelationshipArrayProperty(
    options: RelationshipArrayPropertyOptions
): PropertyDecorator {
    return function (target, propertyKey) {
        IsArray()(target, propertyKey);
        IsString({ each: true })(target, propertyKey);
        if (options?.optional) {
            IsOptional()(target, propertyKey);
        }
    };
}
