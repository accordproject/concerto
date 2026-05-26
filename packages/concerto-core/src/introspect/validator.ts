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

const { BaseException, ErrorCodes } = require('@accordproject/concerto-util');
// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const Field = require('./field');
    const ScalarDeclaration = require('./scalardeclaration');
}
/* eslint-enable no-unused-vars */

/**
 * An Abstract field validator. Extend this class and override the
 * validate method.
 * @private
 * @class
 * @abstract
 * @memberof module:concerto-core
 */
class Validator {
    validator: any;
    field: any;
    /**
     * Create a Property.
     * @param {Object} field - the field or scalar declaration this validator is attached to
     * @param {Object} validator - The validation string
     * @throws {IllegalModelException}
     */
    constructor(field, validator) {
        this.validator = validator;
        this.field = field;
    }

    /**
     * @param {string} id the identifier of the instance
     * @param {string} msg the exception message
     * @param {string} errorType the type of error
     * @throws {Error} throws an error to report the message
     */
    reportError(id, msg, errorType=ErrorCodes.DEFAULT_VALIDATOR_EXCEPTION) {
        throw new BaseException('Validator error for field `' + id + '`. ' + this.getFieldOrScalarDeclaration().getFullyQualifiedName() + ': ' + msg, undefined, errorType);
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
    getFieldOrScalarDeclaration() {
        return this.field;
    }

    /**
     * Validate the property against a value
     * @param {string} identifier the identifier of the instance being validated
     * @param {Object} value the value to validate
     * @throws {IllegalModelException}
     * @private
     */
    validate(identifier, value) {
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
        return false;
    }
}

export = Validator;
