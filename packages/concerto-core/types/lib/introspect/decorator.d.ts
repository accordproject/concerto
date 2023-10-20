export = Decorator;
/**
 * Decorator encapsulates a decorator (annotation) on a class or property.
 * @class
 * @memberof module:concerto-core
 */
declare class Decorator {
    /**
     * Create a Decorator.
     * @param {ClassDeclaration | Property} parent - the owner of this property
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(parent: ClassDeclaration | Property, ast: any);
    ast: any;
    parent: ClassDeclaration | Property;
    arguments: any[];
    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private accept;
    /**
     * Returns the owner of this property
     * @return {ClassDeclaration|Property} the parent class or property declaration
     */
    getParent(): ClassDeclaration | Property;
    /**
     * Process the AST and build the model
     * @throws {IllegalModelException}
     * @private
     */
    private process;
    name: any;
    /**
     * Validate the property
     * @throws {IllegalModelException}
     * @private
     */
    private validate;
    /**
     * Returns the name of a decorator
     * @return {string} the name of this decorator
     */
    getName(): string;
    /**
     * Returns the arguments for this decorator
     * @return {object[]} the arguments for this decorator
     */
    getArguments(): object[];
    /**
     * Returns true if this class is the definition of a decorator.
     *
     * @return {boolean} true if the class is a decorator
     */
    isDecorator(): boolean;
}
import ClassDeclaration = require("./classdeclaration");
import Property = require("./property");
