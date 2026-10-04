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
    /**
     * @deprecated Ignored, with a warning (BC-28): regular expressions are
     * evaluated by the Concerto engine.
     */
    regExp?: RegExp;
    /**
     * The strict AST shape check at model load (BC-19, with BC-17, BC-18
     * and BC-20; on by default): unless this is `false`, a
     * ModelFile whose AST does not have the Concerto metamodel's shape is
     * rejected with an IllegalModelException when it is constructed. `true`
     * also runs `validateAst` in `addModelFile`. `false` is an
     * escape hatch for trusted input only: the shape check is skipped, and
     * code downstream of the load may assume a well-formed AST. A malformed
     * AST still throws an error when it is loaded, never a WASM trap or a
     * process crash, unless the loader can read it all the same (a node's
     * `$class` naming the wrong type, say); the error's class and message
     * are unspecified.
     */
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
    /** accordproject/concerto#1273, `fromJSON`: a key the type does not declare is an error, whatever its value. */
    rejectUnknownKeys?: boolean;
    /** accordproject/concerto#1273, `fromJSON`: a required property set to `null` is an error. */
    rejectRequiredNull?: boolean;
}

/**
 * The stable code of a validation diagnostic (accordproject/concerto#1239).
 */
export type ValidationDiagnosticCode =
    | 'MISSING_REQUIRED_PROPERTY'
    | 'UNDECLARED_FIELD'
    | 'TYPE_VIOLATION'
    | 'INVALID_ENUM_VALUE'
    | 'EMPTY_IDENTIFIER'
    | 'ABSTRACT_CLASS'
    | 'NOT_ASSIGNABLE'
    | 'NOT_RESOURCE'
    | 'NOT_RELATIONSHIP'
    | 'VALIDATOR_FAILURE'
    | 'TYPE_NOT_FOUND';

/**
 * One violation found by `validateInstance` (accordproject/concerto#1239),
 * also attached to the exception `validateInstanceOrThrow` and
 * `Serializer.fromJSON` throw, as its `details`.
 *
 * `code`, `path`, `expected` and `severity` never carry a value from the
 * instance (accordproject/concerto#1325), so they are safe to log or return
 * to a caller. `message` may quote the offending value; pass
 * `redactMessages: true` to get a message built from the value-free fields
 * only. `actual` is the offending value itself, present only with
 * `includeActual: true`.
 */
export interface ValidationDiagnostic {
    /** What kind of violation this is. */
    code: ValidationDiagnosticCode;
    /** A JSON Pointer (RFC 6901) to the offending location, e.g. `/parties/0/email`; `''` for the instance itself. */
    path: string;
    /** The type the model declares at `path` (`String`, `String[]`, `org.acme@1.0.0.Address`, `--> org.acme@1.0.0.Person`), when it declares one. */
    expected?: string;
    /** The value at `path` in the instance (opt-in: `includeActual`). */
    actual?: unknown;
    /** How serious the violation is: an `error` makes the instance invalid. */
    severity: 'error' | 'warning';
    /** A human-readable description. */
    message: string;
}

/**
 * Options of `validateInstance` and `validateInstanceOrThrow`
 * (accordproject/concerto#1239), with the instance side of
 * accordproject/concerto#1273. Every option is off by default except
 * `collectAll` and `hydrate`, which keeps today's `Serializer.fromJSON`
 * behaviour.
 */
export interface ValidateInstanceOptions {
    /** Report every violation found, not only the first. Defaults to true. */
    collectAll?: boolean;
    /** Make the valid instance's `resource` available (built when it is first read). Defaults to true; `false` validates only. */
    hydrate?: boolean;
    /** accordproject/concerto#1273: a key the type does not declare is an error, whatever its value. */
    rejectUnknownKeys?: boolean;
    /** accordproject/concerto#1273: a required property set to `null` is an error. */
    rejectRequiredNull?: boolean;
    /** Add each diagnostic's `actual` value from the instance (accordproject/concerto#1325: off by default). */
    includeActual?: boolean;
    /** Build each diagnostic's `message` from its value-free fields only (accordproject/concerto#1325). */
    redactMessages?: boolean;
    /** UTC offset, in minutes, for DateTime values, as `Serializer.fromJSON` takes it. */
    utcOffset?: number;
    /** Accept a JSON object in the place of a relationship, as `Serializer.fromJSON` does. */
    acceptResourcesForRelationships?: boolean;
    /** The same as `acceptResourcesForRelationships`. */
    permitResourcesForRelationships?: boolean;
    /** @deprecated Ignored, as in `Serializer.fromJSON` (BC-07): DateTime values are always strict. */
    strictQualifiedDateTimes?: boolean;
}

/**
 * What `validateInstance` returns (accordproject/concerto#1239): a valid
 * instance with its `resource` (built when first read, or `null` with
 * `hydrate: false`), or an invalid one with its `errors`, the first being
 * the error `validateInstanceOrThrow` throws.
 */
export type ValidationResult<R = unknown> =
    | { valid: true; readonly resource: R | null; warnings: ValidationDiagnostic[] }
    | { valid: false; resource: null; errors: ValidationDiagnostic[]; warnings: ValidationDiagnostic[] };

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
