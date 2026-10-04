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

// `validateInstance` and `validateInstanceOrThrow` on BaseModelManager and
// ClassDeclaration (accordproject/concerto#1239), over the engine's
// `validateInstance`: it validates the document exactly as
// `Serializer.fromJSON` with `validate: true` and the same options does,
// without building a resource, and reports the error `fromJSON` would throw
// first, then (with `collectAll`) every other violation.
//
// The engine reads `fromJSON`'s own wire encoding (`encodeValue`), so a value
// plain JSON cannot hold reaches it as `fromJSON` sends it. A document the
// engine cannot read at all, where `fromJSON` falls back to its TS path, is
// validated by `fromJSON` itself (`routed`), so the verdict and the
// exception class are always `fromJSON`'s.
//
// - `validateInstance` returns a ValidationResult; a valid instance's
//   `resource` is built on first read, never with `hydrate: false`.
// - `validateInstanceOrThrow` throws what `fromJSON` throws, with the
//   diagnostics as `details`, and returns the Resource (`null` with
//   `hydrate: false`).

import { asUnsupported, handleFor } from './serializer';
import { encodeValue } from './serializer-codec';
import { EngineFastPathUnsupported, isFastPathUnsupported } from './util';
import TypeNotFoundException from '../typenotfoundexception';

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
 * The document: the object `Serializer.fromJSON` is given (JSON text is
 * parsed first) and its wire text (`encodeValue`, not `JSON.stringify`, so
 * `undefined`, `-0`, `NaN` or a Map reach the engine as from `fromJSON`). A
 * document `encodeValue` cannot carry has no text, and is routed.
 * @param {object|string} json the document: a JSON object, or its text
 * @return {object} `{ object, text }`, `text` being `undefined` for a routed document
 */
function documentOf(json: unknown): { object: any; text: string | undefined } {
    const object = typeof json === 'string' ? JSON.parse(json) : json;
    let encoded;
    try {
        encoded = encodeValue(object);
    } catch (err) {
        if (isFastPathUnsupported(err)) {
            return { object, text: undefined };
        }
        throw err;
    }
    return { object, text: JSON.stringify(encoded) };
}

/**
 * The wire text of the merged `fromJSON` options, encoded as the fast path
 * encodes them, so the engine reuses the serializer it keyed by this text.
 * Options that encoding cannot carry are sent as `JSON.stringify` text.
 * @param {object} merged the merged `fromJSON` options
 */
function mergedText(merged: any): string {
    try {
        return JSON.stringify(encodeValue(merged));
    } catch (err) {
        if (isFastPathUnsupported(err)) {
            return JSON.stringify(merged);
        }
        throw err;
    }
}

/** What `engineCall` returns when the engine cannot read the document. */
const UNSUPPORTED = Symbol('unsupported');

/**
 * The engine's `validateInstance` for the document, or `UNSUPPORTED` when
 * the engine cannot read its wire encoding (the caller then routes it). Any
 * other error, an invalid document's in `THROW` mode included, is thrown.
 * @param {object} doc the document (`documentOf`), with its text
 * @param {object} merged the `fromJSON` options
 * @param {string|undefined} fqn the type to validate it as
 * @param {number} mode `THROW`, `FIRST` or `ALL`
 * @return {string|symbol} the engine's result text, or `UNSUPPORTED`
 */
function engineCall(modelManager: BaseModelManager, doc, merged: any, fqn: string | undefined, mode: number): string | typeof UNSUPPORTED {
    try {
        return handleFor(modelManager).validateInstance(doc.text, mergedText(merged), fqn, mode);
    } catch (err) {
        if (asUnsupported(err) instanceof EngineFastPathUnsupported) {
            return UNSUPPORTED;
        }
        throw err;
    }
}

/**
 * The diagnostics of `err`, which `fromJSON` threw for a routed document:
 * its own `details`, else one diagnostic built from the error, located by the
 * `$.` path its message names. Attached to `err` as its `details`.
 */
