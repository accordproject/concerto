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

// Instance validation in one engine call per resource.
//
// `ValidatedResource.validate()`, `setPropertyValue` and `addArrayValue`
// call `validateResource`/`validateProperty` first. Each writes the live
// value into the compact binary layout, already in the shape the engine's
// instance validator reads (`Instance::to_validator_value`'s): a
// `$class`-tagged object per Resource, `{$$relationship, $class, <id field>}`
// per Relationship, and `$$dayjs`/`$$undefined`/`$$number`/`$$map` markers.
// One engine call then returns a code: 0 valid; 1 a `Validation` error (TS
// throws `ValidationException` with the fetched message); 2 any other error
// (thrown through the error factory, `validateTakeError`); 3 the engine
// could not read the value, or its model lacks the property, so the caller
// runs the `ResourceValidator` visitor. A property is checked by its slot
// (`validatePropertyById`, looked up once per model version), which returns
// a `Validation` message itself and throws any other error itself.
//
// Both functions return `false`, for the visitor to run, only when the value
// cannot cross (`EngineFastPathUnsupported`: a lone surrogate, a function,
// symbol or BigInt, a class instance that is not a Resource or dayjs, a
// shared or cyclic reference, a `__proto__` or own `$class` key), when the
// validator is not a plain `ResourceValidator`, or, as a speed choice, for a
// primitive set on a plain field (`visitorIsCheaper`). A Resource whose
// `$identifierFieldName` is not its model's identifying field, or whose
// identifier is truthy but not a string, also takes the visitor. Any other
// outcome is final, with TS 5.0.0's exception class.
//
// The `$identifier` write-back of `ResourceValidator.visitClassDeclaration`
// happens while each Resource is written out, before the engine call. On a
// valid value that is what the visitor leaves; on an invalid one, a resource
// past the failing check also gets it (the visitor stops there), and so does
// a Resource held by a relationship field.

import { rust } from './index';
import { checkString, typedCtorName, modelClasses } from './serializer-codec';
import { EngineFastPathUnsupported, isDayjsLike, isTypedLike } from './util';
import { WireWriter } from './wire';
import { handleFor } from './serializer';
import { classDeclarationGetIdentifierFieldName } from './views';
import ValidationException from '../serializer/validationexception';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type { SerializerOptions } from '../types';
/* eslint-enable no-unused-vars */

// `Instance::to_validator_value`'s PRIVATE_ONLY_KEYS, which the engine drops
// from a Resource: TS skips them rather than send them.
const PRIVATE_ONLY = new Set([
    '$modelManager', '$classDeclaration', '$namespace', '$type', '$identifierFieldName',
    '$validator', '$imports', '$superTypes', '$id',
]);

const CODE_VALID = 0;
const CODE_VALIDATION = 1;
const CODE_UNSUPPORTED = 3;
/** `validatePropertyById`: the slot is not one of the handle's epoch. */
const CODE_STALE = 4;

/**
 * `Dayjs::to_iso_string`: `null` when the date is invalid or outside the
 * ECMAScript time range.
 */
function dayjsIso(d): string | null {
    return d.isValid() ? new Date(d.valueOf()).toISOString() : null;
}

/**
 * Marks `v` as visited: a value reached twice (a cycle or a shared
 * reference) cannot cross.
 * @param {object} v about to be encoded
 * @param {Set<object>} seen visited
 */
function visit(v: object, seen: Set<object>): void {
    if (seen.has(v)) {
        throw new EngineFastPathUnsupported('shared-or-cyclic-reference');
    }
    seen.add(v);
}

// ---------------------------------------------------------------------
// The binary layout (wire.ts)
// ---------------------------------------------------------------------

/** The writer every call writes its value into; wasm-bindgen copies the bytes in. */
const writer = new WireWriter(1 << 12);

/**
 * A live value, in one pass.
 * @param {Set<object>} seen visited objects
 */
function writeValue(v, seen: Set<object>): void {
    if (v === undefined) {
        writer.markerHead('$$undefined');
        writer.literal(true);
        return;
    }
    const t = typeof v;
    if (t === 'string') {
        writer.str(v);
        return;
    }
    if (v === null) {
        writer.literal(null);
        return;
    }
    if (t === 'boolean') {
        writer.literal(v);
        return;
    }
    if (t === 'number') {
        if (Number.isFinite(v)) {
            writer.num(v);
        } else {
            writer.markerHead('$$number');
            writer.str(String(v));
        }
        return;
    }
    if (t !== 'object') {
        throw new EngineFastPathUnsupported(`unsupported-value:${t}`);
    }
    if (Array.isArray(v)) {
        visit(v, seen);
        writer.array(v.length);
        for (let i = 0; i < v.length; i++) {
            writeValue(v[i], seen);
        }
        return;
    }
    if (v instanceof Map) {
        visit(v, seen);
        writer.markerHead('$$map');
        writer.array(v.size);
        v.forEach((x, k) => {
            writer.array(2);
            writeValue(k, seen);
            writeValue(x, seen);
        });
        return;
    }
    if (isDayjsLike(v)) {
        writer.markerHead('$$dayjs');
        const iso = dayjsIso(v);
        if (iso === null) {
            writer.literal(null);
        } else {
            writer.str(iso);
        }
        return;
    }
    if (isTypedLike(v)) {
        visit(v, seen);
        writeTyped(v, seen);
        return;
    }
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) {
        throw new EngineFastPathUnsupported(`instance:${(v.constructor && v.constructor.name) || 'Object'}`);
    }
    visit(v, seen);
    const countAt = writer.beginObject();
    let count = 0;
    for (const key of Object.keys(v)) {
        if (key === '__proto__') {
            throw new EngineFastPathUnsupported('proto-key');
        }
        writer.rawStr(key);
        writeValue(v[key], seen);
        count++;
    }
    writer.putU32(countAt, count);
}

