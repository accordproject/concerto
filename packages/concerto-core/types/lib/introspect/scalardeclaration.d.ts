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
    superType: any;
    superTypeDeclaration: any;
    idField: any;
    timestamped: boolean;
    abstract: boolean;
    validator: StringValidator | NumberValidator;
    type: string;
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
     * Returns the FQN of the super type for this class or null if this
     * class does not have a super type.
     *
     * @return {string} the FQN name of the super type or null
     * @deprecated
     */
    getSuperType(): string;
    /**
     * Get the super type class declaration for this class.
     * @return {ClassDeclaration} the super type declaration, or null if there is no super type.
     * @deprecated
     */
    getSuperTypeDeclaration(): ClassDeclaration;
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
    /**
     * Returns true if this class is abstract.
     *
     * @return {boolean} true if the class is abstract
     * @deprecated
     */
    isAbstract(): boolean;
    /**
     * Returns true if this class is the definition of an asset.
     *
     * @return {boolean} true if the class is an asset
     * @deprecated
     */
    isAsset(): boolean;
    /**
     * Returns true if this class is the definition of a participant.
     *
     * @return {boolean} true if the class is a participant
     * @deprecated
     */
    isParticipant(): boolean;
    /**
     * Returns true if this class is the definition of a transaction.
     *
     * @return {boolean} true if the class is a transaction
     * @deprecated
     */
    isTransaction(): boolean;
    /**
     * Returns true if this class is the definition of an event.
     *
     * @return {boolean} true if the class is an event
     * @deprecated
     */
    isEvent(): boolean;
    /**
     * Returns true if this class is the definition of a concept.
     *
     * @return {boolean} true if the class is a concept
     * @deprecated
     */
    isConcept(): boolean;
}
import Declaration = require("./declaration");
import StringValidator = require("./stringvalidator");
import NumberValidator = require("./numbervalidator");
import ClassDeclaration = require("./classdeclaration");
import Validator = require("./validator");
