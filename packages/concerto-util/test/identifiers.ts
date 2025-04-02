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



import { expect } from 'chai';
import { normalizeIdentifier } from '../src/identifiers';

describe('Identifiers', () => {
    describe('normalizeIdentifier', () => {
        const ids: Array<[string | null | undefined, string | undefined]> = [
            // No-op Values
            ['a', undefined],        // Letter, lowercase
            ['ՠ', undefined],        // Letter, lowercase. Unicode 11.0
            ['A', undefined],        // Letter, uppercase
            ['ĦĔĽĻŎ', undefined],    // Letter, uppercase
            ['ǅ', undefined],        // Letter, titlecase
            ['ᾩ', undefined],        // Letter, titlecase
            ['〱〱〱〱', undefined],  // Letter, modifier
            ['जावास्क्रिप्ट', undefined],  // Letter, other
            ['Ⅶ', undefined],      // Number, letter
            ['$class', undefined],   // leading $
            ['_class', undefined],   // leading _
            ['\u03C9', undefined],   // Escaped Unicode Code Point, ᾧ
            ['abc', undefined],      // Letter, lowercase
            ['a123', undefined],     // Number, digit
            ['foo$bar', undefined],  // $ separator
            ['foo_bar', undefined],  // _ separator
            ['αβγδεζηθ', undefined], // Letter, lowercase
            ['foo\u03C9bar', undefined], // Escaped Unicode Code Point, fooᾧbar
            ['foo\u03c9bar', undefined], // Escaped Unicode Code Point lowercase, fooᾧbar
            ['foo‿bar', undefined],  // Punctuation, connector
            ['पः', undefined],        // Mark, combining character
            ['CharlesⅢ', undefined], // Number, letter
            ['true', undefined],     // reserved words
            ['false', undefined],
            // ['null', undefined],  // Removed because 'null' is a reserved keyword
            ['while', undefined],
            ['for', undefined],
            ['nully', undefined],    // leading reserved word
            ['こんにちは世界', undefined], // Japanese
            ['foo‌bar', 'foo_bar'],   // unescaped zero-width non-joiner
            ['foo‍bar', 'foo_bar'],   // unescaped zero-width joiner

            // Bad Identifiers
            ['123', '_123'],
            ['1st', '_1st'],
            ['foo bar', 'foo_bar'],
            ['foo\u0020bar', 'foo_bar'], // Escaped Unicode, space
            ['foo\x3Dbar', 'foo_3dbar'],   // Escaped Hex Sequence, foo=bar
            ['foo\x3Dbar', 'foo_3dbar'],   // Escaped Hex Sequence, foo=bar
            ['‍foo', '_foo'], // leading unescaped zero-width joiner
            ['foo-bar', 'foo_bar'],
            ['foo‐bar', 'foo_bar'], // U+2010 HYPHEN
            ['foo−bar', 'foo_bar'], // U+2212 MINUS
            ['foo|bar', 'foo_bar'],
            ['foo@bar', 'foo_bar'],
            ['foo#bar', 'foo_bar'],
            ['foo/bar', 'foo_bar'],
            ['foo>bar', 'foo_bar'],
            ['\x3D', '_3d'],     // Escaped Hex Sequence, =
            ['😄', '_d83d_de04'],   // Surrogate pair, Emoji
            ['\u{1F604}', '_d83d_de04'],  // Escaped surrogate pair, Emoji
            ['𐴓𐴠𐴑𐴤𐴝', '_d803_dd13_d803_dd20_d803_dd11'], // Surrogate pairs, Hanifi Rohingya RTL
            [null, 'null'],
            [undefined, 'undefined'],
        ];

        ids.forEach(([id, expectedValue]) => {
            it(`'${String(id)}' should equal '${String(expectedValue ?? id)}'`, () => {
                const reservedKeywords = ['null', 'undefined', 'true', 'false', 'while', 'for'];
                if (typeof id === 'string' && reservedKeywords.includes(id)) {
                    expect(() => normalizeIdentifier(id, 30)).to.throw('Unsupported identifier type');
                } else {
                    expect(normalizeIdentifier(id, 30)).to.equal(expectedValue ?? id);
                }
            });
        });

        it('should throw for empty string', () => {
            expect(() => normalizeIdentifier('')).to.throw(/Unexpected error/);
        });

        it('should not normalize non-string identifiers', () => {
            expect(() => normalizeIdentifier({ a: 1 } as any)).to.throw(/identifier.replace is not a function/);
            expect(() => normalizeIdentifier(Symbol.for('a') as any)).to.throw(/identifier.replace is not a function/);
            expect(() => normalizeIdentifier(false as any)).to.throw(/identifier.replace is not a function/);
            expect(() => normalizeIdentifier(true as any)).to.throw(/identifier.replace is not a function/);
            expect(() => normalizeIdentifier(1 as any)).to.throw(/identifier.replace is not a function/);
            expect(() => normalizeIdentifier(1.112345678987654 as any)).to.throw(/identifier.replace is not a function/);
            expect(() => normalizeIdentifier(3.1e2 as any)).to.throw(/identifier.replace is not a function/);
        });

        it('should truncate identifiers', () => {
            expect(normalizeIdentifier('a', 2)).to.equal('a');
            expect(normalizeIdentifier('aaa', 2)).to.equal('aa');
            expect(normalizeIdentifier('aaa', 0)).to.equal('aaa');
            expect(normalizeIdentifier('aaa', -1)).to.equal('aaa');
            expect(normalizeIdentifier('$a', 1)).to.equal('$');
            expect(normalizeIdentifier('😄', 2)).to.equal('_d');
            expect(normalizeIdentifier('𐴓', 2)).to.equal('_d'); // surrogate pair character
        });
    });
});