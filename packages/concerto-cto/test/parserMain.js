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

const parser = require('../src/parser');
const Parser = require('../src').Parser;
const ParseException = require('../src').ParseException;

/**
 * Get the name and content of all cto files
 * @returns {*} an array of name/content tuples
 */
function getCTOFiles() {
    const result = [];
    const files = fs.readdirSync('./test/cto');

    files.forEach(function(file) {
        if(file.endsWith('.cto')) {
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

    describe('maps', () => {
        it('Should not parse bad map type', () => {
            let content = fs.readFileSync('./test/cto/bad/map.bad.cto', 'utf8');
            (() => {
                Parser.parse(content);
            }).should.throw(/Expected .+ but /);
        });

        it('Should not parse a map with identifiers', () => {
            let content = fs.readFileSync('./test/cto/bad/map.bad.identifiers.cto', 'utf8');
            (() => {
                Parser.parse(content);
            }).should.throw(/Expected .+ but /);
        });
    });

    describe('collection size validators', () => {
        const model = (property) => `namespace org.example@1.0.0
            concept Item {}
            participant Person identified by id { o String id }
            map PhoneBook { o String o String }
            concept Test { ${property} }`;

        it('Should parse validators for arrays and maps', () => {
            const properties = [
                'o String[] value size=[0,2]',
                'o Integer[] value size=[1,]',
                'o Long[] value size=[,2]',
                'o Double[] value size=[1,2]',
                'o Boolean[] value size=[1,]',
                'o DateTime [] value size=[,2]',
                'o Item[] value size=[1,2] optional',
                '--> Person[] value size=[1,2]',
                'o PhoneBook value size=[1,3]',
            ];
            properties.forEach(property => {
                const validator = Parser.parse(model(property), undefined, { skipLocationNodes: true })
                    .declarations[3].properties[0].sizeValidator;
                validator.$class.should.equal('concerto.metamodel@1.0.0.CollectionSizeValidator');
            });
        });

        [
            'o String[] value size=[,]',
            'o String[] value minElements=1',
            'o String[] value size=[1,2] size=[1,2]',
        ].forEach(property => {
            it(`Should reject invalid collection validator syntax: ${property}`, () => {
                (() => Parser.parse(model(property))).should.throw();
            });
        });
    });

    describe('alias-imports',()=>{
        it('Should not parse bad import alias: No parenthesis',()=>{
            const content = fs.readFileSync('./test/cto/bad/aliasImport.bad.single.cto','utf-8');
            (()=>{
                Parser.parse(content);
            }).should.throw(/Expected .+ but/);
        });
        it('Should not parse bad import alias: alias missing',()=>{
            const content = fs.readFileSync('./test/cto/bad/aliasImport.bad.alias-missing.cto','utf-8');
            (()=>{
                Parser.parse(content);
            }).should.throw(/Expected .+ but/);
        });
        it('Should throw when type is alias to a pimitive type',()=>{
            const model=`
            namespace org.saluja
            
            import org.ece.{doc as String}
            `;
            (() => {
                Parser.parse(model);
            }).should.throw(/cannot be aliased to a Primitive type/);
        });
    });

    describe('self-extending', () => {
        const declarationTypes = [
            'asset',
            'participant',
            'transaction',
            'event',
            'concept',
        ];
        declarationTypes.forEach(declarationType => {
            it(`Should not parse a self-extending ${declarationType}`, () => {
                let content = fs.readFileSync(`./test/cto/bad/self-extending-${declarationType}.bad.cto`, 'utf8');
                (() => {
                    Parser.parse(content);
                }).should.throw(new RegExp(`The ${declarationType} ".+" cannot extend itself.`));
            });
        });
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
                const content = `namespace com.test@1.0.0
            concept ${id} {}`;
                (() => {
                    Parser.parse(content);
                }).should.throw(/Expected .+ but /);
            });

            it(`Should not parse identifier '${id}' for property`, () => {
                const content = `namespace com.test@1.0.0
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
