export = Serializer;
/**
 * Serialize Resources instances to/from various formats for long-term storage
 * (e.g. on the blockchain).
 *
 * @class
 * @memberof module:concerto-core
 */
declare class Serializer {
    /**
     * Create a Serializer.
     * @param {Factory} factory - The Factory to use to create instances
     * @param {ModelManager} modelManager - The ModelManager to use for validation etc.
     * @param {object} [options] - Serializer options
     */
    constructor(factory: Factory, modelManager: ModelManager, options?: object);
    factory: Factory;
    modelManager: ModelManager;
    defaultOptions: any;
    /**
     * Set the default options for the serializer.
     * @param {Object} newDefaultOptions The new default options for the serializer.
     */
    setDefaultOptions(newDefaultOptions: any): void;
    /**
     * <p>
     * Convert a {@link Resource} to a JavaScript object suitable for long-term
     * peristent storage.
     * </p>
     * @param {Resource} resource - The instance to convert to JSON
     * @param {Object} [options] - the optional serialization options.
     * @param {boolean} [options.validate] - validate the structure of the Resource
     * with its model prior to serialization (default to true)
     * @param {boolean} [options.convertResourcesToRelationships] - Convert resources that
     * are specified for relationship fields into relationships, false by default.
     * @param {boolean} [options.permitResourcesForRelationships] - Permit resources in the
     * place of relationships (serializing them as resources), false by default.
     * @param {boolean} [options.deduplicateResources] - Generate $id for resources and
     * if a resources appears multiple times in the object graph only the first instance is
     * serialized in full, subsequent instances are replaced with a reference to the $id
     * @param {boolean} [options.convertResourcesToId] - Convert resources that
     * are specified for relationship fields into their id, false by default.
     * @param {number} [options.utcOffset] - UTC Offset for DateTime values.
     * @return {Object} - The Javascript Object that represents the resource
     * @throws {Error} - throws an exception if resource is not an instance of
     * Resource or fails validation.
     */
    toJSON(resource: Resource, options?: {
        validate?: boolean;
        convertResourcesToRelationships?: boolean;
        permitResourcesForRelationships?: boolean;
        deduplicateResources?: boolean;
        convertResourcesToId?: boolean;
        utcOffset?: number;
    }): any;
    /**
     * Create a {@link Resource} from a JavaScript Object representation.
     * The JavaScript Object should have been created by calling the
     * {@link Serializer#toJSON toJSON} API.
     *
     * The Resource is populated based on the JavaScript object.
     *
     * @param {Object} jsonObject The JavaScript Object for a Resource
     * @param {Object} [options] - the optional serialization options
     * @param {boolean} options.acceptResourcesForRelationships - handle JSON objects
     * in the place of strings for relationships, defaults to false.
     * @param {boolean} options.validate - validate the structure of the Resource
     * with its model prior to serialization (default to true)
     * @param {number} [options.utcOffset] - UTC Offset for DateTime values.
     * @return {Resource} The new populated resource
     */
    fromJSON(jsonObject: any, options?: {
        acceptResourcesForRelationships: boolean;
        validate: boolean;
        utcOffset?: number;
    }): Resource;
}
