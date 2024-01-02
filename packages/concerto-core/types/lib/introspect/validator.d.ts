export = Validator;
/**
 * An Abstract field validator. Extend this class and override the
 * validate method.
 * @private
 * @class
 * @abstract
 * @memberof module:concerto-core
 */
declare class Validator {
    /**
     * Create a Property.
     * @param {Object} field - the field or scalar declaration this validator is attached to
     * @param {Object} validator - The validation string
     * @throws {IllegalModelException}
     */
    constructor(field: any, validator: any);
    validator: any;
    field: any;
    /**
     * @param {string} id the identifier of the instance
     * @param {string} msg the exception message
     * @param {string} errorType the type of error
     * @throws {Error} throws an error to report the message
     */
    reportError(id: string, msg: string, errorType?: string): void;
    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private accept;
    /**
     * Returns the field or scalar declaration that this validator applies to
     * @return {Object} the field
     */
    getFieldOrScalarDeclaration(): any;
    /**
     * Validate the property against a value
     * @param {string} identifier the identifier of the instance being validated
     * @param {Object} value the value to validate
     * @throws {IllegalModelException}
     * @private
     */
    private validate;
    /**
     * Determine if the validator is compatible with another validator. For the
     * validators to be compatible, all values accepted by this validator must
     * be accepted by the other validator.
     * @param {Validator} other the other validator.
     * @returns {boolean} True if this validator is compatible with the other
     * validator, false otherwise.
     */
    compatibleWith(other: Validator): boolean;
}
