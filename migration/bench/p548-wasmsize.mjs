#!/usr/bin/env node
// P5-48 (accordproject/concerto-rust#369): WASM size before and after, and
// the P5-39 (#349) breakdown of where the code bytes go.
//
//   node migration/bench/p548-wasmsize.mjs <shipped.wasm> [<named.wasm>]
//
// <shipped.wasm> is the build.sh output (opt-level 3, wasm-opt -O3, names
// stripped): raw, gzip -9 and brotli q11 sizes. <named.wasm> is the same
// engine built with strip=false and wasm-opt -O3 -g (as for the P5-48 WASM
// profile), whose name section lets code bytes be charged to functions.
// Buckets follow P5-39: serde deserialisation monomorphisations,
// concerto_core, regress, concerto_wasm, concerto_core_js, Debug/Display,
// drop glue, other. A function goes to the first bucket that matches. Prints
// JSON. Measure only.
import { readFileSync } from 'node:fs';
import zlib from 'node:zlib';

function sizes(buf) {
    return {
        raw: buf.length,
        gzip: zlib.gzipSync(buf, { level: 9 }).length,
        brotli: zlib.brotliCompressSync(buf, {
            params: {
                [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
                [zlib.constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
            },
        }).length,
    };
}

function leb(buf, pos) {
    let result = 0, shift = 0, byte;
    do {
        byte = buf[pos++];
        result += (byte & 0x7f) * 2 ** shift;
        shift += 7;
    } while (byte & 0x80);
    return [result, pos];
}

function sections(buf) {
    const out = [];
    let pos = 8;
    while (pos < buf.length) {
        const id = buf[pos++];
        let size;
        [size, pos] = leb(buf, pos);
        out.push({ id, start: pos, end: pos + size });
        pos += size;
    }
    return out;
}

function breakdown(buf) {
    const secs = sections(buf);
    // Imported functions come first in the function index space.
    let imported = 0;
    const imp = secs.find(s => s.id === 2);
    if (imp) {
        let pos = imp.start, n;
        [n, pos] = leb(buf, pos);
        for (let i = 0; i < n; i++) {
            let len;
            [len, pos] = leb(buf, pos); pos += len;
            [len, pos] = leb(buf, pos); pos += len;
            const kind = buf[pos++];
            if (kind === 0) { [, pos] = leb(buf, pos); imported++; }
            else if (kind === 1) { pos++; let f; [f, pos] = leb(buf, pos); [, pos] = leb(buf, pos); if (f & 1) [, pos] = leb(buf, pos); }
            else if (kind === 2) { let f; [f, pos] = leb(buf, pos); [, pos] = leb(buf, pos); if (f & 1) [, pos] = leb(buf, pos); }
            else if (kind === 3) { pos += 2; }
            else { throw new Error(`import kind ${kind}`); }
        }
    }
    const names = new Map();
    for (const s of secs.filter(s => s.id === 0)) {
        let pos = s.start, len;
        [len, pos] = leb(buf, pos);
        if (buf.toString('utf8', pos, pos + len) !== 'name') continue;
        pos += len;
        while (pos < s.end) {
            const sub = buf[pos++];
            let size;
            [size, pos] = leb(buf, pos);
            if (sub === 1) {
                let p = pos, n;
                [n, p] = leb(buf, p);
                for (let i = 0; i < n; i++) {
                    let idx, l;
                    [idx, p] = leb(buf, p);
                    [l, p] = leb(buf, p);
                    names.set(idx, buf.toString('utf8', p, p + l));
                    p += l;
                }
            }
            pos += size;
        }
    }
    const code = secs.find(s => s.id === 10);
    const data = secs.find(s => s.id === 11);
    const buckets = {};
    const rules = [
        ['serde deserialisation', n => /serde/.test(n) && /(de::|Deserializ|Visitor|MapAccess|SeqAccess|deserialize|visit_)/.test(n)],
        ['concerto_core', n => /concerto_core(?!_js)/.test(n)],
        ['regress', n => /regress/.test(n)],
        ['concerto_wasm', n => /concerto_wasm/.test(n)],
        ['concerto_core_js', n => /concerto_core_js/.test(n)],
        ['Debug/Display', n => /(core::fmt::(Debug|Display)|as core::fmt::)/.test(n)],
        ['drop glue', n => /drop_in_place/.test(n)],
    ];
    let pos = code.start, n;
    [n, pos] = leb(buf, pos);
    for (let i = 0; i < n; i++) {
        const before = pos;
        let size;
        [size, pos] = leb(buf, pos);
        pos += size;
        const name = names.get(imported + i) || '';
        const rule = rules.find(([, test]) => test(name));
        const key = rule ? rule[0] : 'other';
        buckets[key] = (buckets[key] || 0) + (pos - before);
    }
    const codeBytes = code.end - code.start;
    return {
        codeBytes,
        dataBytes: data ? data.end - data.start : 0,
        functions: n,
        named: names.size,
        buckets: Object.fromEntries(Object.entries(buckets)
            .sort((a, b) => b[1] - a[1])
            .map(([k, v]) => [k, { bytes: v, share: +(100 * v / codeBytes).toFixed(1) }])),
    };
}

const [shipped, named] = process.argv.slice(2);
if (!shipped) {
    console.error('usage: p548-wasmsize.mjs <shipped.wasm> [<named.wasm>]');
    process.exit(2);
}
const out = { shipped: { path: shipped, ...sizes(readFileSync(shipped)) } };
if (named) out.named = { path: named, ...breakdown(readFileSync(named)) };
console.log(JSON.stringify(out, null, 2));
