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
// Both functions return `false` only in that last case, when the value
// cannot cross (`EngineFastPathUnsupported`: a lone surrogate, a function,
// a symbol, a BigInt, a class instance that is not a Resource or a dayjs, a
// shared or cyclic reference, a `__proto__` or own `$class` key, a model
// manager with a custom `regExp` engine) or the instance's validator is not
// a plain `ResourceValidator` (a subclass or another object may override
// the visitor, which the engine cannot run). Every other outcome is final:
// a valid value returns `true`, an invalid one throws with the class TS
// 5.0.0 throws.
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
import { EngineFastPathUnsupported, checkString } from './serializer-codec';
import { handleFor } from './serializer';
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

/**
 * @param {object} v a non-null object
 * @returns {boolean} duck-typed dayjs instance (serializer-codec's test)
 */
function isDayjsLike(v): boolean {
    return typeof v.isValid === 'function' &&
        typeof v.utcOffset === 'function' &&
        typeof v.isBefore === 'function' &&
        typeof v.valueOf === 'function';
}

/**
 * @param {object} v a non-null object
 * @returns {boolean} duck-typed Resource/ValidatedResource/Relationship
 * (serializer-codec's test)
 */
function isTypedLike(v): boolean {
    return typeof v.getFullyQualifiedType === 'function' &&
        typeof v.$namespace === 'string' &&
        typeof v.$type === 'string';
}

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
 * @param {object} v an instance
 * @return {string} its class name, when it is one of the three the codec
 * carries
 */
