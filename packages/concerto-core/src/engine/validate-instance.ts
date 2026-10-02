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

/* istanbul ignore file */
// P5-89 (accordproject/concerto-rust#435; accordproject/concerto#1239,
// #1325 and the instance side of #1273): `validateInstance` and
// `validateInstanceOrThrow` on BaseModelManager and ClassDeclaration, over
// the engine's `ModelManagerHandle.validateInstance` (concerto-wasm), which
// runs concerto-core's `instance::diagnose`. There is no second validator:
// the engine validates the document exactly as `Serializer.fromJSON` (with
// `validate: true` and the same options) does, without building a resource,
// and reports the error `fromJSON` would throw first, then (with
// `collectAll`) every other violation it finds.
//
// - `validateInstance` returns a ValidationResult. A valid instance's
//   `resource` is a getter: the Resource is built (by `Serializer.fromJSON`)
//   only when it is first read, and never with `hydrate: false`.
// - `validateInstanceOrThrow` throws what `Serializer.fromJSON` throws, the
//   error `validateInstance` reports first, with the diagnostics as the
//   exception's `details`; it returns the Resource (or `null` with
//   `hydrate: false`, when nothing is built).
//
// The consistency rule (validateInstance's first error is the one
// validateInstanceOrThrow and fromJSON throw) is checked over the oracle
// corpus by concerto-rust's native harness (`diagnose_agrees`,
// concerto-core/tests/oracle/instances.rs) and here by
// test-lifted/validate-instance.checks.js.

import { handleFor } from './serializer';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type BaseModelManager from '../basemodelmanager';
import type { ValidateInstanceOptions, ValidationDiagnostic, ValidationResult } from '../types';
/* eslint-enable no-unused-vars */

/** The engine's `validateInstance` modes (concerto-wasm). */
const THROW = 0;
const FIRST = 1;
const ALL = 2;

/**
 * The `Serializer.fromJSON` options a call validates with: the model
 * manager's Serializer defaults, then `options`; `permitResourcesForRelationships`
 * turns on `acceptResourcesForRelationships`.
 * @param {BaseModelManager} modelManager the model manager
 * @param {ValidateInstanceOptions} options the caller's options
 * @return {object} the merged `fromJSON` options
 */
function fromJsonOptions(modelManager: BaseModelManager, options: ValidateInstanceOptions): any {
    const merged: any = Object.assign({}, modelManager.getSerializer().defaultOptions, options, { validate: true });
    if (options.permitResourcesForRelationships === true) {
        merged.acceptResourcesForRelationships = true;
    }
    delete merged.permitResourcesForRelationships;
    for (const key of ['collectAll', 'hydrate', 'includeActual', 'redactMessages']) {
        delete merged[key];
    }
    return merged;
}

/**
 * The document as JSON text and as an object, parsed (or stringified) only
 * when asked for.
 * @param {object|string} json the document: a JSON object, or its text
 * @return {object} `{ text(), object() }`
 */
function documentOf(json: unknown) {
    let text: string | undefined = typeof json === 'string' ? json : undefined;
    let object: any = typeof json === 'string' ? undefined : json;
    return {
        text: (): string => text ?? (text = JSON.stringify(object === undefined ? null : object)),
        object: (): any => object !== undefined ? object : (object = JSON.parse(text as string)),
    };
}

/**
 * The value a JSON Pointer names in `root`, or `undefined`.
 * @param {*} root the document
 * @param {string} pointer the pointer
 * @return {*} the value
 */
function valueAt(root: any, pointer: string): unknown {
    if (pointer === '') {
        return root;
    }
    let value = root;
    for (const raw of pointer.slice(1).split('/')) {
        const key = raw.replace(/~1/g, '/').replace(/~0/g, '~');
        if (value === null || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, key)) {
            return undefined;
        }
        value = value[key];
    }
    return value;
}

/**
 * A message built from a diagnostic's value-free fields only (#1325).
 * @param {ValidationDiagnostic} d the diagnostic
 * @return {string} the message
 */
function redactedMessage(d: ValidationDiagnostic): string {
    const where = d.path === '' ? 'the instance' : `\`${d.path}\``;
    return `${d.code} at ${where}` + (d.expected === undefined ? '' : `: expected ${d.expected}`);
}

/**
 * Applies `includeActual` and `redactMessages` to the engine's diagnostics.
 * @param {ValidationDiagnostic[]} diagnostics the diagnostics
 * @param {ValidateInstanceOptions} options the caller's options
 * @param {object} doc the document (`documentOf`)
 * @return {ValidationDiagnostic[]} the diagnostics
 */
