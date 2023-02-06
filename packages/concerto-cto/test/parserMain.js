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

const fs = require('fs');
const chai = require('chai');
const sinon = require('sinon');

// eslint-disable-next-line no-unused-vars
const should = chai.should();
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));

const parser = require('../lib/parser');
const Parser = require('..').Parser;
const ParseException = require('..').ParseException;

/**
 * Get the name and content of all cto files
 * @returns {*} an array of name/content tuples
 */
function getCTOFiles() {
    const result = [];
    const files = fs.readdirSync('./test/cto');

    files.forEach(function(file) {
        if(file.endsWith('records.cto')) {
            const astFile = file.split('.').slice(0, -1).join('.') + '.json';
            const content = fs.readFileSync('./test/cto/' + file, 'utf8');
            const ast = fs.readFileSync('./test/cto/' + astFile, 'utf8');
            result.push({file, content, ast});
        }
    });

    return result;
}

describe('parser', () => {
    getCTOFiles().forEach(({ file, content, ast }) => {
        it(`Should parse ${file}`, () => {
            const mm = Parser.parse(content, undefined, { skipLocationNodes: true });
            mm.should.deep.equal(JSON.parse(ast));
        });
    });

    it('Should parse multiple files', () => {
        const mm = Parser.parseModels(getCTOFiles().map(({ content }) => content), { skipLocationNodes: true });
        mm.should.deep.equal(
            {
                $class: 'concerto.metamodel@1.0.0.Models',
                models: getCTOFiles().map(({ ast }) => JSON.parse(ast)),
            }
        );
    });

    describe('identifiers', () => {

        const acceptedIdentifiers = [
            // Leading Characters
            'a',        // Letter, lowercase
            'ՠ',        // Letter, lowercase. Unicode 11.0
            'A',        // Letter, uppercase
            'ĦĔĽĻŎ',    // Letter, uppercase
            'ǅ',        // Letter, titlecase
            'ᾩ',        // Letter, titlecase
            '〱〱〱〱',  // Letter, modifier
            'जावास्क्रिप्ट',  // Letter, other
            'Ⅶ',      // Number, letter
            '$class',   // leading $
            '_class',   // leading _
            '\u03C9',   // Escaped Unicode Code Point, ᾧ

            // Other
            'abc',      // Letter, lowercase
            'a123',     // Number, digit
            'foo$bar',  // $ separator
            'foo_bar',  // _ separator
            'αβγδεζηθ', // Letter, lowercase
            'foo\u03C9bar', // Escaped Unicode Code Point, fooᾧbar
            'foo\u03c9bar', // Escaped Unicode Code Point lowercase, fooᾧbar
            'foo‿bar',  // Punctuation, connector
            'पः',        // Mark, combining character
            'CharlesⅢ', // Number, letter
            'true',     // reserved words
            'false',
            'null',
            'while',
            'for',
            'nully',    // leading reserved word
            'foo‌bar',   // unescaped zero-width non-joiner
            'foo‍bar',   // unescaped zero-width joiner
        ];
        acceptedIdentifiers.forEach(id => {

            it(`Should parse identifier '${id}'`, () => {
                const content = `namespace ${id}
            concept ${id} {
                o String ${id}
            }`;
                const mm = Parser.parse(content);
                mm.namespace.should.equal(id);
                mm.declarations[0].name.should.equal(id);
                mm.declarations[0].properties[0].name.should.equal(id);
            });
        });

        const rejectedNamespaceIdentifiers = [
            '',
            '123',
            '1st',
            'foo bar',
            'foo\u0020bar', // Escaped Unicode, space
            'foo\x3Dbar',   // Escaped Hex Sequence, foo=bar
            'foo\x3Dbar',   // Escaped Hex Sequence, foo=bar
            '‍foo', // leading unescaped zero-width joiner
            'foo-bar',
            'foo‐bar', // U+2010 HYPHEN'
            'foo−bar', // U+2212 MINUS
            'foo|bar',
            'foo@bar',
            'foo#bar',
            'foo/bar',
            'foo>bar',
            '\x3D',     // Escaped Hex Sequence, =
            '😄',       // Surrogate pair, Emoji
            '\u{1F604}',  // Escaped surrogate pair, Emoji
            '𐴓𐴠𐴑𐴤𐴝', // Surrogate pairs, Hanifi Rohingya RTL
        ];
        const rejectedIdentifiers = [
            ...rejectedNamespaceIdentifiers,
            'foo.bar',
        ];
        rejectedNamespaceIdentifiers.forEach(id => {
            it(`Should not parse identifier '${id}' for namespace`, () => {
                const content = `namespace ${id}`;
                (() => {
                    Parser.parse(content);
                }).should.throw(/Expected .+ but /);
            });
        });
        rejectedIdentifiers.forEach(id => {
            it(`Should not parse identifier '${id}' for concept`, () => {
                const content = `namespace com.test
            concept ${id} {}`;
                (() => {
                    Parser.parse(content);
                }).should.throw(/Expected .+ but /);
            });

            it(`Should not parse identifier '${id}' for property`, () => {
                const content = `namespace com.test
            concept Test {
                o String ${id}
            }`;
                (() => {
                    Parser.parse(content);
                }).should.throw(/Expected .+ but /);
            });
        });
    });
});

describe('parser-exception', () => {
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should handle a normal parsing exception', () => {
        sandbox.stub(parser, 'parse').throws({
            location: {
                start: {
                    line: 99,
                    column: 99
                }
            }
        });
        (() => {
            Parser.parse('fake definitions');
        }).should.throw(ParseException, /Line 99 column 99/);
    });

    it('should handle a normal parsing exception with a file name', () => {
        sandbox.stub(parser, 'parse').throws({
            location: {
                start: {
                    line: 99,
                    column: 99
                }
            }
        });
        (() => {
            Parser.parse('fake definitions', 'mf1.cto');
        }).should.throw(ParseException, /File mf1.cto line 99 column 99/);
    });

    it('should handle any other parsing exception', () => {
        sandbox.stub(parser, 'parse').throws(new Error('fake error'));
        (() => {
            Parser.parse('fake definitions');
        }).should.throw(/fake error/);
        let error = new Error('fake error 2');
        error.location = {};
        parser.parse.throws(error);
        (() => {
            Parser.parse('fake definitions');
        }).should.throw(/fake error 2/);
    });
});
