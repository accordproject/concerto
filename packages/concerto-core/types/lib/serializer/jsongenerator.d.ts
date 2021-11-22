export = JSONGenerator;
/**
 * Converts the contents of a Resource to JSON. The parameters
 * object should contain the keys
 * 'stack' - the TypedStack of objects being processed. It should
 * start with a Resource.
 * 'modelManager' - the ModelManager to use.
 * @private
 * @class
 * @memberof module:concerto-core
 */
declare class JSONGenerator {
    /**
     * Constructor.
     * @param {boolean} [convertResourcesToRelationships] Convert resources that
     * are specified for relationship fields into relationships, false by default.
     * @param {boolean} [permitResourcesForRelationships] Permit resources in the
     * place of relationships (serializing them as resources), false by default.
     * @param {boolean} [deduplicateResources] If resources appear several times
     * in the object graph only the first instance is serialized, with only the $id
     * written for subsequent instances, false by default.
     * @param {boolean} [convertResourcesToId] Convert resources that
     * are specified for relationship fields into their id, false by default.
     * @param {boolean} [ergo] target ergo.
     * @param {number} [utcOffset] UTC Offset for DateTime values.
     */
    constructor(convertResourcesToRelationships?: boolean, permitResourcesForRelationships?: boolean, deduplicateResources?: boolean, convertResourcesToId?: boolean, ergo?: boolean, utcOffset?: number);
    convertResourcesToRelationships: boolean;
    permitResourcesForRelationships: boolean;
    deduplicateResources: boolean;
    convertResourcesToId: boolean;
    ergo: boolean;
    utcOffset: number;
    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visit;
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
     * Converts to JSON safe format.
     *
     * @param {Field} field - the field declaration of the object
     * @param {Object} obj - the object to convert to text
     * @return {Object} the text JSON safe representation
     */
    convertToJSON(field: Field, obj: any): any;
    /**
     * Visitor design pattern
     * @param {RelationshipDeclaration} relationshipDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitRelationshipDeclaration;
    /**
     * Returns the persistent format for a relationship.
     * @param {RelationshipDeclaration} relationshipDeclaration - the relationship being persisted
     * @param {Identifiable} relationshipOrResource - the relationship or the resource
     * @returns {string} the text to use to persist the relationship
     */
    getRelationshipText(relationshipDeclaration: RelationshipDeclaration, relationshipOrResource: Identifiable): string;
}
