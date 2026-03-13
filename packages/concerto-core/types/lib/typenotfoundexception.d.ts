export = TypeNotFoundException;
/**
 * Error thrown when a Concerto type does not exist.
 * @extends BaseException
 * @see see {@link BaseException}
 * @class
 * @memberof module:concerto-core
 */
declare class TypeNotFoundException extends BaseException {
    /**
     * Constructor. If the optional 'message' argument is not supplied, it will be set to a default value that
     * includes the type name.
     * @param {string} typeName - fully qualified type name.
     * @param {string|undefined} message - error message.
     * @param {string} component - the optional component which throws this error
     * @param {string} errorType - the error code related to the error
     */
    constructor(typeName: string, message: string | undefined, component: string, errorType?: string);
    typeName: string;
    /**
     * Get the name of the type that was not found.
     * @returns {string} fully qualified type name.
     */
    getTypeName(): string;
}
import { BaseException } from "@accordproject/concerto-util";
