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
     * Transform a Concerto class or enum type into a Proto3 message or enum one.
     * @param {Object} field - the Concerto class or enum type
     * @return {Object} the Proto3 message or enum type
     * @public
     */
    public concertoToProto3MessageOrEnumType(field: any): any;
    /**
     * Transform Concerto class imports to Proto3 import line strings.
     * @param {Object[]} imports - the imports of a Concerto class
     * @return {string[]} an array of import line strings
     * @public
     */
    public createImportLineStrings(imports: any[]): string[];
    /**
     * Recursively get the names of the subclasses of a class.
     * @param {Object} classDeclaration - the class declaration object
     * @return {String[]} an array of the names of the subclasses of the class
     * @public
     */
    public getNamesOfSubclassesOfClassRecursively(classDeclaration: any): string[];
    /**
     * Recursively get the names of the subclasses of a class that are not abstract.
     * @param {Object} classDeclaration - the class declaration object
     * @return {String[]} an array of the names of the nonabstract subclasses of the class
     * @public
     */
    public getNamesOfNonabstractSubclassesOfClassRecursively(classDeclaration: any): string[];
    /**
     * Recursively check if a class has subclasses.
     * @param {Object} classDeclaration - the class declaration object
     * @return {Boolean} whether or not the class has subclasses
     * @public
     */
    public doesClassHaveSubclassesRecursively(classDeclaration: any): boolean;
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
     * @param {Object} modelManager - the object being visited
     * @param {Object} parameters - the parameter
     * @private
     */
    private visitModelManager;
    /**
     * Visitor design pattern
     * @param {Object} modelFile - the object being visited
     * @param {Object} parameters - the parameter
     * @private
     */
    private visitModelFile;
    /**
     * Visitor design pattern
     * @param {Object} assetDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitAssetDeclaration;
    /**
     * Visitor design pattern
     * @param {Object} transactionDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitTransactionDeclaration;
    /**
     * Visitor design pattern
     * @param {Object} conceptDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitConceptDeclaration;
    /**
     * Visitor design pattern
     * @param {Object} classDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitClassDeclaration;
    /**
     * Visit a Concerto class
     * @param {Object} classDeclaration - the Concerto class being visited
     * @param {Object} parameters - the parameters
     * @private
     */
    private visitClassDeclarationCommon;
    /**
     * Visitor design pattern
     * @param {Object} field - the object being visited
     * @param {Object} parameters - the parameter
     * @private
     */
    private visitField;
    /**
     * Visitor design pattern
     * @param {Object} enumDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @private
     */
    private visitEnumDeclaration;
    /**
     * Visitor design pattern
     * @param {Object} enumValueDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @private
     */
    private visitEnumValueDeclaration;
    /**
     * Visitor design pattern
     * @param {Object} relationshipDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @private
     */
    private visitRelationshipDeclaration;
}
