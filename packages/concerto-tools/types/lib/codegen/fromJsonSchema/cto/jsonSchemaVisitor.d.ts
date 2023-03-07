export = JsonSchemaVisitor;
/**
 * Convert the contents of a JSON Schema file to a Concerto JSON model.
 * Set the following parameters to use:
 * - metaModelNamespace: the current metamodel namespace.
 * - namespace: the desired namespace of the generated model.
 *
 * @private
 * @class
 */
declare class JsonSchemaVisitor {
    /**
     * Create a JSON Schema model class, used to start the inference into
     * Concerto JSON.
     * @param {Object} jsonSchemaModel - the JSON Schema Model.
     *
     * @return {Object} the result of visiting or undefined.
     * @public
     */
    public static parse(jsonSchemaModel: any): any;
    /**
     * Returns true if the property maps to the Concerto DateTime type.
     * @param {Object} property - a JSON Schema model property.
     *
     * @return {Boolean} "true" if the property maps to the Concerto DateTime
     * type.
     * @private
     */
    private isDateTimeProperty;
    /**
     * Returns true if the property contains an "anyOf" or a "oneOf" element.
     * @param {Object} property - a JSON Schema model property.
     *
     * @return {Boolean} "true" if the property contains aan "anyOf" or a
     * "oneOf" element.
     * @private
     */
    private doesPropertyContainAlternation;
    /**
     * Flatten a property containing an "anyOf" or a "oneOf" element.
     * @param {Object} property - a JSON Schema model property.
     *
     * @return {Object} a JSON Schema model property with the "anyOf" or
     * "oneOf" elements resolved.
     * @private
     */
    private flattenAlternationInProperty;
    /**
     * Returns true if the property contains a JSON Schema model reference.
     * @param {Object} property - a JSON Schema model property.
     *
     * @return {Boolean} "true" if the property contains a JSON Schema model
     * reference.
     * @private
     */
    private isReference;
    /**
     * Returns true if the string is a JSON Schema model local
     * reference one.
     * @param {String} potentialReferenceString - a JSON Schema model local
     * reference string.
     *
     * @return {Boolean} "true" if the string is a JSON Schema model local
     * reference one.
     * @private
     */
    private isStringLocalReference;
    /**
     * Parses a local reference string.
     * @param {Object} referenceString - a JSON Schema model local reference
     * string.
     *
     * @return {String[]} the path to the reffered object.
     * @private
     */
    private parseLocalReferenceString;
    /**
     * Parse a $id URL to use it as a namespace and root type.
     * @param {string} id - the $id value from a JSON schema.
     *
     * @returns {object} A namespace and type pair.
     * @private
     */
    private parseIdUri;
    /**
     * Infers a primitive Concerto type from a JSON Schema model property.
     * @param {Object} property - a JSON Schema model property.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the primitive Concerto type inferred from the JSON
     * Schema model property.
     * @private
     */
    private inferPrimitiveConcertoType;
    /**
     * Normalizes a name by replacing forbidden characters with "$_".
     * @param {String} name - a name.
     *
     * @return {Object} a normalized name.
     * @private
     */
    private normalizeName;
    /**
     * Infers a Concerto concept name from a JSON Schema model inline property
     * path.
     * @param {Object} propertyPath - a JSON Schema model property path.
     *
     * @return {Object} the Concerto concept name inferred from the JSON Schema
     * model inline object property path.
     * @private
     */
    private inferInlineObjectConceptName;
    /**
     * Infers a type-specific validator, appropriate to a Concerto primitive.
     * @param {Object} property - a JSON Schema model property.
     * @param {Object} metaModelNamespace - the Concerto meta model namespace.
     *
     * @return {Object} the Concerto field validator inferred from the JSON
     * Schema model property.
     * @private
     */
    private inferTypeSpecificValidator;
    /**
     * Infers a type-specific property, mapping to a Concerto primitive.
     * @param {Object} property - a JSON Schema model property.
     * @param {Object} metaModelNamespace - the Concerto meta model namespace.
     *
     * @return {Object} the Concerto field inferred from the JSON Schema model
     * property.
     * @private
     */
    private inferTypeSpecificProperties;
    /**
     * Local reference property visitor.
     * @param {Object} reference - a JSON Schema model local reference property.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the Concerto fields and declarations inferred from
     * the JSON Schema model local reference property. A property can spawn
     * declarations as well, if it contains inline objects.
     * @private
     */
    private visitLocalReference;
    /**
     * Reference property visitor.
     * @param {Object} reference - a JSON Schema model reference property.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the Concerto fields and declarations inferred from
     * the JSON Schema model reference property. A property can spawn
     * declarations as well, if it contains inline objects.
     * @private
     */
    private visitReference;
    /**
     * Array property visitor.
     * @param {Object} arrayProperty - a JSON Schema model array property.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the Concerto fields and declarations inferred from
     * the JSON Schema model array property. A property can spawn declarations
     * as well, if it contains inline objects.
     * @private
     */
    private visitArrayProperty;
    /**
     * Property visitor.
     * @param {Object} property - a JSON Schema model property.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the Concerto fields and declarations inferred from
     * the JSON Schema model property. A property can spawn declarations as
     * well, if it contains inline objects.
     * @private
     */
    private visitProperty;
    /**
     * Property visitor.
     * @param {Object} properties - the JSON Schema model properties.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the Concerto fields and declarations inferred from
     * the JSON Schema model properties. A property can spawn declarations as
     * well, if it contains inline objects.
     * @private
     */
    private visitProperties;
    /**
     * Non-enum definition visitor.
     * @param {Object} nonEnumDefinition - a JSON Schema model non-enum
     * definition.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the Concerto declaration or declarations inferred from
     * the JSON Schema model non-enum definition. A definition can spawn more
     * than one Concerto declarations if it contains inline objects.
     * @private
     */
    private visitNonEnumDefinition;
    /**
     * Enum definition visitor.
     * @param {Object} enumDefinition - a JSON Schema model enum definition.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the Concerto enum declaration inferred from
     * the JSON Schema model enum definition.
     * @private
     */
    private visitEnumDefinition;
    /**
     * Definition visitor.
     * @param {Object} definition - a JSON Schema model definition.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the Concerto declaration or declarations inferred from
     * the JSON Schema model definition. A definition can spawn more than one
     * Concerto declarations if it contains inline objects.
     * @private
     */
    private visitDefinition;
    /**
     * Definitions visitor.
     * @param {Object} definitions - the JSON Schema model definitions.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the Concerto declarations inferred from the JSON Schema
     * model definitions.
     */
    visitDefinitions(definitions: any, parameters: any): any;
    /**
     * JSON Schema model visitor.
     * @param {Object} jsonSchemaModel - the JSON Schema model.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the Concerto JSON model.
     * @private
     */
    private visitJsonSchemaModel;
    /**
     * Visitor dispatch i.e. main entry point to this visitor.
     * @param {Object} thing - the visited entity.
     * @param {Object} parameters - the visitor parameters.
     * Set the following parameters to use:
     * - metaModelNamespace: the current metamodel namespace.
     * - namespace: the desired namespace of the generated model.
     *
     * @return {Object} the result of visiting or undefined.
     * @public
     */
    public visit(thing: any, parameters: any): any;
}
