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
// P5-12b SPIKE (DO NOT MERGE; accordproject/concerto-rust#292): cheaper
// TS<->WASM transports for P5-12 variant B (one engine call per
// `ValidatedResource.validate()`). Measure only.
//
// Every candidate builds, on the TS side, the value shape the engine's
// instance validator reads (concerto-core `instance/validate.rs`, module doc
// "Scope"; exactly what `JsValue::to_validator_value` builds from the P5-12
// wire): a `$class`-tagged object per Resource, `{$$relationship, $class,
// <id field>}` per Relationship, and `$$dayjs`/`$$undefined`/`$$number`/
// `$$map` markers. So the engine skips P5-12's `decode_wire` and
// `to_validator_value`. The candidates differ in how that tree crosses
// (`CONCERTO_P512B_TRANSPORT`, read once at load):
//
//   json         (a)   JSON.stringify, `serde_json::from_str` into `Value`
//   json-scratch (a+e) the same text, `encodeInto` a reused engine buffer
//   object       (b)   the JS tree itself, through serde-wasm-bindgen
//   binary       (c)   a compact tagged layout, written in one pass from the
//                      live resource into a reused TS buffer, copied in
//   binary-scratch (c+e) the same layout written straight into the reused
//                      engine buffer (no copy)
//
// All send the options as a bit set and the root identifier as a string
// (candidate (e)). Anything the codec cannot express throws
// `EngineFastPathUnsupported`, as P5-12's path does, and the caller falls
// back to the visitor.

import { rust } from './index';
import { EngineFastPathUnsupported, checkString } from './serializer-codec';
import { handleFor, syncIdentifiers, asUnsupported } from './serializer';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type BaseModelManager from '../basemodelmanager';
import type { SerializerOptions } from '../types';
/* eslint-enable no-unused-vars */

const TRANSPORT: string = (typeof process !== 'undefined' && process.env && process.env.CONCERTO_P512B_TRANSPORT) || 'json';

// `Instance::to_validator_value`'s PRIVATE_ONLY_KEYS (concerto-core
// instance/value.rs); a superset of serializer-codec's TYPED_SKIP.
const PRIVATE_ONLY = new Set([
    '$modelManager', '$classDeclaration', '$namespace', '$type', '$identifierFieldName',
    '$validator', '$imports', '$superTypes', '$id',
]);

/**
 * @param {*} v value
 * @returns {boolean} duck-typed dayjs instance (serializer-codec's test)
 */
function isDayjsLike(v): boolean {
    return typeof v.isValid === 'function' &&
        typeof v.utcOffset === 'function' &&
        typeof v.isBefore === 'function' &&
        typeof v.valueOf === 'function';
}

/**
 * @param {*} v value
 * @returns {boolean} duck-typed Resource/ValidatedResource/Relationship
 */
function isTypedLike(v): boolean {
    return typeof v.getFullyQualifiedType === 'function' &&
        typeof v.$namespace === 'string' &&
        typeof v.$type === 'string';
}

/**
 * `Dayjs::to_iso_string` (`null` when invalid or out of range).
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
 * @return {string} its class name, if one of the three the codec carries
 */
function typedCtor(v): string {
    const ctorName = v.constructor && v.constructor.name;
    if (ctorName !== 'Resource' && ctorName !== 'ValidatedResource' && ctorName !== 'Relationship') {
        throw new EngineFastPathUnsupported(`typed-class:${ctorName}`);
    }
    return ctorName;
}

/**
 * @param {Set<object>} seen visited
 * @param {object} v about to be encoded
 */
function visit(v: object, seen: Set<object>): void {
    if (seen.has(v)) {
        throw new EngineFastPathUnsupported('shared-or-cyclic-reference');
    }
    seen.add(v);
}

// ---------------------------------------------------------------------
// The validator-shaped tree ((a) and (b))
// ---------------------------------------------------------------------

/**
 * A live value as the validator-shaped plain tree.
 * @param {*} v the value
 * @param {Set<object>} seen visited objects
 * @param {boolean} checkStrings reject lone surrogates here (the JSON
 * transports leave that to the engine's parser instead)
 * @return {*} the tree
 */
