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
// The wire codec for the Serializer fast path (P4-10; PORTING.md section 5
// row 6, D7). `Serializer.fromJSON`/`toJSON` cross the WASM boundary in one
// call each, instead of per field through the TS visitors (which keep
// their shells and stay the fallback path, plan §3).
//
// Plain JSON crosses unchanged. Anything else is a one-key object tagged
// `@@oracle` (matching concerto-wasm's own `WIRE_TAG`, and the oracle
// harness's own codec), so that a value JSON cannot hold (a non-finite
// number or `-0`, `undefined`, a `Map`, a dayjs, an already-`Resource`/
// `ValidatedResource`/`Relationship` field) still round-trips.
//
// A `"typed"` value's `fields` holds every own property of the TS object,
// in order, `$`-prefixed handles included (`$namespace`, `$type`,
// `$identifierFieldName`, `$identifier`, `$timestamp`, and `$class` for a
// `Relationship`) except `$modelManager`/`$classDeclaration`/`$validator`,
// which this codec never sends or expects. A dayjs crosses as `(epoch ms,
// utcOffset minutes)` (PORTING.md 3.3), never a date object: D7 keeps dayjs
// construction in TS, so `decodeValue` rebuilds one from that pair.
//
// `encodeValue` throws `EngineFastPathUnsupported` for anything it cannot
// express this way (a stubbed instance, a class other than the three
// listed above, a function, a symbol, or an object or array reached twice:
// a cycle or a shared reference, whose identity a JSON tree cannot carry);
// the fast path catches it and falls
// back to the TS visitor path, exactly as an unconverted call would run.

import dayjs from '../dayjs-setup';
import { EngineFastPathUnsupported, isDayjsLike, isTypedLike, hasLoneSurrogate } from './util';
import { WireWriter } from './wire';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type BaseModelManager from '../basemodelmanager';
/* eslint-enable no-unused-vars */

const TAG = '@@oracle';

/**
 * Throws `EngineFastPathUnsupported` for a string the engine cannot receive
 * unchanged: one with a lone surrogate. The caller falls back to the TS
 * path, which keeps it as is.
 * @param {string} s the string (a value, an object key or a map key)
 */
function checkString(s: string): void {
    if (hasLoneSurrogate(s)) {
        throw new EngineFastPathUnsupported('lone-surrogate');
    }
}

/**
 * Throws `EngineFastPathUnsupported` for an object key the codec cannot
 * carry: a lone surrogate (`checkString`), or `__proto__`. On the TS side
 * `out['__proto__'] = x` would set the prototype instead of an own
 * property, so the key would vanish (and `ResourceValidator`'s "Unexpected
 * properties ... __proto__" check with it); rather than special-case it
 * across the boundary, the whole call falls back to the TS path, which
 * treats it exactly as ts mode does.
 * @param {string} key the key
 */
function checkKey(key: string): void {
    if (key === '__proto__') {
        throw new EngineFastPathUnsupported('proto-key');
    }
    checkString(key);
}

/**
 * `obj[key] = value` as an own, enumerable, writable, configurable data
 * property, whatever `key` is (`__proto__` included), so a decoded object
 * never gets a prototype from its data.
 * @param {object} obj the object
 * @param {string} key the key
 * @param {*} value the value
 */
function setOwn(obj: object, key: string, value: unknown): void {
    Object.defineProperty(obj, key, { value, enumerable: true, writable: true, configurable: true });
}

/**
 * Throws `EngineFastPathUnsupported` unless `text`, the output of
 * `JSON.stringify`, is JSON the engine can read: `JSON.stringify` escapes
 * a lone surrogate as `\udXXX` and writes a valid pair as raw characters,
 * so any such escape not itself escaped (an odd run of backslashes before
 * it) is a lone surrogate. Used for text that was not built by
 * `encodeValue` (a model file's AST).
 * @param {string} text the JSON text
 * @return {string} `text`
 */