function finish(diagnostics: ValidationDiagnostic[], options: ValidateInstanceOptions, doc): ValidationDiagnostic[] {
    for (const d of diagnostics) {
        if (options.includeActual === true) {
            const actual = valueAt(doc.object(), d.path);
            if (actual !== undefined) {
                d.actual = actual;
            }
        }
        if (options.redactMessages === true) {
            d.message = redactedMessage(d);
        }
    }
    return diagnostics;
}

/**
 * `err`, with `includeActual` and `redactMessages` applied to its
 * `details`, when it has them.
 * @param {*} err the error thrown
 * @param {ValidateInstanceOptions} options the caller's options
 * @param {object} doc the document (`documentOf`)
 * @return {*} the error
 */
function withDetails(err: any, options: ValidateInstanceOptions, doc): any {
    if (err && Array.isArray(err.details)) {
        finish(err.details, options, doc);
    }
    return err;
}

/**
 * The document to hand `Serializer.fromJSON` for the type `fqn`: the
 * document itself, given a `$class` of `fqn` when it has none.
 * @param {*} object the document
 * @param {string} [fqn] the type it is validated as
 * @return {*} the document for fromJSON
 */
function withClass(object: any, fqn?: string): any {
    if (fqn === undefined || object === null || typeof object !== 'object' || Array.isArray(object) || object.$class) {
        return object;
    }
    return Object.assign({ $class: fqn }, object);
}

/**
 * `validateInstance` (accordproject/concerto#1239).
 * @param {BaseModelManager} modelManager the model manager
 * @param {object|string} json the document, or its JSON text
 * @param {ValidateInstanceOptions} [options] the options
 * @param {string} [fqn] the type to validate it as (ClassDeclaration), else its own `$class`
 * @return {ValidationResult} the result
 */
function validateInstance(modelManager: BaseModelManager, json: unknown, options: ValidateInstanceOptions = {}, fqn?: string): ValidationResult<any> {
    const doc = documentOf(json);
    const merged = fromJsonOptions(modelManager, options);
    const out = handleFor(modelManager).validateInstance(doc.text(), JSON.stringify(merged), fqn, options.collectAll === false ? FIRST : ALL);
    const diagnostics: ValidationDiagnostic[] = finish(JSON.parse(out).diagnostics, options, doc);
    const errors = diagnostics.filter((d) => d.severity === 'error');
    const warnings = diagnostics.filter((d) => d.severity !== 'error');
    if (errors.length > 0) {
        return { valid: false, resource: null, errors, warnings };
    }
    const result: any = { valid: true, warnings };
    if (options.hydrate === false) {
        result.resource = null;
        return result;
    }
    let resource;
    Object.defineProperty(result, 'resource', {
        enumerable: true,
        configurable: true,
        get: () => resource ?? (resource = modelManager.getSerializer().fromJSON(withClass(doc.object(), fqn), merged)),
    });
    return result;
}

/**
 * `validateInstanceOrThrow` (accordproject/concerto#1239).
 * @param {BaseModelManager} modelManager the model manager
 * @param {object|string} json the document, or its JSON text
 * @param {ValidateInstanceOptions} [options] the options
 * @param {string} [fqn] the type to validate it as (ClassDeclaration), else its own `$class`
 * @return {Resource|null} the resource, or `null` with `hydrate: false`
 */
function validateInstanceOrThrow(modelManager: BaseModelManager, json: unknown, options: ValidateInstanceOptions = {}, fqn?: string): any {
    const doc = documentOf(json);
    const merged = fromJsonOptions(modelManager, options);
    const object = typeof json === 'string' ? undefined : json as any;
    // A document of its own type (or with none) goes straight to fromJSON,
    // which throws the same error; another type (a subtype, or a mismatch)
    // is checked against `fqn` first.
    const sameType = fqn === undefined || (object && typeof object === 'object' && (!object.$class || object.$class === fqn));
    if (options.hydrate === false || !sameType) {
        try {
            handleFor(modelManager).validateInstance(doc.text(), JSON.stringify(merged), fqn, THROW);
        } catch (err) {
            throw withDetails(err, options, doc);
        }
        if (options.hydrate === false) {
            return null;
        }
    }
    try {
        return modelManager.getSerializer().fromJSON(withClass(doc.object(), fqn), merged);
    } catch (err) {
        throw withDetails(err, options, doc);
    }
}

export { validateInstance, validateInstanceOrThrow };
