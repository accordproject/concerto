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

const { isNull } = require('../util');
const Validator = require('./validator');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const Field = require('./field');
}
/* eslint-enable no-unused-vars */

/**
 * A Validator to enforce that non null numeric values are between two values.
 * @private
 * @class
 * @memberof module:concerto-core
 */
class NumberValidator extends Validator{

    /**
     * Create a NumberValidator.
     * @param {Field} field - the field this validator is attached to
     * @param {Object} ast - The ast for the range defined as [lower,upper] (inclusive).
     *
     * @throws {IllegalModelException}
     */
    constructor(field, ast) {
        super(field, ast);

        this.lowerBound = null;
        this.upperBound = null;

        if(Object.prototype.hasOwnProperty.call(ast, 'lower')) {
            this.lowerBound = ast.lower;
        }

        if(Object.prototype.hasOwnProperty.call(ast, 'upper')) {
            this.upperBound = ast.upper;
        }

        if(this.lowerBound === null && this.upperBound === null) {
            // can't specify no upper and lower value
            this.reportError(null, 'Invalid range, lower and-or upper bound must be specified.');
        } else if (this.lowerBound === null || this.upperBound === null) {
            // this is fine and means that we don't need to check whether upper > lower
        } else {
            if(this.lowerBound > this.upperBound) {
                this.reportError(null, 'Lower bound must be less than or equal to upper bound.');
            }
        }
    }

    /**
     * Returns the lower bound for this validator, or null if not specified
     * @returns {number} the lower bound or null
     */
    getLowerBound() {
        return this.lowerBound;
    }
    /**
     * Returns the upper bound for this validator, or null if not specified
     * @returns {number} the upper bound or null
     */
    getUpperBound() {
        return this.upperBound;
    }

    /**
     * Validate the property
     * @param {string} identifier the identifier of the instance being validated
     * @param {Object} value the value to validate
     * @throws {IllegalModelException}
     * @private
     */
    validate(identifier, value) {
        if(value !== null) {
            if(this.lowerBound !== null && value < this.lowerBound) {
                this.reportError(identifier, `Value ${value} is outside lower bound ${this.lowerBound}`);
            }

            if(this.upperBound !== null && value > this.upperBound) {
                this.reportError(identifier, `Value ${value} is outside upper bound ${this.upperBound}`);
            }
        }
    }

    /**
     * Returns a string representation
     * @return {string} the string representation
     * @private
     */
    toString() {
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
    compatibleWith(other) {
        if (!(other instanceof NumberValidator)) {
            return false;
        }
        const thisLowerBound = this.getLowerBound();
        const otherLowerBound = other.getLowerBound();
        if (isNull(thisLowerBound) && !isNull(otherLowerBound)) {
            return false;
        } else if (!isNull(thisLowerBound) && !isNull(otherLowerBound)) {
            if (thisLowerBound < otherLowerBound) {
                return false;
            }
        }
        const thisUpperBound = this.getUpperBound();
        const otherUpperBound = other.getUpperBound();
        if (isNull(thisUpperBound) && !isNull(otherUpperBound)) {
            return false;
        } else if (!isNull(thisUpperBound) && !isNull(otherUpperBound)) {
            if (thisUpperBound > otherUpperBound) {
                return false;
            }
        }
        return true;
    }
}

module.exports = NumberValidator;