function checkJsonText(text: string): string {
    if (/(?:^|[^\\])(?:\\\\)*\\u[dD][89a-fA-F][0-9a-fA-F]{2}/.test(text)) {
        throw new EngineFastPathUnsupported('lone-surrogate');
    }
    return text;
}

// The three own properties a "typed" value never carries across (they are
// handles the engine has no use for; `$validator` is rebuilt on decode from
// the serializer's own options instead).
const TYPED_SKIP = new Set(['$modelManager', '$classDeclaration', '$validator']);

/**
 * A live Resource/ValidatedResource/Relationship in the `"typed"` wire
 * shape (module doc).
 * @param {object} v the instance
 * @return {object} its wire encoding
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
 * Marks `v` as visited on this encode, throwing `EngineFastPathUnsupported`
 * if it was already visited: a cycle (`vehicle.logEntries[0].vehicle ===
 * vehicle`) would recurse forever, and a value shared between two places
 * (the same `Resource` as a field of two parents, which `toJSON`'s
 * `deduplicateResources` relies on) would cross as two independent copies,
 * losing the identity the TS visitors see. Either way the fast path cannot
 * express it, so the caller falls back to the visitor path.
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
 * @param {*} v the value
 * @param {Set<object>} [seen] the objects already visited on this encode (see `visit`)
 * @return {*} its wire encoding
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
// P5-101 (E-7, F-8; accordproject/concerto-rust#455): the same wire value,
// written straight from the live object in the compact binary layout
// (wire.ts) instead of built as a tagged object tree and then
// `JSON.stringify`d. The engine reads the bytes as it reads that text
// (concerto-wasm `parse_wire_bytes`).
// ---------------------------------------------------------------------

/** The one writer of the Serializer fast path's binary input. */
const valueWriter = new WireWriter(64 * 1024);

/** Set while `valueWriter` is being written (a getter may re-enter). */
let valueWriterBusy = false;

/**
 * How deep the binary write nests before it leaves the value to the text
 * path, as ast-codec.ts does: below the engine's JSON reader's limit (128),
 * so a value that text rejects for its depth is still sent, and rejected,
 * as text.
 */
const MAX_BINARY_DEPTH = 100;

/** Thrown inside `encodeBytes` to leave a value to the text path. */
class TextPathOnly extends Error {
}

/**
 * `encodeValue(v)`'s wire value in the compact binary layout: a view of the
 * writer's buffer, valid until the next call. Undefined when the value is
 * left to the text path (`JSON.stringify(encodeValue(v))`), which then
 * throws what it always threw: a value `encodeValue` cannot express
 * (`EngineFastPathUnsupported`), one nested deeper than
 * `MAX_BINARY_DEPTH`, a non-finite number where `encodeValue` would not
 * tag one, or a call made while the writer is in use. Any other error (a
 * throwing getter) propagates, as from `encodeValue`, which reads the same
 * properties in the same order.
 * @param {*} v the value
 * @return {Uint8Array | undefined} its bytes
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
 * @param {string} kind the tag's value
 */
function writeTagHead(count: number, kind: string): void {
    const at = valueWriter.beginObject();
    valueWriter.putU32(at, count);
    valueWriter.rawStr(TAG);
    valueWriter.str(kind);
}

/**
 * A finite number `encodeValue` writes as itself.
 * @param {number} n the number
 */
function writeNumber(n: number): void {
    if (!Number.isFinite(n)) {
        throw new TextPathOnly();
    }
    valueWriter.num(n);
}

/**
 * `encodeValue(v, seen)`, written to `valueWriter` (`encodeBytes`).
 * @param {*} v the value
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
        checkString(v);
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
            // A hole (`encodeValue`'s `map` keeps it) is `null` in
            // `JSON.stringify`'s text.
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
        const entries = [...v.entries()];
        w.array(entries.length);
        for (const [k, x] of entries) {
            w.array(2);
            writeWireValue(k, seen, depth + 3);
            writeWireValue(x, seen, depth + 3);
        }
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
 * @param {object} v the object
 * @param {Set<string>|undefined} skip the keys left out
 * @param {Set<object>} seen the objects already visited on this encode
 * @param {number} depth how deep `v` is
 */
