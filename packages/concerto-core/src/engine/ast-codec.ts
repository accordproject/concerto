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
// A model's AST for the engine without `JSON.stringify` (P5-92,
// accordproject/concerto-rust#438).
//
// The `ModelFile` constructor used to `JSON.stringify` an AST that already
// exists as a JS object (the CTO parser's output, an `addModel`/
// `addModelFile`/`fromAst` input) for the engine to parse the text again
// before its typed read. `encodeAst` writes the object straight into the
// compact binary layout of the instance fast path (validate-resource.ts,
// P5-12b/P5-12c), through the one writer of that layout (wire.ts, P5-101),
// which the engine reads straight into the typed model
// (`rustHandle.stageModelFileBytes`, concerto-rust concerto-core
// `introspect::compact`, which has the layout).
//
// The bytes describe exactly the document `JSON.parse(JSON.stringify(ast))`
// is, so the engine's verdict, and its error, are the text path's. Where
// `JSON.stringify` would write a value as is, it is written as is; where it
// drops or replaces one, so does `encodeAst` (an `undefined`, function or
// symbol property is left out, such an array item is `null`, and so is a
// number that is not finite). Anything else `JSON.stringify` treats in its
// own way makes `encodeAst` return undefined, and the caller sends the AST's
// JSON text instead, as before:
//
// - an object with a `toJSON` method (a `Date` among them), or whose
//   prototype is neither `Object.prototype` nor `null` (a class instance, a
//   boxed primitive, a `Map`, an object from another realm);
// - a BigInt (`JSON.stringify` throws);
// - a string or key with a lone surrogate (`JSON.stringify` escapes it,
//   and the engine rejects that text);
// - nesting deeper than `MAX_DEPTH` (the engine's JSON reader has a
//   nesting limit; a cycle, which `JSON.stringify` throws on, lands here).
//
// Any other error (a getter that throws) is thrown, as `JSON.stringify`
// would throw it.

import { EngineFastPathUnsupported } from './util';
import { WireWriter } from './wire';

/** Thrown (and caught by `encodeAst`) for an AST the text path must take. */
const UNSUPPORTED: unique symbol = Symbol('ast-codec unsupported');

/**
 * How deep the AST may nest: well below serde_json's text reader's limit
 * (128), so every AST the engine would reject for its depth takes the text
 * path, which rejects it as before.
 */
const MAX_DEPTH = 100;

const hasOwn = Object.prototype.hasOwnProperty;

/**
 * The writer `encodeAst` writes into (wire.ts): its buffer is reused across
 * calls, and the engine binding copies the bytes into WASM memory before it
 * returns. Its `count` is how many times `encodeAst` has run: the bytes it
 * returned are valid while that is unchanged (P5-100, F-3).
 */
const writer = new WireWriter(64 * 1024);

/**
 * Whether `JSON.stringify` leaves a property with this value out (and
 * writes `null` for such an array item).
 * @param {*} v the value
 * @return {boolean} true for `undefined`, a function or a symbol
 */
function omitted(v: unknown): boolean {
    const t = typeof v;
    return t === 'undefined' || t === 'function' || t === 'symbol';
}

/**
 * One value, as `JSON.stringify` writes it (module doc).
 * @param {*} v the value; never one `omitted` is true for
 * @param {number} depth how deep `v` is
 */
function writeValue(v: any, depth: number): void {
    const t = typeof v;
    if (t === 'string') {
        writer.str(v);
        return;
    }
    if (t === 'number') {
        if (Number.isFinite(v)) {
            writer.num(v);
        } else {
            writer.literal(null);
        }
        return;
    }
    if (t === 'boolean') {
        writer.literal(v);
        return;
    }
    if (v === null) {
        writer.literal(null);
        return;
    }
    if (t !== 'object' || depth >= MAX_DEPTH || typeof v.toJSON === 'function') {
        throw UNSUPPORTED;
    }
    if (Array.isArray(v)) {
        const n = v.length;
        writer.array(n);
        for (let i = 0; i < n; i++) {
            const item = v[i];
            if (omitted(item)) {
                writer.literal(null);
            } else {
                writeValue(item, depth + 1);
            }
        }
        return;
    }
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) {
        throw UNSUPPORTED;
    }
    const countAt = writer.beginObject();
    let count = 0;
    // P5-94 (accordproject/concerto-rust#444): `for...in` with an own-key
    // check visits exactly `Object.keys(v)`, in the same order, without
    // allocating a keys array per object (V8 reads a fast object's keys
    // from its map's enum cache), which was about a quarter of the JS
    // allocation of `addModelFile`.
    for (const key in v) {
        if (!hasOwn.call(v, key)) {
            continue;
        }
        const item = v[key];
        if (omitted(item)) {
            continue;
        }
        writer.rawStr(key);
        writeValue(item, depth + 1);
        count++;
    }
    writer.putU32(countAt, count);
}

/**
 * The AST in the compact binary layout (module doc): a view of a reused
 * buffer, valid until the next call. Undefined for an AST the caller must
 * send as JSON text instead (a lone surrogate among them, which the writer
 * reports as `EngineFastPathUnsupported`).
 * @param {object} ast the model's AST
 * @return {Uint8Array | undefined} its bytes
 * @throws {*} whatever reading the AST throws (a getter's error)
 */
function encodeAst(ast: object): Uint8Array | undefined {
    writer.begin();
    let out: Uint8Array | undefined;
    try {
        writeValue(ast, 0);
        out = writer.bytes();
    } catch (e) {
        if (e !== UNSUPPORTED && !(e instanceof EngineFastPathUnsupported)) {
            throw e;
        }
    } finally {
        writer.release();
    }
    return out;
}

/**
 * The number of `encodeAst` calls so far: the bytes one returned are
 * valid while this is unchanged.
 * @return {number} the count
 */
function encodeAstCount(): number {
    return writer.count;
}

export { encodeAst, encodeAstCount };
