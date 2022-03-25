export = TransactionDeclaration;
/** Class representing the definition of an Transaction.
 * @extends ClassDeclaration
 * @see See  {@link ClassDeclaration}
 *
 * @class
 * @memberof module:concerto-core
 */
declare class TransactionDeclaration {
    /**
     * Create an TransactionDeclaration.
     * @param {ModelFile} modelFile the ModelFile for this class
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile: ModelFile, ast: any);
    /**
     * Returns the kind of declaration
     *
     * @return {string} what kind of declaration this is
     */
    declarationKind(): string;
}
import ModelFile = require("./modelfile");
