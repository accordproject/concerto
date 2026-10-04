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

// The engine helpers the public modules share with src/engine/, in a module
// with no imports, so a public module reaches them without loading the
// engine (engineloader.ts loads engine modules only through its non-literal
// `require`). Nothing here is exported from index.ts, and every export is
// `@internal`.

/**
 * The brand of a fast-path fallback signal: a registered symbol, set to
 * `true` on `EngineFastPathUnsupported` (engine/serializer-codec.ts) and on
 * an engine error whose payload says the wire codec could not carry the
 * value (`fastPathUnsupported`; engine/errors.ts). A registered symbol
 * rather than a class test, which a minifier or a second copy of the module
 * would break.
 * @internal
 */
export const FAST_PATH_UNSUPPORTED: unique symbol = Symbol.for('@accordproject/concerto-core:EngineFastPathUnsupported') as any;

/**
 * Whether `err` tells a fast path's caller to run its TS path instead: an
 * `EngineFastPathUnsupported`, or an engine error flagged the same way. The
 * test for an error the engine may have thrown, so the decision never
 * depends on an error's message text (error parity lets messages change);
 * a caller that catches only its own internal throw may test
 * `instanceof EngineFastPathUnsupported` instead.
 * @param {*} err the error caught
 * @return {boolean} true to fall back
 * @internal
 */
export function isFastPathUnsupported(err: unknown): boolean {
    return err !== null && typeof err === 'object' && (err as any)[FAST_PATH_UNSUPPORTED] === true;
}

/**
 * `v` when it is a string, else `undefined`: how a `ModelFile`'s
 * `definitions` or `fileName` crosses to the engine's `Option<String>`
 * parameters. The `ModelFile` constructor rejects only a *truthy*
 * non-string, so `0`, `false` and `NaN` are stored as they are; only a
 * genuine string is forwarded, anything else is `undefined`, as TS 5.0.0
 * (which makes no engine call) sees it.
 * @param {*} v the value
 * @return {string|undefined} the string, or undefined
 * @internal
 */
export function optionalString(v: unknown): string | undefined {
    return typeof v === 'string' ? v : undefined;
}
