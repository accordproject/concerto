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

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type BaseModelManager from '../basemodelmanager';
/* eslint-enable no-unused-vars */

const TAG = '@@oracle';

/** Thrown when a value cannot cross the fast path; the caller falls back to the visitor path. */
class EngineFastPathUnsupported extends Error {
}

/**
 * @param {*} v value
 * @returns {boolean} duck-typed dayjs instance
 */
function isDayjsLike(v): boolean {
    return !!v && typeof v === 'object' &&
        typeof v.isValid === 'function' &&
        typeof v.utcOffset === 'function' &&
        typeof v.isBefore === 'function' &&
        typeof v.valueOf === 'function';
}

/**
 * @param {*} v value
 * @returns {boolean} duck-typed Resource/ValidatedResource/Relationship
 */
function isTypedLike(v): boolean {
    return !!v && typeof v === 'object' &&
        typeof v.getFullyQualifiedType === 'function' &&
        typeof v.$namespace === 'string' &&
        typeof v.$type === 'string';
}

// A UTF-16 code unit in D800-DFFF that is not half of a surrogate pair.
// `JSON.stringify` writes one as a `\udXXX` escape, which serde_json (the
// engine's JSON reader) rejects outright, and Rust strings cannot hold one
// anyway (PORTING.md 3.1, DV-004).
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/**
 * Throws `EngineFastPathUnsupported` for a string the engine cannot receive
 * unchanged: one with a lone surrogate. The caller falls back to the TS
 * path, which keeps it as is.
 * @param {string} s the string (a value, an object key or a map key)
 */
function checkString(s: string): void {
    if (LONE_SURROGATE.test(s)) {
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
    const ctorName = v.constructor && v.constructor.name;
    if (ctorName !== 'Resource' && ctorName !== 'ValidatedResource' && ctorName !== 'Relationship') {
        throw new EngineFastPathUnsupported(`typed-class:${ctorName}`);
    }
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

// ---------------------------------------------------------------------------
// P5-06b: the same wire text, built with fewer copies.
// ---------------------------------------------------------------------------
//
// `encodeValue` copies every value it walks. Most of a document is already
// plain JSON, which `JSON.stringify` writes as `encodeValue`'s copy would be
// written, so `encodeMember` keeps a string, a boolean, `null`, a finite
// number other than `-0`, and an array of only those, as they are, and hands
// anything else to `encodeValue`. The lone-surrogate check that
// `encodeValue` makes per string (`checkString`) is made once on the whole
// text instead (`checkJsonText`), which finds the same strings.

/**
 * @param {*} v value
 * @returns {boolean} whether `JSON.stringify` writes `v` as `encodeValue(v)` would be written
 */
function isSimple(v): boolean {
    const t = typeof v;
    return t === 'string' || t === 'boolean' || v === null ||
        (t === 'number' && Number.isFinite(v) && !Object.is(v, -0));
}

/**
 * `encodeValue(v, seen)`, returning `v` itself when it is plain JSON of the
 * simple kinds above (an array of them is marked visited, as `encodeValue`
 * would mark it). The lone-surrogate check is left to the caller.
 * @param {*} v the value
 * @param {Set<object>} seen the objects already visited on this encode
 * @return {*} its wire encoding
 */
function encodeMember(v, seen: Set<object>) {
    if (isSimple(v)) {
        return v;
    }
    if (Array.isArray(v) && Object.getPrototypeOf(v) === Array.prototype) {
        let simple = true;
        for (let i = 0; i < v.length; i++) {
            if (!isSimple(v[i])) {
                simple = false;
                break;
            }
        }
        if (simple) {
            visit(v, seen);
            return v;
        }
    }
    return encodeValue(v, seen);
}

/**
 * `JSON.stringify(encodeValue(obj))` for a plain object, also returning the
 * value of each of its own properties, in `Object.keys` order (the lean
 * `serializerFromJsonLean` reply names them by index). `null` when `obj` is
 * not a plain object, for the caller to use `encodeValue` instead. Throws
 * `EngineFastPathUnsupported` where `encodeValue` would.
 * @param {*} obj the object
 * @return {object|null} `{ text, values }`, or `null`
 */
function encodePlainObjectText(obj): { text: string, values: unknown[] } | null {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || isDayjsLike(obj) || isTypedLike(obj) || obj instanceof Map) {
        return null;
    }
    const proto = Object.getPrototypeOf(obj);
    if (proto !== Object.prototype && proto !== null) {
        return null;
    }
    const seen = new Set<object>();
    visit(obj, seen);
    const keys = Object.keys(obj);
    const values = new Array(keys.length);
    let out: any = obj;
    for (let i = 0; i < keys.length; i++) {
        const key = keys[i];
        if (key === '__proto__') {
            throw new EngineFastPathUnsupported('proto-key');
        }
        const value = obj[key];
        values[i] = value;
        const encoded = encodeMember(value, seen);
        if (out === obj && encoded !== value) {
            out = {};
            for (let j = 0; j < i; j++) {
                out[keys[j]] = values[j];
            }
        }
        if (out !== obj) {
            out[key] = encoded;
        }
    }
    return { text: checkJsonText(JSON.stringify(out)), values };
}

/**
 * `JSON.stringify(encodeValue(resource))` for a Resource/ValidatedResource/
 * Relationship (`encodeTyped`), with its fields encoded by `encodeMember`.
 * @param {object} resource the instance
 * @return {string} the wire text
 */
function encodeTypedText(resource): string {
    const seen = new Set<object>();
    visit(resource, seen);
    const ctorName = resource.constructor && resource.constructor.name;
    if (ctorName !== 'Resource' && ctorName !== 'ValidatedResource' && ctorName !== 'Relationship') {
        throw new EngineFastPathUnsupported(`typed-class:${ctorName}`);
    }
    const fields = {};
    for (const key of Object.keys(resource)) {
        if (TYPED_SKIP.has(key)) {
            continue;
        }
        if (key === '__proto__') {
            throw new EngineFastPathUnsupported('proto-key');
        }
        fields[key] = encodeMember(resource[key], seen);
    }
    return checkJsonText(JSON.stringify({ [TAG]: 'typed', ctor: ctorName, fqn: resource.getFullyQualifiedType(), fields }));
}

// The own properties `Instance::to_validator_value` (concerto-core) leaves
// out of the validator's shape: the three handles and the private ones.
const VALIDATOR_SKIP = new Set([
    '$modelManager', '$classDeclaration', '$validator',
    '$namespace', '$type', '$identifierFieldName', '$imports', '$superTypes', '$id',
]);

/**
 * A resource whose own properties are all plain JSON of the simple kinds
 * above, as the JSON text of the shape the engine's validator reads
 * (`Instance::to_validator_value`: `$class` first, then each own property
 * but `VALIDATOR_SKIP`), for concerto-wasm `resourceValidateSimple`. `null`
 * for any other resource.
 * @param {object} resource the Resource/ValidatedResource
 * @return {string|null} the text, or `null`
 */
function encodeValidatorText(resource): string | null {
    const out: any = { $class: resource.getFullyQualifiedType() };
    for (const key of Object.keys(resource)) {
        if (VALIDATOR_SKIP.has(key)) {
            continue;
        }
        if (key === '__proto__') {
            return null;
        }
        const value = resource[key];
        if (!isSimple(value)) {
            if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
                return null;
            }
            for (let i = 0; i < value.length; i++) {
                if (!isSimple(value[i])) {
                    return null;
                }
            }
        }
        out[key] = value;
    }
    const text = JSON.stringify(out);
    try {
        return checkJsonText(text);
    } catch (err) {
        return null;
    }
}

