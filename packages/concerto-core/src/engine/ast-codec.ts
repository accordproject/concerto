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
// P5-12b/P5-12c), which the engine reads straight into the typed model
// (`rustHandle.stageModelFileCheckedCompact`/`...WithHeaderCompact`,
// concerto-rust concerto-core `introspect::compact`, which has the layout):
//
//   0 null, 1 false, 2 true, 3 a double (8 bytes LE), 4 an i32 (4 bytes
//   LE), 5 a string (u32 LE byte length, then UTF-8), 6 an array (u32 LE
//   count, then the items), 7 an object (u32 LE count, then a u32 LE key
//   length, the UTF-8 key and the value per entry).
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

/** Thrown (and caught by `encodeAst`) for an AST the text path must take. */
const UNSUPPORTED: unique symbol = Symbol('ast-codec unsupported');

/**
 * How deep the AST may nest: well below serde_json's text reader's limit
 * (128), so every AST the engine would reject for its depth takes the text
 * path, which rejects it as before.
 */
const MAX_DEPTH = 100;

/** Whether this runtime has `String.prototype.isWellFormed` (ES2024). */
const hasIsWellFormed = typeof (String.prototype as any).isWellFormed === 'function';

// A UTF-16 code unit in D800-DFFF that is not half of a surrogate pair.
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

const encoder = new TextEncoder();
const f64 = new Float64Array(1);
const f64Bytes = new Uint8Array(f64.buffer);

/** The size `buf` starts at, and goes back to when it grew past `KEPT`. */
const INITIAL = 64 * 1024;
const KEPT = 4 * 1024 * 1024;

// Reused across calls; grown on demand. The engine binding copies the
// bytes into WASM memory before it returns.
let buf = new Uint8Array(INITIAL);
let pos = 0;

/**
 * How many times `encodeAst` has run: the bytes it returned are valid
 * while this is unchanged.
 */
let generation = 0;

/**
 * Grows `buf` to hold `n` more bytes.
 * @param {number} n bytes needed
 */
function ensure(n: number): void {
    if (pos + n <= buf.length) {
        return;
    }
    let cap = buf.length * 2;
    while (cap < pos + n) {
        cap *= 2;
    }
    const next = new Uint8Array(cap);
    next.set(buf.subarray(0, pos));
    buf = next;
}

/**
 * @param {number} at offset
 * @param {number} n a u32
 */
function putU32(at: number, n: number): void {
    buf[at] = n & 0xff;
    buf[at + 1] = (n >>> 8) & 0xff;
    buf[at + 2] = (n >>> 16) & 0xff;
    buf[at + 3] = (n >>> 24) & 0xff;
}

/**
 * A length-prefixed UTF-8 string (no tag).
 * @param {string} s the string
 */
function writeRawStr(s: string): void {
    const n = s.length;
    ensure(4 + n * 3);
    const lenAt = pos;
    pos += 4;
    let i = 0;
    for (; i < n; i++) {
        const c = s.charCodeAt(i);
        if (c >= 0x80) {
            break;
        }
        buf[pos++] = c;
    }
    if (i < n) {
        // Not ASCII: `encodeInto` would write a lone surrogate as U+FFFD.
        if (hasIsWellFormed ? !(s as any).isWellFormed() : LONE_SURROGATE.test(s)) {
            throw UNSUPPORTED;
        }
        pos += encoder.encodeInto(s.substring(i), buf.subarray(pos)).written;
    }
    putU32(lenAt, pos - lenAt - 4);
}

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
        ensure(1);
        buf[pos++] = 5;
        writeRawStr(v);
        return;
    }
    if (t === 'number') {
        ensure(9);
        if ((v | 0) === v) {
            // `-0` lands here as `0`, which is how `JSON.stringify` writes it.
            buf[pos++] = 4;
            putU32(pos, v);
            pos += 4;
        } else if (Number.isFinite(v)) {
            buf[pos++] = 3;
            f64[0] = v;
            buf.set(f64Bytes, pos);
            pos += 8;
        } else {
            buf[pos++] = 0;
        }
        return;
    }
    if (t === 'boolean') {
        ensure(1);
        buf[pos++] = v ? 2 : 1;
        return;
    }
    if (v === null) {
        ensure(1);
        buf[pos++] = 0;
        return;
    }
    if (t !== 'object' || depth >= MAX_DEPTH || typeof v.toJSON === 'function') {
        throw UNSUPPORTED;
    }
    if (Array.isArray(v)) {
        const n = v.length;
        ensure(5);
        buf[pos++] = 6;
        putU32(pos, n);
        pos += 4;
        for (let i = 0; i < n; i++) {
            const item = v[i];
            if (omitted(item)) {
                ensure(1);
                buf[pos++] = 0;
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
    ensure(5);
    buf[pos++] = 7;
    const countAt = pos;
    pos += 4;
    let count = 0;
    for (const key of Object.keys(v)) {
        const item = v[key];
        if (omitted(item)) {
            continue;
        }
        writeRawStr(key);
        writeValue(item, depth + 1);
        count++;
    }
    putU32(countAt, count);
}

/**
 * The AST in the compact binary layout (module doc): a view of a reused
 * buffer, valid until the next call. Undefined for an AST the caller must
 * send as JSON text instead.
 * @param {object} ast the model's AST
 * @return {Uint8Array | undefined} its bytes
 * @throws {*} whatever reading the AST throws (a getter's error)
 */
function encodeAst(ast: object): Uint8Array | undefined {
    generation++;
    pos = 0;
    let out: Uint8Array | undefined;
    try {
        writeValue(ast, 0);
        out = buf.subarray(0, pos);
    } catch (e) {
        if (e !== UNSUPPORTED) {
            throw e;
        }
    } finally {
        if (buf.length > KEPT) {
            buf = new Uint8Array(INITIAL);
        }
    }
    return out;
}

/**
 * The number of `encodeAst` calls so far: the bytes one returned are
 * valid while this is unchanged.
 * @return {number} the generation
 */
function encodeAstGeneration(): number {
    return generation;
}

export { encodeAst, encodeAstGeneration };
