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
            const mm = Parser.parse(content);
            mm.should.deep.equal(JSON.parse(ast));
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
