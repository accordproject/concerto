export = IllegalModelException;
/**
 * Exception throws when a composer file is semantically invalid
 * @extends BaseFileException
 * @see See  {@link BaseFileException}
 * @class
 * @memberof module:concerto-core
 */
declare class IllegalModelException extends BaseFileException {
    /**
     * Create an IllegalModelException.
     * @param {string} message - the message for the exception
     * @param {ModelFile} [modelFile] - the modelfile associated with the exception
     * @param {Object} [fileLocation] - location details of the error within the model file.
     * @param {number} fileLocation.start.line - start line of the error location.
     * @param {number} fileLocation.start.column - start column of the error location.
     * @param {number} fileLocation.end.line - end line of the error location.
     * @param {number} fileLocation.end.column - end column of the error location.
     * @param {string} [component] - the component which throws this error
     * @param {string} [code] - the optional code of the error
     * @param {string} [status] - the optional status of the error
     */
    constructor(message: string, modelFile?: ModelFile, fileLocation?: any, component?: string, code?: string, status?: string);
}
import { BaseFileException } from "@accordproject/concerto-util";
import ModelFile = require("./modelfile");
