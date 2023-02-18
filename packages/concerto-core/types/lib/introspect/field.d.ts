export = Field;
/**
 * Class representing the definition of a Field. A Field is owned
 * by a ClassDeclaration and has a name, type and additional metadata
 * (see below).
 * @private
 * @extends Property
 * @see See  {@link  Property}
 * @class
 * @memberof module:concerto-core
 */
declare class Field extends Property {
    scalarField: Field;
    validator: StringValidator | NumberValidator;
    defaultValue: any;
    /**
     * Returns the validator string for this field
     * @return {Validator} the validator for the field or null
     */
    getValidator(): Validator;
    /**
     * Returns the default value for the field or null
     * @return {string | number} the default value for the field or null
     */
    getDefaultValue(): string | number;
    /**
     * Returns true if this class is the definition of a field.
     *
     * @return {boolean} true if the class is a field
     */
    isField(): boolean;
    /**
     * Returns true if the field's type is a scalar
     * @returns {boolean} true if the field is a scalar type
     */
    isTypeScalar(): boolean;
    /**
     * Unboxes a field that references a scalar type to an
     * underlying Field definition.
     * @throws {Error} throws an error if this field is not a scalar type.
     * @returns {Field} the primitive field for this scalar
     */
    getScalarField(): Field;
}
import Property = require("./property");
import StringValidator = require("./stringvalidator");
import NumberValidator = require("./numbervalidator");
import Validator = require("./validator");
