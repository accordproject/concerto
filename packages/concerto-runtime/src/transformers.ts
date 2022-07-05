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

import { ClassConstructor, instanceToPlain, plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import type { Concept } from './generated';
import { findType, isTyped } from './types';

interface ConstructorType<InstanceType> {
    new (): InstanceType;
}

interface ConcertoObject {
    $class?: string;
}

export function validate(instance: Concept): void {
    if (!isTyped(instance)) {
        throw new Error('cannot validate untyped object');
    }
    const errors = validateSync(instance);
    if (errors.length) {
        throw errors;
    }
}

function convertDataToObject(data: unknown): object {
    if (Buffer.isBuffer(data)) {
        return convertDataToObject(data.toString('utf-8'));
    } else if (typeof data === 'string') {
        return JSON.parse(data);
    } else if (!data || typeof data !== 'object') {
        throw new Error('invalid data');
    } else {
        return data;
    }
}

function parseWithConstructor<InstanceType extends Concept>(constructor: ConstructorType<InstanceType>, data: unknown): InstanceType {
    const dataAsObject = convertDataToObject(data);
    const instance = plainToInstance(constructor, dataAsObject);
    validate(instance);
    return instance;
}

function parseWithoutConstructor<InstanceType extends Concept>(data: unknown): InstanceType {
    const dataAsObject = convertDataToObject(data);
    const $class = (dataAsObject as ConcertoObject).$class;
    if (!$class) {
        throw new Error('no $class present');
    }
    const namespace = $class.slice(0, $class.lastIndexOf('.'));
    const name = $class.slice($class.lastIndexOf('.') + 1);
    const type = findType(namespace, name);
    const constructor = type.constructor;
    const instance = plainToInstance(constructor as ClassConstructor<InstanceType>, dataAsObject);
    validate(instance);
    return instance;
}

export function parse<InstanceType extends Concept>(constructor: ConstructorType<InstanceType>, data: Buffer): InstanceType;
export function parse<InstanceType extends Concept>(constructor: ConstructorType<InstanceType>, data: string): InstanceType;
export function parse<InstanceType extends Concept>(constructor: ConstructorType<InstanceType>, data: object): InstanceType;
export function parse<InstanceType extends Concept>(constructor: ConstructorType<InstanceType>, data: unknown): InstanceType;
export function parse<InstanceType extends Concept>(data: Buffer): InstanceType
export function parse<InstanceType extends Concept>(data: string): InstanceType
export function parse<InstanceType extends Concept>(data: object): InstanceType
export function parse<InstanceType extends Concept>(data: unknown): InstanceType
export function parse<InstanceType extends Concept>(constructorOrData: unknown, data?: unknown): InstanceType {
    if (typeof constructorOrData === 'function') {
        const constructor = constructorOrData as ConstructorType<InstanceType>;
        return parseWithConstructor(constructor, data);
    } else {
        return parseWithoutConstructor(constructorOrData);
    }
}

export function serialize<DataType>(instance: Concept): DataType {
    if (!isTyped(instance)) {
        throw new Error('cannot serialize untyped object');
    }
    validate(instance);
    return instanceToPlain(instance) as DataType;
}
