export = FileWriter;
/**
 * FileWriter creates text files under a directory tree. It can be used
 * by code generators to create source files for example.
 * Basic usage is: openFile(fileName), writeLine(...), closeFile().
 *
 * @private
 * @extends Writer
 * @see See {@link Writer}
 * @class
 * @memberof module:concerto-core
 */
declare class FileWriter extends Writer {
    /**
     * Create a FileWriter.
     *
     * @param {string} outputDirectory - the path to an output directory
     * that will be used to store generated files.
     */
    constructor(outputDirectory: string);
    outputDirectory: string;
    relativeDir: string;
    fileName: string;
    /**
     * Opens a file for writing. The file will be created in the
     * root directory of this FileWriter.
     *
     * @param {string} fileName - the name of the file to open
     */
    openFile(fileName: string): void;
    /**
     * Opens a file for writing, with a location relative to the
     * root directory of this FileWriter.
     *
     * @param {string} relativeDir - the relative directory to use
     * @param {string} fileName - the name of the file to open
     */
    openRelativeFile(relativeDir: string, fileName: string): void;
    /**
     * Closes the current open file
     */
    closeFile(): void;
}
import Writer = require("./writer");
