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
// ClassDeclaration (accordproject/concerto#1239): the engine validates the
// document exactly as `Serializer.fromJSON` with `validate: true` would,
// without building a resource, and reports `fromJSON`'s first error, then
// (with `collectAll`) every other violation. A document the engine cannot
// read is validated by `fromJSON` itself (`routed`), so the verdict and
// exception class are always `fromJSON`'s. A valid instance's `resource` is
// built on first read; `validateInstanceOrThrow` throws with the
// diagnostics as `details`.

import { asUnsupported, handleFor, optionsText, withPreparedWire } from './serializer';
import Serializer from '../serializer';
import { encodeBytes, encodeValue } from './serializer-codec';
import { EngineFastPathUnsupported, isFastPathUnsupported } from './util';
import TypeNotFoundException from '../typenotfoundexception';

/* eslint-disable no-unused-vars */
import type BaseModelManager from '../basemodelmanager';
import type { ValidateInstanceOptions, ValidationDiagnostic, ValidationResult } from '../types';
/* eslint-enable no-unused-vars */

/** The engine's `validateInstance` modes (concerto-wasm). */
const THROW = 0;
const FIRST = 1;
const ALL = 2;

/**
 * The `fromJSON` options to validate with: the manager's Serializer
 * defaults, then `options`; `permitResourcesForRelationships` turns on
 * `acceptResourcesForRelationships`.
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
 * The document object (JSON text is parsed first) and its wire encoding, as
 * `fromJSON`'s fast path sends it: the compact binary layout where it can
 * (`encodeBytes`, copied, as the writer's bytes last only until its next
 * write), else the wire text (`encodeValue`); `wire` is undefined for a
 * document that must be routed.
 */
function documentOf(json: unknown): { object: any; wire: Uint8Array | string | undefined } {
    const object = typeof json === 'string' ? JSON.parse(json) : json;
    return { object, wire: wireOf(object) };
}

/** `documentOf`'s wire encoding of the parsed document `object`. */
function wireOf(object: any): Uint8Array | string | undefined {
    const bytes = encodeBytes(object);
    if (bytes !== undefined) {
        return bytes.slice();
    }
    let encoded;
    try {
        encoded = encodeValue(object);
    } catch (err) {
        if (isFastPathUnsupported(err)) {
            return undefined;
        }
        throw err;
    }
    return JSON.stringify(encoded);
}

/**
 * The merged options' wire text, as `fromJSON`'s fast path encodes them
 * (`optionsText`), so the engine reuses its serializer. Options it cannot
 * encode throw `EngineFastPathUnsupported`, and the document is routed to
 * `fromJSON`, as the fast path routes them.
 */
function mergedText(merged: any): string {
    try {
        return optionsText(merged);
    } catch (err) {
        throw asUnsupported(err);
    }
}

/** What `engineCall` returns when the engine cannot read the document. */
const UNSUPPORTED = Symbol('unsupported');

/**
 * The engine's `validateInstance` result text, or `UNSUPPORTED` when it
 * cannot read the document. Any other error is thrown.
 */
function engineCall(modelManager: BaseModelManager, doc, merged: any, fqn: string | undefined, mode: number): string | typeof UNSUPPORTED {
    try {
        const handle = handleFor(modelManager);
        const options = mergedText(merged);
        return typeof doc.wire === 'string'
            ? handle.validateInstance(doc.wire, options, fqn, mode)
            : handle.validateInstanceBytes(doc.wire, options, fqn, mode);
    } catch (err) {
        if (asUnsupported(err) instanceof EngineFastPathUnsupported) {
            return UNSUPPORTED;
        }
        throw err;
    }
}

/**
 * The diagnostics of an error `fromJSON` threw for a routed document: its
 * `details`, else one built from the error and the `$.` path it names.
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
 * A routed document through `fromJSON` itself; with `fqn`, the engine first
 * checks its `$class` is or extends `fqn`. Returns `{ resource }` or `{ error }`.
 */