// ---------------------------------------------------------------------------
// P5-06b review: what `validate()`'s fast path may read.
// ---------------------------------------------------------------------------
//
// The encoders above list an object's properties with `Object.keys` and read
// each one. The TS visitor (serializer/resourcevalidator.ts
// `visitClassDeclaration`) lists them with `Object.getOwnPropertyNames`,
// which also sees a non-enumerable one, and reads each declared field once.
// `validate()` falls back to that visitor whenever the engine says
// "invalid", so the fast path may only run where reading first is
// unobservable and `Object.keys` sees what the visitor sees: every object
// it would reach is a non-Proxy whose own string-keyed properties are all
// enumerable data properties (an array's own `length` aside). This check
// reads property descriptors only, so no getter or Proxy trap runs.

let isProxyFn: ((v: unknown) => boolean) | null | undefined;

/**
 * @param {object} v an object
 * @return {boolean} whether `v` is a Proxy; `true` when that cannot be told
 */
function mayBeProxy(v: object): boolean {
    if (isProxyFn === undefined) {
        try {
            // eslint-disable-next-line global-require
            const types = require('util').types;
            isProxyFn = types && typeof types.isProxy === 'function' ? types.isProxy : null;
        } catch (err) {
            isProxyFn = null;
        }
    }
    return isProxyFn ? isProxyFn(v) : true;
}

/**
 * Whether every object reachable from `root` through own properties (and a
 * `Map`'s entries) holds only enumerable own data properties and is not a
 * Proxy (see above), so that the `validate()` fast path's reads have no side
 * effects and see every property the visitor would. The handles
 * `TYPED_SKIP` names are checked but not walked into.
 * @param {object} root the resource
 * @return {boolean} whether the fast path may read it
 */
