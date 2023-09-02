export = Decorated;
/**
 * Decorated defines a model element that may have decorators attached.
 *
 * @private
 * @abstract
 * @class
 * @memberof module:concerto-core
 */
declare class Decorated extends ModelElement {
    /**
     * Extracts the decorators applied to an AST.
     * @param {*} ast - the AST created by the parser
     * @param {ModelManager} modelManager - the ModelManager that supplies decorator factories
     * @returns {Decorator[]} the decorators
     */
    static processDecorators(ast: any, modelManager: ModelManager): Decorator[];
    /**
     * Create a Decorated from an Abstract Syntax Tree. The AST is the
     * result of parsing.
     * @param {ModelFile} modelFile - the ModelFile for this decorated
     * @param {*} ast - the AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile: ModelFile, ast: any);
    /**
     * Process the AST and build the model
     *
     * @throws {IllegalModelException}
     * @private
     */
    private process;
    decorators: Decorator[];
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
import ModelElement = require("./modelelement");
import Decorator = require("./decorator");
import ModelFile = require("./modelfile");
