export = CustomResource;
/**
 * CustomResource is a Resource that is designed to be extended by
 * generated client classes.
 * @abstract
 */
declare class CustomResource extends Resource {
    /**
     * Constructor.
     * @param {unknown} opaque Opaque data
     */
    constructor(opaque: unknown);
    $validator: any;
    /**
     * Validates the instance against its model. If validation is not enabled, then an error
     * will be thrown.
     *
     * @throws {Error} - if the instance if invalid with respect to the model
     */
    validate(): void;
}
import Resource = require("./resource");
