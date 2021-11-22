export = ValidatedResource;
/**
 * ValidatedResource is a Resource that can validate that property
 * changes (or the whole instance) do not violate the structure of
 * the type information associated with the instance.
 * @extends Resource
 * @see See {@link Resource}
 * @class
 * @memberof module:concerto-core
 */
declare class ValidatedResource extends Resource {
    /**
     * This constructor should not be called directly.
     * Use the Factory class to create instances.
     *
     * <p>
     * <strong>Note: Only to be called by framework code. Applications should
     * retrieve instances from {@link Factory}</strong>
     * </p>
     * @param {ModelManager} modelManager - The ModelManager for this instance
     * @param {ClassDeclaration} classDeclaration - The class declaration for this instance.
     * @param {string} ns - The namespace this instance.
     * @param {string} type - The type this instance.
     * @param {string} id - The identifier of this instance.
     * @param {string} timestamp - The timestamp of this instance
     * @param {ResourceValidator} resourceValidator - The validator to use for this instance
     * @private
     */
    private constructor();
    $validator: ResourceValidator;
    /**
     * Validates the instance against its model.
     *
     * @throws {Error} - if the instance if invalid with respect to the model
     */
    validate(): void;
}
import Resource = require("./resource");
