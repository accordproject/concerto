export = Decorator;
/**
 * Decorator encapsulates a decorator (annotation) on a class or property.
 * @class
 * @memberof module:concerto-core
 */
declare class Decorator {
    /**
     * Create a Decorator.
     * @param {ModelElement} parent - the owner of this property
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(parent: ModelElement, ast: any);
    ast: any;
    parent: ModelElement;
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
     * @return {ModelElement} the parent model element
     */
    getParent(): ModelElement;
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
import ModelElement = require("./modelelement");
