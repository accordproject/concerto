export = RecursionDetectionVisitor;
/**
 * Detects whether ClassDeclaration contains recursive references.
 * Basic example:
 * concept Person {
 *   o Person[] children
 * }
 *
 * parameters.stack should be initialized to []
 * @private
 * @class
 * @memberof module:concerto-tools
 */
declare class RecursionDetectionVisitor {
    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visit;
    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitClassDeclaration;
    /**
     * Visitor design pattern
     * @param {Field} field - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitField;
    /**
     * Visitor design pattern
     * @param {EnumDeclaration} enumDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitEnumDeclaration;
    /**
     * Visitor design pattern
     * @param {RelationshipDeclaration} relationshipDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitRelationshipDeclaration;
}
