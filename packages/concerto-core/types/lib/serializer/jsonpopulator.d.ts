export = JSONPopulator;
/**
 * Populates a Resource with data from a JSON object graph. The JSON objects
 * should be the result of calling Serializer.toJSON and then JSON.parse.
 * The parameters object should contain the keys
 * 'stack' - the TypedStack of objects being processed. It should
 * start with the root object from JSON.parse.
 * 'factory' - the Factory instance to use for creating objects.
 * 'modelManager' - the ModelManager instance to use to resolve classes
 * @private
 * @class
 * @memberof module:concerto-core
 */
declare class JSONPopulator {
    /**
     * Constructor.
     * @param {boolean} [acceptResourcesForRelationships] Permit resources in the
     * place of relationships, false by default.
     * @param {boolean} [ergo] - Deprecated - This is a dummy parameter to avoid breaking any consumers. It will be removed in a future release.
     * @param {number} [utcOffset] - UTC Offset for DateTime values.
     * @param {number} [strictQualifiedDateTimes] - Only allow fully-qualified date-times with offsets.

     */
    constructor(acceptResourcesForRelationships?: boolean, ergo?: boolean, utcOffset?: number, strictQualifiedDateTimes?: number);
    acceptResourcesForRelationships: boolean;
    utcOffset: number;
    strictQualifiedDateTimes: number;
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
     * @param {MapDeclaration} mapDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitMapDeclaration;
    /**
     * Visitor design pattern
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitField;
    /**
     *
     * @param {Field} field - the field of the item being converted
     * @param {Object} jsonItem - the JSON object of the item being converted
     * @param {Object} parameters - the parameters
     * @return {Object} - the populated object.
     */
    convertItem(field: Field, jsonItem: any, parameters: any): any;
    /**
     * Converts a primtive object to JSON text.
     *
     * @param {Field} field - the field declaration of the object
     * @param {Object} json - the JSON object to convert to a Concerto Object
     * @param {Object} parameters - the parameters
     * @return {string} the text representation
     */
    convertToObject(field: Field, json: any, parameters?: any): string;
    /**
     * Visitor design pattern
     * @param {RelationshipDeclaration} relationshipDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private visitRelationshipDeclaration;
}
