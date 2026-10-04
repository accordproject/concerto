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

// The wire codec of the Serializer fast path: `Serializer.fromJSON`/`toJSON`
// cross in one call each instead of per field through the TS visitors.
//
// Plain JSON crosses unchanged. Anything else is a one-key object tagged
// `@@oracle` (concerto-wasm's `WIRE_TAG`), so a value JSON cannot hold (a
// non-finite number or `-0`, `undefined`, a `Map`, a dayjs, a
// `Resource`/`ValidatedResource`/`Relationship`) round-trips. A `"typed"`
// value's `fields` holds every own property of the object, `$`-prefixed ones
// included, except `$modelManager`/`$classDeclaration`/`$validator`. A dayjs
// crosses as `(epoch ms, utcOffset minutes)`, and is rebuilt in TS.
//
// `encodeValue` throws `EngineFastPathUnsupported` for anything it cannot
// express (another class, a function, a symbol, or an object reached twice);
// the caller then falls back to the TS visitors.

import dayjs from '../dayjs-setup';
import { EngineFastPathUnsupported, isDayjsLike, isTypedLike, hasLoneSurrogate } from './util';
import { WireWriter } from './wire';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type BaseModelManager from '../basemodelmanager';
/* eslint-enable no-unused-vars */

const TAG = '@@oracle';

const hasOwn = Object.prototype.hasOwnProperty;

/**
 * Throws `EngineFastPathUnsupported` for a string with a lone surrogate,
 * which the engine cannot receive unchanged.
 * @param {string} s the string (a value, an object key or a map key)
 */
function checkString(s: string): void {
    if (hasLoneSurrogate(s)) {
        throw new EngineFastPathUnsupported('lone-surrogate');
    }
}

/**
 * Throws `EngineFastPathUnsupported` for an object key the codec cannot
 * carry: a lone surrogate, or `__proto__` (`out['__proto__'] = x` would set
 * the prototype, losing the key), so the TS path treats it instead.
 */
function checkKey(key: string): void {
    if (key === '__proto__') {
        throw new EngineFastPathUnsupported('proto-key');
    }
    checkString(key);
}

// The handles a "typed" value never carries (`$validator` is rebuilt on
// decode from the serializer's options).
const TYPED_SKIP = new Set(['$modelManager', '$classDeclaration', '$validator']);

/**
 * A live Resource/ValidatedResource/Relationship in the `"typed"` wire
 * shape (module doc).
 */
function encodeTyped(v, seen: Set<object>) {
    const ctorName = typedCtorName(v);
    const fields = {};
    for (const key of Object.keys(v)) {
        if (TYPED_SKIP.has(key)) {
            continue;
        }
        checkKey(key);
        fields[key] = encodeValue(v[key], seen);
    }
    return { [TAG]: 'typed', ctor: ctorName, fqn: v.getFullyQualifiedType(), fields };
}

/**
 * Marks `v` as visited on this encode. A cycle would recurse forever, and a
 * value shared between two places (which `toJSON`'s `deduplicateResources`
 * relies on) would cross as two copies, so either throws
 * `EngineFastPathUnsupported`.
 * @param {object} v the object or array about to be encoded
 * @param {Set<object>} seen the objects already visited on this encode
 */
function visit(v: object, seen: Set<object>): void {
    if (seen.has(v)) {
        throw new EngineFastPathUnsupported('shared-or-cyclic-reference');
    }
    seen.add(v);
}

/**
 * A JS runtime value as the wire value the engine reads (module doc).
 * @param {Set<object>} [seen] the objects already visited on this encode (see `visit`)
 */
