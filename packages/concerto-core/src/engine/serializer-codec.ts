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

// The wire codec of the Serializer fast path: `fromJSON`/`toJSON` cross in
// one call each instead of per field. Plain JSON crosses unchanged; anything
// else is a one-key object tagged `@@oracle` (`WIRE_TAG`): a non-finite
// number or `-0`, `undefined`, a `Map`, a dayjs (epoch ms and utcOffset), or
// a Resource/ValidatedResource/Relationship, whose `"typed"` `fields` hold
// every own property except `$modelManager`/`$classDeclaration`/`$validator`.
// Anything else (another class, a function, a symbol, an object reached
// twice) throws `EngineFastPathUnsupported`, and the TS visitors run.

import dayjs from '../dayjs-setup';
import { EngineFastPathUnsupported, isDayjsLike, isTypedLike, hasLoneSurrogate } from './util';
import { WireWriter } from './wire';

/* eslint-disable no-unused-vars */
import type BaseModelManager from '../basemodelmanager';
/* eslint-enable no-unused-vars */

const TAG = '@@oracle';

const hasOwn = Object.prototype.hasOwnProperty;

/** Throws `EngineFastPathUnsupported` for a string with a lone surrogate. */
function checkString(s: string): void {
    if (hasLoneSurrogate(s)) {
        throw new EngineFastPathUnsupported('lone-surrogate');
    }
}

/**
 * Throws `EngineFastPathUnsupported` for a key the codec cannot carry: a lone
 * surrogate, or `__proto__` (assigning it would set the prototype).
 */
function checkKey(key: string): void {
    if (key === '__proto__') {
        throw new EngineFastPathUnsupported('proto-key');
    }
    checkString(key);
}

// `$validator` is rebuilt on decode from the serializer's options.
const TYPED_SKIP = new Set(['$modelManager', '$classDeclaration', '$validator']);

/** A live Resource/ValidatedResource/Relationship in the `"typed"` wire shape. */
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
 * Marks `v` visited on this encode. A cycle, or a value shared between two
 * places (which `deduplicateResources` relies on), throws
 * `EngineFastPathUnsupported`.
 */
function visit(v: object, seen: Set<object>): void {
    if (seen.has(v)) {
        throw new EngineFastPathUnsupported('shared-or-cyclic-reference');
    }
    seen.add(v);
}

/** A JS runtime value as the wire value the engine reads. */
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

// The same wire value written from the live object in the compact binary
// layout (wire.ts), which the engine reads as it reads the text.

/** The one writer of the Serializer fast path's binary input. */
const valueWriter = new WireWriter(64 * 1024);

/** How deep the binary write nests before leaving the value to the text path (engine limit 128). */
const MAX_BINARY_DEPTH = 100;

/** Thrown inside `encodeBytes` to leave a value to the text path. */
class TextPathOnly extends Error {
}

/**
 * `encodeValue(v)` in the compact binary layout, valid until the next call.
 * Undefined when the value is left to the text path, which throws what it
 * always threw; any other error (a throwing getter) propagates.
 */
function encodeBytes(v: unknown): Uint8Array | undefined {
    // A getter read mid-write may re-enter: the writer refuses the nested
    // write, which takes the text path.
    if (!valueWriter.begin()) {
        return undefined;
    }
    try {
        writeWireValue(v, new Set(), 0);
        return valueWriter.bytes();
    } catch (err) {
        if (err instanceof TextPathOnly || err instanceof EngineFastPathUnsupported) {
            return undefined;
        }
        throw err;
    } finally {
        valueWriter.release();
    }
}

/** A tagged object's head: the header with `count` entries (tag included) and the tag. */
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

/** `encodeValue(v, seen)`, written to `valueWriter`. */
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
        // `rawStr` throws for a lone surrogate, so the string is scanned once.
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
        // The count is patched in after: a value's getter may change the map.
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

/** The object of `v`'s own enumerable keys (less `skip`) and their values. */
function writeEntries(v, skip: Set<string> | undefined, seen: Set<object>, depth: number): void {
    const w = valueWriter;
    const countAt = w.beginObject();
    let count = 0;
    // `for...in` with an own check visits `Object.keys` order through V8's
    // enumeration cache; `rawStr` checks lone surrogates.
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
 * The public model classes `materializeTyped` constructs, required late to
 * avoid a load-order cycle.
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
 * The wire name of a Resource/ValidatedResource/Relationship, by constructor
 * identity (a minifier renames `constructor.name`). Any other class throws
 * `EngineFastPathUnsupported`.
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
 * What `materializeTyped` needs about a class, kept while the model files
 * are unchanged: its class declaration and `$identifierFieldName`.
 */
interface TypeInfo {
    ctor: string;
    ns: unknown;
    type: unknown;
    classDeclaration: any;
    identifierFieldName: string;
}

/** `TypeInfo`s by fqn and TS class, and the last one found (a run of one class skips the lookup). */
interface TypeCache {
    byFqn: Map<string, Record<string, TypeInfo>>;
    last: { fqn: string; entry: Record<string, TypeInfo> } | undefined;
}

function newTypeCache(): TypeCache {
    return { byFqn: new Map(), last: undefined };
}

/**
 * `new Ctor(...)`, setting the own properties in the constructors' order,
 * with `$identifierFieldName` from `info`.
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
 * A `"typed"` wire node as a real Resource/ValidatedResource/Relationship,
 * which behaves as the visitor path's result. Decoded in place, so `node`
 * must be fresh `JSON.parse` output.
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
 * `materializeTyped` for `serializerFromJsonCompact`'s `[ctor, fqn,
 * $namespace, $type, $identifierFieldName, $identifier, $timestamp, fields]`.
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

/** A new instance of `fqn`: by its constructor the first time, then `constructCached`. */
function newInstance(ctor, fqn, ns, type, id, timestamp, modelManager: BaseModelManager, types: TypeCache) {
    const { Resource, ValidatedResource, Relationship, ResourceValidator } = modelClasses();
    const Ctor = ctor === 'ValidatedResource' ? ValidatedResource : ctor === 'Relationship' ? Relationship : Resource;
    const validator = ctor === 'ValidatedResource' ? new ResourceValidator({}) : undefined;
    // Checked against the namespace and type it was learned for.
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
    // Rebuilt as every later instance is, so they share one object layout.
    return constructCached(Ctor, learned, modelManager, ns, type, id, timestamp, Ctor === Relationship, validator);
}

/** Sets an own enumerable data property; `__proto__` is defined, never setting a prototype. */
function setField(resource, key: string, value: unknown): void {
    if (key === '__proto__') {
        Object.defineProperty(resource, key, { value, enumerable: true, writable: true, configurable: true });
    } else {
        resource[key] = value;
    }
}

/**
 * A wire value as the runtime value it decodes to, over fresh `JSON.parse`
 * output: only tagged members are replaced in place.
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

/** A `"map"` wire value's `entries` as a Map, each key and value decoded. */
function decodeParsedMap(entries, modelManager: BaseModelManager, types: TypeCache): Map<unknown, unknown> {
    const out = new Map();
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        out.set(decodeParsed(entry[0], modelManager, types), decodeParsed(entry[1], modelManager, types));
    }
    return out;
}

/** A primitive, or an `"undefined"`, `"number"` or `"dayjs"` tagged value, decoded. */
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