/**
 * A live Resource/ValidatedResource/Relationship, as
 * `Instance::to_validator_value` builds it, with a Resource's `$identifier`
 * write-back (module doc).
 * @param {Set<object>} seen visited objects
 */
function writeTyped(v, seen: Set<object>): void {
    const ctor = typedCtorName(v);
    const fqn = v.getFullyQualifiedType();
    const countAt = writer.beginObject();
    let count;
    if (ctor === 'Relationship') {
        writer.rawStr('$$relationship');
        writer.literal(true);
        writer.rawStr('$class');
        writer.str(fqn);
        count = 2;
        const field = v.$identifierFieldName;
        const id = v[field];
        if (typeof id === 'string') {
            writer.rawStr(String(field));
            writer.str(id);
            count++;
        }
        writer.putU32(countAt, count);
        return;
    }
    // The engine reads a Resource's identifier from its model's identifying
    // field and treats a non-string as empty; the visitor reads
    // `getIdentifier()` and calls `trim()`. Where they can differ, the
    // visitor runs.
    const field = v.$identifierFieldName;
    if (field !== modelIdentifierField(v.$classDeclaration)) {
        throw new EngineFastPathUnsupported('identifier-field');
    }
    const id = v.getIdentifier();
    if (id && typeof id !== 'string') {
        throw new EngineFastPathUnsupported('identifier-type');
    }
    if (field !== '$identifier') {
        v.$identifier = id;
    }
    writer.rawStr('$class');
    writer.str(fqn);
    count = 1;
    for (const key of Object.keys(v)) {
        if (PRIVATE_ONLY.has(key)) {
            continue;
        }
        if (key === '__proto__') {
            throw new EngineFastPathUnsupported('proto-key');
        }
        if (key === '$class') {
            // The engine's `$class` comes first; an own `$class` would
            // replace its value in place. Left to the visitor.
            throw new EngineFastPathUnsupported('own-$class');
        }
        writer.rawStr(key);
        writeValue(v[key], seen);
        count++;
    }
    writer.putU32(countAt, count);
}

/**
 * The identifying field the engine uses for a Resource of `decl`
 * (`getIdentifierFieldName() || '$identifier'`), read through the view,
 * which checks the whole super type chain against the model epoch before it
 * reuses a cached answer.
 * @param {*} decl the Resource's `$classDeclaration`
 */
function modelIdentifierField(decl): string {
    if (!decl || typeof decl !== 'object' || typeof decl.getIdentifierFieldName !== 'function') {
        throw new EngineFastPathUnsupported('class-declaration');
    }
    return classDeclarationGetIdentifierFieldName(decl) || '$identifier';
}

// ---------------------------------------------------------------------
// The calls
// ---------------------------------------------------------------------

/**
 * The validator's options as the engine's bit set, or `-1` when the
 * validator is not a plain `ResourceValidator` (module doc).
 * @param {*} validator the instance's `$validator`
 */
function flagsOf(validator): number {
    if (!validator || validator.constructor !== modelClasses().ResourceValidator) {
        return -1;
    }
    const options: SerializerOptions = validator.options;
    if (!options) {
        return 0;
    }
    return (options.convertResourcesToRelationships ? 1 : 0) | (options.permitResourcesForRelationships ? 2 : 0);
}

/**
 * Throws the error behind a non-zero code, or returns `false` for
 * `CODE_UNSUPPORTED`.
 * @return {boolean} `true` when valid
 */
function outcome(code: number): boolean {
    if (code === CODE_VALID) {
        return true;
    }
    if (code === CODE_VALIDATION) {
        throw new ValidationException(rust.validateErrorMessage());
    }
    if (code === CODE_UNSUPPORTED) {
        rust.validateErrorMessage();
        return false;
    }
    throw rust.validateTakeError();
}

/**
 * `ValidatedResource.validate()` in one engine call.
 * @param {string} rootId its `getFullyQualifiedIdentifier()`
 * @return {boolean} `true` when valid; `false` when the engine cannot
 * validate it (the caller runs the visitor)
 * @throws {Error} the error TS throws for an invalid resource
 */
