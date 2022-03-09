export = ParticipantDeclaration;
/** Class representing the definition of a Participant.
 * @extends ClassDeclaration
 * @see See  {@link ClassDeclaration}
 *
 * @class
 * @memberof module:concerto-core
 */
declare class ParticipantDeclaration {
    /**
     * Create an ParticipantDeclaration.
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
