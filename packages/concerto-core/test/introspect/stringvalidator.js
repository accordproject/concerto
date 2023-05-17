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

    // valid test parms
    let VALID_MIN_LENGTH_AND_MAX_LENGTH_AST = { minLength : 1, maxLength : 100 };
    let NO_MIN_LENGTH_AST = { minLength : null, maxLength : 10 };
    let NO_MAX_LENGTH_AST = { minLength : 2 , maxLength : null };

    // error parms
    let NO_PARMS_IN_AST = {'minLength' : null, 'maxLength' : null };
    let MIN_LENGTH_IS_HIGHER_THAN_MAX_LENGTH = {'minLength' : 200, 'maxLength' : 100 };
    let NEGETIVE_MIN_LENGTH = { minLength : -2 , maxLength : null };
    let NEGETIVE_MAX_LENGTH = { minLength : null , maxLength : -100 };
    let NEGETIVE_LENGTH = { minLength : -1 , maxLength : -100 };

    beforeEach(() => {
        mockField = sinon.createStubInstance(Field);
        mockField.getFullyQualifiedName.returns('org.acme.myField');
    });

    describe('#constructor', () => {

        it('should throw for invalid regexes', () => {
            (() => {
                new StringValidator(mockField, { pattern: '^[A-z' }, VALID_MIN_LENGTH_AND_MAX_LENGTH_AST);
            }).should.throw(/Validator error for field/);
        });

        it('should throw for invalid string length', () => {
            (() => {
                new StringValidator(mockField, { pattern: '^[A-z]' }, NO_PARMS_IN_AST);
            }).should.throw(/Invalid string length, minLength and-or maxLength must be specified/);
        });

        it('should throw for string min length is bigger than max length', () => {
            (() => {
                new StringValidator(mockField, { pattern: '^[A-z]' }, MIN_LENGTH_IS_HIGHER_THAN_MAX_LENGTH);
            }).should.throw(/minLength must be less than or equal to maxLength/);
        });

        it('should throw for negetive string min length', () => {
            (() => {
                new StringValidator(mockField, null, NEGETIVE_MIN_LENGTH);
            }).should.throw(/minLength and-or maxLength must be positive integers/);
        });

        it('should throw for negetive string max length', () => {
            (() => {
                new StringValidator(mockField, null, NEGETIVE_MAX_LENGTH);
            }).should.throw(/minLength and-or maxLength must be positive integers/);
        });

        it('should throw for negetive string length', () => {
            (() => {
                new StringValidator(mockField, null, NEGETIVE_LENGTH);
            }).should.throw(/minLength and-or maxLength must be positive integers/);
        });
    });

    describe('#validate', () => {

        it('should ignore a null string', () => {
            let v = new StringValidator(mockField, { pattern: '^[A-z][A-z][0-9]{7}' }, VALID_MIN_LENGTH_AND_MAX_LENGTH_AST);
            v.getRegex().toString().should.equal('/^[A-z][A-z][0-9]{7}/');
            v.validate('id', null);
        });

        it('should validate a string', () => {
            let v = new StringValidator(mockField, { pattern: '^[A-z][A-z][0-9]{7}' }, VALID_MIN_LENGTH_AND_MAX_LENGTH_AST);
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

        it('should validate a string', () => {
            let v = new StringValidator(mockField, null, VALID_MIN_LENGTH_AND_MAX_LENGTH_AST);
            v.validate('id', 'AB1234567455455455');
        });

        it('should validate a string, when only minLength specified', () => {
            let v = new StringValidator(mockField, null, NO_MAX_LENGTH_AST);
            v.validate('id', 'AB1234567455455455');
            (() => {
                v.validate('id', 'w');
            }).should.throw(/The string length of w should be at least 2 characters./);
            (() => {
                v.validate('id', '');
            }).should.throw(/Validator error for field `id`. org.acme.myField/);
        });

        it('should validate a string, when only maxLength specified', () => {
            let v = new StringValidator(mockField, null, NO_MIN_LENGTH_AST);
            v.validate('id', 'ABCD123456');
            v.validate('id', '');
            (() => {
                v.validate('id', 'ABCD1234567');
            }).should.throw(/The string length of ABCD1234567 should not exceed 10 characters./);
        });

        it('should string legth should take precedence over regex (if string length specified)', () => {
            let v = new StringValidator(mockField, { pattern: '^[A-z]{1,100}$' }, { minLength : 1, maxLength : 10 });
            (() => {
                v.validate('id', 'AbCdefghijklmksadada');
            }).should.throw(/The string length of AbCdefghijklmksadada should not exceed 10 characters./);
        });

    });

    describe('#validate with custom RegEx engine', () => {
        const options = {
            regExp: XRegExp
        };
        it('should ignore a null string', () => {
            let v = new StringValidator(mockField, { pattern: '^[A-z][A-z][0-9]{7}' }, VALID_MIN_LENGTH_AND_MAX_LENGTH_AST, options);
            v.getRegex().toString().should.equal('/^[A-z][A-z][0-9]{7}/');
            v.validate('id', null);
        });

        it('should validate a string', () => {
            let v = new StringValidator(mockField, { pattern: '^[\\p{Letter}\\p{Number}]{7}', flags: 'u' }, VALID_MIN_LENGTH_AND_MAX_LENGTH_AST, options);
            v.validate('id', 'AB1234567');
        });
    });

    describe('#compatibleWith', () => {
        it('should return false for a number validator', () => {
            const other = new NumberValidator(mockField, { lower: -1, upper: 1 });
            const v = new StringValidator(mockField, { pattern: 'foo' }, VALID_MIN_LENGTH_AND_MAX_LENGTH_AST);
            v.compatibleWith(other).should.be.false;
        });
        it('should return true when the patterns are the same', () => {
            const other = new StringValidator(mockField, { pattern: 'foo' }, null);
            const v = new StringValidator(mockField, { pattern: 'foo' }, null);
            v.compatibleWith(other).should.be.true;
        });
        it('should return false when the pattern is changed', () => {
            const other = new StringValidator(mockField, { pattern: 'bar' }, null);
            const v = new StringValidator(mockField, { pattern: 'foo' }, null);
            v.compatibleWith(other).should.be.false;
        });
        it('should return true when the patterns and flags are the same', () => {
            const other = new StringValidator(mockField, { pattern: 'foo', flags: 'i' }, null);
            const v = new StringValidator(mockField, { pattern: 'foo', flags: 'i' }, null);
            v.compatibleWith(other).should.be.true;
        });
        it('should return false when the flags are changed', () => {
            const other = new StringValidator(mockField, { pattern: 'foo', flags: 'i' }, null);
            const v = new StringValidator(mockField, { pattern: 'foo', flags: 'g' }, null);
            v.compatibleWith(other).should.be.false;
        });
        it('should return true when the string lengths are the same', () => {
            const other = new StringValidator(mockField, null, VALID_MIN_LENGTH_AND_MAX_LENGTH_AST);
            const v = new StringValidator(mockField, null, VALID_MIN_LENGTH_AND_MAX_LENGTH_AST);
            v.compatibleWith(other).should.be.true;
        });
        it('should return false when the string length is changed', () => {
            const other = new StringValidator(mockField, null, VALID_MIN_LENGTH_AND_MAX_LENGTH_AST);
            const v = new StringValidator(mockField, null, NO_MIN_LENGTH_AST);
            v.compatibleWith(other).should.be.false;
        });
        it('should return true when the min lenghts of string are same', () => {
            const other = new StringValidator(mockField, null, NO_MAX_LENGTH_AST);
            const v = new StringValidator(mockField, null, NO_MAX_LENGTH_AST);
            v.compatibleWith(other).should.be.true;
        });
        it('should return true when the max lenghts of string are same', () => {
            const other = new StringValidator(mockField, null, NO_MIN_LENGTH_AST);
            const v = new StringValidator(mockField, null, NO_MIN_LENGTH_AST);
            v.compatibleWith(other).should.be.true;
        });
        it('should return true when the patterns and string lengths are the same', () => {
            const other = new StringValidator(mockField, { pattern: 'foo' }, VALID_MIN_LENGTH_AND_MAX_LENGTH_AST);
            const v = new StringValidator(mockField, { pattern: 'foo' }, VALID_MIN_LENGTH_AND_MAX_LENGTH_AST);
            v.compatibleWith(other).should.be.true;
        });
        it('should return false when the pattern is changed but string lengths are same', () => {
            const other = new StringValidator(mockField, { pattern: 'bar' }, VALID_MIN_LENGTH_AND_MAX_LENGTH_AST);
            const v = new StringValidator(mockField, { pattern: 'foo' }, VALID_MIN_LENGTH_AND_MAX_LENGTH_AST);
            v.compatibleWith(other).should.be.false;
        });
        it('should return false when the patterns are same but string lengths differs', () => {
            const other = new StringValidator(mockField, { pattern: 'foo' }, VALID_MIN_LENGTH_AND_MAX_LENGTH_AST);
            const v = new StringValidator(mockField, { pattern: 'foo' }, NO_MIN_LENGTH_AST);
            v.compatibleWith(other).should.be.false;
        });
        it('should return false when the pattern and string lengths are different', () => {
            const other = new StringValidator(mockField, { pattern: 'bar' }, VALID_MIN_LENGTH_AND_MAX_LENGTH_AST);
            const v = new StringValidator(mockField, { pattern: 'foo' }, NO_MIN_LENGTH_AST);
            v.compatibleWith(other).should.be.false;
        });
    });
});
