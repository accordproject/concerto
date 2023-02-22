export = OpenApiVisitor;
/**
 * Convert the contents of an OpenAPI definition file to a Concerto JSON model.
 * Set the following parameters to use:
 * - metaModelNamespace: the current metamodel namespace.
 * - namespace: the desired namespace of the generated model.
 *
 * @private
 * @class
 */
declare class OpenApiVisitor {
    /**
     * Create an OpenAPI definition class, used to start the inference into
     * Concerto JSON.
     * @param {Object} openApiDefinition - the OpenAPI definition.
     *
     * @return {Object} the result of visiting or undefined.
     * @public
     */
    public static infer(openApiDefinition: any): any;
    /**
     * OpenAPI definition visitor.
     * @param {Object} openApiDefinition - the OpenAPI definition.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the Concerto JSON model.
     * @private
     */
    private visitOpenApiDefinition;
    /**
     * Visitor dispatch i.e. main entry point to this visitor.
     * @param {Object} thing - the visited entity.
     * @param {Object} parameters - the visitor parameters.
     * Set the following parameters to use:
     * - metaModelNamespace: the current metamodel namespace.
     * - namespace: the desired namespace of the generated model.
     *
     * @return {Object} the result of visiting or undefined.
     * @public
     */
    public visit(thing: any, parameters: any): any;
}
