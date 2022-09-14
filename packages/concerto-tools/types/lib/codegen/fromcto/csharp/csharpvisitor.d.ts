export = CSharpVisitor;
/**
 * Convert the contents of a ModelManager to C# code. Set a
 * fileWriter property (instance of FileWriter) on the parameters
 * object to control where the generated code is written to disk.
 *
 * @private
 * @class
 * @memberof module:concerto-tools
 */
declare class CSharpVisitor {
    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     */
    visit(thing: any, parameters: any): any;
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
     * Ensures that a concerto property name is valid in CSharp
     * @param {string} access the CSharp field access
     * @param {string|undefined} parentName the Concerto parent name
     * @param {string} propertyName the Concerto property name
     * @param {string} propertyType the Concerto property type
     * @param {string} array the array declaration
     * @param {string} getset the getter and setter declaration
     * @param {Object} [parameters]  - the parameter
     * @returns {string} the property declaration
     */
    toCSharpProperty(access: string, parentName: string | undefined, propertyName: string, propertyType: string, array: string, getset: string, parameters?: any): string;
    /**
     * Converts a Concerto namespace to a CSharp namespace. If pascal casing is enabled,
     * each component of the namespace is pascal cased - for example org.example will
     * become Org.Example, not OrgExample.
     * @param {string} ns the Concerto namespace
     * @param {object} [parameters] true to enable pascal casing
     * @param {boolean} [parameters.pascalCase] true to enable pascal casing
     * @return {string} the CSharp identifier
     * @private
     */
    private toCSharpNamespace;
    /**
     * Converts a Concerto name to a CSharp identifier. Internal names such
     * as $class, $identifier are prefixed with "_". Names matching C# keywords
     * such as class, namespace are prefixed with "_". If pascal casing is enabled,
     * the name is pascal cased.
     * @param {string|undefined} parentName the Concerto name of the parent type
     * @param {string} name the Concerto name
     * @param {object} [parameters] true to enable pascal casing
     * @param {boolean} [parameters.pascalCase] true to enable pascal casing
     * @return {string} the CSharp identifier
     * @private
     */
    private toCSharpIdentifier;
    /**
     * Converts a Concerto type to a CSharp type. Primitive types are converted
     * everything else is passed through unchanged.
     * @param {string} type  - the concerto type
     * @param {object} [parameters] true to enable pascal casing
     * @param {boolean} [parameters.pascalCase] true to enable pascal casing
     * @return {string} the corresponding type in CSharp
     * @private
     */
    private toCSharpType;
    /**
     * Get the .NET namespace for a given model file.
     * @private
     * @param {ModelFile} modelFile the model file
     * @param {object} [parameters] the parameters
     * @param {string} [parameters.namespacePrefix] the optional namespace prefix
     * @param {boolean} [parameters.pascalCase] the optional namespace prefix
     * @return {string} the .NET namespace for the model file
     */
    private getDotNetNamespace;
}