function writeEntries(v, skip: Set<string> | undefined, seen: Set<object>, depth: number): void {
    const w = valueWriter;
    const countAt = w.beginObject();
    let count = 0;
    for (const key of Object.keys(v)) {
        if (skip !== undefined && skip.has(key)) {
            continue;
        }
        checkKey(key);
        w.rawStr(key);
        writeWireValue(v[key], seen, depth + 1);
        count++;
    }
    w.putU32(countAt, count);
}

let modelClassesCache: any;

/**
 * The public model classes `materializeTyped` constructs, required once on
 * first use and cached (P5-06: it runs once per decoded instance).
 * Required late, not at module load: these are the public model classes,
 * not engine-only code, and a late require avoids a load-order cycle with
 * them (P5-02 removed the CONCERTO_ENGINE=ts|rust flag: the whole directory
 * is rust-mode code now, but the public model classes it requires here are
 * not).
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
 * The wire name (`ctor`) of a Resource/ValidatedResource/Relationship, found
 * by the identity of its constructor against the public model classes (the
 * same module instances the public graph uses, build-esm.js), never by
 * `constructor.name`, which a minifier renames (P5-43,
 * accordproject/concerto-rust#364). Any other class, a subclass of the three
 * included, throws `EngineFastPathUnsupported` (`typed-class:`), as before.
 * @param {object} v a typed-like instance
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
 * What `materializeTyped` needs to know about an instance's class, kept per
 * class (and checked against the constructor, namespace and type it was
 * learned for) by a caller that decodes many
 * instances against the same, unchanged model files (P5-16,
 * accordproject/concerto-rust#310): the class declaration
 * `modelManager.getType(fqn)` answers, and the `$identifierFieldName` the
 * instance constructor computes (`Identifiable`'s constructor looks the
 * type up again, through `getModelFile(ns).getType(fqn)`, for every
 * instance). The caller owns the map and drops it whenever the model files
 * change (`engine/serializer.ts` keeps it next to its handle).
 */
interface TypeInfo {
    ctor: string;
    ns: unknown;
    type: unknown;
    classDeclaration: any;
    identifierFieldName: string;
}

/**
 * The `TypeInfo`s of each class, by fully-qualified name and then by TS
 * class (`ctor`), and the entry found last: a run of instances of one
 * class then compares the name with the last one's instead of hashing it
 * again (P5-16).
 */
interface TypeCache {
    byFqn: Map<string, Record<string, TypeInfo>>;
    last: { fqn: string; entry: Record<string, TypeInfo> } | undefined;
}

/**
 * A new, empty `TypeCache`.
 * @return {object} the cache
 */
function newTypeCache(): TypeCache {
    return { byFqn: new Map(), last: undefined };
}

/**
 * `new Ctor(modelManager, classDeclaration, ns, type, id, timestamp[, validator])`,
 * the instance's own properties set in the order the constructors set them
 * (`Typed`, then `Identifiable`, then `Relationship`'s `$class` or
 * `ValidatedResource`'s `$validator`), but with `$identifierFieldName`
 * taken from `info`, which the real constructor computed for the first
 * instance of this class (P5-16). Only `newInstance` calls it, with
 * `info` from a `TypeCache`.
 * @param {Function} Ctor Resource, ValidatedResource or Relationship
 * @param {object} info the class's `TypeInfo`
 * @param {BaseModelManager} modelManager the model manager
 * @param {string} ns the namespace
 * @param {string} type the short type name
 * @param {*} id the identifier
 * @param {*} timestamp the timestamp
 * @param {boolean} isRelationship whether `Ctor` is Relationship
 * @param {*} [validator] the ValidatedResource's validator
 * @return {object} the instance
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
 * A `"typed"` wire node (module doc) materialised into a real
 * Resource/ValidatedResource/Relationship, using the real TS classes so
 * that every getter and later mutation (`setPropertyValue`, `toJSON`, ...)
 * behaves exactly as the visitor path's result would.
 *
 * With `types` (P5-16), the class lookups are made once per class and kept
 * there (`TypeCache`), and the node's fields are decoded in place
 * (`decodeParsed`): the node must then be fresh `JSON.parse` output that
 * nothing else holds.
 * @param {object} node the wire node
 * @param {BaseModelManager} modelManager the model manager to resolve its class in
 * @param {Map} [types] the caller's `TypeCache`
 * @return {object} the materialised instance
 */
