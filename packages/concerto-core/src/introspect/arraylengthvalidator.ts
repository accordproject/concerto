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

const { isNull } = require('@accordproject/concerto-util').NullUtil;
const Validator = require('./validator');

/**
 * A validator for array property length.
 * @class
 * @memberof module:concerto-core
 */
class ArrayLengthValidator extends Validator {
    /**
     * @param {Property} property the array property
     * @param {Object} validator the array length validator AST
     */
    constructor(property, validator) {
        super(property, validator);
        this.minElements = Object.prototype.hasOwnProperty.call(validator, 'minElements') ? validator.minElements : null;
        this.maxElements = Object.prototype.hasOwnProperty.call(validator, 'maxElements') ? validator.maxElements : null;

        if (!property.isArray()) {
            this.reportError(property.getName(), 'Array length validators can only be applied to array properties.');
        } else if (isNull(this.minElements) && isNull(this.maxElements)) {
            this.reportError(property.getName(), 'minElements and-or maxElements must be specified.');
        } else if ((!isNull(this.minElements) && (!Number.isInteger(this.minElements) || this.minElements < 0))
            || (!isNull(this.maxElements) && (!Number.isInteger(this.maxElements) || this.maxElements < 0))) {
            this.reportError(property.getName(), 'minElements and maxElements must be non-negative integers.');
        } else if (!isNull(this.minElements) && !isNull(this.maxElements) && this.minElements > this.maxElements) {
            this.reportError(property.getName(), 'minElements must be less than or equal to maxElements.');
        }
    }

    /**
     * @param {string} identifier the identifier of the instance being validated
     * @param {Array} value the array to validate
     */
    validate(identifier, value) {
        if (!isNull(this.minElements) && value.length < this.minElements) {
            this.reportError(identifier, `The array must contain at least ${this.minElements} elements.`);
        }
        if (!isNull(this.maxElements) && value.length > this.maxElements) {
            this.reportError(identifier, `The array must contain no more than ${this.maxElements} elements.`);
        }
    }

    /** @returns {number | null} the minimum array length */
    getMinElements() {
        return this.minElements;
    }

    /** @returns {number | null} the maximum array length */
    getMaxElements() {
        return this.maxElements;
    }

    /**
     * @param {Validator} other the new validator
     * @returns {boolean} whether every value accepted by this validator is accepted by the other
     */
    compatibleWith(other) {
        if (!(other instanceof ArrayLengthValidator)) {
            return false;
        }
        if (isNull(this.minElements) && !isNull(other.minElements) && other.minElements > 0) {
            return false;
        }
        if (!isNull(this.minElements) && !isNull(other.minElements) && this.minElements < other.minElements) {
            return false;
        }
        if (isNull(this.maxElements) && !isNull(other.maxElements)) {
            return false;
        }
        return isNull(this.maxElements) || isNull(other.maxElements) || this.maxElements <= other.maxElements;
    }
}

export = ArrayLengthValidator;
