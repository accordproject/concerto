export = BaseException;
/**
* A base class for all Concerto exceptions
* @extends Error
* @class
* @memberof module:concerto-core
*/
declare class BaseException extends Error {
    /**
     * Create the BaseException.
     * @param {string} message - The exception message.
     * @param {string} component - The optional component which throws this error.
     * @param {string} [errorCode] - The optional error code regarding the error
     * @param {string} [errorStatus] - The optional error status regarding the error
     */
    constructor(message: string, component: string, errorCode?: string, errorStatus?: string);
    component: any;
    code: string;
    status: string;
}
