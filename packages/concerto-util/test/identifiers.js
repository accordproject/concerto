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

'use strict';

const { normalizeIdentifier } = require('../src/identifiers');

require('chai').should();

describe('Identifiers', function () {

    describe('normalizeIdentifier', function() {
        const ids = [
            // No-op Values
            ['a'],        // Letter, lowercase
            ['ՠ'],        // Letter, lowercase. Unicode 11.0
            ['A'],        // Letter, uppercase
            ['ĦĔĽĻŎ'],    // Letter, uppercase
            ['ǅ'],        // Letter, titlecase
            ['ᾩ'],        // Letter, titlecase
            ['〱〱〱〱'],  // Letter, modifier
            ['जावास्क्रिप्ट'],  // Letter, other
            ['Ⅶ'],      // Number, letter
            ['$class'],   // leading $
            ['_class'],   // leading _
            ['\u03C9'],   // Escaped Unicode Code Point, ᾧ
            ['abc'],      // Letter, lowercase
            ['a123'],     // Number, digit
            ['foo$bar'],  // $ separator
            ['foo_bar'],  // _ separator
            ['αβγδεζηθ'], // Letter, lowercase
            ['foo\u03C9bar'], // Escaped Unicode Code Point, fooᾧbar
            ['foo\u03c9bar'], // Escaped Unicode Code Point lowercase, fooᾧbar
            ['foo‿bar'],  // Punctuation, connector
            ['पः'],        // Mark, combining character
            ['CharlesⅢ'], // Number, letter
            ['true'],     // reserved words
            ['false'],
            ['null'],
            ['while'],
            ['for'],
            ['nully'],    // leading reserved word
            ['こんにちは世界'], // Japanese
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
            ['foo‐bar', 'foo_bar'], // U+2010 HYPHEN'
            ['foo−bar', 'foo_bar'], // U+2212 MINUS
            ['foo|bar', 'foo_bar'],
            ['foo@bar', 'foo_bar'],
            ['foo#bar', 'foo_bar'],
            ['foo/bar', 'foo_bar'],
            ['foo>bar', 'foo_bar'],
            ['\x3D', '_3d'],     // Escaped Hex Sequence, =
            ['😄', '_1f604'],       // Surrogate pair, Emoji
            ['\u{1F604}', '_1f604'],  // Escaped surrogate pair, Emoji
            ['𐴓𐴠𐴑𐴤𐴝', '_d803_dd13_d803_dd20_d803_dd11'], // Surrogate pairs, Hanifi Rohingya RTL
            ['‿foo', '_‿foo'], // leading connector punctuation, undertie
            ['́foo', '_́foo'], // leading combining mark
            ['ःfoo', '_ःfoo'], // leading spacing combining mark
            ['́', '_́'], // combining mark alone
            [null, 'null'],
            [undefined, 'undefined'],
        ];
        ids.forEach(([id, expectedValue]) => {
            it(`'${id}' should equal '${expectedValue ?? id}'`, function() {
                normalizeIdentifier(id, 30).should.equal(expectedValue ?? id);
            });
        });

        it('should throw for empty string', () => {
            (() => normalizeIdentifier('')).should.throw(/Unexpected error/);
        });

        it('should not normalize non string identifiers', () => {
            (() => normalizeIdentifier({ a: 1 })).should.throw(/Unsupported identifier type/);
            (() => normalizeIdentifier(Symbol.for('a'))).should.throw(/Unsupported identifier type/);
            (() => normalizeIdentifier(false)).should.throw(/Unsupported identifier type/);
            (() => normalizeIdentifier(true)).should.throw(/Unsupported identifier type/);
            (() => normalizeIdentifier(1)).should.throw(/Unsupported identifier type/);
            (() => normalizeIdentifier(1.112345678987654)).should.throw(/Unsupported identifier type/);
            (() => normalizeIdentifier(3.1e2)).should.throw(/Unsupported identifier type/);
        });

        it('should truncate identifiers', () => {
            normalizeIdentifier('a', 2).should.equal('a');
            normalizeIdentifier('aaa', 2).should.equal('aa');
            normalizeIdentifier('aaa', 0).should.equal('aaa');
            normalizeIdentifier('aaa', -1).should.equal('aaa');
            normalizeIdentifier('$a', 1).should.equal('$');
            normalizeIdentifier('😄', 2).should.equal('_1');
            normalizeIdentifier('𐴓', 2).should.equal('_d'); // surrogate pair character
        });
    });
});
