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
     */
    constructor(message: string);
}
import { BaseException } from "@accordproject/concerto-util";
