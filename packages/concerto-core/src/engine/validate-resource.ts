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
// Instance validation in one engine call per resource (task P5-12c,
// accordproject/concerto-rust#293: the P5-12 spike's variant B on the P5-12b
// transport, accordproject/concerto-rust#289 and #292).
//
// `ValidatedResource.validate()`, `setPropertyValue` and `addArrayValue`
// (src/model/validatedresource.ts) call `validateResource`/`validateProperty`
// below first. Each writes the value straight from the live object into a
// compact binary layout (concerto-wasm src/validate_resource.rs has the
// format), already in the shape the engine's instance validator reads
// (concerto-core `instance/validate.rs`, module doc "Scope"; exactly what
// `Instance::to_validator_value` builds from the Serializer's wire value):
// a `$class`-tagged object per Resource, `{$$relationship, $class, <id
// field>}` per Relationship, and `$$dayjs`/`$$undefined`/`$$number`/`$$map`
// markers. One engine call then runs the validator and returns a code:
//
//   0  valid;
//   1  a `Validation` error: the message is fetched and TS throws
//      `new ValidationException(message)`, which is what the error factory
//      (errors.ts) builds for that kind;
//   2  any other error: TS throws the exception the unchanged error-factory
//      path builds (`validateTakeError`), so its class is the same as for
//      every other binding;
//   3  the engine could not read the value (or its model lacks the
//      property TS found): as for a value TS cannot encode at all, the
//      caller runs the `ResourceValidator` visitor instead.
//
// P5-101 (D-10, accordproject/concerto-rust#455): a property is checked by
// its slot (`validatePropertyById`: the declaration's handle and the
// property's index in its validation plan, looked up once per model
// version, `propertySlot`), so neither the type's name nor the property's
// crosses, and that call returns a `Validation` error's message itself (a
// string in place of code 1) and throws any other error itself (code 2),
// with no `validateErrorMessage`/`validateTakeError` crossing.
//
// Both functions return `false` only in that last case, when the value
// cannot cross (`EngineFastPathUnsupported`: a lone surrogate, a function,
// a symbol, a BigInt, a class instance that is not a Resource or a dayjs, a
// shared or cyclic reference, a `__proto__` or own `$class` key) or the
// instance's validator is not
// a plain `ResourceValidator` (a subclass or another object may override
// the visitor, which the engine cannot run). Every other outcome is final:
// a valid value returns `true`, an invalid one throws with the class TS
// 5.0.0 throws. The one other `false` is a speed choice, not a fallback:
// `setPropertyValue` of a string, number or boolean on a plain primitive
// field with no validator stays on the visitor, which is cheaper there than
// an engine call (`visitorIsCheaper`).
//
// A Resource whose `$identifierFieldName` is not its model's identifying
// field, or whose identifier is truthy but not a string, also takes the
// visitor: the engine reads the model's field and treats a non-string as
// empty, where the visitor reads `getIdentifier()` and calls `trim()` on it.
//
// The `$identifier` write-back of `ResourceValidator.visitClassDeclaration`
// (`obj.$identifier = obj.getIdentifier()` for an identified Resource whose
// identifying field is not `$identifier`) happens here while the resource
// is written out, before the engine call, for every Resource in the tree.
// On a valid value that is exactly what the visitor leaves behind. On an
// invalid one the visitor has written back only the resources it reached
// before the failing check, so the `$identifier` of a resource past that
// point (or of the one that failed before its own write-back) can differ
// from what TS 5.0.0 leaves; its value is then the identifier, the value TS
// would have written had it got that far. A Resource held by a relationship
// field (`permitResourcesForRelationships`) is written back too, which the
// visitor never visits.

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

// `Instance::to_validator_value`'s PRIVATE_ONLY_KEYS (concerto-core-js
// value.rs), which the engine drops from a Resource: TS skips them too,
// rather than sending them to be dropped.
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
 * `Dayjs::to_iso_string` (concerto-core instance/dayjs.rs): `null` when the
 * date is invalid or out of the ECMAScript time range.
 * @param {*} d the dayjs
 * @return {string|null} the ISO text
 */
function dayjsIso(d): string | null {
    if (!d.isValid()) {
        return null;
    }
    const ms = d.valueOf();
    return Math.abs(ms) <= 8.64e15 ? new Date(ms).toISOString() : null;
}

