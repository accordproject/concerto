export = TypeNotFoundException;
declare const TypeNotFoundException_base: typeof import("@accordproject/concerto-cto/types/lib/baseexception");
/**
 * Error thrown when a Concerto type does not exist.
 * @extends BaseException
 * @see see {@link BaseException}
 * @class
 * @memberof module:concerto-core
 */
declare class TypeNotFoundException extends TypeNotFoundException_base {
    /**
     * Constructor. If the optional 'message' argument is not supplied, it will be set to a default value that
     * includes the type name.
     * @param {string} typeName - fully qualified type name.
     * @param {string} [message] - error message.
     * @param {string} component - the optional component which throws this error
     */
    constructor(typeName: string, message?: string, component: string);
    typeName: string;
    /**
     * Get the name of the type that was not found.
     * @returns {string} fully qualified type name.
     */
    getTypeName(): string;
}