function encodeValue(v, seen: Set<object> = new Set()) {
    if (v === undefined) {
        return { [TAG]: 'undefined' };
    }
    if (typeof v === 'string') {
        checkString(v);
        return v;
    }
    if (v === null || typeof v === 'boolean') {
        return v;
    }
    if (typeof v === 'number') {
        if (!Number.isFinite(v)) {
            return { [TAG]: 'number', value: String(v) };
        }
        if (Object.is(v, -0)) {
            return { [TAG]: 'number', value: '-0' };
        }
        return v;
    }
    if (Array.isArray(v)) {
        visit(v, seen);
        return v.map((item) => encodeValue(item, seen));
    }
    if (v instanceof Map) {
        visit(v, seen);
        return { [TAG]: 'map', entries: [...v.entries()].map(([k, x]) => [encodeValue(k, seen), encodeValue(x, seen)]) };
    }
    if (isDayjsLike(v)) {
        const valid = v.isValid();
        return valid
            ? { [TAG]: 'dayjs', valid: true, ms: v.valueOf(), utcOffset: v.utcOffset() }
            : { [TAG]: 'dayjs', valid: false };
    }
    if (isTypedLike(v)) {
        visit(v, seen);
        return encodeTyped(v, seen);
    }
    if (typeof v === 'function' || typeof v === 'symbol') {
        throw new EngineFastPathUnsupported(`unsupported-value:${typeof v}`);
    }
    if (typeof v === 'object') {
        const proto = Object.getPrototypeOf(v);
        if (proto !== Object.prototype && proto !== null) {
            throw new EngineFastPathUnsupported(`instance:${(v.constructor && v.constructor.name) || 'Object'}`);
        }
        visit(v, seen);
        const out = {};
        for (const key of Object.keys(v)) {
            checkKey(key);
            out[key] = encodeValue(v[key], seen);
        }
        return out;
    }
    throw new EngineFastPathUnsupported(`unsupported-value:${typeof v}`);
}

// ---------------------------------------------------------------------
// The same wire value written straight from the live object in the compact
// binary layout (wire.ts), which the engine reads as it reads the text
// (`parse_wire_bytes`).
// ---------------------------------------------------------------------

/** The one writer of the Serializer fast path's binary input. */
const valueWriter = new WireWriter(64 * 1024);

/** Set while `valueWriter` is being written (a getter may re-enter). */
let valueWriterBusy = false;

/**
 * How deep the binary write nests before it leaves the value to the text
 * path: below the engine's JSON limit (128), so a value too deep is rejected
 * as text.
 */
const MAX_BINARY_DEPTH = 100;

/** Thrown inside `encodeBytes` to leave a value to the text path. */
class TextPathOnly extends Error {
}

/**
 * `encodeValue(v)`'s wire value in the compact binary layout: a view of the
 * writer's buffer, valid until the next call. Undefined when the value is
 * left to the text path, which throws what it always threw (a value
 * `encodeValue` cannot express, one nested deeper than `MAX_BINARY_DEPTH`,
 * or a call while the writer is in use). Any other error (a throwing getter)
 * propagates, as from `encodeValue`.
 */
function encodeBytes(v: unknown): Uint8Array | undefined {
    if (valueWriterBusy) {
        return undefined;
    }
    valueWriterBusy = true;
    try {
        valueWriter.begin();
        writeWireValue(v, new Set(), 0);
        return valueWriter.bytes();
    } catch (err) {
        if (err instanceof TextPathOnly || err instanceof EngineFastPathUnsupported) {
            return undefined;
        }
        throw err;
    } finally {
        valueWriter.release();
        valueWriterBusy = false;
    }
}

/**
 * A one-key-or-more tagged object's head: the object header with `count`
 * entries, and its `TAG` entry.
 * @param {number} count the entries, the tag's included
 */
function writeTagHead(count: number, kind: string): void {
    const at = valueWriter.beginObject();
    valueWriter.putU32(at, count);
    valueWriter.rawStr(TAG);
    valueWriter.str(kind);
}

/** A finite number `encodeValue` writes as itself. */
function writeNumber(n: number): void {
    if (!Number.isFinite(n)) {
        throw new TextPathOnly();
    }
    valueWriter.num(n);
}

