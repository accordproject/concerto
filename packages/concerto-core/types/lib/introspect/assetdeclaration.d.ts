export = AssetDeclaration;
/**
 * AssetDeclaration defines the schema (aka model or class) for
 * an Asset. It extends ClassDeclaration which manages a set of
 * fields, a super-type and the specification of an
 * identifying field.
 *
 * @extends ClassDeclaration
 * @see See {@link ClassDeclaration}
 * @class
 * @memberof module:concerto-core
 */
declare class AssetDeclaration {
    /**
     * Create an AssetDeclaration.
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
