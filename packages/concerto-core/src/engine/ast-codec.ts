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

// A model's AST for the engine without `JSON.stringify`: `encodeAst` writes
// it in the compact binary layout (wire.ts), which the engine reads straight
// into the typed model (`stageModelFileBytes`). The bytes describe exactly
// `JSON.parse(JSON.stringify(ast))`, so the verdict and errors are the text
// path's. `encodeAst` returns undefined, and the caller sends JSON text, for
// anything else `JSON.stringify` treats specially: a `toJSON` method, a
// prototype other than `Object.prototype` or `null`, a BigInt, a lone
// surrogate, or nesting deeper than `MAX_DEPTH` (a cycle lands here). A
// throwing getter's error is thrown.

import { EngineFastPathUnsupported } from './util';
import { WireWriter } from './wire';

/** Thrown (and caught by `encodeAst`) for an AST the text path must take. */
const UNSUPPORTED: unique symbol = Symbol('ast-codec unsupported');

/**
 * How deep the AST may nest: below serde_json's limit (128), so an AST the
 * engine would reject for its depth takes the text path.
 */
const MAX_DEPTH = 100;

const hasOwn = Object.prototype.hasOwnProperty;

/** The writer `encodeAst` reuses; the binding copies the bytes before it returns. */
const writer = new WireWriter(64 * 1024);

/** Whether `JSON.stringify` omits a property with this value (`null` as an array item). */
function omitted(v: unknown): boolean {
    const t = typeof v;
    return t === 'undefined' || t === 'function' || t === 'symbol';
}

/** One value, as `JSON.stringify` writes it; never an `omitted` one. */
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
    // Visits exactly `Object.keys(v)`, without a keys array per object.
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
 * The AST in the compact layout, valid until the next call; undefined when
 * the caller must send JSON text.
 * @throws {*} whatever reading the AST throws (a getter's error)
 */
function encodeAst(ast: object): Uint8Array | undefined {
    // A getter read mid-write may encode another AST: that one is sent as
    // text instead.
    if (!writer.begin()) {
        return undefined;
    }
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

/** The number of `encodeAst` calls: a result is valid while this is unchanged. */
function encodeAstCount(): number {
    return writer.count;
}

export { encodeAst, encodeAstCount };