/**
 * `encodeValue(v, seen)`, written to `valueWriter` (`encodeBytes`).
 * @param {Set<object>} seen the objects already visited on this encode
 * @param {number} depth how deep `v` is
 */
function writeWireValue(v, seen: Set<object>, depth: number): void {
    if (depth >= MAX_BINARY_DEPTH) {
        throw new TextPathOnly();
    }
    const w = valueWriter;
    if (v === undefined) {
        writeTagHead(1, 'undefined');
        return;
    }
    if (typeof v === 'string') {
        // `rawStr` throws for a lone surrogate, so the string is scanned
        // once.
        w.str(v);
        return;
    }
    if (v === null || typeof v === 'boolean') {
        w.literal(v);
        return;
    }
    if (typeof v === 'number') {
        if (!Number.isFinite(v) || Object.is(v, -0)) {
            writeTagHead(2, 'number');
            w.rawStr('value');
            w.str(Object.is(v, -0) ? '-0' : String(v));
            return;
        }
        w.num(v);
        return;
    }
    if (Array.isArray(v)) {
        visit(v, seen);
        const n = v.length;
        w.array(n);
        for (let i = 0; i < n; i++) {
            // A hole is `null` in `JSON.stringify`'s text.
            if (i in v) {
                writeWireValue(v[i], seen, depth + 1);
            } else {
                w.literal(null);
            }
        }
        return;
    }
    if (v instanceof Map) {
        visit(v, seen);
        writeTagHead(2, 'map');
        w.rawStr('entries');
        // No `[key, value]` array per entry; the count is patched in after
        // (a value's getter may change the map).
        const countAt = w.pos + 1;
        w.array(0);
        let count = 0;
        v.forEach((x, k) => {
            w.array(2);
            writeWireValue(k, seen, depth + 3);
            writeWireValue(x, seen, depth + 3);
            count++;
        });
        w.putU32(countAt, count);
        return;
    }
    if (isDayjsLike(v)) {
        if (v.isValid()) {
            writeTagHead(4, 'dayjs');
            w.rawStr('valid');
            w.literal(true);
            w.rawStr('ms');
            writeNumber(v.valueOf());
            w.rawStr('utcOffset');
            writeNumber(v.utcOffset());
        } else {
            writeTagHead(2, 'dayjs');
            w.rawStr('valid');
            w.literal(false);
        }
        return;
    }
    if (isTypedLike(v)) {
        visit(v, seen);
        const ctorName = typedCtorName(v);
        writeTagHead(4, 'typed');
        w.rawStr('ctor');
        w.str(ctorName);
        w.rawStr('fqn');
        w.str(v.getFullyQualifiedType());
        w.rawStr('fields');
        writeEntries(v, TYPED_SKIP, seen, depth + 1);
        return;
    }
    if (typeof v === 'function' || typeof v === 'symbol') {
        throw new EngineFastPathUnsupported(`unsupported-value:${typeof v}`);
    }
    if (typeof v === 'object') {
        const proto = Object.getPrototypeOf(v);
        if (proto !== Object.prototype && proto !== null) {
            throw new EngineFastPathUnsupported(`instance:${(v.constructor && v.constructor.name) || 'Object'}`);
        }
        visit(v, seen);
        writeEntries(v, undefined, seen, depth);
        return;
    }
    throw new EngineFastPathUnsupported(`unsupported-value:${typeof v}`);
}

/**
 * The object of `v`'s own enumerable keys (less `skip`) and their values,
 * as `encodeValue` and `encodeTyped` build it.
 * @param {Set<object>} seen the objects already visited on this encode
 * @param {number} depth how deep `v` is
 */
