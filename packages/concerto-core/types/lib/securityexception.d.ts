export = SecurityException;
/**
* Class representing a security exception
* @extends BaseException
* @see See {@link BaseException}
* @class
* @memberof module:concerto-core
*/
declare class SecurityException extends BaseException {
    /**
     * Create the SecurityException.
     * @param {string} message - The exception message.
     * @param {string} [status] - the optional status of the error
     * @param {string} [code] - the optional code of the error
     */
    constructor(message: string, status?: string, code?: string);
}
import { BaseException } from "@accordproject/concerto-util";
