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
     */
    constructor(message: string, component: string);
    component: any;
}
