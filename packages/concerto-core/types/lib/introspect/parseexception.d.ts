export = ParseException;
/**
 * Exception throws when a Concerto file is syntactically invalid
 * @extends BaseFileException
 * @see See {@link BaseFileException}
 * @class
 * @memberof module:concerto-core
 * @private
 */
declare class ParseException extends BaseFileException {
    /**
     * Create an ParseException
     * @param {string} message - the message for the exception
     * @param {string} [fileLocation] - the file location associated with the exception
     * @param {string} [fileName] - the file name associated with the exception
     * @param {string} [fullMessageOverride] - the pre-existing full message
     * @param {string} [component] - the component which throws this error
     */
    constructor(message: string, fileLocation?: string, fileName?: string, fullMessageOverride?: string, component?: string);
}
import BaseFileException = require("../basefileexception");
