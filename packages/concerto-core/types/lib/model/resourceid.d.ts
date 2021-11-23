export = ResourceId;
/**
 * All the identifying properties of a resource.
 * @private
 * @class
 * @memberof module:concerto-core
 * @property {String} namespace
 * @property {String} type
 * @property {String} id
 */
declare class ResourceId {
    /**
     * Parse a URI into an identifier.
     * <p>
     * Three formats are allowable:
     * <ol>
     *   <li>Valid resource URI argument: <em>resource:qualifiedTypeName#ID</em></li>
     *   <li>Valid resource URI argument with missing URI scheme: <em>qualifiedTypeName#ID</em></li>
     *   <li>URI argument containing only an ID, with legacy namespace and type arguments supplied.</li>
     * </ol>
     * @param {String} uri - Resource URI.
     * @param {String} [legacyNamespace] - Namespace to use for legacy resource identifiers.
     * @param {String} [legacyType] - Type to use for legacy resource identifiers.
     * @return {Identifier} - An identifier.
     * @throws {Error} - On an invalid resource URI.
     */
    static fromURI(uri: string, legacyNamespace?: string, legacyType?: string): Identifier;
    /**
     * <strong>Note: only for use by internal framework code.</strong>
     * @param {String} namespace - Namespace containing the type.
     * @param {String} type - Short type name.
     * @param {String} id - Instance identifier.
     * @private
     */
    private constructor();
    namespace: string;
    type: string;
    id: string;
    /**
     * URI representation of this identifier.
     * @return {String} A URI.
     */
    toURI(): string;
}
