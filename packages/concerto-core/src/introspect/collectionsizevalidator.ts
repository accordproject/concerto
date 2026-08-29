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

import { NullUtil } from '@accordproject/concerto-util';
import Validator from './validator';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type { ValidatedElement } from './validator';
import type { AstNode } from './decorated';
/* eslint-enable no-unused-vars */

const { isNull } = NullUtil;

/**
 * A Validator to enforce that a collection (array or map) has a size within a specified range.
 * @private
 * @class
 * @memberof module:concerto-core
 */
class CollectionSizeValidator extends Validator {
    minSize: number | null;
    maxSize: number | null;

    /**
     * Create a CollectionSizeValidator.
     * @param {Object} field - the field or declarations this validator is attached to
     * @param {Object} validator - The size validation object - [minSize, maxSize] (inclusive).
     *
     * @throws {IllegalModelException}
     */
    constructor(field: ValidatedElement, validator: AstNode) {
        super(field, validator);
        this.minSize = validator.minSize ?? null;
        this.maxSize = validator.maxSize ?? null;

        if (isNull(this.minSize) && isNull(this.maxSize)) {
            this.reportError(field.getName(), 'Invalid collection size, minSize and/or maxSize must be specified.');
        } else if ((this.minSize ?? 0) < 0 || (this.maxSize ?? 0) < 0) {
            this.reportError(field.getName(), 'minSize and/or maxSize must be positive integers.');
        } else if (isNull(this.minSize) || isNull(this.maxSize)) {
            // this is fine and means that we don't need to check whether minSize > maxSize
        } else if (this.minSize > this.maxSize) {
            this.reportError(field.getName(), 'minSize must be less than or equal to maxSize.');
        }
    }

    /**
     * Validate the property
     * @param {string} identifier the identifier of the instance being validated
     * @param {number} value the collection size to validate
     * @throws {IllegalModelException}
     * @private
     */
    validate(identifier: string | null, value: number): void {
        if(!isNull(this.minSize) && value < this.minSize) {
            this.reportError(identifier, `Collection must contain at least ${this.minSize} elements.`);
        }
        if(!isNull(this.maxSize) && value > this.maxSize) {
            this.reportError(identifier, `Collection must contain no more than ${this.maxSize} elements.`);
        }
    }

    /**
     * Returns the minSize for this validator, or null if not specified
     * @returns {number} the min size or null
     */
    getMinSize(): number | null {
        return this.minSize;
    }

    /**
     * Returns the maxSize for this validator, or null if not specified
     * @returns {number} the max size or null
     */
    getMaxSize(): number | null {
        return this.maxSize;
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
        if (!(other instanceof CollectionSizeValidator)) {
            return false;
        }

        const thisMinSize = this.getMinSize();
        const otherMinSize = other.getMinSize();
        if (isNull(thisMinSize) && !isNull(otherMinSize)) {
            return false;
        } else if (!isNull(thisMinSize) && !isNull(otherMinSize)) {
            if (thisMinSize < otherMinSize) {
                return false;
            }
        }

        const thisMaxSize = this.getMaxSize();
        const otherMaxSize = other.getMaxSize();
        if (isNull(thisMaxSize) && !isNull(otherMaxSize)) {
            return false;
        } else if (!isNull(thisMaxSize) && !isNull(otherMaxSize)) {
            if (thisMaxSize > otherMaxSize) {
                return false;
            }
        }

        return true;
    }
}

export { CollectionSizeValidator };
export default CollectionSizeValidator;
