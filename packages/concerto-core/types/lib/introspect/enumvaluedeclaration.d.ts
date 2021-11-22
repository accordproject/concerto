export = EnumValueDeclaration;
/**
 * Class representing a value from a set of enumerated values
 *
 * @extends Property
 * @see See {@link Property}
 * @class
 * @memberof module:concerto-core
 */
declare class EnumValueDeclaration extends Property {
    /**
     * Returns true if this class is the definition of a enum value.
     *
     * @return {boolean} true if the class is an enum value
     */
    isEnumValue(): boolean;
}
import Property = require("./property");
