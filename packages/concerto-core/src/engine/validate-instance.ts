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
// The engine reads the document as `fromJSON`'s own wire encoding
// (`encodeValue`), never as `JSON.stringify` text, so a value plain JSON
// cannot hold (an `undefined` field, `-0`, `NaN`, a Map, ...) reaches it as
// `fromJSON` sends it, and keeps the engine's structured diagnostics,
// `collectAll` and `hydrate: false`. Only a document the engine cannot read
// at all, where `fromJSON` itself falls back to its TS path
// (`EngineFastPathUnsupported`: a Date, an object with `toJSON`, a lone
// surrogate, a function, ...), is validated by `fromJSON` itself (`routed`),
// so the verdict, and the exception class, are always `fromJSON`'s,
// whatever `hydrate` is.
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
 * The document: the object `Serializer.fromJSON` is given (JSON text is
 * parsed first, as `JSON.parse` reads it) and its wire text, the one
 * `fromJSON` hands the engine.
 *
 * The text is `fromJSON`'s own wire encoding (`encodeValue`), not
 * `JSON.stringify`, which would turn a value plain JSON cannot hold into
 * another one (a Date into a string, `NaN` into `null`, an object with
 * `toJSON` into what it returns, `undefined` into nothing): a tagged value
 * (`undefined`, `-0`, `NaN`, a Map, ...) reaches the engine as it reaches
 * it from `fromJSON`. A document `encodeValue` cannot carry (`fromJSON`
 * falls back to its TS path) has no text: it is validated by `fromJSON`
 * itself (`routed`), so the verdict is always `fromJSON`'s.
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
 * The wire text of the merged `fromJSON` options (P5-101, E-7): the same
 * encoding `Serializer.fromJSON`'s fast path sends (`encodeValue`, as
 * `optionsText` writes it), so the engine reads them, and keeps the
 * serializer it builds for them, as it does for `fromJSON` (its cache is
 * keyed by this text). The merged object is new on every call, so it is not
 * remembered here (`optionsText`'s cache is by object). Options that
 * encoding cannot carry (a value of a class it does not know) are sent as
 * `JSON.stringify` writes them, as before.
 * @param {object} merged the merged `fromJSON` options
 * @return {string} their text
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
 * the engine cannot read its wire encoding, where `fromJSON` itself falls
 * back to its TS path (`asUnsupported`), for the caller to route it
 * (`routed`). Any other error, an invalid document's in `THROW` mode
 * included, is thrown.
 * @param {BaseModelManager} modelManager the model manager
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
 * The diagnostics of `err`, which `Serializer.fromJSON` threw for a routed
 * document (`documentOf`): its own `details` when it has them, else one
 * diagnostic built from the error (a type violation, or a type not found),
 * located by the `$.` path its message names, when it names one. Attached
 * to `err` as its `details`, so the exception and `validateInstance` agree.
 * @param {*} err the error thrown
 * @return {ValidationDiagnostic[]} the diagnostics
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
 * A routed document (`documentOf`) through `Serializer.fromJSON` itself:
 * with `fqn`, its `$class` is first checked to be or extend `fqn`, by the
 * engine (over the `$class` alone, which is plain JSON), as
 * `validateInstance` checks it for any other document.
 * @param {BaseModelManager} modelManager the model manager
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
 * @param {BaseModelManager} modelManager the model manager
 * @param {object|string} json the document, or its JSON text
 * @param {ValidateInstanceOptions} [options] the options
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
    // A document of its own type (or with none) goes straight to fromJSON,
    // which throws the same error; another type (a subtype, or a mismatch)
    // is checked against `fqn` first.
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
