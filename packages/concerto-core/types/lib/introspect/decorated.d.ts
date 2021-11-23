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
     * @param {ModelFile} modelFile - the model file
     * @param {string} ast - the AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile: ModelFile, ast: string);
    modelFile: ModelFile;
    ast: string;
    /**
     * Returns the ModelFile that defines this class.
     *
     * @return {ModelFile} the owning ModelFile
     */
    getModelFile(): ModelFile;
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
     * @throws {IllegalModelException}
     * @private
     */
    private validate;
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
import Decorator = require("./decorator");
