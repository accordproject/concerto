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
     * @param {Field} field - the field this validator is attached to
     * @param {Object} validator - The validation string
     * @throws {IllegalModelException}
     */
    constructor(field: Field, validator: any);
    validator: any;
    field: Field;
    /**
     * @param {string} id the identifier of the instance
     * @param {string} msg the exception message
     * @throws {Error} throws an error to report the message
     */
    reportError(id: string, msg: string): void;
    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private accept;
    /**
     * Returns the field that this validator applies to
     * @return {Field} the field
     */
    getField(): Field;
    /**
     * Validate the property against a value
     * @param {string} identifier the identifier of the instance being validated
     * @param {Object} value the value to validate
     * @throws {IllegalModelException}
     * @private
     */
    private validate;
}
