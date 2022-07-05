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

import 'reflect-metadata';

const typeSymbol = Symbol.for('concerto-runtime:type');

export interface TypedOptions {
    namespace: string;
    name: string;
}

export interface Type {
    // eslint-disable-next-line @typescript-eslint/ban-types
    constructor: Function;
    namespace: string;
    name: string;
}

type TypeRegistry = Record<string, Type>;

const typeRegistry: TypeRegistry = {};

export function Typed(options: TypedOptions): ClassDecorator {
    return function (target) {
        const type: Type = {
            ...options,
            constructor: target,
        };
        const typeKey = `${type.namespace}.${type.name}`;
        typeRegistry[typeKey] = type;
        Reflect.defineMetadata(typeSymbol, type, target);
    };
}

export function findType(namespace: string, name: string): Type {
    const typeKey = `${namespace}.${name}`;
    const type = typeRegistry[typeKey];
    if (!type) {
        throw new Error(`no registered type with namespace "${namespace}" and name "${name}"`);
    }
    return type;
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function isTyped(target: Object): boolean {
    if (typeof target !== 'function') {
        return isTyped(target.constructor);
    }
    return Reflect.hasMetadata(typeSymbol, target);
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function getType(target: Object): Type {
    if (typeof target !== 'function') {
        return getType(target.constructor);
    }
    const type = Reflect.getMetadata(typeSymbol, target);
    if (!type) {
        throw new Error('target is not typed');
    }
    return type;
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function getSuperType(target: Object): Type | undefined {
    if (typeof target !== 'function') {
        return getSuperType(target.constructor);
    }
    const superClass = Object.getPrototypeOf(target);
    if (!superClass.name) {
        return undefined;
    }
    return getType(superClass);
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function getSuperTypes(target: Object): Type[] {
    if (typeof target !== 'function') {
        return getSuperTypes(target.constructor);
    }
    const result: Type[] = [];
    let superClass = Object.getPrototypeOf(target);
    while (superClass.name) {
        result.push(getType(superClass));
        superClass = Object.getPrototypeOf(superClass);
    }
    return result;
}