function writeEntries(v, skip: Set<string> | undefined, seen: Set<object>, depth: number): void {
    const w = valueWriter;
    const countAt = w.beginObject();
    let count = 0;
    // `for...in` with an own check visits `Object.keys` order but reads each
    // value through V8's enumeration cache. `rawStr` checks lone surrogates,
    // so only `__proto__` is checked here.
    for (const key in v) {
        if (!hasOwn.call(v, key) || (skip !== undefined && skip.has(key))) {
            continue;
        }
        if (key === '__proto__') {
            throw new EngineFastPathUnsupported('proto-key');
        }
        w.rawStr(key);
        writeWireValue(v[key], seen, depth + 1);
        count++;
    }
    w.putU32(countAt, count);
}

let modelClassesCache: any;

/**
 * The public model classes `materializeTyped` constructs, required on first
 * use (a late require avoids a load-order cycle) and cached.
 * @return {object} `{Resource, ValidatedResource, Relationship, ResourceValidator}`
 */
function modelClasses(): any {
    if (!modelClassesCache) {
        modelClassesCache = {
            // eslint-disable-next-line global-require
            Resource: require('../model/resource').default,
            // eslint-disable-next-line global-require
            ValidatedResource: require('../model/validatedresource').default,
            // eslint-disable-next-line global-require
            Relationship: require('../model/relationship').default,
            // eslint-disable-next-line global-require
            ResourceValidator: require('../serializer/resourcevalidator').default,
        };
    }
    return modelClassesCache;
}

/**
 * The wire name (`ctor`) of a Resource/ValidatedResource/Relationship, by
 * constructor identity, never `constructor.name` (a minifier renames it).
 * Any other class, a subclass included, throws `EngineFastPathUnsupported`.
 * @return {string} `'Resource'`, `'ValidatedResource'` or `'Relationship'`
 */
function typedCtorName(v): string {
    const ctor = v.constructor;
    const { Resource, ValidatedResource, Relationship } = modelClasses();
    if (ctor === Resource) {
        return 'Resource';
    }
    if (ctor === ValidatedResource) {
        return 'ValidatedResource';
    }
    if (ctor === Relationship) {
        return 'Relationship';
    }
    throw new EngineFastPathUnsupported(`typed-class:${(ctor && ctor.name) || 'Object'}`);
}

/**
 * What `materializeTyped` needs about an instance's class, kept per class
 * (checked against the constructor, namespace and type) while the model files
 * are unchanged: the class declaration `getType(fqn)` answers, and the
 * `$identifierFieldName` the constructor computes.
 */
interface TypeInfo {
    ctor: string;
    ns: unknown;
    type: unknown;
    classDeclaration: any;
    identifierFieldName: string;
}

/**
 * The `TypeInfo`s by fully-qualified name and then TS class, and the entry
 * found last, so a run of one class skips the hash lookup.
 */
interface TypeCache {
    byFqn: Map<string, Record<string, TypeInfo>>;
    last: { fqn: string; entry: Record<string, TypeInfo> } | undefined;
}

/** A new, empty `TypeCache`. */
function newTypeCache(): TypeCache {
    return { byFqn: new Map(), last: undefined };
}

/**
 * `new Ctor(modelManager, classDeclaration, ns, type, id, timestamp[,
 * validator])`, the own properties set in the constructors' order, but with
 * `$identifierFieldName` from `info`.
 * @param {Function} Ctor Resource, ValidatedResource or Relationship
 * @param {object} info the class's `TypeInfo`
 * @param {boolean} isRelationship whether `Ctor` is Relationship
 */
function constructCached(Ctor, info: TypeInfo, modelManager: BaseModelManager, ns, type, id, timestamp, isRelationship: boolean, validator?) {
    const resource = Object.create(Ctor.prototype);
    // Typed's constructor.
    resource.$modelManager = modelManager;
    resource.$classDeclaration = info.classDeclaration;
    resource.$namespace = ns;
    resource.$type = type;
    // Identifiable's constructor.
    resource.$identifierFieldName = info.identifierFieldName;
    resource.setIdentifier(id);
    resource.$timestamp = timestamp;
    if (validator !== undefined) {
        // ValidatedResource's constructor.
        resource.$validator = validator;
    } else if (isRelationship) {
        // Relationship's constructor.
        resource.$class = 'Relationship';
    }
    return resource;
}

