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

const { RE2 } = require('re2-wasm');
const Validator = require('./validator');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const Field = require('./field');
}
/* eslint-enable no-unused-vars */

/**
 * A Validator to enforce that a string matches a regex
 * @private
 * @class
 * @memberof module:concerto-core
 */
class StringValidator extends Validator{

    /**
     * Create a StringValidator.
     * @param {Field} field - the field this validator is attached to
     * @param {Object} validator - The validation string. This must be a regex
     * expression.
     *
     * @throws {IllegalModelException}
     */
    constructor(field, validator) {
        super(field, validator);
        try {
            if (validator.flags) {
                this.regex = new RE2(validator.pattern, validator.flags);
            } else {
                this.regex = new RE2(validator.pattern);
            }
        }
        catch(exception) {
            this.reportError(field.getName(), exception.message);
        }
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
            if(!this.regex.test(value)) {
                this.reportError(identifier, 'Value \'' + value + '\' failed to match validation regex: ' + this.regex);
            }
        }
    }

    /**
     * Returns the RegExp object associated with the string validator
     * @returns {RegExp} the RegExp object
     */
    getRegex() {
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
    compatibleWith(other) {
        if (!(other instanceof StringValidator)) {
            return false;
        } else if (this.validator.pattern !== other.validator.pattern) {
            return false;
        } else if (this.validator.flags !== other.validator.flags) {
            return false;
        } else {
            return true;
        }
    }
}

module.exports = StringValidator;
