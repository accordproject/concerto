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
import type { ICollectionSizeValidator } from '@accordproject/concerto-metamodel';
/* eslint-enable no-unused-vars */
import { rust } from '../engineloader';

/**
 * A Validator to enforce that a collection (array or map) has a size within a specified range.
 * @private
 * @class
 * @memberof module:concerto-core
 */
class CollectionSizeValidator extends Validator {
    declare validator: ICollectionSizeValidator;
    // Definitely assigned: by the TS body, or from the Rust snapshot.
    minSize!: number | null;
    maxSize!: number | null;

    /**
     * Create a CollectionSizeValidator.
     * @param {Object} field - the field or declarations this validator is attached to
     * @param {Object} validator - The size validation object - [minSize, maxSize] (inclusive).
     *
     * @throws {IllegalModelException}
     */
    constructor(field: ValidatedElement, validator: ICollectionSizeValidator) {
        super(field, validator);
        Object.assign(this, rust.collectionSizeValidatorNew(this, validator));
    }

    /**
     * Validate the property
     * @param {string} identifier the identifier of the instance being validated
     * @param {number} value the collection size to validate
     * @throws {IllegalModelException}
     * @private
     */
    validate(identifier: string | null, value: number): void {
        rust.collectionSizeValidatorValidate(this, identifier, value);
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
        return rust.collectionSizeValidatorCompatibleWith(this, other, CollectionSizeValidator);
    }
}

export { CollectionSizeValidator };
export default CollectionSizeValidator;