/**
 * A `"typed"` wire node materialised into a real
 * Resource/ValidatedResource/Relationship, so every getter and later mutation
 * behaves as on the visitor path's result. Class lookups come from `types`;
 * the fields are decoded in place, so `node` must be fresh `JSON.parse`
 * output nothing else holds.
 * @param {BaseModelManager} modelManager the model manager to resolve its class in
 * @param {Map} types the caller's `TypeCache`
 */
function materializeTyped(node, modelManager: BaseModelManager, types: TypeCache) {
    const decode = (v) => decodeParsed(v, modelManager, types);
    const fields = node.fields || {};
    const identifierFieldName = fields.$identifierFieldName;
    const resource = newInstance(node.ctor, node.fqn, fields.$namespace, fields.$type,
        decode(fields.$identifier), decode(fields.$timestamp), modelManager, types);
    for (const key of Object.keys(fields)) {
        switch (key) {
        case '$namespace': case '$type': case '$identifierFieldName': case '$identifier': case '$timestamp': case '$class':
            continue;
        }
        if (key === identifierFieldName) {
            continue;
        }
        setField(resource, key, decode(fields[key]));
    }
    return resource;
}

/**
 * `materializeTyped` for `serializerFromJsonCompact`'s result: `[ctor, fqn,
 * $namespace, $type, $identifierFieldName, $identifier, $timestamp,
 * fields]`, each in its wire encoding, `fields` without what
 * `materializeTyped` skips. Decoded in place.
 * @param {BaseModelManager} modelManager the model manager to resolve its class in
 * @param {Map} types the caller's `TypeCache`
 */
function materializeCompact(node, modelManager: BaseModelManager, types: TypeCache) {
    const decode = (v) => decodeParsed(v, modelManager, types);
    const [ctor, fqn, ns, type, , id, timestamp, fields] = node;
    const resource = newInstance(ctor, fqn, decodeTagged(ns), decodeTagged(type),
        decode(id), decode(timestamp), modelManager, types);
    for (const key of Object.keys(fields)) {
        setField(resource, key, decode(fields[key]));
    }
    return resource;
}

/**
 * The instance of class `fqn` that `materializeTyped` builds, before its
 * fields are set: through its constructor the first time, then
 * `constructCached`.
 * @param {BaseModelManager} modelManager the model manager to resolve the class in
 * @param {Map} types the caller's `TypeCache`
 */
function newInstance(ctor, fqn, ns, type, id, timestamp, modelManager: BaseModelManager, types: TypeCache) {
    const { Resource, ValidatedResource, Relationship, ResourceValidator } = modelClasses();
    const Ctor = ctor === 'ValidatedResource' ? ValidatedResource : ctor === 'Relationship' ? Relationship : Resource;
    const validator = ctor === 'ValidatedResource' ? new ResourceValidator({}) : undefined;
    // Looked up by the strings `JSON.parse` made, and checked against the
    // namespace and type it was learned for.
    const last = types.last;
    const entry = last && last.fqn === fqn ? last.entry : types.byFqn.get(fqn);
    const info = entry?.[ctor];
    if (info && info.ns === ns && info.type === type) {
        if (last?.entry !== entry) {
            types.last = { fqn, entry: entry! };
        }
        return constructCached(Ctor, info, modelManager, ns, type, id, timestamp, Ctor === Relationship, validator);
    }
    const classDeclaration = modelManager.getType(fqn);
    const resource = validator !== undefined
        ? new Ctor(modelManager, classDeclaration, ns, type, id, timestamp, validator)
        : new Ctor(modelManager, classDeclaration, ns, type, id, timestamp);
    const learned = { ctor, ns, type, classDeclaration, identifierFieldName: resource.$identifierFieldName };
    let learnedEntry = types.byFqn.get(fqn);
    if (!learnedEntry) {
        learnedEntry = Object.create(null) as Record<string, TypeInfo>;
        types.byFqn.set(fqn, learnedEntry);
    }
    learnedEntry[ctor] = learned;
    types.last = { fqn, entry: learnedEntry };
    // The first instance is rebuilt as every later one is, so they share
    // one V8 object layout.
    return constructCached(Ctor, learned, modelManager, ns, type, id, timestamp, Ctor === Relationship, validator);
}