function toTree(v, seen: Set<object>, checkStrings: boolean) {
    if (v === undefined) {
        return { $$undefined: true };
    }
    const t = typeof v;
    if (t === 'string') {
        if (checkStrings) {
            checkString(v);
        }
        return v;
    }
    if (v === null || t === 'boolean') {
        return v;
    }
    if (t === 'number') {
        return Number.isFinite(v) ? v : { $$number: String(v) };
    }
    if (t !== 'object') {
        throw new EngineFastPathUnsupported(`unsupported-value:${t}`);
    }
    if (Array.isArray(v)) {
        visit(v, seen);
        const out = new Array(v.length);
        for (let i = 0; i < v.length; i++) {
            out[i] = toTree(v[i], seen, checkStrings);
        }
        return out;
    }
    if (v instanceof Map) {
        visit(v, seen);
        const entries: any[] = [];
        v.forEach((x, k) => {
            entries.push([toTree(k, seen, checkStrings), toTree(x, seen, checkStrings)]);
        });
        return { $$map: entries };
    }
    if (isDayjsLike(v)) {
        return { $$dayjs: dayjsIso(v) };
    }
    if (isTypedLike(v)) {
        visit(v, seen);
        return typedTree(v, seen, checkStrings);
    }
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) {
        throw new EngineFastPathUnsupported(`instance:${(v.constructor && v.constructor.name) || 'Object'}`);
    }
    visit(v, seen);
    const out = {};
    for (const key of Object.keys(v)) {
        if (key === '__proto__') {
            throw new EngineFastPathUnsupported('proto-key');
        }
        if (checkStrings) {
            checkString(key);
        }
        out[key] = toTree(v[key], seen, checkStrings);
    }
    return out;
}

/**
 * @param {object} v a live Resource/ValidatedResource/Relationship
 * @param {Set<object>} seen visited objects
 * @param {boolean} checkStrings see `toTree`
 * @return {object} `Instance::to_validator_value`
 */
function typedTree(v, seen: Set<object>, checkStrings: boolean) {
    const ctor = typedCtor(v);
    const fqn = v.getFullyQualifiedType();
    if (ctor === 'Relationship') {
        const out = { $$relationship: true, $class: fqn };
        const field = v.$identifierFieldName;
        const id = v[field];
        if (typeof id === 'string') {
            if (checkStrings) {
                checkString(id);
                checkString(String(field));
            }
            out[field] = id;
        }
        return out;
    }
    const out = { $class: fqn };
    for (const key of Object.keys(v)) {
        if (PRIVATE_ONLY.has(key)) {
            continue;
        }
        if (key === '__proto__') {
            throw new EngineFastPathUnsupported('proto-key');
        }
        if (checkStrings) {
            checkString(key);
        }
        out[key] = toTree(v[key], seen, checkStrings);
    }
    return out;
}

// ---------------------------------------------------------------------
// The binary layout ((c)); concerto-wasm src/p512b.rs has the format
// ---------------------------------------------------------------------

const encoder = new TextEncoder();
const f64 = new Float64Array(1);
const f64Bytes = new Uint8Array(f64.buffer);

let buf: Uint8Array = new Uint8Array(1 << 16);
let pos = 0;
// Whether `buf` is the engine's scratch view (binary-scratch).
let scratch = false;

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
    if (scratch) {
        // Resizing the engine's Vec keeps its bytes; the view is new.
        buf = rust.p512bScratch(cap);
    } else {
        const next = new Uint8Array(cap);
        next.set(buf.subarray(0, pos));
        buf = next;
    }
}

/**
 * @param {number} at offset
 * @param {number} n u32
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
        // Non-ASCII: `encodeInto` would turn a lone surrogate into U+FFFD.
        checkString(s);
        pos += encoder.encodeInto(s.substring(i), buf.subarray(pos)).written;
    }
    putU32(lenAt, pos - lenAt - 4);
}

/**
 * @param {string} s the string
 */
function writeStr(s: string): void {
    ensure(1);
    buf[pos++] = 5;
    writeRawStr(s);
}

/**
 * @param {number} v a finite number
 */
