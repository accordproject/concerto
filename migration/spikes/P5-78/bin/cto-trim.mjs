#!/usr/bin/env node
// P5-78 spike (accordproject/concerto-rust#420), item 2: what in the
// concerto-cto browser bundle could be trimmed. Estimate only (no grammar
// change): in the minified Parser-only bundle (bin/sizes.mjs entry o1p),
// measure the bytes taken by the expanded Unicode character classes (the
// grammar's Lu/Ll/Lt/Lm/Lo/Nl/Mn/Mc/Nd/Pc/Zs rules, as regex literals) and by
// their copies in Peggy's error-reporting class expectations, then replace
// both with `\p{...}` escapes and empty expectation lists to see the
// compressed size of the remainder.
//
//   node migration/spikes/P5-78/bin/cto-trim.mjs   (after bin/sizes.mjs)
import fs from 'fs';
import path from 'path';
import url from 'url';
import zlib from 'zlib';
const SPIKE = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const b = fs.readFileSync(path.join(SPIKE, 'build', 'sizes', 'o1p', 'bundle.mjs'), 'utf8');
const gz = (s) => zlib.gzipSync(Buffer.from(s), { level: 9 }).length;
const br = (s) => zlib.brotliCompressSync(Buffer.from(s), { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 } }).length;
const size = (s) => ({ raw: Buffer.byteLength(s), gzip: gz(s), brotli: br(s) });
// Regex literals that are one long character class.
const CLASS = /\/\^?\[(?:\\.|[^\]\\\n])*\]\/[a-z]*/g;
const bigClasses = (b.match(CLASS) || []).filter((c) => c.length > 300);
let t1 = b;
for (const c of bigClasses) {
    t1 = t1.split(c).join('/[\\p{L}]/u');
}
// Peggy class expectations: an array of ranges and characters, e.g. [["A","Z"],"_",...].
const EXPECT = /\[(?:\["(?:\\.|[^"\\])+","(?:\\.|[^"\\])+"\]|"(?:\\.|[^"\\])+")(?:,(?:\["(?:\\.|[^"\\])+","(?:\\.|[^"\\])+"\]|"(?:\\.|[^"\\])+"))*\]/g;
const bigExpect = (t1.match(EXPECT) || []).filter((c) => c.length > 300);
let t2 = t1;
for (const c of bigExpect) {
    t2 = t2.split(c).join('[]');
}
const res = {
    tool: 'cto-trim', note: 'estimate on the minified bundle; not a working parser change',
    bundle: size(b),
    bigClassRegexes: { count: bigClasses.length, rawBytes: bigClasses.reduce((a, c) => a + c.length, 0) },
    bigClassExpectations: { count: bigExpect.length, rawBytes: bigExpect.reduce((a, c) => a + c.length, 0) },
    withPropertyEscapes: size(t1),
    withPropertyEscapesAndNoClassExpectations: size(t2),
};
fs.writeFileSync(path.join(SPIKE, 'results', 'cto-trim.json'), JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