function routed(modelManager: BaseModelManager, doc, merged: any, fqn?: string): { resource?: any; error?: any } {
    const object = doc.object;
    const $class = object !== null && typeof object === 'object' ? object.$class : undefined;
    if (fqn !== undefined && typeof $class === 'string' && $class !== '' && $class !== fqn) {
        const handle = handleFor(modelManager);
        const skeleton = JSON.stringify({ $class });
        // Only the `$class` is checked here, which no option changes: options
        // the fast path cannot encode are left out.
        let options;
        try {
            options = mergedText(merged);
        } catch (err) {
            if (!(err instanceof EngineFastPathUnsupported)) {
                throw err;
            }
            options = 'null';
        }
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

/** Applies `includeActual` and `redactMessages` to the diagnostics. */
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

/** `err`, with `includeActual` and `redactMessages` applied to its `details`. */
function withDetails(err: any, options: ValidateInstanceOptions, doc): any {
    if (err && Array.isArray(err.details)) {
        finish(err.details, options, doc);
    }
    return err;
}

/** The document for `fromJSON`, given a `$class` of `fqn` when it has none. */
function withClass(object: any, fqn?: string): any {
    if (fqn === undefined || object === null || typeof object !== 'object' || Array.isArray(object) || object.$class) {
        return object;
    }
    return Object.assign({ $class: fqn }, object);
}

/** `validateInstance` (accordproject/concerto#1239); `fqn` defaults to the document's `$class`. */
function validateInstance(modelManager: BaseModelManager, json: unknown, options: ValidateInstanceOptions = {}, fqn?: string): ValidationResult<any> {
    const doc = documentOf(json);
    const merged = fromJsonOptions(modelManager, options);
    const out = doc.wire === undefined ? UNSUPPORTED : engineCall(modelManager, doc, merged, fqn, options.collectAll === false ? FIRST : ALL);
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
    // Parsed here from JSON text, the document is ours alone, so the
    // resource is read from the wire encoding the engine just validated.
    const ours = typeof json === 'string';
    let resource;
    Object.defineProperty(result, 'resource', {
        enumerable: true,
        configurable: true,
        get: () => resource ?? (resource = hydrate(modelManager, doc, merged, fqn, ours)),
    });
    return result;
}

/**
 * The resource `fromJSON` builds for a valid document; with `ours` (the
 * document is unchanged since `doc.wire` was written) and the Serializer's
 * own `fromJSON`, the document is not encoded again.
 */
function hydrate(modelManager: BaseModelManager, doc, merged: any, fqn: string | undefined, ours: boolean): any {
    const serializer = modelManager.getSerializer();
    const object = withClass(doc.object, fqn);
    if (ours && object === doc.object && doc.wire !== undefined && serializer.fromJSON === Serializer.prototype.fromJSON) {
        return withPreparedWire(object, doc.wire, () => serializer.fromJSON(object, merged));
    }
    return serializer.fromJSON(object, merged);
}

/** `validateInstanceOrThrow`; returns the resource, or `null` with `hydrate: false`. */
function validateInstanceOrThrow(modelManager: BaseModelManager, json: unknown, options: ValidateInstanceOptions = {}, fqn?: string): any {
    const object = typeof json === 'string' ? JSON.parse(json) : json;
    const merged = fromJsonOptions(modelManager, options);
    // A document of its own type (or none) goes straight to fromJSON, which
    // encodes it itself, so it is not encoded here first; one that fromJSON
    // must route takes its visitor path there, as `routed` would send it.
    const sameType = fqn === undefined || (object && typeof object === 'object' && (!object.$class || object.$class === fqn));
    const direct = options.hydrate !== false && sameType;
    const doc = { object, wire: direct ? undefined : wireOf(object) };
    if (!direct) {
        if (doc.wire === undefined) {
            return viaFromJson(modelManager, doc, merged, options, fqn);
        }
        let out;
        try {
            out = engineCall(modelManager, doc, merged, fqn, THROW);
        } catch (err) {
            throw withDetails(err, options, doc);
        }
        if (out === UNSUPPORTED) {
            return viaFromJson(modelManager, doc, merged, options, fqn);
        }
        if (options.hydrate === false) {
            return null;
        }
    }
    try {
        // Without `direct`, nothing ran since the document was encoded:
        // fromJSON sends those bytes.
        return direct
            ? modelManager.getSerializer().fromJSON(withClass(object, fqn), merged)
            : hydrate(modelManager, doc, merged, fqn, true);
    } catch (err) {
        if (direct && isRouted(object)) {
            routedDiagnostics(err);
        }
        throw withDetails(err, options, doc);
    }
}

/** `validateInstanceOrThrow` of a routed document, through `fromJSON` (`routed`). */
function viaFromJson(modelManager: BaseModelManager, doc, merged: any, options: ValidateInstanceOptions, fqn?: string): any {
    const { resource, error } = routed(modelManager, doc, merged, fqn);
    if (error !== undefined) {
        throw withDetails(error, options, doc);
    }
    return options.hydrate === false ? null : resource;
}

/**
 * Whether `routed` would have sent `object` to `fromJSON`: the wire cannot
 * carry it. False when encoding it throws (fromJSON threw that error).
 */
function isRouted(object: any): boolean {
    try {
        return wireOf(object) === undefined;
    } catch {
        return false;
    }
}

export { validateInstance, validateInstanceOrThrow };
