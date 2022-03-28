export = GoLangVisitor;
/**
 * Convert the contents of a ModelManager to Go Lang code.
 * All generated code is placed into the 'main' package. Set a
 * fileWriter property (instance of FileWriter) on the parameters
 * object to control where the generated code is written to disk.
 *
 * @private
 * @class
 * @memberof module:concerto-tools
 */
declare class GoLangVisitor {
    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @public
     */
    public visit(thing: any, parameters: any): any;
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
     * @param {EnumDeclaration} enumDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitEnumDeclaration;
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
     * Returns true if the ModelFile contains a class that has a DateTime
     * field.
     * @param {ModelFile} modelFile  - the modelFile
     * @return {boolean} true if the modelFile contains a class that contains
     * a field of type DateTime.
     * @private
     */
    private containsDateTimeField;
    /**
     * Converts a Concerto type to a Go Lang type. Primitive types are converted
     * everything else is passed through unchanged.
     * @param {string} type  - the concerto type
     * @return {string} the corresponding type in Go Lang
     * @private
     */
    private toGoType;
    /**
     * Converts a Concerto namespace to a Go package name.
     * @param {string} namespace  - the concerto type
     * @return {string} the corresponding package name in Go Lang
     * @private
     */
    private toGoPackageName;
}
