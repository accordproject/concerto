export = ModelUtil;
/**
 * Internal Model Utility Class
 * <p><a href="./diagrams-private/modelutil.svg"><img src="./diagrams-private/modelutil.svg" style="height:100%;"/></a></p>
 * @private
 * @class
 * @memberof module:concerto-core
 */
declare class ModelUtil {
    /**
     * Returns everything after the last dot, if present, of the source string
     * @param {string} fqn - the source string
     * @return {string} - the string after the last dot
     */
    static getShortName(fqn: string): string;
    /**
     * Returns the namespace for the fully qualified name of a type
     * @param {string} fqn - the fully qualified identifier of a type
     * @return {string} - namespace of the type (everything before the last dot)
     * or the empty string if there is no dot
     */
    static getNamespace(fqn: string): string;
    /**
     * @typedef ParseNamespaceResult
     * @property {string} name the name of the namespace
     * @property {string} escapedNamespace the escaped namespace
     * @property {string} version the version of the namespace
     * @property {object} versionParsed the parsed semantic version of the namespace
     */
    /**
     * Parses a potentially versioned namespace into
     * its name and version parts. The version of the namespace
     * (if present) is parsed using semver.parse.
     * @param {string} ns the namespace to parse
     * @param {object} [options] optional parsing options
     * @param {boolean} [options.disableVersionValidation] if false, the version will be validated
     * @returns {ParseNamespaceResult} the result of parsing
     */
    static parseNamespace(ns: string, options?: {
        disableVersionValidation?: boolean;
    }): {
        /**
         * the name of the namespace
         */
        name: string;
        /**
         * the escaped namespace
         */
        escapedNamespace: string;
        /**
         * the version of the namespace
         */
        version: string;
        /**
         * the parsed semantic version of the namespace
         */
        versionParsed: object;
    };
    /**
     * Return the fully qualified name for an import
     * @param {object} imp - the import
     * @return {string[]} - the fully qualified names for that import
     * @private
     */
    private static importFullyQualifiedNames;
    /**
     * Returns true if the type is a primitive type
     * @param {string} typeName - the name of the type
     * @return {boolean} - true if the type is a primitive
     * @private
     */
    private static isPrimitiveType;
    /**
     * Returns true if the type is assignable to the propertyType.
     *
     * @param {ModelFile} modelFile - the ModelFile that owns the Property
     * @param {string} typeName - the FQN of the type we are trying to assign
     * @param {Property} property - the property that we'd like to store the
     * type in.
     * @return {boolean} - true if the type can be assigned to the property
     * @private
     */
    private static isAssignableTo;
    /**
     * Returns the passed string with the first character capitalized
     * @param {string} string - the string
     * @return {string} the string with the first letter capitalized
     * @private
     */
    private static capitalizeFirstLetter;
    /**
     * Returns true if the given field is an enumerated type
     * @param {Field} field - the string
     * @return {boolean} true if the field is declared as an enumeration
     * @private
     */
    private static isEnum;
    /**
     * Returns true if the given field is an map type
     * @param {Field} field - the string
     * @return {boolean} true if the field is declared as an map
     * @private
     */
    private static isMap;
    /**
     * Returns true if the given field is a Scalar type
     * @param {Field} field - the Field to test
     * @return {boolean} true if the field is declared as an scalar
     * @private
     */
    private static isScalar;
    /**
     * Return true if the name is a valid Concerto identifier
     * @param {string} name - the name of the identifier to test.
     * @returns {boolean} true if the identifier is valid.
     */
    static isValidIdentifier(name: string): boolean;
    /**
     * Get the fully qualified name of a type.
     * @param {string} namespace - namespace of the type.
     * @param {string} type - short name of the type.
     * @returns {string} the fully qualified type name.
     */
    static getFullyQualifiedName(namespace: string, type: string): string;
    /**
     * Converts a fully qualified type name to a FQN without a namespace version.
     * If the FQN is a primitive type it is returned unchanged.
     * @param {string} fqn fully qualified name of a type
     * @returns {string} the fully qualified name minus the namespace version
     */
    static removeNamespaceVersionFromFullyQualifiedName(fqn: string): string;
    /**
     * Returns true if the property is a system property.
     * System properties are not declared in the model.
     * @param {String} propertyName - the name of the property
     * @return {Boolean} true if the property is a system property
     * @private
     */
    private static isSystemProperty;
    /**
     * Returns true if the property is an system property that can be set in serialized JSON.
     * System properties are not declared in the model.
     * @param {String} propertyName - the name of the property
     * @return {Boolean} true if the property is a system property
     * @private
     */
    private static isPrivateSystemProperty;
    /**
     * Returns true if this Key is a valid Map Key.
     *
     * @param {Object} key - the Key of the Map Declaration
     * @return {boolean} true if the Key is a valid Map Key
    */
    static isValidMapKey(key: any): boolean;
    /**
     * Returns true if this Key is a valid Map Key Scalar Value.
     *
     * @param {Object} decl - the Map Key Scalar declaration
     * @return {boolean} true if the Key is a valid Map Key Scalar type
    */
    static isValidMapKeyScalar(decl: any): boolean;
    /**
     * Returns true if this Value is a valid Map Value.
     *
     * @param {Object} value - the Value of the Map Declaration
     * @return {boolean} true if the Value is a valid Map Value
     */
    static isValidMapValue(value: any): boolean;
}
