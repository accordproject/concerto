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

'use strict';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type { IDecorator } from '@accordproject/concerto-metamodel';
import type { TypedStack } from '@accordproject/concerto-util';
import type BaseModelManager from './basemodelmanager';
import type Factory from './factory';
import type Typed from './model/typed';
import type { EmptyValueGenerator } from './serializer/valuegenerator';
/* eslint-enable no-unused-vars */

export interface ModelManagerOptions {
    regExp?: RegExp;
    metamodelValidation?: boolean;
    addMetamodel?: boolean;
    // Transitional migration escape hatch for legacy models.
    // This option is temporary and will be removed in a future release.
    dangerouslyAllowReservedSystemTypeNamesInUserModels?: boolean;
    decoratorValidation?: {
        missingDecorator?: string;
        invalidDecorator?: string;
    };
    skipLocationNodes?: boolean;
    offline?: boolean;
    utcOffset?: number;
}

export interface ModelFileSource {
    ast: unknown;
    definitions: string | null;
    fileName: string;
}

/**
 * Options accepted by Serializer#toJSON, Serializer#fromJSON and the
 * visitors they drive.
 */
export interface SerializerOptions {
    /** validate the structure of the Resource against its model. Defaults to true. */
    validate?: boolean;
    /** convert resources supplied for relationship fields into relationships. */
    convertResourcesToRelationships?: boolean;
    /** permit resources in the place of relationships, serializing them as resources. */
    permitResourcesForRelationships?: boolean;
    /** accept JSON objects in the place of relationships when deserializing. */
    acceptResourcesForRelationships?: boolean;
    /** serialize repeated resources once, writing only $id for later instances. */
    deduplicateResources?: boolean;
    /** convert resources supplied for relationship fields into their id. */
    convertResourcesToId?: boolean;
    /** UTC offset, in minutes, for DateTime values. */
    utcOffset?: number;
    /** only allow fully-qualified date-times with offsets. */
    strictQualifiedDateTimes?: boolean;
}

/** Whether to upsert or append the decorator. */
export type DecoratorCommandType = 'UPSERT' | 'APPEND';

/** Map declaration elements that can be targeted by a decorator command. */
export type DecoratorCommandMapElement = 'KEY' | 'VALUE' | 'KEY_VALUE';

/**
 * Which model elements to add the decorator to. Any absent element is a
 * wildcard. Mirrors `CommandTarget` in the decorator command set model.
 */
export interface DecoratorCommandTarget {
    $class?: string;
    namespace?: string;
    declaration?: string;
    property?: string;
    /** mutually exclusive with `property` */
    properties?: string[];
    type?: string;
    mapElement?: DecoratorCommandMapElement;
}

/**
 * Applies a decorator to a given target. Mirrors `Command` in the decorator
 * command set model.
 */
export interface DecoratorCommand {
    $class?: string;
    target: DecoratorCommandTarget;
    decorator: IDecorator;
    type: DecoratorCommandType;
    decoratorNamespace?: string;
}

/**
 * A named and versioned set of decorator commands. Mirrors
 * `DecoratorCommandSet` in the decorator command set model.
 */
export interface DecoratorCommandSet {
    $class?: string;
    name: string;
    version: string;
    includes?: Array<{ name: string; version: string }>;
    commands: DecoratorCommand[];
}

/**
 * Field generation options accepted by Factory#newResource and friends.
 */
export interface GenerateOptions {
    /** skip validation of the created instance. */
    disableValidation?: boolean;
    /** 'sample' for realistic values, 'empty' for empty ones. */
    generate?: string;
    /** also generate values for optional fields. */
    includeOptionalFields?: boolean;
}

/**
 * The parameters an InstanceGenerator walks a declaration with, assembled by
 * Factory#parseGenerateOptions.
 */
export interface InstanceGeneratorParameters {
    modelManager: BaseModelManager;
    factory: Factory;
    valueGenerator: EmptyValueGenerator;
    includeOptionalFields: boolean;
    stack?: TypedStack<Typed>;
    seen?: string[];
}
