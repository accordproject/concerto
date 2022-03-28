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
    constructor(parent: Property | ClassDeclaration, ast: any);
    ast: any;
    parent: Property | ClassDeclaration;
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
    getParent(): Property | ClassDeclaration;
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
}
import Property = require("./property");
import ClassDeclaration = require("./classdeclaration");
