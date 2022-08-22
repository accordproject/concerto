export = ClassDeclaration;
/**
 * ClassDeclaration defines the structure (model/schema) of composite data.
 * It is composed of a set of Properties, may have an identifying field, and may
 * have a super-type.
 * A ClassDeclaration is conceptually owned by a ModelFile which
 * defines all the classes that are part of a namespace.
 *
 * @abstract
 * @class
 * @memberof module:concerto-core
 */
declare class ClassDeclaration extends Decorated {
    /**
     * Create a ClassDeclaration from an Abstract Syntax Tree. The AST is the
     * result of parsing.
     *
     * @param {ModelFile} modelFile - the ModelFile for this class
     * @param {Object} ast - the AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile: ModelFile, ast: any);
    modelFile: ModelFile;
    name: any;
    properties: any[];
    superType: any;
    superTypeDeclaration: any;
    idField: any;
    timestamped: boolean;
    abstract: boolean;
    type: any;
    fqn: string;
    /**
     * Adds a required field named 'timestamp' of type 'DateTime' if this class declaration has the 'concerto.Concept'
     * super type.
     * This method should only be called by system code.
     * @private
     */
    private addTimestampField;
    /**
     * Adds a required field named '$identifier' of type 'String'
     * This method should only be called by system code.
     * @private
     */
    private addIdentifierField;
    /**
     * Resolve the super type on this class and store it as an internal property.
     * @return {ClassDeclaration} The super type, or null if non specified.
     */
    _resolveSuperType(): ClassDeclaration;
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
     * Returns true if this class is declared as abstract in the model file
     *
     * @return {boolean} true if the class is abstract
     */
    isAbstract(): boolean;
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
     * Returns true if this class declaration declares an identifying field
     * (system or explicit)
     * @returns {Boolean} true if the class declaration includes an identifier
     */
    isIdentified(): boolean;
    /**
     * Returns true if this class declaration declares a system identifier
     * $identifier
     * @returns {Boolean} true if the class declaration includes a system identifier
     */
    isSystemIdentified(): boolean;
    /**
     * Returns true if this class declaration declares an explicit identifier
     * @returns {Boolean} true if the class declaration includes an explicit identifier
     */
    isExplicitlyIdentified(): boolean;
    /**
     * Returns the name of the identifying field for this class. Note
     * that the identifying field may come from a super type.
     *
     * @return {string} the name of the id field for this class or null if it does not exist
     */
    getIdentifierFieldName(): string;
    /**
     * Returns the field with a given name or null if it does not exist.
     * The field must be directly owned by this class -- the super-type is
     * not introspected.
     *
     * @param {string} name the name of the field
     * @return {Property} the field definition or null if it does not exist
     */
    getOwnProperty(name: string): Property;
    /**
     * Returns the fields directly defined by this class.
     *
     * @return {Property[]} the array of fields
     */
    getOwnProperties(): Property[];
    /**
     * Returns the FQN of the super type for this class or null if this
     * class does not have a super type.
     *
     * @return {string} the FQN name of the super type or null
     */
    getSuperType(): string;
    /**
     * Get the super type class declaration for this class.
     * @return {ClassDeclaration} the super type declaration, or null if there is no super type.
     */
    getSuperTypeDeclaration(): ClassDeclaration;
    /**
     * Get the class declarations for all subclasses of this class, including this class.
     * @return {ClassDeclaration[]} subclass declarations.
     */
    getAssignableClassDeclarations(): ClassDeclaration[];
    /**
     * Get the class declarations for just the direct subclasses of this class, excluding this class.
     * @return {ClassDeclaration[]} direct subclass declarations.
     */
    getDirectSubclasses(): ClassDeclaration[];
    /**
     * Get all the super-type declarations for this type.
     * @return {ClassDeclaration[]} super-type declarations.
     */
    getAllSuperTypeDeclarations(): ClassDeclaration[];
    /**
     * Returns the property with a given name or null if it does not exist.
     * Fields defined in super-types are also introspected.
     *
     * @param {string} name the name of the field
     * @return {Property} the field, or null if it does not exist
     */
    getProperty(name: string): Property;
    /**
     * Returns the properties defined in this class and all super classes.
     *
     * @return {Property[]} the array of fields
     */
    getProperties(): Property[];
    /**
     * Get a nested property using a dotted property path
     * @param {string} propertyPath The property name or name with nested structure e.g a.b.c
     * @returns {Property} the property
     * @throws {IllegalModelException} if the property path is invalid or the property does not exist
     */
    getNestedProperty(propertyPath: string): Property;
    /**
     * Returns true if this class is the definition of an asset.
     *
     * @return {boolean} true if the class is an asset
     */
    isAsset(): boolean;
    /**
     * Returns true if this class is the definition of a participant.
     *
     * @return {boolean} true if the class is an asset
     */
    isParticipant(): boolean;
    /**
     * Returns true if this class is the definition of a transaction.
     *
     * @return {boolean} true if the class is an asset
     */
    isTransaction(): boolean;
    /**
     * Returns true if this class is the definition of an event.
     *
     * @return {boolean} true if the class is an asset
     */
    isEvent(): boolean;
    /**
     * Returns true if this class is the definition of a concept.
     *
     * @return {boolean} true if the class is an asset
     */
    isConcept(): boolean;
    /**
     * Returns true if this class is the definition of a enum.
     *
     * @return {boolean} true if the class is an asset
     */
    isEnum(): boolean;
    /**
     * Returns true if this class is the definition of a enum.
     *
     * @return {boolean} true if the class is an asset
     */
    isClassDeclaration(): boolean;
}
import Decorated = require("./decorated");
import ModelFile = require("./modelfile");
import Property = require("./property");
