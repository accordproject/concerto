export = ConceptDeclaration;
/**
 * ConceptDeclaration defines the schema (aka model or class) for
 * an Concept. It extends ClassDeclaration which manages a set of
 * fields, a super-type and the specification of an
 * identifying field.
 *
 * @extends ClassDeclaration
 * @see {@link ClassDeclaration}
 * @class
 * @memberof module:concerto-core
 */
declare class ConceptDeclaration extends ClassDeclaration {
    /**
     * Create a ConceptDeclaration.
     * @param {ModelFile} modelFile the ModelFile for this class
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile: ModelFile, ast: any);
}
import ClassDeclaration = require("./classdeclaration");
import ModelFile = require("./modelfile");