function writeNum(v: number): void {
    ensure(9);
    if ((v | 0) === v) {
        // -0 lands here as 0, as `validator_number` spells it.
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
 * An object header: the tag and a count patched in by `endObject`.
 * @return {number} where the count goes
 */
function beginObject(): number {
    ensure(5);
    buf[pos++] = 7;
    pos += 4;
    return pos - 4;
}

/**
 * A one-key object `{key: <string>}` or `{key: true}`.
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
 * A live value in the binary layout, in one pass.
 * @param {*} v the value
 * @param {Set<object>} seen visited objects
 */
function writeValue(v, seen: Set<object>): void {
    if (v === undefined) {
        writeMarkerHead('$$undefined');
        ensure(1);
        buf[pos++] = 2;
        return;
    }
    const t = typeof v;
    if (t === 'string') {
        writeStr(v);
        return;
    }
    if (v === null) {
        ensure(1);
        buf[pos++] = 0;
        return;
    }
    if (t === 'boolean') {
        ensure(1);
        buf[pos++] = v ? 2 : 1;
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
            ensure(1);
            buf[pos++] = 0;
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
 * @param {object} v a live Resource/ValidatedResource/Relationship
 * @param {Set<object>} seen visited objects
 * @return {string} its fully-qualified type
 */
function writeTyped(v, seen: Set<object>): string {
    const ctor = typedCtor(v);
    const fqn = v.getFullyQualifiedType();
    const countAt = beginObject();
    let count = 0;
    if (ctor === 'Relationship') {
        writeRawStr('$$relationship');
        ensure(1);
        buf[pos++] = 2;
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
        return fqn;
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
            // `$class` is already first; a JS own `$class` overwrites it in
            // place (IndexMap insert). Rare; not worth the patch here.
            throw new EngineFastPathUnsupported('own-$class');
        }
        writeRawStr(key);
        writeValue(v[key], seen);
        count++;
    }
    putU32(countAt, count);
    return fqn;
}

// ---------------------------------------------------------------------
// The calls
// ---------------------------------------------------------------------

let scratchView: Uint8Array | null = null;

/**
 * The engine's reused buffer, re-fetched when the module's memory has grown
 * (which detaches the old view).
 * @param {number} min bytes needed
 * @return {Uint8Array} the view
 */
function scratchFor(min: number): Uint8Array {
    if (!scratchView || scratchView.byteLength === 0 || scratchView.byteLength < min) {
        let cap = Math.max(1 << 16, scratchView ? scratchView.byteLength : 0);
        while (cap < min) {
            cap *= 2;
        }
        scratchView = rust.p512bScratch(cap);
    }
    return scratchView as Uint8Array;
}

/**
 * @param {SerializerOptions} options the validator's options
 * @return {number} the bit set
 */
function flagsOf(options: SerializerOptions): number {
    if (!options) {
        return 0;
    }
    return (options.convertResourcesToRelationships ? 1 : 0) | (options.permitResourcesForRelationships ? 2 : 0);
}

/**
 * `getFullyQualifiedIdentifier()`, given the type already read.
 * @param {object} resource the root
 * @param {string} fqn its type
 * @return {string} the identifier
 */
function rootId(resource, fqn: string): string {
    const id = resource.getIdentifier();
    return id ? fqn + '#' + id : fqn;
}

/**
 * P5-12b: `ValidatedResource.validate()` through `TRANSPORT`, then the
 * `$identifier` write-back, as P5-12's `fastValidateResource`.
 * @param {BaseModelManager} modelManager the model manager
 * @param {object} resource the resource to validate
 * @param {SerializerOptions} options the resource validator's options
 */
function fastValidateResource(modelManager: BaseModelManager, resource: any, options: SerializerOptions) {
    const handle = handleFor(modelManager);
    const flags = flagsOf(options);
    try {
        switch (TRANSPORT) {
        case 'object': {
            const tree: any = toTree(resource, new Set(), true);
            handle.validateResourceObject(tree, rootId(resource, tree.$class), flags);
            break;
        }
        case 'json-scratch': {
            const tree: any = toTree(resource, new Set(), false);
            const text = JSON.stringify(tree);
            const view = scratchFor(text.length * 3);
            const { written } = encoder.encodeInto(text, view);
            handle.validateResourceJsonScratch(written, rootId(resource, tree.$class), flags);
            break;
        }
        case 'binary':
        case 'binary-scratch': {
            scratch = TRANSPORT === 'binary-scratch';
            buf = scratch ? scratchFor(1 << 12) : buf;
            pos = 0;
            if (!isTypedLike(resource)) {
                throw new EngineFastPathUnsupported('root-not-typed');
            }
            const seen = new Set<object>([resource]);
            const fqn = writeTyped(resource, seen);
            if (scratch) {
                // `buf` may have been replaced by a grown view.
                scratchView = buf;
                handle.validateResourceBinaryScratch(pos, rootId(resource, fqn), flags);
            } else {
                handle.validateResourceBinary(buf.subarray(0, pos), rootId(resource, fqn), flags);
            }
            break;
        }
        default: {
            const tree: any = toTree(resource, new Set(), false);
            handle.validateResourceJson(JSON.stringify(tree), rootId(resource, tree.$class), flags);
        }
        }
    } catch (err) {
        throw asUnsupported(err);
    }
    syncIdentifiers(resource);
}

// Profiling hooks for migration/bench/p512b-profile.mjs.
const p512bInternals = {
    toTree,
    rootId,
    flagsOf,
    scratchFor,
    encodeBinary(resource, useScratch: boolean): { bytes: Uint8Array; len: number; fqn: string } {
        scratch = useScratch;
        buf = scratch ? scratchFor(1 << 12) : buf;
        pos = 0;
        const fqn = writeTyped(resource, new Set<object>([resource]));
        if (scratch) {
            scratchView = buf;
        }
        return { bytes: buf, len: pos, fqn };
    },
};

export { fastValidateResource, p512bInternals, TRANSPORT };
