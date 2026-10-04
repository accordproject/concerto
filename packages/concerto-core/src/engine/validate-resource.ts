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
// value in the compact binary layout, in the shape the engine's instance
// validator reads (`$class`-tagged Resources, `{$$relationship, ...}`
// Relationships, `$$dayjs`/`$$undefined`/`$$number`/`$$map` markers). The
// engine returns a code: 0 valid; 1 a `Validation` error (TS throws
// `ValidationException`); 2 any other error (`validateTakeError`); 3 the
// visitor must run.
//
// Both return `false`, for the `ResourceValidator` visitor, only when the
// value cannot cross (`EngineFastPathUnsupported`), the validator is not a
// plain `ResourceValidator`, a Resource's identifier field or identifier
// differ from what the engine reads, or the visitor is cheaper
// (`visitorIsCheaper`). Any other outcome is final, with TS 5.0.0's class.
// The `$identifier` write-back of `visitClassDeclaration` happens while
// each Resource is written, so an invalid value may get it past the point
// where the visitor would stop.

import { rust } from './index';
import { checkString, typedCtorName, modelClasses } from './serializer-codec';
import { EngineFastPathUnsupported, isDayjsLike, isTypedLike } from './util';
import { WireWriter } from './wire';
import { handleFor } from './serializer';
import { classDeclarationGetIdentifierFieldName } from './views-lookups';
import ValidationException from '../serializer/validationexception';

/* eslint-disable no-unused-vars */
import type { SerializerOptions } from '../types';
/* eslint-enable no-unused-vars */

// `to_validator_value`'s PRIVATE_ONLY_KEYS: dropped by the engine, so not sent.
const PRIVATE_ONLY = new Set([
    '$modelManager', '$classDeclaration', '$namespace', '$type', '$identifierFieldName',
    '$validator', '$imports', '$superTypes', '$id',
]);

const CODE_VALID = 0;
const CODE_VALIDATION = 1;
const CODE_UNSUPPORTED = 3;
const CODE_STALE = 4;

/** `Dayjs::to_iso_string`: `null` when invalid or outside the ECMAScript range. */
function dayjsIso(d): string | null {
    return d.isValid() ? new Date(d.valueOf()).toISOString() : null;
}

/** Marks `v` visited: a value reached twice cannot cross. */
function visit(v: object, seen: Set<object>): void {
    if (seen.has(v)) {
        throw new EngineFastPathUnsupported('shared-or-cyclic-reference');
    }
    seen.add(v);
}

/** The writer every call writes its value into; wasm-bindgen copies the bytes in. */
const writer = new WireWriter(1 << 12);

/** A live value, in one pass. */
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
 * A live Resource/ValidatedResource/Relationship, as `to_validator_value`
 * builds it, with a Resource's `$identifier` write-back.
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
    // The engine reads the identifier from the model's identifying field and
    // treats a non-string as empty; the visitor calls `getIdentifier().trim()`.
    // Where they can differ, the visitor runs.
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
            // An own `$class` would replace the engine's in place: left to the visitor.
            throw new EngineFastPathUnsupported('own-$class');
        }
        writer.rawStr(key);
        writeValue(v[key], seen);
        count++;
    }
    writer.putU32(countAt, count);
}

/** The identifying field the engine uses for `decl` (`getIdentifierFieldName() || '$identifier'`). */
function modelIdentifierField(decl): string {
    if (!decl || typeof decl !== 'object' || typeof decl.getIdentifierFieldName !== 'function') {
        throw new EngineFastPathUnsupported('class-declaration');
    }
    return classDeclarationGetIdentifierFieldName(decl) || '$identifier';
}

/** The validator's options as the engine's bit set, or -1 if not a plain `ResourceValidator`. */
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

/** Throws the error behind a non-zero code, or returns `false` for `CODE_UNSUPPORTED`. */
function outcome(code: number): boolean {
    if (code === CODE_VALID) {
        return true;
    }
    if (code === CODE_VALIDATION) {
        throw new ValidationException(rust.validateErrorMessage());
    }
    if (code === CODE_UNSUPPORTED) {
        // The engine keeps no error for this code.
        return false;
    }
    throw rust.validateTakeError();
}

/**
 * `ValidatedResource.validate()` in one engine call. `false` when the caller
 * must run the visitor.
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
    } catch (err) {
        if (err instanceof EngineFastPathUnsupported) {
            return false;
        }
        throw err;
    }
    // A getter read mid-write may validate another value: the writer
    // refuses that nested write, which runs the visitor.
    if (!writer.begin()) {
        return false;
    }
    let code;
    try {
        try {
            writeTyped(resource, new Set<object>([resource]));
        } catch (err) {
            if (err instanceof EngineFastPathUnsupported) {
                return false;
            }
            throw err;
        }
        code = handle.validateResourceBinary(writer.bytes(), rootId, flags);
    } finally {
        writer.release();
    }
    return outcome(code);
}

/**
 * Whether the visitor is cheaper than an engine call: a primitive on a single
 * primitive field with no enum, scalar or validator (about 0.55 µs against
 * 1.3 µs). Speed only.
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
 * `field.accept(this.$validator, parameters)` in `setPropertyValue` and
 * `addArrayValue`, in one engine call (`value` is the new array for
 * `addArrayValue`). `false` when the caller must run the visitor.
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
    } catch (err) {
        if (err instanceof EngineFastPathUnsupported) {
            return false;
        }
        throw err;
    }
    // As in `validateResource`: a nested write runs the visitor. The writer
    // is released however the engine calls end.
    if (!writer.begin()) {
        return false;
    }
    let byId;
    let code;
    try {
        try {
            writeValue(value, new Set<object>());
        } catch (err) {
            if (err instanceof EngineFastPathUnsupported) {
                return false;
            }
            throw err;
        }
        const fqn = resource.getFullyQualifiedType();
        const modelManager = resource.getModelManager();
        const slot = propertySlot(modelManager, handle, fqn, propName);
        if (slot !== undefined) {
            // By slot; this call returns a `Validation` message and throws any other error.
            byId = handle.validatePropertyById(writer.bytes(), slot[0], slot[1], slot[2], rootId, flags);
            if (byId === CODE_STALE) {
                dropSlots(modelManager);
                byId = undefined;
            }
        }
        if (byId === undefined) {
            code = handle.validatePropertyBinary(writer.bytes(), fqn, propName, rootId, flags);
        }
    } finally {
        writer.release();
    }
    if (typeof byId === 'string') {
        throw new ValidationException(byId);
    }
    if (byId !== undefined) {
        return byId === CODE_VALID;
    }
    return outcome(code);
}

/**
 * The slot of `fqn.propName`, looked up once per model version; undefined if
 * none. The slots are kept in the manager's engine state
 * (`EngineState.propertySlots`) for its current handle and version; the
 * engine refuses a slot of another epoch (`CODE_STALE`), and the caller then
 * drops them (`dropSlots`).
 */
function propertySlot(modelManager, handle, fqn: string, propName: string): Uint32Array | undefined {
    const state = modelManager._engine;
    let slots = state.propertySlots;
    if (slots === undefined || slots.version !== state.version || slots.handle !== handle) {
        slots = { version: state.version, handle, byType: new Map() };
        state.propertySlots = slots;
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

/** Forgets `modelManager`'s slots. */
function dropSlots(modelManager): void {
    modelManager._engine.propertySlots = undefined;
}

export { validateResource, validateProperty };
