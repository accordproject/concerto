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
     * @param {string} errorType - The optional error code regarding the error
     */
    constructor(message: string, component: string, errorType: string);
    component: any;
    errorType: string;
    /**
     * Returns the error type associated with the exception
     * @return {string} the error type for this exception
     */
    getErrorType(): string;
}
