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

import { ErrorCodes } from '@accordproject/concerto-util';
import IllegalModelException from './illegalmodelexception';
import ValidationException from '../serializer/validationexception';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type Property from './property';
import type ScalarDeclaration from './scalardeclaration';
import type {
    ICollectionSizeValidator,
    IDoubleDomainValidator,
    IIntegerDomainValidator,
    ILongDomainValidator,
    IStringLengthValidator,
    IStringRegexValidator,
} from '@accordproject/concerto-metamodel';
/* eslint-enable no-unused-vars */

/**
 * The numeric range validators, which share a shape across the three numeric
 * primitive types.
 */
export type NumberDomainValidatorAst = IIntegerDomainValidator | ILongDomainValidator | IDoubleDomainValidator;

/**
 * The metamodel nodes a Validator is built from. Subclasses narrow this to the
 * single node kind they handle.
 */
export type ValidatorAst =
    | ICollectionSizeValidator
    | IStringRegexValidator
    | IStringLengthValidator
    | NumberDomainValidatorAst;

/**
 * The model elements a Validator can be attached to: a Property (in practice a
 * Field) or a ScalarDeclaration.
 */
export type ValidatedElement = Property | ScalarDeclaration;

/**
 * The message of a validator error: the instance or element identifier and
 * the fully qualified name of the field or scalar, then the message.
 * @param {Validator} validator the validator reporting the error
 * @param {string} id the identifier of the instance or element
 * @param {string} msg the exception message
 * @return {string} the full message
 * @private
 */
function errorMessage(validator: Validator, id: string | null, msg: string): string {
    return 'Validator error for field `' + id + '`. ' + validator.getFieldOrScalarDeclaration().getFullyQualifiedName() + ': ' + msg;
}

/**
 * An Abstract field validator. Extend this class and override the
 * validate method.
 * @private
 * @class
 * @abstract
 * @memberof module:concerto-core
 */
class Validator {
    validator: ValidatorAst | undefined;
    field: ValidatedElement;
    /**
     * Create a Property.
     * @param {Object} field - the field or scalar declaration this validator is attached to
     * @param {Object} validator - The validation string
     * @throws {IllegalModelException}
     */
    constructor(field: ValidatedElement, validator: ValidatorAst | undefined) {
        this.validator = validator;
        this.field = field;
    }

    /**
     * Reports an instance value that fails the validator (BC-39: a
     * ValidationException, keeping the errorType; 5.0.0 threw a BaseException).
     * @param {string} id the identifier of the instance
     * @param {string} msg the exception message
     * @param {string} errorType the type of error
     * @throws {ValidationException} throws an error to report the message
     */
    reportError(id: string | null, msg: string, errorType: string = ErrorCodes.DEFAULT_VALIDATOR_EXCEPTION): never {
        const err = new ValidationException(errorMessage(this, id, msg));
        err.errorType = errorType;
        throw err;
    }

    /**
     * Reports a validator that is not valid in its model: a bad bound or
     * regex, or a default value outside the validator (BC-39: an
     * IllegalModelException, keeping the errorType; 5.0.0 threw a
     * BaseException).
     * @param {string} id the identifier of the element
     * @param {string} msg the exception message
     * @param {string} errorType the type of error
     * @throws {IllegalModelException} throws an error to report the message
     */
    reportModelError(id: string | null, msg: string, errorType: string = ErrorCodes.DEFAULT_VALIDATOR_EXCEPTION): never {
        const err = new IllegalModelException(errorMessage(this, id, msg));
        err.errorType = errorType;
        throw err;
    }

    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     */
    accept(visitor,parameters) {
        return visitor.visit(this, parameters);
    }

    /**
     * Returns the field or scalar declaration that this validator applies to
     * @return {Object} the field
     */
    getFieldOrScalarDeclaration(): ValidatedElement {
        return this.field;
    }

    /**
     * Validate the property against a value
     * @param {string} identifier the identifier of the instance being validated
     * @param {Object} value the value to validate
     * @throws {IllegalModelException}
     * @private
     */
    validate(identifier: string | null, value: any): void {
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
        return false;
    }
}

export { Validator };
export default Validator;
