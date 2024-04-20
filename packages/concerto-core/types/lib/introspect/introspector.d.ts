export = Introspector;
/**
 *
 * Provides access to the structure of transactions, assets and participants.
 *
 * @class
 * @memberof module:concerto-core
 */
declare class Introspector {
    /**
     * Create the Introspector.
     * @param {ModelManager} modelManager - the ModelManager that backs this Introspector
     */
    constructor(modelManager: ModelManager);
    modelManager: ModelManager;
    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     */
    accept(visitor: any, parameters: any): any;
    /**
     * Returns all the class declarations for the business network.
     * @return {ClassDeclaration[]} the array of class declarations
     */
    getClassDeclarations(): ClassDeclaration[];
    /**
     * Returns the class declaration with the given fully qualified name.
     * Throws an error if the class declaration does not exist.
     * @param {String} fullyQualifiedTypeName  - the fully qualified name of the type
     * @return {ClassDeclaration} the class declaration
     * @throws {Error} if the class declaration does not exist
     */
    getClassDeclaration(fullyQualifiedTypeName: string): ClassDeclaration;
    /**
     * Returns the backing ModelManager
     * @return {ModelManager} the backing ModelManager
     * @private
     */
    private getModelManager;
}
import ModelManager = require("../modelmanager");
import ClassDeclaration = require("./classdeclaration");
