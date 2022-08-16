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

const Field = require('../../lib/introspect/field');
const StringValidator = require('../../lib/introspect/stringvalidator');

require('chai').should();
const sinon = require('sinon');
const NumberValidator = require('../../lib/introspect/numbervalidator');

const XRegExp = require('xregexp');

describe('StringValidator', () => {

    let mockField;

    beforeEach(() => {
        mockField = sinon.createStubInstance(Field);
        mockField.getFullyQualifiedName.returns('org.acme.myField');
    });

    describe('#constructor', () => {

        it('should throw for invalid regexes', () => {
            (() => {
                new StringValidator(mockField, { pattern: '^[A-z' });
            }).should.throw(/Validator error for field/);
        });

    });

    describe('#validate', () => {

        it('should ignore a null string', () => {
            let v = new StringValidator(mockField, { pattern: '^[A-z][A-z][0-9]{7}' });
            v.getRegex().toString().should.equal('/^[A-z][A-z][0-9]{7}/');
            v.validate('id', null);
        });

        it('should validate a string', () => {
            let v = new StringValidator(mockField, { pattern: '^[A-z][A-z][0-9]{7}' });
            v.validate('id', 'AB1234567');
        });

        it('should detect mismatch string', () => {
            let v = new StringValidator(mockField, { pattern: '^[A-z][A-z][0-9]{7}' });

            (() => {
                v.validate('id', 'xyz');
            }).should.throw(/Validator error for field `id`. org.acme.myField/);
        });

        it('should validate a string with escaped chacters', () => {
            let v = new StringValidator(mockField, { pattern: '^[\\\\]*\\n$' });
            v.validate('id', '\\\\\n');
        });

        it('should not validate a string with escaped chacters', () => {
            let v = new StringValidator(mockField, { pattern: '^[\\\\]*\\n$' });
            (() => {
                v.validate('id', '\\hi!\n');
            }).should.throw(/Validator error for field `id`. org.acme.myField/);
        });

        it('should validate a unicode string', () => {
            let v = new StringValidator(mockField, { pattern: '^(\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4})(?:\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4}|\\p{Mn}|\\p{Mc}|\\p{Nd}|\\p{Pc}|\\u200C|\\u200D)*$', flags: 'u' });
            v.validate('id', 'AB1234567');
        });

        it('should not validate a unicode string', () => {
            let v = new StringValidator(mockField, { pattern: '^(\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4})(?:\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4}|\\p{Mn}|\\p{Mc}|\\p{Nd}|\\p{Pc}|\\u200C|\\u200D)*$', flags: 'u' });
            (() => {
                v.validate('id', '1FOO');
            }).should.throw(/Validator error for field `id`. org.acme.myField/);
        });

    });

    describe('#validate with custom RegEx engine', () => {
        const options = {
            regExp: XRegExp
        };
        it('should ignore a null string', () => {
            let v = new StringValidator(mockField, { pattern: '^[A-z][A-z][0-9]{7}' }, options);
            v.getRegex().toString().should.equal('/^[A-z][A-z][0-9]{7}/');
            v.validate('id', null);
        });

        it('should validate a string', () => {
            let v = new StringValidator(mockField, { pattern: '^[\\p{Letter}\\p{Number}]{7}', flags: 'u' }, options);
            v.validate('id', 'AB1234567');
        });
    });

    describe('#compatibleWith', () => {
        it('should return false for a number validator', () => {
            const other = new NumberValidator(mockField, { lower: -1, upper: 1 });
            const v = new StringValidator(mockField, { pattern: 'foo' });
            v.compatibleWith(other).should.be.false;
        });
        it('should return true when the patterns are the same', () => {
            const other = new StringValidator(mockField, { pattern: 'foo' });
            const v = new StringValidator(mockField, { pattern: 'foo' });
            v.compatibleWith(other).should.be.true;
        });
        it('should return false when the pattern is changed', () => {
            const other = new StringValidator(mockField, { pattern: 'bar' });
            const v = new StringValidator(mockField, { pattern: 'foo' });
            v.compatibleWith(other).should.be.false;
        });
        it('should return true when the patterns and flags are the same', () => {
            const other = new StringValidator(mockField, { pattern: 'foo', flags: 'i' });
            const v = new StringValidator(mockField, { pattern: 'foo', flags: 'i' });
            v.compatibleWith(other).should.be.true;
        });
        it('should return false when the flags are changed', () => {
            const other = new StringValidator(mockField, { pattern: 'foo', flags: 'i' });
            const v = new StringValidator(mockField, { pattern: 'foo', flags: 'g' });
            v.compatibleWith(other).should.be.false;
        });
    });
});
