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

// The helpers the engine codecs share (serializer-codec.ts,
// validate-resource.ts, ast-codec.ts and wire.ts), where each kept its own
// copy, and the fast-path fallback signal, defined once.

import { FAST_PATH_UNSUPPORTED, isFastPathUnsupported, optionalString } from '../engineutil';

/** Thrown when a value cannot cross the fast path; the caller falls back to the visitor path. */
class EngineFastPathUnsupported extends Error {
}

// The brand the fast path's callers test for (`isFastPathUnsupported`)
// rather than `constructor.name`, which a minifier renames. A registered
// symbol, so callers need no reference to this module.
Object.defineProperty(EngineFastPathUnsupported.prototype, FAST_PATH_UNSUPPORTED, { value: true });

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

// A UTF-16 code unit in D800-DFFF that is not half of a surrogate pair:
// serde_json rejects its `\udXXX` escape and a Rust string cannot hold it
// (DV-004).
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

/** Whether this runtime has `String.prototype.isWellFormed` (ES2024). */
const hasIsWellFormed = typeof (String.prototype as any).isWellFormed === 'function';

/**
 * Whether `s` holds a lone surrogate, which the engine cannot receive
 * unchanged. `isWellFormed()` (Node 20+) is much cheaper than the regular
 * expression, which stays for older runtimes.
 * @return {boolean} true if it has one
 */
function hasLoneSurrogate(s: string): boolean {
    return hasIsWellFormed ? !(s as any).isWellFormed() : LONE_SURROGATE.test(s);
}

export {
    EngineFastPathUnsupported, isFastPathUnsupported, optionalString,
    isDayjsLike, isTypedLike, hasLoneSurrogate,
};
