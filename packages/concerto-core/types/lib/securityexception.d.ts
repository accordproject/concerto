export = SecurityException;
declare const SecurityException_base: typeof import("@accordproject/concerto-cto/types/lib/baseexception");
/**
* Class representing a security exception
* @extends BaseException
* @see See {@link BaseException}
* @class
* @memberof module:concerto-core
*/
declare class SecurityException extends SecurityException_base {
    /**
     * Create the SecurityException.
     * @param {string} message - The exception message.
     */
    constructor(message: string);
}
