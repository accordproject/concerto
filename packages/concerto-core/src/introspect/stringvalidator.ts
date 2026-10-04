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
import { rust } from '../engineloader';

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
    // Definitely assigned from the Rust snapshot.
    minLength!: number | null | undefined;
    maxLength!: number | null | undefined;
    // BC-28: a native RegExp of the pattern the engine compiled, for
    // getRegex() and matchesRegex(); `validate` uses the engine's regex.
    regex!: RegExp | null;

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

        // BC-28: the engine compiles the pattern and checks the bounds and default.
        Object.assign(this, rust.stringValidatorNew(this, validator, lengthValidator));
        this.regex = validator ? new RegExp(validator.pattern, validator.flags) : null;
    }

    /**
     * Validate the property
     * @param {string} identifier the identifier of the instance being validated
     * @param {Object} value the value to validate
     * @throws {IllegalModelException}
     * @private
     */
    validate(identifier: string | null, value: string): void {
        rust.stringValidatorValidate(this, identifier, value);
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
        return rust.stringValidatorCompatibleWith(this, other, StringValidator);
    }
}

export { StringValidator };
export default StringValidator;
