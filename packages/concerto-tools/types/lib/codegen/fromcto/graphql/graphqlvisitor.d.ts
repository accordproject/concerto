export = GraphQLVisitor;
/**
* Convert the contents of a ModelManager to GraphQL types, based on
* the https://spec.graphql.org/June2018/ specification.
* Set a fileWriter property (instance of FileWriter) on the parameters
* object to control where the generated code is written to disk.
*
* @private
* @class
* @memberof module:concerto-tools
*/
declare class GraphQLVisitor {
    /**
    * Constructor.
    * @param {boolean} [namespaces] - whether or not namespaces should be used.
    */
    constructor(namespaces?: boolean);
    namespaces: boolean;
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
    /**
    * Visitor design pattern
    * @param {Field} field - the object being visited
    * @param {Object} parameters  - the parameter
    * @return {Object} the result of visiting or null
    * @private
    */
    private visitField;
    /**
    * Visitor design pattern
    * @param {EnumValueDeclaration} enumValueDeclaration - the object being visited
    * @param {Object} parameters  - the parameter
    * @return {Object} the result of visiting or null
    * @private
    */
    private visitEnumValueDeclaration;
    /**
    * Visitor design pattern
    * @param {Relationship} relationship - the object being visited
    * @param {Object} parameters  - the parameter
    * @return {Object} the result of visiting or null
    * @private
    */
    private visitRelationship;
    /**
    * Converts a Decorator to a GraphQL directive string, to be placed
    * on a type or a field
    * @param {Decorator} decorator - the decorator
    * @param {Object} parameters  - the parameters
    * @return {String} the decorator as a GraphQL string
    * @private
    */
    private decoratorAsString;
    /**
    * Converts a Decorator to the definition of a directive
    * that can be placed on an OBJECT or a FIELD_DEFINTION. Concerto doesn't
    * have a model for Decorators, so we have to infer one from an instance.
    * We use the last instance in the file to infer a model. :-/
    * @param {Decorator} decorator - the decorator
    * @param {Object} parameters  - the parameters
    * @return {String} the decorator as a GraphQL directive string
    * @private
    */
    private decoratorAsDirectiveString;
    /**
    * @param {Decorator[]} decorators - the decorators
    * @param {Object} parameters  - the parameters
    * @return {String} the decorators as a GraphQL string
    * @private
    */
    private decoratorsAsString;
    /**
     * Converts a Concerto type to a GraphQL type
     * @param {string} type the Concerto type
     * @returns {string} the GraphQL type
     */
    toGraphQLType(type: string): string;
    /**
     * Escapes characters in a Concerto name to make them legal in GraphQL
     * @param {string} name Concerto name
     * @returns {string} a GraphQL legal name
     */
    toGraphQLName(name: string): string;
}
