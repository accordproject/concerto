export = ScalarDeclaration;
/**
 * ScalarDeclaration defines the structure (model/schema) of composite data.
 * It is composed of a set of Properties, may have an identifying field, and may
 * have a super-type.
 * A ScalarDeclaration is conceptually owned by a ModelFile which
 * defines all the classes that are part of a namespace.
 *
 * @abstract
 * @class
 * @memberof module:concerto-core
 */
declare class ScalarDeclaration extends Declaration {
    validator: StringValidator | NumberValidator;
    scalarType: string;
    defaultValue: any;
    /**
     * Semantic validation of the structure of this class. Subclasses should
     * override this method to impose additional semantic constraints on the
     * contents/relations of fields.
     *
     * @throws {IllegalModelException}
     * @protected
     */
    protected validate(): void;
    /**
     * Returns the underlying primitive type of this scalar
     *
     * @return {string} the type of the scalar (String, Integer, Long etc.)
     */
    getScalarType(): string;
    /**
     * Returns the validator string for this scalar definition
     * @return {Validator} the validator for the field or null
     */
    getValidator(): Validator;
    /**
     * Returns the default value for the field or null
     * @return {string | number | null} the default value for the field or null
     */
    getDefaultValue(): string | number | null;
}
import Declaration = require("./declaration");
import StringValidator = require("./stringvalidator");
import NumberValidator = require("./numbervalidator");
import Validator = require("./validator");
