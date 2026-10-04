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
import type { ValidatedElement, NumberDomainValidatorAst } from './validator';
/* eslint-enable no-unused-vars */

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type Field from './field';
import type ScalarDeclaration from './scalardeclaration';
/* eslint-enable no-unused-vars */
import { rust } from '../engineloader';

/**
 * A Validator to enforce that non null numeric values are between two values.
 * @private
 * @class
 * @memberof module:concerto-core
 */
class NumberValidator extends Validator{
    declare validator: NumberDomainValidatorAst;
    // Definitely assigned: by the constructor, or from the engine snapshot.
    lowerBound!: number | null;
    upperBound!: number | null;

    /**
     * Create a NumberValidator.
     * @param {Object} field - the field or scalar declaration this validator is attached to
     * @param {Object} ast - The ast for the range defined as [lower,upper] (inclusive).
     *
     * @throws {IllegalModelException}
     */
    constructor(field: ValidatedElement, ast: NumberDomainValidatorAst) {
        super(field, ast);
        Object.assign(this, rust.numberValidatorNew(this, ast));
    }

    /**
     * Returns the lower bound for this validator, or null if not specified
     * @returns {number} the lower bound or null
     */
    getLowerBound(): number | null {
        return this.lowerBound;
    }
    /**
     * Returns the upper bound for this validator, or null if not specified
     * @returns {number} the upper bound or null
     */
    getUpperBound(): number | null {
        return this.upperBound;
    }

    /**
     * Validate the property
     * @param {string} identifier the identifier of the instance being validated
     * @param {Object} value the value to validate
     * @throws {IllegalModelException}
     * @private
     */
    validate(identifier: string | null, value: number): void {
        rust.numberValidatorValidate(this, identifier, value);
    }

    /**
     * Returns a string representation
     * @return {string} the string representation
     * @private
     */
    toString(): string {
        return 'NumberValidator lower: ' + this.lowerBound + ' upper: ' + this.upperBound;
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
        return rust.numberValidatorCompatibleWith(this, other, NumberValidator);
    }
}

export { NumberValidator };
export default NumberValidator;
