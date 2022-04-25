export = Concerto;
/**
 * Runtime API for Concerto.
 *
 * @class
 * @memberof module:concerto-core
 */
declare class Concerto {
    /**
     * Create a Concerto instance.
     * @param {ModelManager} modelManager - The this.modelManager to use for validation etc.
     */
    constructor(modelManager: ModelManager);
    modelManager: ModelManager;
    /**
     * Validates the instance against its model.
     * @param {*} obj the input object
     * @param {*} [options] the validation options
     * @throws {Error} - if the instance if invalid with respect to the model
     */
    validate(obj: any, options?: any): void;
    /**
     * Returns the model manager
     * @returns {ModelManager} the model manager associated with this Concerto class
     */
    getModelManager(): ModelManager;
    /**
     * Returns true if the input object is a Concerto object
     * @param {*} obj the input object
     * @return {boolean} true if the object has a $class attribute
     */
    isObject(obj: any): boolean;
    /**
     * Returns the ClassDeclaration for an object, or throws an exception
     * @param {*} obj the input object
     * @throw {Error} an error if the object does not have a $class attribute
     * @return {*} the ClassDeclaration for the type
     */
    getTypeDeclaration(obj: any): any;
    /**
     * Gets the identifier for an object
     * @param {*} obj the input object
     * @return {string} The identifier for this object
     */
    getIdentifier(obj: any): string;
    /**
     * Returns true if the object has an identifier
     * @param {*} obj the input object
     * @return {boolean} is the object has been defined with an identifier in the model
     */
    isIdentifiable(obj: any): boolean;
    /**
     * Returns true if the object is a relationship. Relationships are strings
     * of the form: 'resource:org.accordproject.Order#001' (a relationship)
     * to the 'Order' identifiable, with the id 001.
     * @param {*} obj the input object
     * @return {boolean} true if the object is a relationship
     */
    isRelationship(obj: any): boolean;
    /**
     * Set the identifier for an object. This method does *not* mutate the
     * input object, use the return object.
     * @param {*} obj the input object
     * @param {string} id the new identifier
     * @returns {*} the input object with the identifier set
     */
    setIdentifier(obj: any, id: string): any;
    /**
     * Returns the fully qualified identifier for an object
     * @param {*} obj the input object
     * @returns {string} the fully qualified identifier
     */
    getFullyQualifiedIdentifier(obj: any): string;
    /**
     * Returns a URI for an object
     * @param {*} obj the input object
     * @return {string} the URI for the object
     */
    toURI(obj: any): string;
    /**
     * Parses a resource URI into typeDeclaration and id components.
     *
     * @param {string} uri the input URI
     * @returns {*} an object with typeDeclaration and id attributes
     * @throws {Error} if the URI is invalid or the type does not exist
     * in the model manager
     */
    fromURI(uri: string): any;
    /**
     * Returns the short type name
     * @param {*} obj the input object
     * @returns {string} the short type name
     */
    getType(obj: any): string;
    /**
     * Returns the namespace for the object
     * @param {*} obj the input object
     * @returns {string} the namespace
     */
    getNamespace(obj: any): string;
}
import ModelManager = require("./modelmanager");
