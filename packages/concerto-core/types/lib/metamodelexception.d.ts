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
     */
    constructor(message: string);
}
import { BaseException } from "@accordproject/concerto-util";