function isPlainDataGraph(root: object): boolean {
    const seen = new Set<object>();
    const pending: object[] = [root];
    while (pending.length > 0) {
        const obj = pending.pop() as object;
        if (seen.has(obj)) {
            continue;
        }
        seen.add(obj);
        if (mayBeProxy(obj)) {
            return false;
        }
        const typed = isTypedLike(obj);
        const isArray = Array.isArray(obj);
        // One descriptor at a time: `Object.getOwnPropertyDescriptors`
        // (every one at once) is several times slower here.
        for (const key of Object.getOwnPropertyNames(obj)) {
            const d = Object.getOwnPropertyDescriptor(obj, key) as PropertyDescriptor;
            if (!('value' in d)) {
                return false;
            }
            if (!d.enumerable && !(isArray && key === 'length')) {
                return false;
            }
            if (typed && TYPED_SKIP.has(key)) {
                continue;
            }
            const value = d.value;
            if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
                pending.push(value);
            }
        }
        if (obj instanceof Map) {
            for (const [k, x] of obj) {
                if (k !== null && (typeof k === 'object' || typeof k === 'function')) {
                    pending.push(k);
                }
                if (x !== null && (typeof x === 'object' || typeof x === 'function')) {
                    pending.push(x);
                }
            }
        }
    }
    return true;
}

let modelClassesCache: any;

/**
 * The public model classes `materializeTyped` constructs, required once on
 * first use and cached (P5-06: it runs once per decoded instance).
 * Required late, not at module load: this file loads in ts mode too
 * (transitively, were it ever imported there), and these are the public
 * model classes, not engine-only code.
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
 * A `"typed"` wire node (module doc) materialised into a real
 * Resource/ValidatedResource/Relationship, using the real TS classes so
 * that every getter and later mutation (`setPropertyValue`, `toJSON`, ...)
 * behaves exactly as the visitor path's result would.
 * @param {object} node the wire node
 * @param {BaseModelManager} modelManager the model manager to resolve its class in
 * @return {object} the materialised instance
 */
function materializeTyped(node, modelManager: BaseModelManager) {
    const { Resource, ValidatedResource, Relationship, ResourceValidator } = modelClasses();

    const classDeclaration = modelManager.getType(node.fqn);
    const fields = node.fields || {};
    const ns = fields.$namespace;
    const type = fields.$type;
    const identifierFieldName = fields.$identifierFieldName;
    const id = decodeValue(fields.$identifier, modelManager);
    const timestamp = decodeValue(fields.$timestamp, modelManager);

    let resource;
    if (node.ctor === 'ValidatedResource') {
        const validator = new ResourceValidator({});
        resource = new ValidatedResource(modelManager, classDeclaration, ns, type, id, timestamp, validator);
    } else if (node.ctor === 'Relationship') {
        resource = new Relationship(modelManager, classDeclaration, ns, type, id, timestamp);
    } else {
        resource = new Resource(modelManager, classDeclaration, ns, type, id, timestamp);
    }

    const skip = new Set(['$namespace', '$type', '$identifierFieldName', '$identifier', '$timestamp', '$class', identifierFieldName]);
    for (const key of Object.keys(fields)) {
        if (skip.has(key)) {
            continue;
        }
        setOwn(resource, key, decodeValue(fields[key], modelManager));
    }
    return resource;
}

/**
 * A resource built from `serializerFromJsonLean`'s reply (concerto-wasm):
 * what `materializeTyped` builds from the same resource's `"typed"` wire
 * value, in the same steps and the same order, but with each field that the
 * reply names by index taken from `values` (an array is copied, as the
 * populator builds a new one) rather than decoded.
 * @param {Array} reply the parsed reply
 * @param {Array} values the input object's own property values, in `Object.keys` order
 * @param {BaseModelManager} modelManager the model manager to resolve its class in
 * @return {object} the materialised instance
 */
function materializeLean(reply, values: unknown[], modelManager: BaseModelManager) {
    const { Resource, ValidatedResource, Relationship, ResourceValidator } = modelClasses();

    const classDeclaration = modelManager.getType(reply[1]);
    const ns = decodeValue(reply[2], modelManager);
    const type = decodeValue(reply[3], modelManager);
    const id = decodeValue(reply[4], modelManager);
    const timestamp = decodeValue(reply[5], modelManager);

    let resource;
    if (reply[0] === 'ValidatedResource') {
        const validator = new ResourceValidator({});
        resource = new ValidatedResource(modelManager, classDeclaration, ns, type, id, timestamp, validator);
    } else if (reply[0] === 'Relationship') {
        resource = new Relationship(modelManager, classDeclaration, ns, type, id, timestamp);
    } else {
        resource = new Resource(modelManager, classDeclaration, ns, type, id, timestamp);
    }

    for (let i = 6; i < reply.length; i += 2) {
        const key = reply[i];
        const item = reply[i + 1];
        let value;
        if (typeof item === 'number') {
            value = values[item];
            if (Array.isArray(value)) {
                value = value.slice();
            }
        } else {
            value = decodeValue(item[0], modelManager);
        }
        // A plain assignment is `setOwn` here (the constructors leave only
        // writable data properties, and no class in the chain has an
        // accessor), except for `__proto__`.
        if (key === '__proto__') {
            setOwn(resource, key, value);
        } else {
            resource[key] = value;
        }
    }
    return resource;
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

export {
    EngineFastPathUnsupported, encodeValue, decodeValue, checkString, checkJsonText,
    encodePlainObjectText, encodeTypedText, encodeValidatorText, materializeLean, modelClasses,
    isPlainDataGraph,
};
