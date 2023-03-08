export = MermaidVisitor;
/**
 * Convert the contents of a ModelManager
 * to Mermaid format file.
 * Set a fileWriter property (instance of FileWriter) on the parameters
 * object to control where the generated code is written to disk.
 *
 * @protected
 * @class
 */
declare class MermaidVisitor extends DiagramVisitor {
    /**
     * Visitor design pattern
     * @param {ModelManager} modelManager - the object being visited
     * @param {Object} parameters  - the parameter
     * @protected
     */
    protected visitModelManager(modelManager: ModelManager, parameters: any): void;
    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @param {string} type  - the type of the declaration
     * @protected
     */
    protected visitClassDeclaration(classDeclaration: ClassDeclaration, parameters: any, type?: string): void;
    /**
     * Visitor design pattern
     * @param {RelationshipDeclaration} relationship - the object being visited
     * @param {Object} parameters  - the parameter
     * @protected
     */
    protected visitRelationship(relationship: RelationshipDeclaration, parameters: any): void;
    /**
     * Escape versions and periods.
     * @param {String} string - the object being visited
     * @return {String} string  - the parameter
     * @protected
     */
    protected escapeString(string: string): string;
}
import DiagramVisitor = require("../../../common/diagramvisitor");
