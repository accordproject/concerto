export = EventDeclaration;
/** Class representing the definition of an Event.
 * @extends ClassDeclaration
 * @see See  {@link ClassDeclaration}
 * @class
 * @memberof module:concerto-core
 */
declare class EventDeclaration {
    /**
     * Create an EventDeclaration.
     * @param {ModelFile} modelFile the ModelFile for this class
     * @param {Object} ast - The AST created by the parser
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
}
