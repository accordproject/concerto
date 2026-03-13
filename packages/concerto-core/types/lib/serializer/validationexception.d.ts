export = ValidationException;
/**
 * Exception thrown when a resource fails to model against the model
 * @extends BaseException
 * @see See {@link  BaseException}
 * @class
 * @memberof module:concerto-core
 * @private
 */
declare class ValidationException {
    /**
     * Create a ValidationException
     * @param {string} message - the message for the exception
     * @param {string} component - the optional component which throws this error
     */
    constructor(message: string, component: string);
}
