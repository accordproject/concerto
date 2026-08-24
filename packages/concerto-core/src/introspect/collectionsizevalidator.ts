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
const ModelUtil = require('../modelutil');
const Validator = require('./validator');

/**
 * A validator for array and map property sizes.
 * @class
 * @memberof module:concerto-core
 */
class CollectionSizeValidator extends Validator {
    /**
     * @param {Property} property the collection property
     * @param {Object} validator the collection size validator AST
     */
    constructor(property, validator) {
        super(property, validator);
        this.minSize = Object.prototype.hasOwnProperty.call(validator, 'minSize') ? validator.minSize : null;
        this.maxSize = Object.prototype.hasOwnProperty.call(validator, 'maxSize') ? validator.maxSize : null;

        if (isNull(this.minSize) && isNull(this.maxSize)) {
            this.reportError(property.getName(), 'minSize and-or maxSize must be specified.');
        } else if ((!isNull(this.minSize) && (!Number.isInteger(this.minSize) || this.minSize < 0))
            || (!isNull(this.maxSize) && (!Number.isInteger(this.maxSize) || this.maxSize < 0))) {
            this.reportError(property.getName(), 'minSize and maxSize must be non-negative integers.');
        } else if (!isNull(this.minSize) && !isNull(this.maxSize) && this.minSize > this.maxSize) {
            this.reportError(property.getName(), 'minSize must be less than or equal to maxSize.');
        }
    }

    /**
     * @param {string} identifier the identifier of the instance being validated
     * @param {Array | Map} value the collection to validate
     */
    validate(identifier, value) {
        if (!Array.isArray(value) && !(value instanceof Map)) {
            return;
        }
        const size = value instanceof Map
            ? Array.from(value.keys()).filter(key => !ModelUtil.isSystemProperty(key)).length
            : value.length;
        if (!isNull(this.minSize) && size < this.minSize) {
            this.reportError(identifier, `The collection must contain at least ${this.minSize} elements.`);
        }
        if (!isNull(this.maxSize) && size > this.maxSize) {
            this.reportError(identifier, `The collection must contain no more than ${this.maxSize} elements.`);
        }
    }

    /** @returns {number | null} the minimum collection size */
    getMinSize() {
        return this.minSize;
    }

    /** @returns {number | null} the maximum collection size */
    getMaxSize() {
        return this.maxSize;
    }

    /**
     * @param {Validator} other the new validator
     * @returns {boolean} whether every value accepted by this validator is accepted by the other
     */
    compatibleWith(other) {
        if (!(other instanceof CollectionSizeValidator)) {
            return false;
        }
        if (isNull(this.minSize) && !isNull(other.minSize) && other.minSize > 0) {
            return false;
        }
        if (!isNull(this.minSize) && !isNull(other.minSize) && this.minSize < other.minSize) {
            return false;
        }
        if (isNull(this.maxSize) && !isNull(other.maxSize)) {
            return false;
        }
        return isNull(this.maxSize) || isNull(other.maxSize) || this.maxSize <= other.maxSize;
    }
}

export = CollectionSizeValidator;
