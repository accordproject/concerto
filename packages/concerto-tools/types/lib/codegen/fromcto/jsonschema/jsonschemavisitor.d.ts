export = JSONSchemaVisitor;
/**
 * Convert the contents of a {@link ModelManager} to a JSON Schema, returning
 * the schema for all types under the 'definitions' key. If the 'rootType'
 * parameter option is set to a fully-qualified type name, then the properties
 * of the type are also added to the root of the schema object.
 *
 * If the fileWriter parameter is set then the JSONSchema will be written to disk.
 *
 * Note that by default $ref is used to references types, unless
 * the `inlineTypes` parameter is set, in which case types are expanded inline,
 * UNLESS they contain recursive references, in which case $ref is used.
 *
 * The meta schema used is http://json-schema.org/draft-07/schema#
 *
 * @private
 * @class
 * @memberof module:concerto-tools
 */
declare class JSONSchemaVisitor {
    /**
     * Gets an object with all the decorators for a model element. The object
     * is keyed by decorator name, while the values are the decorator arguments.
     * @param {object} decorated a ClassDeclaration or a Property
     * @returns {object} the decorators
     */
    getDecorators(decorated: object): object;
    /**
     * Returns true if the class declaration contains recursive references.
     *
     * Basic example:
     * concept Person {
     *   o Person[] children
     * }
     *
     * @param {object} classDeclaration the class being visited
     * @returns {boolean} true if the model is recursive
     */
    isModelRecursive(classDeclaration: object): boolean;
    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @public
     */
    public visit(thing: any, parameters: any): any;
    /**
     * Visitor design pattern
     * @param {ModelManager} modelManager - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitModelManager;
    /**
     * Visitor design pattern
     * @param {ModelFile} modelFile - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitModelFile;
    /**
     * Visitor design pattern
     * @param {AssetDeclaration} assetDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitAssetDeclaration;
    /**
     * Visitor design pattern
     * @param {TransactionDeclaration} transactionDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitTransactionDeclaration;
    /**
     * Visitor design pattern
     * @param {ConceptDeclaration} conceptDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitConceptDeclaration;
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
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @param {Object} jsonSchema - the base JSON Schema object to use
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitClassDeclarationCommon;
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
     * @param {EnumValueDeclaration} enumValueDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitEnumValueDeclaration;
    /**
     * Visitor design pattern
     * @param {RelationshipDeclaration} relationshipDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitRelationshipDeclaration;
}