function typedCtor(v): string {
    const ctorName = v.constructor && v.constructor.name;
    if (ctorName !== 'Resource' && ctorName !== 'ValidatedResource' && ctorName !== 'Relationship') {
        throw new EngineFastPathUnsupported(`typed-class:${ctorName}`);
    }
    return ctorName;
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
// The binary layout (concerto-wasm src/validate_resource.rs)
// ---------------------------------------------------------------------

const encoder = new TextEncoder();
const f64 = new Float64Array(1);
const f64Bytes = new Uint8Array(f64.buffer);

// Reused across calls; grown on demand. wasm-bindgen copies the bytes in.
let buf: Uint8Array = new Uint8Array(1 << 12);
let pos = 0;

/**
 * Grows `buf` to hold `n` more bytes.
 * @param {number} n bytes needed
 */
function ensure(n: number): void {
    if (pos + n <= buf.length) {
        return;
    }
    let cap = buf.length * 2;
    while (cap < pos + n) {
        cap *= 2;
    }
    const next = new Uint8Array(cap);
    next.set(buf.subarray(0, pos));
    buf = next;
}

/**
 * @param {number} at offset
 * @param {number} n a u32
 */
function putU32(at: number, n: number): void {
    buf[at] = n & 0xff;
    buf[at + 1] = (n >>> 8) & 0xff;
    buf[at + 2] = (n >>> 16) & 0xff;
    buf[at + 3] = (n >>> 24) & 0xff;
}

/**
 * A length-prefixed UTF-8 string (no tag).
 * @param {string} s the string
 */
function writeRawStr(s: string): void {
    const n = s.length;
    ensure(4 + n * 3);
    const lenAt = pos;
    pos += 4;
    let i = 0;
    for (; i < n; i++) {
        const c = s.charCodeAt(i);
        if (c >= 0x80) {
            break;
        }
        buf[pos++] = c;
    }
    if (i < n) {
        // Not ASCII: `encodeInto` would turn a lone surrogate into U+FFFD,
        // so reject one first (the engine cannot hold it, PORTING.md 3.1).
        checkString(s);
        pos += encoder.encodeInto(s.substring(i), buf.subarray(pos)).written;
    }
    putU32(lenAt, pos - lenAt - 4);
}

/**
 * @param {number} tag the tag byte
 */
function writeTag(tag: number): void {
    ensure(1);
    buf[pos++] = tag;
}

/**
 * @param {string} s the string
 */
function writeStr(s: string): void {
    writeTag(5);
    writeRawStr(s);
}

/**
 * A finite number, as `validate::js_number` reads it.
 * @param {number} v the number
 */
function writeNum(v: number): void {
    ensure(9);
    if ((v | 0) === v) {
        // `-0` lands here as `0`, which is how `js_number` spells it too.
        buf[pos++] = 4;
        putU32(pos, v);
        pos += 4;
        return;
    }
    buf[pos++] = 3;
    f64[0] = v;
    buf.set(f64Bytes, pos);
    pos += 8;
}

/**
 * An object header, with its entry count patched in later.
 * @return {number} where the count goes
 */
function beginObject(): number {
    ensure(5);
    buf[pos++] = 7;
    pos += 4;
    return pos - 4;
}

/**
 * The head of a one-key marker object `{key: <value>}`.
 * @param {string} key the marker key
 */
function writeMarkerHead(key: string): void {
    ensure(5);
    buf[pos++] = 7;
    putU32(pos, 1);
    pos += 4;
    writeRawStr(key);
}

/**
 * A live value, in one pass.
 * @param {*} v the value
 * @param {Set<object>} seen visited objects
 */
function writeValue(v, seen: Set<object>): void {
    if (v === undefined) {
        writeMarkerHead('$$undefined');
        writeTag(2);
        return;
    }
    const t = typeof v;
    if (t === 'string') {
        writeStr(v);
        return;
    }
    if (v === null) {
        writeTag(0);
        return;
    }
    if (t === 'boolean') {
        writeTag(v ? 2 : 1);
        return;
    }
    if (t === 'number') {
        if (Number.isFinite(v)) {
            writeNum(v);
        } else {
            writeMarkerHead('$$number');
            writeStr(String(v));
        }
        return;
    }
    if (t !== 'object') {
        throw new EngineFastPathUnsupported(`unsupported-value:${t}`);
    }
    if (Array.isArray(v)) {
        visit(v, seen);
        ensure(5);
        buf[pos++] = 6;
        putU32(pos, v.length);
        pos += 4;
        for (let i = 0; i < v.length; i++) {
            writeValue(v[i], seen);
        }
        return;
    }
    if (v instanceof Map) {
        visit(v, seen);
        writeMarkerHead('$$map');
        ensure(5);
        buf[pos++] = 6;
        putU32(pos, v.size);
        pos += 4;
        v.forEach((x, k) => {
            ensure(5);
            buf[pos++] = 6;
            putU32(pos, 2);
            pos += 4;
            writeValue(k, seen);
            writeValue(x, seen);
        });
        return;
    }
    if (isDayjsLike(v)) {
        writeMarkerHead('$$dayjs');
        const iso = dayjsIso(v);
        if (iso === null) {
            writeTag(0);
        } else {
            writeStr(iso);
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
    const countAt = beginObject();
    let count = 0;
    for (const key of Object.keys(v)) {
        if (key === '__proto__') {
            throw new EngineFastPathUnsupported('proto-key');
        }
        writeRawStr(key);
        writeValue(v[key], seen);
        count++;
    }
    putU32(countAt, count);
}

/**
 * A live Resource/ValidatedResource/Relationship, as
 * `Instance::to_validator_value` builds it. Also does the `$identifier`
 * write-back of a Resource (module doc).
 * @param {object} v the instance
 * @param {Set<object>} seen visited objects
 */
function writeTyped(v, seen: Set<object>): void {
    const ctor = typedCtor(v);
    const fqn = v.getFullyQualifiedType();
    const countAt = beginObject();
    let count;
    if (ctor === 'Relationship') {
        writeRawStr('$$relationship');
        writeTag(2);
        writeRawStr('$class');
        writeStr(fqn);
        count = 2;
        const field = v.$identifierFieldName;
        const id = v[field];
        if (typeof id === 'string') {
            writeRawStr(String(field));
            writeStr(id);
            count++;
        }
        putU32(countAt, count);
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
    writeRawStr('$class');
    writeStr(fqn);
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
        writeRawStr(key);
        writeValue(v[key], seen);
        count++;
    }
    putU32(countAt, count);
}

// A class declaration view's identifying field never changes (a model
// update replaces the views), so it is read once per view.
const identifierFields = new WeakMap<object, string>();

/**
 * The identifying field the engine uses for a Resource of `decl`: as the
 * Identifiable constructor computes `$identifierFieldName`,
 * `getIdentifierFieldName() || '$identifier'`.
 * @param {*} decl the Resource's `$classDeclaration`
 * @return {string} the field name
 */
function modelIdentifierField(decl): string {
    if (!decl || typeof decl !== 'object' || typeof decl.getIdentifierFieldName !== 'function') {
        throw new EngineFastPathUnsupported('class-declaration');
    }
    let field = identifierFields.get(decl);
    if (field === undefined) {
        field = decl.getIdentifierFieldName() || '$identifier';
        identifierFields.set(decl, field as string);
    }
    return field as string;
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
    if (!validator || validator.constructor?.name !== 'ResourceValidator') {
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
        pos = 0;
        writeTyped(resource, new Set<object>([resource]));
    } catch (err) {
        if (err instanceof EngineFastPathUnsupported) {
            return false;
        }
        throw err;
    }
    return outcome(handle.validateResourceBinary(buf.subarray(0, pos), rootId, flags));
}

/**
 * `field.accept(this.$validator, parameters)` in
 * `ValidatedResource.setPropertyValue`/`addArrayValue`, in one engine call.
 * @param {object} resource the ValidatedResource
 * @param {string} propName the property TS found on its class declaration
 * @param {*} value the value to check (for `addArrayValue`, the new array)
 * @param {string} rootId the resource's `getFullyQualifiedIdentifier()`
 * @return {boolean} `true` when valid; `false` when the engine cannot
 * validate it (the caller runs the visitor)
 * @throws {Error} the error TS throws for an invalid value
 */
function validateProperty(resource, propName: string, value, rootId: string): boolean {
    const flags = flagsOf(resource.$validator);
    if (flags < 0) {
        return false;
    }
    let handle;
    try {
        checkString(propName);
        checkString(rootId);
        handle = handleFor(resource.getModelManager());
        pos = 0;
        writeValue(value, new Set<object>());
    } catch (err) {
        if (err instanceof EngineFastPathUnsupported) {
            return false;
        }
        throw err;
    }
    return outcome(handle.validatePropertyBinary(buf.subarray(0, pos), resource.getFullyQualifiedType(), propName, rootId, flags));
}

export { validateResource, validateProperty };