/**
 * Marks `v` as visited on this encode (serializer-codec's `visit`): a value
 * reached twice (a cycle or a shared reference) cannot cross.
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
// The binary layout (concerto-rust concerto-core `introspect::compact`),
// written through the one writer of that layout (wire.ts, P5-101 F-8).
// ---------------------------------------------------------------------

/** The writer every call writes its value into; wasm-bindgen copies the bytes in. */
const writer = new WireWriter(1 << 12);

/**
 * A live value, in one pass.
 * @param {*} v the value
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
 * `Instance::to_validator_value` builds it. Also does the `$identifier`
 * write-back of a Resource (module doc).
 * @param {object} v the instance
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
    // field, and treats any value there that is not a string as empty.
    // `visitClassDeclaration` reads `getIdentifier()` (the instance's own
    // `$identifierFieldName`) and calls `id.trim()` on it. Where the two can
    // differ, the visitor runs instead.
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
 * The identifying field the engine uses for a Resource of `decl`: as the
 * Identifiable constructor computes `$identifierFieldName`,
 * `getIdentifierFieldName() || '$identifier'`.
 *
 * P5-98 (F-1): read through `views.classDeclarationGetIdentifierFieldName`,
 * which caches the answer per view and checks the whole super type chain
 * against the model epoch before reusing it. A memo of its own here, keyed
 * by the view alone, went stale when a super type's model file was updated
 * (the subclass's view, in another file, is not replaced), and the stale
 * field then sent every later validation to the visitor.
 * @param {*} decl the Resource's `$classDeclaration`
 * @return {string} the field name
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
 * @return {number} the flags
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
 * @param {number} code the engine's result code
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
 * @param {object} resource the ValidatedResource
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
 * engine call: a string, number or boolean set on a single primitive field
 * with no enum type, no scalar type and no validator. The visitor then does
 * one type check (itself one small engine call, P4-10) and nothing more,
 * while the engine call pays a fixed cost to encode the value, cross into
 * WASM and look the property up (measured on workload 3's
 * `setPropertyValue('sequence', i)`: 0.55 µs through the visitor, 1.3 µs
 * through `validatePropertyBinary`). A field with a validator (`regex`,
 * `length`, `range`), or any object or array value, costs the visitor far
 * more (8.8 µs for a `regex`+`length` String, 40 µs for a concept) and goes
 * to the engine. The visitor is the TS reference path, so the choice
 * changes speed only, never the outcome.
 * @param {*} field the property TS found on the class declaration
 * @param {*} value the value being set
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
 * @param {object} resource the ValidatedResource
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
        // P5-101 (D-10): by the slot, and with a `Validation` error's
        // message in the same call (any other error is thrown by it).
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
 * P5-101 (D-10, accordproject/concerto-rust#455): the `validatePropertyById`
 * slots (`[declId, propIndex, epoch]`) of one rustHandle, by type and
 * property name, for the model version they were looked up at
 * (`EngineState.version`, which every change of the manager's model files
 * or rustHandle moves). A slot of another epoch is also refused by the
 * engine (`CODE_STALE`), and the slots are then looked up again.
 */
interface PropertySlots {
    version: number;
    byType: Map<string, Map<string, Uint32Array | null>>;
}

const propertySlots = new WeakMap<object, PropertySlots>();

/**
 * Forgets `handle`'s slots.
 * @param {object} handle the rustHandle
 */
function dropSlots(handle: object): void {
    propertySlots.delete(handle);
}

/**
 * The `validatePropertyById` slot of property `propName` of type `fqn`,
 * looked up once per model version (`validationPropertySlot`); undefined
 * when the engine has none (the caller then crosses by name, which answers
 * `CODE_UNSUPPORTED` for it) or the manager keeps no engine state.
 * @param {object} modelManager the resource's model manager
 * @param {object} handle its rustHandle
 * @param {string} fqn the resource's type
 * @param {string} propName the property
 * @return {Uint32Array | undefined} the slot
 */
function propertySlot(modelManager, handle, fqn: string, propName: string): Uint32Array | undefined {
    const state = modelManager._engine;
    if (state === undefined) {
        return undefined;
    }
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
