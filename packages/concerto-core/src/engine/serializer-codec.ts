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
// listed above, a function, a symbol); the fast path catches it and falls
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
function encodeTyped(v) {
    const ctorName = v.constructor && v.constructor.name;
    if (ctorName !== 'Resource' && ctorName !== 'ValidatedResource' && ctorName !== 'Relationship') {
        throw new EngineFastPathUnsupported(`typed-class:${ctorName}`);
    }
    const fields = {};
    for (const key of Object.keys(v)) {
        if (TYPED_SKIP.has(key)) {
            continue;
        }
        fields[key] = encodeValue(v[key]);
    }
    return { [TAG]: 'typed', ctor: ctorName, fqn: v.getFullyQualifiedType(), fields };
}

/**
 * A JS runtime value as the wire value the engine reads (module doc).
 * @param {*} v the value
 * @return {*} its wire encoding
 */
function encodeValue(v) {
    if (v === undefined) {
        return { [TAG]: 'undefined' };
    }
    if (v === null || typeof v === 'boolean' || typeof v === 'string') {
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
        return v.map(encodeValue);
    }
    if (v instanceof Map) {
        return { [TAG]: 'map', entries: [...v.entries()].map(([k, x]) => [encodeValue(k), encodeValue(x)]) };
    }
    if (isDayjsLike(v)) {
        const valid = v.isValid();
        return valid
            ? { [TAG]: 'dayjs', valid: true, ms: v.valueOf(), utcOffset: v.utcOffset() }
            : { [TAG]: 'dayjs', valid: false };
    }
    if (isTypedLike(v)) {
        return encodeTyped(v);
    }
    if (typeof v === 'function' || typeof v === 'symbol') {
        throw new EngineFastPathUnsupported(`unsupported-value:${typeof v}`);
    }
    if (typeof v === 'object') {
        const proto = Object.getPrototypeOf(v);
        if (proto !== Object.prototype && proto !== null) {
            throw new EngineFastPathUnsupported(`instance:${(v.constructor && v.constructor.name) || 'Object'}`);
        }
        const out = {};
        for (const key of Object.keys(v)) {
            out[key] = encodeValue(v[key]);
        }
        return out;
    }
    throw new EngineFastPathUnsupported(`unsupported-value:${typeof v}`);
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
    // Required late, not at module load: this file loads in ts mode too
    // (transitively, were it ever imported there), and these are the
    // public model classes, not engine-only code.
    // eslint-disable-next-line global-require
    const Resource = require('../model/resource').default;
    // eslint-disable-next-line global-require
    const ValidatedResource = require('../model/validatedresource').default;
    // eslint-disable-next-line global-require
    const Relationship = require('../model/relationship').default;
    // eslint-disable-next-line global-require
    const ResourceValidator = require('../serializer/resourcevalidator').default;

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
        resource[key] = decodeValue(fields[key], modelManager);
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
            out[key] = decodeValue(v[key], modelManager);
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

export { EngineFastPathUnsupported, encodeValue, decodeValue };