function validateResource(resource, rootId: string): boolean {
    const flags = flagsOf(resource.$validator);
    if (flags < 0) {
        return false;
    }
    let handle;
    try {
        checkString(rootId);
        handle = handleFor(resource.getModelManager());
        writer.begin();
        writeTyped(resource, new Set<object>([resource]));
    } catch (err) {
        writer.release();
        if (err instanceof EngineFastPathUnsupported) {
            return false;
        }
        throw err;
    }
    const code = handle.validateResourceBinary(writer.bytes(), rootId, flags);
    writer.release();
    return outcome(code);
}

/**
 * Whether the visitor checks `value` against `field` more cheaply than an
 * engine call: a string, number or boolean on a single primitive field with
 * no enum, scalar or validator, where the visitor does one type check (about
 * 0.55 µs against 1.3 µs for the engine call). Speed only: the visitor is
 * the TS reference path.
 * @param {*} field the property TS found on the class declaration
 * @return {boolean} `true` when the visitor should run
 */
function visitorIsCheaper(field, value): boolean {
    const t = typeof value;
    if (t !== 'string' && t !== 'number' && t !== 'boolean') {
        return false;
    }
    return typeof field.isField === 'function' && field.isField() &&
        !field.isArray() &&
        !field.isTypeEnum() &&
        !field.isTypeScalar() &&
        field.isPrimitive() &&
        field.getValidator() === null;
}

/**
 * `field.accept(this.$validator, parameters)` in
 * `ValidatedResource.setPropertyValue`/`addArrayValue`, in one engine call.
 * @param {string} propName the property TS found on its class declaration
 * @param {*} value the value to check (for `addArrayValue`, the new array)
 * @param {string} rootId the resource's `getFullyQualifiedIdentifier()`
 * @param {*} [field] the property's declaration; when given and
 * `visitorIsCheaper` holds, the visitor runs instead of the engine
 * @return {boolean} `true` when valid; `false` when the caller should run
 * the visitor (the engine cannot validate the value, or the visitor is the
 * cheaper path for it)
 * @throws {Error} the error TS throws for an invalid value
 */
function validateProperty(resource, propName: string, value, rootId: string, field?): boolean {
    if (field && visitorIsCheaper(field, value)) {
        return false;
    }
    const flags = flagsOf(resource.$validator);
    if (flags < 0) {
        return false;
    }
    let handle;
    try {
        checkString(propName);
        checkString(rootId);
        handle = handleFor(resource.getModelManager());
        writer.begin();
        writeValue(value, new Set<object>());
    } catch (err) {
        writer.release();
        if (err instanceof EngineFastPathUnsupported) {
            return false;
        }
        throw err;
    }
    const fqn = resource.getFullyQualifiedType();
    const slot = propertySlot(resource.getModelManager(), handle, fqn, propName);
    if (slot !== undefined) {
        // By the slot; a `Validation` error's message comes back in the
        // same call, and any other error is thrown by it.
        const result = handle.validatePropertyById(writer.bytes(), slot[0], slot[1], slot[2], rootId, flags);
        if (typeof result === 'string') {
            writer.release();
            throw new ValidationException(result);
        }
        if (result !== CODE_STALE) {
            writer.release();
            return result === CODE_VALID;
        }
        dropSlots(handle);
    }
    const code = handle.validatePropertyBinary(writer.bytes(), fqn, propName, rootId, flags);
    writer.release();
    return outcome(code);
}

/**
 * The `validatePropertyById` slots (`[declId, propIndex, epoch]`) of one
 * rustHandle, by type and property name, for the model version they were
 * looked up at. The engine also refuses a slot of another epoch
 * (`CODE_STALE`), and the slots are then looked up again.
 */
interface PropertySlots {
    version: number;
    byType: Map<string, Map<string, Uint32Array | null>>;
}

const propertySlots = new WeakMap<object, PropertySlots>();

/** Forgets `handle`'s slots. */
function dropSlots(handle: object): void {
    propertySlots.delete(handle);
}

/**
 * The slot of property `propName` of type `fqn`, looked up once per model
 * version; undefined when the engine has none (the caller then crosses by
 * name).
 */
function propertySlot(modelManager, handle, fqn: string, propName: string): Uint32Array | undefined {
    // A manager with a rustHandle has engine state.
    const state = modelManager._engine;
    let slots = propertySlots.get(handle);
    if (slots === undefined || slots.version !== state.version) {
        slots = { version: state.version, byType: new Map() };
        propertySlots.set(handle, slots);
    }
    let byName = slots.byType.get(fqn);
    if (byName === undefined) {
        byName = new Map();
        slots.byType.set(fqn, byName);
    }
    let slot = byName.get(propName);
    if (slot === undefined) {
        const found: Uint32Array | null = handle.validationPropertySlot(fqn, propName) ?? null;
        byName.set(propName, found);
        slot = found;
    }
    return slot ?? undefined;
}

export { validateResource, validateProperty };
