export = MermaidVisitor;
/**
 * Convert the contents of a ModelManager
 * to Mermaid format file.
 * Set a fileWriter property (instance of FileWriter) on the parameters
 * object to control where the generated code is written to disk.
 *
 * @private
 * @class
 */
declare class MermaidVisitor extends DiagramVisitor {
    /**
     * Visitor design pattern
     * @param {RelationshipDeclaration} relationship - the object being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    private visitRelationship;
    /**
     * Escape versions and periods.
     * @param {String} string - the object being visited
     * @return {String} string  - the parameter
     * @private
     */
    private escapeString;
}
import DiagramVisitor = require("../common/diagramvisitor");
