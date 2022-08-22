export = Decorated;
/**
 * Decorated defines a model element that may have decorators attached.
 *
 * @private
 * @abstract
 * @class
 * @memberof module:concerto-core
 */
declare class Decorated {
    /**
     * Create a Decorated from an Abstract Syntax Tree. The AST is the
     * result of parsing.
     *
     * @param {string} ast - the AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(ast: string);
    ast: string;
    /**
     * Returns the ModelFile that defines this class.
     *
     * @abstract
     * @protected
     * @return {ModelFile} the owning ModelFile
     */
    protected getModelFile(): ModelFile;
    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private accept;
    /**
     * Process the AST and build the model
     *
     * @throws {IllegalModelException}
     * @private
     */
    private process;
    decorators: any[];
    /**
     * Semantic validation of the structure of this decorated. Subclasses should
     * override this method to impose additional semantic constraints on the
     * contents/relations of fields.
     *
     * @param {...*} args the validation arguments
     * @throws {IllegalModelException}
     * @protected
     */
    protected validate(...args: any[]): void;
    /**
     * Returns the decorators for this class.
     *
     * @return {Decorator[]} the decorators for the class
     */
    getDecorators(): Decorator[];
    /**
     * Returns the decorator for this class with a given name.
     * @param {string} name  - the name of the decorator
     * @return {Decorator} the decorator attached to this class with the given name, or null if it does not exist.
     */
    getDecorator(name: string): Decorator;
}
import ModelFile = require("./modelfile");
import Decorator = require("./decorator");
