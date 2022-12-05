export = OpenApiVisitor;
/**
 * Convert the contents of a ModelManager
 * to an Open API 3.0.2 specification document, where
 * each concept declaration with a @resource decorator
 * becomes a RESTful resource addressable via a path.
 *
 * The JSON schema for the types is included in the
 * Open API document and is used to validate request and
 * response bodies.
 *
 * @private
 * @class
 */
declare class OpenApiVisitor {
    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters  - the parameters
     * @param {string} [parameters.openApiTitle] - the title property
     * of the Open API specification
     * @param {string} [parameters.openApiVersion] - the version property
     * of the Open API specification
     * @return {Object} the result of visiting or null
     * @private
     */
    private visit;
    /**
     * Visitor design pattern
     * @param {ModelManager} modelManager - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitModelManager;
    /**
     * Visitor design pattern
     * @param {ModelFile} modelFile - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitModelFile;
    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitClassDeclaration;
}
