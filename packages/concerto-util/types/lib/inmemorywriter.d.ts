export = InMemoryWriter;
/**
 * InMemoryWriter stores string representation of files in a map structure.
 * The Map key is the filename, and the value are its string contents.
 *
 * @private
 * @extends Writer
 * @see See {@link Writer}
 * @class
 * @memberof module:concerto-core
 */
declare class InMemoryWriter extends Writer {
    fileName: string;
    data: Map<any, any>;
    /**
     * Creates the filename which will be used for association with its string content.
     *
     * @param {string} fileName - the name of the file.
     */
    openFile(fileName: string): void;
    /**
     * Writes the contents of the buffer to the Map store.
     */
    closeFile(): void;
    /**
     * Returns the content of the Map store.
     *
     * @return {Map} - a Map containing the string representation of files. (k,v) => (filename, file content).
     */
    getFilesInMemory(): Map<any, any>;
}
import Writer = require("./writer");
