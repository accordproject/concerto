export = InstanceGenerator;
/**
 * Generate sample instance data for the specified class declaration
 * and resource instance. The specified resource instance will be
 * updated with either default values or generated sample data.
 * @private
 * @class
 * @memberof module:concerto-core
 */
declare class InstanceGenerator {
    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visit;
    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitClassDeclaration;
    /**
     * Visitor design pattern
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitField;
    /**
     * Get a value for the specified field.
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {*} A value for the specified field.
     */
    getFieldValue(field: Field, parameters: any): any;
    /**
     * Find a concrete type that extends the provided type. If the supplied type argument is
     * not abstract then it will be returned.
     * TODO: work out whether this has to be a leaf node or whether the closest type can be used
     * It depends really since the closest type will satisfy the model but whether it satisfies
     * any transaction code which attempts to use the generated resource is another matter.
     * @param {ClassDeclaration} declaration the class declaration.
     * @return {ClassDeclaration} the closest extending concrete class definition.
     * @throws {Error} if no concrete subclasses exist.
     */
    findConcreteSubclass(declaration: ClassDeclaration): ClassDeclaration;
    /**
     * Visitor design pattern
     * @param {RelationshipDeclaration} relationshipDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Relationship} the result of visiting
     * @private
     */
    private visitRelationshipDeclaration;
    /**
     * Generate a random ID for a given type.
     * @private
     * @param {ClassDeclaration} classDeclaration - class declaration for a type.
     * @return {String} an ID.
     */
    private generateRandomId;
}
