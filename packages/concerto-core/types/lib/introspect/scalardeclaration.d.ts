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
declare class ScalarDeclaration extends Decorated {
    /**
     * Create a ScalarDeclaration from an Abstract Syntax Tree. The AST is the
     * result of parsing.
     *
     * @param {ModelFile} modelFile - the ModelFile for this class
     * @param {Object} ast - the AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile: ModelFile, ast: any);
    modelFile: ModelFile;
    name: any;
    superType: any;
    superTypeDeclaration: any;
    idField: any;
    timestamped: boolean;
    abstract: boolean;
    validator: StringValidator | NumberValidator;
    type: string;
    defaultValue: any;
    fqn: string;
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
     * Returns the short name of a class. This name does not include the
     * namespace from the owning ModelFile.
     *
     * @return {string} the short name of this class
     */
    getName(): string;
    /**
     * Return the namespace of this class.
     * @return {string} namespace - a namespace.
     */
    getNamespace(): string;
    /**
     * Returns the fully qualified name of this class.
     * The name will include the namespace if present.
     *
     * @return {string} the fully-qualified name of this class
     */
    getFullyQualifiedName(): string;
    /**
     * Returns false as scalars are never identified.
     * @returns {Boolean} false as scalars are never identified
     */
    isIdentified(): boolean;
    /**
     * Returns false as scalars are never identified.
     * @returns {Boolean} false as scalars are never identified
     */
    isSystemIdentified(): boolean;
    /**
     * Returns null as scalars are never identified.
     * @return {null} null, as scalars are never identified
     */
    getIdentifierFieldName(): null;
    /**
     * Returns the FQN of the super type for this class or null if this
     * class does not have a super type.
     *
     * @return {string} the FQN name of the super type or null
     */
    getType(): string;
    /**
     * Throws an error as scalars do not have supertypes.
     */
    getSuperType(): void;
    /**
     * Get the super type class declaration for this class.
     * @return {ScalarDeclaration | null} the super type declaration, or null if there is no super type.
     */
    getSuperTypeDeclaration(): ScalarDeclaration | null;
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
     */
    isAbstract(): boolean;
    /**
     * Returns true if this class is the definition of an asset.
     *
     * @return {boolean} true if the class is an asset
     */
    isAsset(): boolean;
    /**
     * Returns true if this class is the definition of a participant.
     *
     * @return {boolean} true if the class is a participant
     */
    isParticipant(): boolean;
    /**
     * Returns true if this class is the definition of a transaction.
     *
     * @return {boolean} true if the class is a transaction
     */
    isTransaction(): boolean;
    /**
     * Returns true if this class is the definition of an event.
     *
     * @return {boolean} true if the class is an event
     */
    isEvent(): boolean;
    /**
     * Returns true if this class is the definition of a concept.
     *
     * @return {boolean} true if the class is a concept
     */
    isConcept(): boolean;
    /**
     * Returns true if this class is the definition of an enum.
     *
     * @return {boolean} true if the class is an enum
     */
    isEnum(): boolean;
    /**
     * Returns true if this class is the definition of a class declaration.
     *
     * @return {boolean} true if the class is a class
     */
    isClassDeclaration(): boolean;
    /**
     * Returns true if this class is the definition of a scalar declaration.
     *
     * @return {boolean} true if the class is a scalar
     */
    isScalarDeclaration(): boolean;
}
import Decorated = require("./decorated");
import ModelFile = require("./modelfile");
import StringValidator = require("./stringvalidator");
import NumberValidator = require("./numbervalidator");
import Validator = require("./validator");
