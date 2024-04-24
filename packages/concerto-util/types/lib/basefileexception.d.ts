export = BaseFileException;
/**
 * Exception throws when a Concerto file is semantically invalid
 * @extends BaseException
 * @see {@link BaseException}
 * @class
 * @memberof module:concerto-core
 */
declare class BaseFileException extends BaseException {
    /**
     * Create an BaseFileException
     * @param {string} message - the message for the exception
     * @param {string} fileLocation - the optional file location associated with the exception
     * @param {string} fullMessage - the optional full message text
     * @param {string} [fileName] - the file name
     * @param {string} [component] - the component which throws this error
     * @param {string} [errorType='BaseFileException'] - the error code
     */
    constructor(message: string, fileLocation: string, fullMessage: string, fileName?: string, component?: string, errorType?: string);
    fileLocation: string;
    shortMessage: string;
    fileName: string;
    /**
     * Returns the file location associated with the exception or null
     * @return {string} the optional location associated with the exception
     */
    getFileLocation(): string;
    /**
     * Returns the error message without the location of the error
     * @returns {string} the error message
     */
    getShortMessage(): string;
    /**
     * Returns the fileName for the error
     * @returns {string} the file name or null
     */
    getFileName(): string;
}
import BaseException = require("./baseexception");
