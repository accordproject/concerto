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

// Engine helpers with no imports, so they never load the engine; `@internal`.

/**
 * A fast-path fallback signal's brand: a registered symbol, so module copies agree.
 * @internal
 */
export const FAST_PATH_UNSUPPORTED: unique symbol = Symbol.for('@accordproject/concerto-core:EngineFastPathUnsupported') as any;

/**
 * Whether `err` tells a fast path's caller to run its TS path instead.
 * @param {*} err the error caught
 * @return {boolean} true to fall back
 * @internal
 */
export function isFastPathUnsupported(err: unknown): boolean {
    return err !== null && typeof err === 'object' && (err as any)[FAST_PATH_UNSUPPORTED] === true;
}

/**
 * `v` when it is a string, else `undefined`, for an `Option<String>` parameter.
 * @param {*} v the value
 * @return {string|undefined} the string, or undefined
 * @internal
 */
export function optionalString(v: unknown): string | undefined {
    return typeof v === 'string' ? v : undefined;
}
