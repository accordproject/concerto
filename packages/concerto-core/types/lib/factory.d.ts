export = Factory;
/**
 * Use the Factory to create instances of Resource: transactions, participants
 * and assets.
 *
 * @class
 * @memberof module:concerto-core
 */
declare class Factory {
    /**
     * Create a new ID for an object.
     * @returns {string} a new ID
     */
    static newId(): string;
    /**
     * Create the factory.
     *
     * @param {ModelManager} modelManager - The ModelManager to use for this registry
     */
    constructor(modelManager: ModelManager);
    modelManager: ModelManager;
    /**
     * Create a new Resource with a given namespace, type name and id
     * @param {String} ns - the namespace of the Resource
     * @param {String} type - the type of the Resource
     * @param {String} [id] - an optional string identifier
     * @param {Object} [options] - an optional set of options
     * @param {boolean} [options.disableValidation] - pass true if you want the factory to
     * return a {@link Resource} instead of a {@link ValidatedResource}. Defaults to false.
     * @param {String} [options.generate] - Pass one of: <dl>
     * <dt>sample</dt><dd>return a resource instance with generated sample data.</dd>
     * <dt>empty</dt><dd>return a resource instance with empty property values.</dd></dl>
     * @param {boolean} [options.includeOptionalFields] - if <code>options.generate</code>
     * is specified, whether optional fields should be generated.
     * @return {Resource} the new instance
     * @throws {TypeNotFoundException} if the type is not registered with the ModelManager
     */
    newResource(ns: string, type: string, id?: string, options?: {
        disableValidation?: boolean;
        generate?: string;
        includeOptionalFields?: boolean;
    }): Resource;
    /**
     * Create a new Concept with a given namespace and type name
     * @param {String} ns - the namespace of the Concept
     * @param {String} type - the type of the Concept
     * @param {String} [id] - an optional string identifier
     * @param {Object} [options] - an optional set of options
     * @param {boolean} [options.disableValidation] - pass true if you want the factory to
     * return a {@link Concept} instead of a {@link ValidatedConcept}. Defaults to false.
     * @param {String} [options.generate] - Pass one of: <dl>
     * <dt>sample</dt><dd>return a resource instance with generated sample data.</dd>
     * <dt>empty</dt><dd>return a resource instance with empty property values.</dd></dl>
     * @param {boolean} [options.includeOptionalFields] - if <code>options.generate</code>
     * is specified, whether optional fields should be generated.
     * @return {Resource} the new instance
     * @throws {TypeNotFoundException} if the type is not registered with the ModelManager
     */
    newConcept(ns: string, type: string, id?: string, options?: {
        disableValidation?: boolean;
        generate?: string;
        includeOptionalFields?: boolean;
    }): Resource;
    /**
     * Create a new Relationship with a given namespace, type and identifier.
     * A relationship is a typed pointer to an instance. I.e the relationship
     * with `namespace = 'org.example'`, `type = 'Vehicle'` and `id = 'ABC' creates`
     * a pointer that points at an instance of org.example.Vehicle with the id
     * ABC.
     *
     * @param {String} ns - the namespace of the Resource
     * @param {String} type - the type of the Resource
     * @param {String} id - the identifier
     * @return {Relationship} - the new relationship instance
     * @throws {TypeNotFoundException} if the type is not registered with the ModelManager
     */
    newRelationship(ns: string, type: string, id: string): Relationship;
    /**
     * Create a new transaction object. The identifier of the transaction is set to a UUID.
     * @param {String} ns - the namespace of the transaction.
     * @param {String} type - the type of the transaction.
     * @param {String} [id] - an optional string identifier
     * @param {Object} [options] - an optional set of options
     * @param {String} [options.generate] - Pass one of: <dl>
     * <dt>sample</dt><dd>return a resource instance with generated sample data.</dd>
     * <dt>empty</dt><dd>return a resource instance with empty property values.</dd></dl>
     * @param {boolean} [options.includeOptionalFields] - if <code>options.generate</code>
     * is specified, whether optional fields should be generated.
     * @return {Resource} A resource for the new transaction.
     */
    newTransaction(ns: string, type: string, id?: string, options?: {
        generate?: string;
        includeOptionalFields?: boolean;
    }): Resource;
    /**
     * Create a new event object. The identifier of the event is
     * set to a UUID.
     * @param {String} ns - the namespace of the event.
     * @param {String} type - the type of the event.
     * @param {String} [id] - an optional string identifier
     * @param {Object} [options] - an optional set of options
     * @param {String} [options.generate] - Pass one of: <dl>
     * <dt>sample</dt><dd>return a resource instance with generated sample data.</dd>
     * <dt>empty</dt><dd>return a resource instance with empty property values.</dd></dl>
     * @param {boolean} [options.includeOptionalFields] - if <code>options.generate</code>
     * is specified, whether optional fields should be generated.
     * @return {Resource} A resource for the new event.
     */
    newEvent(ns: string, type: string, id?: string, options?: {
        generate?: string;
        includeOptionalFields?: boolean;
    }): Resource;
    /**
     * PRIVATE IMPLEMENTATION. DO NOT CALL FROM OUTSIDE THIS CLASS.
     *
     * Initialize the state of a newly created resource
     * @private
     * @param {Typed} newObject - resource to initialize.
     * @param {ClassDeclaration} classDeclaration - class declaration for the resource.
     * @param {Object} clientOptions - field generation options supplied by the caller.
     */
    private initializeNewObject;
    /**
     * PRIVATE IMPLEMENTATION. DO NOT CALL FROM OUTSIDE THIS CLASS.
     *
     * Parse the client-supplied field generation options and return a corresponding set of InstanceGenerator
     * options that can be used to initialize a resource.
     * @private
     * @param {Object} clientOptions - field generation options supplied by the caller.
     * @return {Object} InstanceGenerator options.
     */
    private parseGenerateOptions;
}
import Resource = require("./model/resource");
import Relationship = require("./model/relationship");