function routedDiagnostics(err: any): ValidationDiagnostic[] {
    if (err && Array.isArray(err.details) && err.details.length > 0) {
        return err.details;
    }
    const message = err && typeof err.message === 'string' ? err.message : String(err);
    const named = /`\$((?:\.[^.`[\]]+|\[\d+\])*)`/.exec(message);
    const path = named
        ? named[1].replace(/\[(\d+)\]/g, '.$1').split('.').slice(1).map((k) => '/' + k.replace(/~/g, '~0').replace(/\//g, '~1')).join('')
        : '';
    const details: ValidationDiagnostic[] = [{
        code: err instanceof TypeNotFoundException ? 'TYPE_NOT_FOUND' : 'TYPE_VIOLATION',
        path,
        severity: 'error',
        message,
    }];
    if (err !== null && typeof err === 'object') {
        Object.defineProperty(err, 'details', { value: details, enumerable: false, writable: true, configurable: true });
    }
    return details;
}

/**
 * A routed document through `Serializer.fromJSON` itself; with `fqn`, the
 * engine first checks its `$class` (plain JSON) is or extends `fqn`.
 * @param {object} doc the document (`documentOf`)
 * @param {object} merged the `fromJSON` options
 * @param {string} [fqn] the type to validate it as
 * @return {object} `{ resource }`, or `{ error }`, what fromJSON threw
 */
function routed(modelManager: BaseModelManager, doc, merged: any, fqn?: string): { resource?: any; error?: any } {
    const object = doc.object;
    const $class = object !== null && typeof object === 'object' ? object.$class : undefined;
    if (fqn !== undefined && typeof $class === 'string' && $class !== '' && $class !== fqn) {
        const handle = handleFor(modelManager);
        const skeleton = JSON.stringify({ $class });
        const options = mergedText(merged);
        const first = JSON.parse(handle.validateInstance(skeleton, options, fqn, FIRST)).diagnostics[0];
        if (first && first.path === '' && (first.code === 'NOT_ASSIGNABLE' || first.code === 'TYPE_NOT_FOUND')) {
            try {
                handle.validateInstance(skeleton, options, fqn, THROW);
            } catch (error) {
                return { error };
            }
        }
    }
    try {
        return { resource: modelManager.getSerializer().fromJSON(withClass(object, fqn), merged) };
    } catch (error) {
        routedDiagnostics(error);
        return { error };
    }
}

/** The value a JSON Pointer names in `root`, or `undefined`. */
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

/** A message built from a diagnostic's value-free fields only. */
function redactedMessage(d: ValidationDiagnostic): string {
    const where = d.path === '' ? 'the instance' : `\`${d.path}\``;
    return `${d.code} at ${where}` + (d.expected === undefined ? '' : `: expected ${d.expected}`);
}

/**
 * Applies `includeActual` and `redactMessages` to the engine's diagnostics.
 * @param {object} doc the document (`documentOf`)
 */
function finish(diagnostics: ValidationDiagnostic[], options: ValidateInstanceOptions, doc): ValidationDiagnostic[] {
    for (const d of diagnostics) {
        if (options.includeActual === true) {
            const actual = valueAt(doc.object, d.path);
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
 * @param {object} doc the document (`documentOf`)
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
 * @param {string} [fqn] the type it is validated as
 */
function withClass(object: any, fqn?: string): any {
    if (fqn === undefined || object === null || typeof object !== 'object' || Array.isArray(object) || object.$class) {
        return object;
    }
    return Object.assign({ $class: fqn }, object);
}

/**
 * `validateInstance` (accordproject/concerto#1239).
 * @param {object|string} json the document, or its JSON text
 * @param {string} [fqn] the type to validate it as (ClassDeclaration), else its own `$class`
 */
function validateInstance(modelManager: BaseModelManager, json: unknown, options: ValidateInstanceOptions = {}, fqn?: string): ValidationResult<any> {
    const doc = documentOf(json);
    const merged = fromJsonOptions(modelManager, options);
    const out = doc.text === undefined ? UNSUPPORTED : engineCall(modelManager, doc, merged, fqn, options.collectAll === false ? FIRST : ALL);
    if (out === UNSUPPORTED) {
        const { resource, error } = routed(modelManager, doc, merged, fqn);
        if (error !== undefined) {
            const all = finish(routedDiagnostics(error).map((d) => Object.assign({}, d)), options, doc);
            const errors = all.filter((d) => d.severity === 'error');
            return { valid: false, resource: null, errors: options.collectAll === false ? errors.slice(0, 1) : errors, warnings: [] };
        }
        return { valid: true, warnings: [], resource: options.hydrate === false ? null : resource };
    }
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
        get: () => resource ?? (resource = modelManager.getSerializer().fromJSON(withClass(doc.object, fqn), merged)),
    });
    return result;
}

/**
 * `validateInstanceOrThrow` (accordproject/concerto#1239).
 * @param {object|string} json the document, or its JSON text
 * @param {string} [fqn] the type to validate it as (ClassDeclaration), else its own `$class`
 * @return {Resource|null} the resource, or `null` with `hydrate: false`
 */
function validateInstanceOrThrow(modelManager: BaseModelManager, json: unknown, options: ValidateInstanceOptions = {}, fqn?: string): any {
    const doc = documentOf(json);
    const merged = fromJsonOptions(modelManager, options);
    const viaFromJson = () => {
        const { resource, error } = routed(modelManager, doc, merged, fqn);
        if (error !== undefined) {
            throw withDetails(error, options, doc);
        }
        return options.hydrate === false ? null : resource;
    };
    if (doc.text === undefined) {
        return viaFromJson();
    }
    const object = doc.object;
    // A document of its own type (or with none) goes straight to fromJSON;
    // another type is checked against `fqn` first.
    const sameType = fqn === undefined || (object && typeof object === 'object' && (!object.$class || object.$class === fqn));
    if (options.hydrate === false || !sameType) {
        let out;
        try {
            out = engineCall(modelManager, doc, merged, fqn, THROW);
        } catch (err) {
            throw withDetails(err, options, doc);
        }
        if (out === UNSUPPORTED) {
            return viaFromJson();
        }
        if (options.hydrate === false) {
            return null;
        }
    }
    try {
        return modelManager.getSerializer().fromJSON(withClass(object, fqn), merged);
    } catch (err) {
        throw withDetails(err, options, doc);
    }
}

export { validateInstance, validateInstanceOrThrow };
