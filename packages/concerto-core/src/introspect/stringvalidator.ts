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

import { ErrorCodes, NullUtil } from '@accordproject/concerto-util';
const { isNull } = NullUtil;
import Validator from './validator';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type { ValidatedElement } from './validator';
import type { IStringLengthValidator, IStringRegexValidator } from '@accordproject/concerto-metamodel';
/* eslint-enable no-unused-vars */

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type Field from './field';
import type ScalarDeclaration from './scalardeclaration';
/* eslint-enable no-unused-vars */

/**
 * A Validator to enforce that a string matches a regex
 * @private
 * @class
 * @memberof module:concerto-core
 */
class StringValidator extends Validator{
    declare validator: IStringRegexValidator | undefined;
    // The metamodel makes both bounds optional, so an AST can leave either
    // absent as well as explicitly null.
    minLength: number | null | undefined;
    maxLength: number | null | undefined;
    regex: RegExp | null;

    /**
     * Create a StringValidator.
     * @param {Object} field - the field or scalar declaration this validator is attached to
     * @param {Object} validator - The validation string. This must be a regex
     * @param {Object} lengthValidator - The length validation string - [minLength,maxLength] (inclusive).
     *
     * @throws {IllegalModelException}
     */
    constructor(field: ValidatedElement, validator?: IStringRegexValidator, lengthValidator?: IStringLengthValidator) {
        super(field, validator);
        this.minLength = null;
        this.maxLength = null;
        this.regex = null;

        if (lengthValidator) {
            this.minLength = lengthValidator?.minLength;
            this.maxLength = lengthValidator?.maxLength;

            if(this.minLength === null && this.maxLength === null) {
                // can't specify no upper and lower value
                this.reportError(field.getName(), 'Invalid string length, minLength and-or maxLength must be specified.');
            } else if ((this.minLength ?? 0) < 0 || (this.maxLength ?? 0) < 0) {
                this.reportError(field.getName(), 'minLength and-or maxLength must be positive integers.');
            } else if (this.minLength === null || this.maxLength === null) {
                // this is fine and means that we don't need to check whether minLength > maxLength
            } else if(this.minLength !== undefined && this.maxLength !== undefined && this.minLength > this.maxLength) {
                this.reportError(field.getName(), 'minLength must be less than or equal to maxLength.');
            }
        }

        if (validator) {
            try {
                // ScalarDeclarations have no parent, so the custom RegExp option
                // is only picked up for properties
                const parent = 'getParent' in field ? field.getParent() : undefined;
                const CustomRegExp = (parent?.getModelFile()?.getModelManager()?.options?.regExp || RegExp) as typeof RegExp;
                this.regex = new CustomRegExp(validator.pattern, validator.flags);
            }
            catch (exception) {
                this.reportError(field.getName(), (exception as Error).message, ErrorCodes.REGEX_VALIDATOR_EXCEPTION);
            }
        }

        if(this.field?.ast?.defaultValue) {
            this.validate(field.getName(), this.field.ast.defaultValue);
        }
    }

    /**
     * Validate the property
     * @param {string} identifier the identifier of the instance being validated
     * @param {Object} value the value to validate
     * @throws {IllegalModelException}
     * @private
     */
    validate(identifier: string | null, value: string): void {
        if(value !== null) {
            //Enforce string length rule first
            if(this.minLength !== null && this.minLength !== undefined && value.length < this.minLength) {
                this.reportError(identifier, `The string length of '${value}' should be at least ${this.minLength} characters.`);
            }
            if(this.maxLength !== null && this.maxLength !== undefined && value.length > this.maxLength) {
                this.reportError(identifier, `The string length of '${value}' should not exceed ${this.maxLength} characters.`);
            }

            if (this.regex && !this.matchesRegex(value)) {
                this.reportError(identifier, `Value '${value}' failed to match validation regex: ${this.regex}`);
            }
        }
    }

    /**
     * Tests a value against the validation regex. Returns true when no regex is
     * specified.
     * @param {string} value the value to test
     * @returns {boolean} true if the value matches the validation regex
     */
    matchesRegex(value) {
        if (!this.regex) {
            return true;
        }
        // `test` advances `lastIndex` when the regex has the global or sticky flag, so
        // testing the same value twice would otherwise alternate between matching and
        // not matching. Reset it before and after so that every test is independent of
        // previous ones, and so that getRegex() never hands out a poisoned object.
        this.regex.lastIndex = 0;
        try {
            return this.regex.test(value);
        } finally {
            this.regex.lastIndex = 0;
        }
    }

    /**
     * Returns the minLength for this validator, or null if not specified
     * @returns {number} the min length or null
     */
    getMinLength(): number | null | undefined {
        return this.minLength;
    }
    /**
     * Returns the maxLength for this validator, or null if not specified
     * @returns {number} the max length or null
     */
    getMaxLength(): number | null | undefined {
        return this.maxLength;
    }

    /**
     * Returns the RegExp object associated with the string validator, or null if not specified
     * @returns {RegExp} the RegExp object
     */
    getRegex(): RegExp | null {
        return this.regex;
    }

    /**
     * Determine if the validator is compatible with another validator. For the
     * validators to be compatible, all values accepted by this validator must
     * be accepted by the other validator.
     * @param {Validator} other the other validator.
     * @returns {boolean} True if this validator is compatible with the other
     * validator, false otherwise.
     */
    compatibleWith(other: Validator | null): boolean {
        if (!(other instanceof StringValidator)) {
            return false;
        }

        if (this.validator?.pattern !== other.validator?.pattern) {
            return false;
        } else if (this.validator?.flags !== other.validator?.flags) {
            return false;
        }

        const thisMinLength = this.getMinLength();
        const otherMinLength = other.getMinLength();
        if (isNull(thisMinLength) && !isNull(otherMinLength)) {
            return false;
        } else if (!isNull(thisMinLength) && !isNull(otherMinLength)) {
            if (thisMinLength < otherMinLength) {
                return false;
            }
        }
        const thisMaxLength = this.getMaxLength();
        const otherMaxLength = other.getMaxLength();
        if (isNull(thisMaxLength) && !isNull(otherMaxLength)) {
            return false;
        } else if (!isNull(thisMaxLength) && !isNull(otherMaxLength)) {
            if (thisMaxLength > otherMaxLength) {
                return false;
            }
        }
        return true;
    }
}

export { StringValidator };
export default StringValidator;
