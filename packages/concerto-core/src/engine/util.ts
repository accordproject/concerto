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

// Helpers the engine codecs share, and the fast-path fallback signal.

import { FAST_PATH_UNSUPPORTED, isFastPathUnsupported, optionalString } from '../engineutil';

/** Thrown when a value cannot cross the fast path; the caller falls back to the visitor path. */
class EngineFastPathUnsupported extends Error {
}

// The brand callers test (`isFastPathUnsupported`) instead of the
// minifier-renamed `constructor.name`; a registered symbol.
Object.defineProperty(EngineFastPathUnsupported.prototype, FAST_PATH_UNSUPPORTED, { value: true });

/** Whether `v` is a duck-typed dayjs. */
function isDayjsLike(v): boolean {
    return !!v && typeof v === 'object' &&
        typeof v.isValid === 'function' &&
        typeof v.utcOffset === 'function' &&
        typeof v.isBefore === 'function' &&
        typeof v.valueOf === 'function';
}

/** Whether `v` is a duck-typed Resource/ValidatedResource/Relationship. */
function isTypedLike(v): boolean {
    return !!v && typeof v === 'object' &&
        typeof v.getFullyQualifiedType === 'function' &&
        typeof v.$namespace === 'string' &&
        typeof v.$type === 'string';
}

// A lone UTF-16 surrogate, which a Rust string cannot hold (DV-004).
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

const hasIsWellFormed = typeof (String.prototype as any).isWellFormed === 'function';

/** Whether `s` holds a lone surrogate; `isWellFormed()` (Node 20+) is cheaper than the regex. */
function hasLoneSurrogate(s: string): boolean {
    return hasIsWellFormed ? !(s as any).isWellFormed() : LONE_SURROGATE.test(s);
}

export {
    EngineFastPathUnsupported, isFastPathUnsupported, optionalString,
    isDayjsLike, isTypedLike, hasLoneSurrogate,
};
