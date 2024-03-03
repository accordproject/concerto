export = MetamodelException;
/**
* Class representing an invalid Metamodel instance (JSON AST)
* @extends BaseException
* @see See {@link BaseException}
* @class
* @memberof module:concerto-core
*/
declare class MetamodelException extends BaseException {
    /**
     * Create the MetamodelException.
     * @param {string} message - The exception message.
     * @param {string} [code] - the optional code of the error
     * @param {string} [status] - the optional status of the error
     */
    constructor(message: string, code?: string, status?: string);
}
import { BaseException } from "@accordproject/concerto-util";
