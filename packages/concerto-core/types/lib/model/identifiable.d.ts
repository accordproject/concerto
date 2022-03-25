export = Identifiable;
/**
 * Identifiable is an entity with a namespace, type and an identifier.
 * Applications should retrieve instances from {@link Factory}
 * This class is abstract.
 * @extends Typed
 * @abstract
 * @class
 * @memberof module:concerto-core
 */
declare class Identifiable extends Typed {
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
     * @param {string} id - The identifier of this instance.
     * @param {string} timestamp - The timestamp of this instance
     * @protected
     */
    protected constructor();
    $identifier: string;
    $timestamp: string;
    /**
     * Get the timestamp of this instance
     * @return {string} The timestamp for this object
     */
    getTimestamp(): string;
    /**
     * Get the identifier of this instance
     * @return {string} The identifier for this object
     */
    getIdentifier(): string;
    /**
     * Set the identifier of this instance
     * @param {string} id - the new identifier for this object
     */
    setIdentifier(id: string): void;
    /**
     * Get the fully qualified identifier of this instance.
     * (namespace '.' type '#' identifier).
     * @return {string} the fully qualified identifier of this instance
     */
    getFullyQualifiedIdentifier(): string;
    /**
     * Determine if this identifiable is a relationship.
     * @return {boolean} True if this identifiable is a relationship,
     * false if not.
     */
    isRelationship(): boolean;
    /**
     * Determine if this identifiable is a resource.
     * @return {boolean} True if this identifiable is a resource,
     * false if not.
     */
    isResource(): boolean;
    /**
     * Returns a URI representation of a reference to this identifiable
     * @return {String} the URI for the identifiable
     */
    toURI(): string;
}
import Typed = require("./typed");
