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

// The writer of the compact binary layout the engine reads
// (concerto-core `introspect::compact`):
//
//   0 null, 1 false, 2 true, 3 a double (8 bytes LE), 4 an i32 (4 bytes
//   LE), 5 a string (u32 LE byte length, then UTF-8), 6 an array (u32 LE
//   count, then the items), 7 an object (u32 LE count, then a u32 LE key
//   length, the UTF-8 key and the value per entry).
//
// ast-codec.ts and validate-resource.ts each own a `WireWriter`. Its buffer
// is reused across writes, grows on demand, and shrinks back once a write has
// grown it past `KEPT`; each result is valid until that writer's next write.

import { EngineFastPathUnsupported, hasLoneSurrogate } from './util';

const encoder = new TextEncoder();
const f64 = new Float64Array(1);
const f64Bytes = new Uint8Array(f64.buffer);

/** The largest buffer a writer keeps between writes. */
const KEPT = 4 * 1024 * 1024;

/** The tags of the layout (module doc). */
const NULL = 0;
const FALSE = 1;
const TRUE = 2;
const F64 = 3;
const I32 = 4;
const STR = 5;
const ARRAY = 6;
const OBJECT = 7;

/** A writer of the compact layout (module doc) over a reused buffer. */
class WireWriter {
    /** The buffer; grown on demand. */
    buf: Uint8Array;
    /** Where the next byte goes. */
    pos = 0;
    /** How many writes have begun: a result is valid while this is unchanged. */
    count = 0;
    /** The size the buffer starts at, and goes back to (`release`). */
    private readonly initial: number;

    /**
     */
    constructor(initial: number) {
        this.initial = initial;
        this.buf = new Uint8Array(initial);
    }

    /** Starts a new write, over the previous one. */
    begin(): void {
        this.count++;
        this.pos = 0;
    }

    /**
     * What has been written since `begin`: a view of the buffer, valid until
     * the next `begin`.
     */
    bytes(): Uint8Array {
        return this.buf.subarray(0, this.pos);
    }

    /**
     * Ends a write: a buffer grown past `KEPT` goes back to its initial
     * size (a view `bytes` returned keeps the old one alive while needed).
     */
    release(): void {
        if (this.buf.length > KEPT) {
            this.buf = new Uint8Array(this.initial);
        }
    }

    /**
     * Grows the buffer to hold `n` more bytes.
     * @param {number} n bytes needed
     */
    ensure(n: number): void {
        const need = this.pos + n;
        if (need <= this.buf.length) {
            return;
        }
        let cap = this.buf.length * 2;
        while (cap < need) {
            cap *= 2;
        }
        const next = new Uint8Array(cap);
        next.set(this.buf.subarray(0, this.pos));
        this.buf = next;
    }

    /**
     * Writes a u32 at `at` (already reserved).
     * @param {number} at offset
     */
    putU32(at: number, n: number): void {
        const buf = this.buf;
        buf[at] = n & 0xff;
        buf[at + 1] = (n >>> 8) & 0xff;
        buf[at + 2] = (n >>> 16) & 0xff;
        buf[at + 3] = (n >>> 24) & 0xff;
    }

    /**
     * @param {number} tag a tag byte (module doc)
     */
    tag(tag: number): void {
        this.ensure(1);
        this.buf[this.pos++] = tag;
    }

    /** `null`, `false` or `true`. */
    literal(v: boolean | null): void {
        this.tag(v === null ? NULL : v ? TRUE : FALSE);
    }

    /**
     * A length-prefixed UTF-8 string (no tag). A lone surrogate, which
     * `encodeInto` would write as U+FFFD, throws `EngineFastPathUnsupported`.
     */
    rawStr(s: string): void {
        const n = s.length;
        this.ensure(4 + n * 3);
        const buf = this.buf;
        const lenAt = this.pos;
        let pos = lenAt + 4;
        let i = 0;
        for (; i < n; i++) {
            const c = s.charCodeAt(i);
            if (c >= 0x80) {
                break;
            }
            buf[pos++] = c;
        }
        if (i < n) {
            if (hasLoneSurrogate(s)) {
                throw new EngineFastPathUnsupported('lone-surrogate');
            }
            pos += encoder.encodeInto(s.substring(i), buf.subarray(pos)).written;
        }
        this.pos = pos;
        this.putU32(lenAt, pos - lenAt - 4);
    }

    /** A string. */
    str(s: string): void {
        this.tag(STR);
        this.rawStr(s);
    }

    /**
     * A finite number: an `i32` when it is one (`-0` as `0`, which is how
     * both `JSON.stringify` and the validator spell it), else a double.
     */
    num(v: number): void {
        this.ensure(9);
        if ((v | 0) === v) {
            this.buf[this.pos++] = I32;
            this.putU32(this.pos, v);
            this.pos += 4;
            return;
        }
        this.buf[this.pos++] = F64;
        f64[0] = v;
        this.buf.set(f64Bytes, this.pos);
        this.pos += 8;
    }

    /** An array header for `n` items. */
    array(n: number): void {
        this.ensure(5);
        this.buf[this.pos++] = ARRAY;
        this.putU32(this.pos, n);
        this.pos += 4;
    }

    /**
     * An object header, its entry count patched in later (`putU32` at the
     * offset returned).
     * @return {number} where the count goes
     */
    beginObject(): number {
        this.ensure(5);
        this.buf[this.pos++] = OBJECT;
        this.pos += 4;
        return this.pos - 4;
    }

    /**
     * A whole write of `text` as plain UTF-8 bytes (no tag, no length), for
     * bindings that take JSON text as UTF-8, which crosses in one copy: a
     * view of the buffer, valid until the next write. `JSON.stringify`
     * output has no lone surrogate.
     */
    utf8(text: string): Uint8Array {
        this.begin();
        // At most three bytes per UTF-16 code unit.
        this.ensure(text.length * 3);
        this.pos = encoder.encodeInto(text, this.buf).written;
        const out = this.bytes();
        this.release();
        return out;
    }

    /** The head of a one-key object `{key: <value>}`, its value written next. */
    markerHead(key: string): void {
        this.ensure(5);
        this.buf[this.pos++] = OBJECT;
        this.putU32(this.pos, 1);
        this.pos += 4;
        this.rawStr(key);
    }
}

export { WireWriter };