function materializeTyped(node, modelManager: BaseModelManager, types?: TypeCache) {
    const decode = types ? (v) => decodeParsed(v, modelManager, types) : (v) => decodeValue(v, modelManager);
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
 * `materializeTyped` for the compact result of `serializerFromJsonCompact`
 * (concerto-wasm, P5-16): `[ctor, fqn, $namespace, $type,
 * $identifierFieldName, $identifier, $timestamp, fields]`, each value in its
 * wire encoding, where `fields` already leaves out what `materializeTyped`
 * skips. Builds the same instance `materializeTyped` builds from the
 * `"typed"` node of the same resource. `node` must be fresh `JSON.parse`
 * output that nothing else holds (it is decoded in place).
 * @param {Array} node the compact result
 * @param {BaseModelManager} modelManager the model manager to resolve its class in
 * @param {Map} types the caller's `TypeCache`
 * @return {object} the materialised instance
 */
function materializeCompact(node, modelManager: BaseModelManager, types: TypeCache) {
    if (!Array.isArray(node) || node.length !== 8) {
        throw new EngineFastPathUnsupported('unrecognised-compact-result');
    }
    const decode = (v) => decodeParsed(v, modelManager, types);
    const [ctor, fqn, ns, type, , id, timestamp, fields] = node;
    const resource = newInstance(ctor, fqn, decodeValue(ns, modelManager), decodeValue(type, modelManager),
        decode(id), decode(timestamp), modelManager, types);
    for (const key of Object.keys(fields)) {
        setField(resource, key, decode(fields[key]));
    }
    return resource;
}

/**
 * The Resource/ValidatedResource/Relationship (by `ctor`) of class `fqn`
 * that `materializeTyped` builds, before its fields are set: through its
 * constructor, or, when `types` already has this class, `constructCached`.
 * @param {string} ctor the TS class name
 * @param {string} fqn the class's fully-qualified name
 * @param {string} ns the namespace
 * @param {string} type the short type name
 * @param {*} id the identifier
 * @param {*} timestamp the timestamp
 * @param {BaseModelManager} modelManager the model manager to resolve the class in
 * @param {Map} [types] the caller's `TypeCache`
 * @return {object} the instance
 */
function newInstance(ctor, fqn, ns, type, id, timestamp, modelManager: BaseModelManager, types?: TypeCache) {
    const { Resource, ValidatedResource, Relationship, ResourceValidator } = modelClasses();
    const Ctor = ctor === 'ValidatedResource' ? ValidatedResource : ctor === 'Relationship' ? Relationship : Resource;
    const validator = ctor === 'ValidatedResource' ? new ResourceValidator({}) : undefined;
    // Looked up by the strings `JSON.parse` already made (no key is built),
    // and checked against the namespace and type it was learned for.
    const last = types?.last;
    const entry = last && last.fqn === fqn ? last.entry : types?.byFqn.get(fqn);
    const info = entry?.[ctor];
    if (info && info.ns === ns && info.type === type) {
        if (last?.entry !== entry) {
            types!.last = { fqn, entry: entry! };
        }
        return constructCached(Ctor, info, modelManager, ns, type, id, timestamp, Ctor === Relationship, validator);
    }
    const classDeclaration = modelManager.getType(fqn);
    const resource = validator !== undefined
        ? new Ctor(modelManager, classDeclaration, ns, type, id, timestamp, validator)
        : new Ctor(modelManager, classDeclaration, ns, type, id, timestamp);
    if (!types) {
        return resource;
    }
    const learned = { ctor, ns, type, classDeclaration, identifierFieldName: resource.$identifierFieldName };
    let learnedEntry = types.byFqn.get(fqn);
    if (!learnedEntry) {
        learnedEntry = Object.create(null) as Record<string, TypeInfo>;
        types.byFqn.set(fqn, learnedEntry);
    }
    learnedEntry[ctor] = learned;
    types.last = { fqn, entry: learnedEntry };
    // The first instance of a class is built again the way every later one
    // is, so that all of them share one object layout (V8 map): the
    // constructor's instance has a different one, and code that reads
    // instances of both (validate, toJSON) would see two.
    return constructCached(Ctor, learned, modelManager, ns, type, id, timestamp, Ctor === Relationship, validator);
}

/**
 * `setOwn(resource, key, value)`: the model classes define methods only
 * (no accessors), so a plain assignment makes the same own, enumerable,
 * writable, configurable property, except for `__proto__`.
 * @param {object} resource the instance
 * @param {string} key the key
 * @param {*} value the value
 */
function setField(resource, key: string, value: unknown): void {
    if (key === '__proto__') {
        setOwn(resource, key, value);
    } else {
        resource[key] = value;
    }
}

/**
 * `decodeValue` over fresh `JSON.parse` output that nothing else holds
 * (P5-16): plain arrays and objects are kept and only their tagged members
 * replaced, instead of being copied. `JSON.parse` already makes every key,
 * `__proto__` included, an own data property, as `decodeValue`'s copies
 * do. `types` is `materializeTyped`'s `TypeCache`.
 * @param {*} v the parsed wire value
 * @param {BaseModelManager} modelManager the model manager, for a `"typed"` value
 * @param {Map} types the caller's `TypeCache`
 * @return {*} the decoded value
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
    if (!Object.prototype.hasOwnProperty.call(v, TAG)) {
        for (const key of Object.keys(v)) {
            const item = v[key];
            if (item !== null && typeof item === 'object') {
                const decoded = decodeParsed(item, modelManager, types);
                if (decoded !== item) {
                    setOwn(v, key, decoded);
                }
            }
        }
        return v;
    }
    if (v[TAG] === 'typed') {
        return materializeTyped(v, modelManager, types);
    }
    return decodeValue(v, modelManager);
}

/**
 * A wire value (module doc) as the JS runtime value it decodes to.
 * @param {*} v the wire value
 * @param {BaseModelManager} modelManager the model manager, for a `"typed"` value
 * @return {*} the decoded value
 */
function decodeValue(v, modelManager: BaseModelManager) {
    if (v === null || typeof v !== 'object') {
        return v;
    }
    if (Array.isArray(v)) {
        return v.map((item) => decodeValue(item, modelManager));
    }
    if (!Object.prototype.hasOwnProperty.call(v, TAG)) {
        const out = {};
        for (const key of Object.keys(v)) {
            setOwn(out, key, decodeValue(v[key], modelManager));
        }
        return out;
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
    case 'map':
        return new Map(v.entries.map(([k, x]) => [decodeValue(k, modelManager), decodeValue(x, modelManager)]));
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
    case 'typed':
        return materializeTyped(v, modelManager);
    default:
        throw new EngineFastPathUnsupported(`unrecognised-wire-kind:${v[TAG]}`);
    }
}

export { EngineFastPathUnsupported, typedCtorName, modelClasses, encodeValue, encodeBytes, decodeValue, decodeParsed, materializeCompact, checkString, checkJsonText };
export type { TypeCache };
export { newTypeCache };
