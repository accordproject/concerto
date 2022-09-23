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
    validator: NumberValidator | StringValidator;
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
}
import Property = require("./property");
import NumberValidator = require("./numbervalidator");
import StringValidator = require("./stringvalidator");
import Validator = require("./validator");
