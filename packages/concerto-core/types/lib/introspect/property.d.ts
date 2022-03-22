export = Property;
/**
 * Property representing an attribute of a class declaration,
 * either a Field or a Relationship.
 *
 * @class
 * @memberof module:concerto-core
 */
declare class Property extends Decorated {
    /**
     * Create a Property.
     * @param {ClassDeclaration} parent - the owner of this property
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(parent: ClassDeclaration, ast: any);
    parent: ClassDeclaration;
    /**
     * Returns the owner of this property
     * @return {ClassDeclaration} the parent class declaration
     */
    getParent(): ClassDeclaration;
    name: any;
    decorator: any;
    type: any;
    array: boolean;
    optional: boolean;
    /**
     * Validate the property
     * @param {ClassDeclaration} classDecl the class declaration of the property
     * @throws {IllegalModelException}
     * @private
     */
    private validate;
    /**
     * Returns the name of a property
     * @return {string} the name of this field
     */
    getName(): string;
    /**
     * Returns the type of a property
     * @return {string} the type of this field
     */
    getType(): string;
    /**
     * Returns true if the field is optional
     * @return {boolean} true if the field is optional
     */
    isOptional(): boolean;
    /**
     * Returns the fully qualified type name of a property
     * @return {string} the fully qualified type of this property
     */
    getFullyQualifiedTypeName(): string;
    /**
     * Returns the fully name of a property (ns + class name + property name)
     * @return {string} the fully qualified name of this property
     */
    getFullyQualifiedName(): string;
    /**
     * Returns the namespace of the parent of this property
     * @return {string} the namespace of the parent of this property
     */
    getNamespace(): string;
    /**
     * Returns true if the field is declared as an array type
     * @return {boolean} true if the property is an array type
     */
    isArray(): boolean;
    /**
     * Returns true if the field is declared as an enumerated value
     * @return {boolean} true if the property is an enumerated value
     */
    isTypeEnum(): boolean;
    /**
     * Returns true if this property is a primitive type.
     * @return {boolean} true if the property is a primitive type.
     */
    isPrimitive(): boolean;
}
import Decorated = require("./decorated");
