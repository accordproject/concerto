export = StringValidator;
/**
 * A Validator to enforce that a string matches a regex
 * @private
 * @class
 * @memberof module:concerto-core
 */
declare class StringValidator extends Validator {
    /**
     * Create a StringValidator.
     * @param {Object} field - the field or scalar declaration this validator is attached to
     * @param {Object} validator - The validation string. This must be a regex
     * @param {Object} lengthValidator - The length validation string - [minLength,maxLength] (inclusive).
     *
     * @throws {IllegalModelException}
     */
    constructor(field: any, validator: any, lengthValidator: any);
    minLength: any;
    maxLength: any;
    regex: any;
    /**
     * Returns the minLength for this validator, or null if not specified
     * @returns {number} the min length or null
     */
    getMinLength(): number;
    /**
     * Returns the maxLength for this validator, or null if not specified
     * @returns {number} the max length or null
     */
    getMaxLength(): number;
    /**
     * Returns the RegExp object associated with the string validator, or null if not specified
     * @returns {RegExp} the RegExp object
     */
    getRegex(): RegExp;
}
import Validator = require("./validator");
