export = ProtobufVisitor;
/**
 * Convert the contents of a {@link ModelManager} to Proto3 files.
 *
 * @private
 * @class
 * @memberof module:concerto-tools
 */
declare class ProtobufVisitor {
    /**
     * Transform a Concerto namespace (with a version) to a package name compliant with Proto 3.
     * @param {Object} concertoNamespace - the Concerto namespace
     * @return {Object} a package name compliant with Proto 3
     * @public
     */
    public concertoNamespaceToProto3SafePackageName(concertoNamespace: any): any;
    /**
     * Transform a Concerto meta property into a Proto3 field rule.
     * @param {Object} field - the Concerto meta property
     * @return {Object} the Proto3 field rule
     * @public
     */
    public concertoToProto3FieldRule(field: any): any;
    /**
     * Transform a Concerto primitive type into a Proto3 one.
     * @param {Object} field - the Concerto primitive type
     * @return {Object} the Proto3 primitive type
     * @public
     */
    public concertoToProto3PrimitiveType(field: any): any;
    /**
     * Transform Concerto class imports to Proto3 import line strings.
     * @param {Object[]} imports - the imports of a Concerto class
     * @return {string[]} an array of import line strings
     * @public
     */
    public createImportLineStrings(imports: any[]): string[];
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
     * @private
     */
    private visitModelManager;
    /**
     * Visitor design pattern
     * @param {ModelFile} modelFile - the object being visited
     * @param {Object} parameters - the parameter
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
     * Visit a Concerto class
     * @param {ClassDeclaration} classDeclaration - the Concerto class being visited
     * @param {Object} parameters - the parameters
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
