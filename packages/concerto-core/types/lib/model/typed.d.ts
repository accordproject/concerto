export = Typed;
/**
 * Object is an instance with a namespace and a type.
 *
 * This class is abstract.
 * @abstract
 * @class
 * @memberof module:concerto-core
 */
declare class Typed {
    /**
     * Create an instance.
     * <p>
     * <strong>Note: Only to be called by framework code. Applications should
     * retrieve instances from {@link Factory}</strong>
     * </p>
     *
     * @param {ModelManager} modelManager - The ModelManager for this instance
     * @param {ClassDeclaration} classDeclaration - The class declaration for this instance.
     * @param {string} ns - The namespace this instance.
     * @param {string} type - The type this instance.
     * @private
     */
    private constructor();
    $modelManager: ModelManager;
    $classDeclaration: ClassDeclaration;
    $namespace: string;
    $type: string;
    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private accept;
    /**
     * Get the ModelManager for this instance
     * @return {ModelManager} The ModelManager for this object
     * @private
     */
    private getModelManager;
    /**
     * Get the type of the instance (a short name, not including namespace).
     * @return {string} The type of this object
     */
    getType(): string;
    /**
     * Get the fully-qualified type name of the instance (including namespace).
     * @return {string} The fully-qualified type name of this object
     */
    getFullyQualifiedType(): string;
    /**
     * Get the namespace of the instance.
     * @return {string} The namespace of this object
     */
    getNamespace(): string;
    /**
     * Returns the class declaration for this instance object.
     *
     * @return {ClassDeclaration} - the class declaration for this instance
     * @private
     */
    private getClassDeclaration;
    /**
     * Sets a property on this Resource
     * @param {string} propName - the name of the field
     * @param {string} value - the value of the property
     */
    setPropertyValue(propName: string, value: string): void;
    /**
     * Adds a value to an array property on this Resource
     * @param {string} propName - the name of the field
     * @param {string} value - the value of the property
     */
    addArrayValue(propName: string, value: string): void;
    /**
     * Sets the fields to their default values, based on the model
     * @private
     */
    private assignFieldDefaults;
    /**
     * Check to see if this instance is an instance of the specified fully qualified
     * type name.
     * @param {String} fqt The fully qualified type name.
     * @returns {boolean} True if this instance is an instance of the specified fully
     * qualified type name, false otherwise.
     */
    instanceOf(fqt: string): boolean;
    /**
     * Overriden to prevent people accidentally converting a resource to JSON
     * without using the Serializer.
     * @private
     */
    private toJSON;
}