/**
 * `resource[key] = value` as an own enumerable data property; `__proto__` is
 * defined instead, so decoded data never sets a prototype.
 */
function setField(resource, key: string, value: unknown): void {
    if (key === '__proto__') {
        Object.defineProperty(resource, key, { value, enumerable: true, writable: true, configurable: true });
    } else {
        resource[key] = value;
    }
}

/**
 * A wire value as the runtime value it decodes to, over fresh `JSON.parse`
 * output nothing else holds: arrays and untagged objects are kept and only
 * their tagged members replaced in place (`JSON.parse` already made every key
 * an own data property, `__proto__` included).
 * @param {BaseModelManager} modelManager the model manager, for a `"typed"` value
 * @param {Map} types the caller's `TypeCache`
 */
function decodeParsed(v, modelManager: BaseModelManager, types: TypeCache) {
    if (v === null || typeof v !== 'object') {
        return v;
    }
    if (Array.isArray(v)) {
        for (let i = 0; i < v.length; i++) {
            const item = v[i];
            if (item !== null && typeof item === 'object') {
                v[i] = decodeParsed(item, modelManager, types);
            }
        }
        return v;
    }
    if (v[TAG] === 'typed') {
        return materializeTyped(v, modelManager, types);
    }
    if (v[TAG] === 'map') {
        return decodeParsedMap(v.entries, modelManager, types);
    }
    if (!hasOwn.call(v, TAG)) {
        for (const key of Object.keys(v)) {
            const item = v[key];
            if (item !== null && typeof item === 'object') {
                const decoded = decodeParsed(item, modelManager, types);
                if (decoded !== item) {
                    setField(v, key, decoded);
                }
            }
        }
        return v;
    }
    return decodeTagged(v);
}

/**
 * A `"map"` wire value's `entries` as a Map, each key and value decoded by
 * `decodeParsed` (so a `"typed"` value takes its class from `types`).
 * @param {Array} entries the `[key, value]` wire pairs
 * @param {BaseModelManager} modelManager the model manager, for a `"typed"` value
 * @param {Map} types the caller's `TypeCache`
 */
function decodeParsedMap(entries, modelManager: BaseModelManager, types: TypeCache): Map<unknown, unknown> {
    const out = new Map();
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        out.set(decodeParsed(entry[0], modelManager, types), decodeParsed(entry[1], modelManager, types));
    }
    return out;
}

/**
 * A primitive (itself) or an `"undefined"`, `"number"` or `"dayjs"` tagged
 * value, as the runtime value it decodes to.
 */
function decodeTagged(v) {
    if (v === null || typeof v !== 'object') {
        return v;
    }
    switch (v[TAG]) {
    case 'undefined':
        return undefined;
    case 'number':
        switch (v.value) {
        case 'NaN': return NaN;
        case 'Infinity': return Infinity;
        case '-Infinity': return -Infinity;
        case '-0': return -0;
        default: throw new EngineFastPathUnsupported(`unrecognised-wire-number:${v.value}`);
        }
    case 'dayjs': {
        if (!v.valid) {
            return dayjs.utc(NaN);
        }
        let d = dayjs.utc(v.ms);
        if (v.utcOffset) {
            d = d.utcOffset(v.utcOffset);
        }
        return d;
    }
    default:
        throw new EngineFastPathUnsupported(`unrecognised-wire-kind:${v[TAG]}`);
    }
}

export { typedCtorName, modelClasses, encodeValue, encodeBytes, decodeParsed, materializeCompact, checkString };
export type { TypeCache };
export { newTypeCache };
