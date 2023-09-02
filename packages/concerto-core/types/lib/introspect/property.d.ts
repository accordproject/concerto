export = Property;
/**
 * Property representing an attribute of a class declaration,
 * either a Field or a Relationship. Properties may be array or be optional.
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
    decorator: any;
    propertyType: any;
    array: boolean;
    optional: boolean;
    /**
     * Validate the property
     * @param {ClassDeclaration} classDecl the class declaration of the property
     * @throws {IllegalModelException}
     * @protected
     */
    protected validate(classDecl: ClassDeclaration): void;
    /**
     * Returns the type of a property. This will return either: a primitive type
     * name (String, Boolean, Integer etc) or the name of a non-primitive type,
     * or will return null if this is an enum property.
     *
     * Note this is NOT the same as getMetaType() which returns the meta type for the property.
     * @return {string|null} the type of this property or null if this is an enum property
     */
    getPropertyType(): string | null;
    /**
     * Returns true if the field is optional
     * @return {boolean} true if the property is optional
     */
    isOptional(): boolean;
    /**
     * Returns the fully qualified type name of a property
     * @return {string} the fully qualified type of this property
     */
    getFullyQualifiedTypeName(): string;
    /**
     * Returns true if the field is declared as an array type
     * @return {boolean} true if the property is an array type
     */
    isArray(): boolean;
    /**
     * Returns true if the field is declared as an enumerated value
     * @deprecated replaced by isPropertyEnum()
     * @return {boolean} true if the property is an enumerated value
     */
    isTypeEnum(): boolean;
    /**
     * Returns true if the field is declared as an enumerated value
     * @return {boolean} true if the property is an enumerated value
     */
    isPropertyEnum(): boolean;
    /**
     * Returns true if this property is a primitive type.
     * @return {boolean} true if the property is a primitive type.
     */
    isPrimitive(): boolean;
}
import Decorated = require("./decorated");
import ClassDeclaration = require("./classdeclaration");
