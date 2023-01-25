export = PlantUMLVisitor;
/**
 * Convert the contents of a ModelManager
 * to PlantUML format files.
 * Set a fileWriter property (instance of FileWriter) on the parameters
 * object to control where the generated code is written to disk.
 *
 * @private
 * @class
 * @memberof module:concerto-tools
 */
declare class PlantUMLVisitor extends DiagramVisitor {
    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    private visitClassDeclaration;
    /**
     * Write a class declaration
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @param {string} [style] - the style for the prototype (optional)
     * @private
     */
    private writeDeclaration;
    /**
     * Escape versions and periods.
     * @param {String} string - the object being visited
     * @return {String} string  - the parameter
     * @private
     */
    private escapeString;
}
import DiagramVisitor = require("../common/diagramvisitor");
