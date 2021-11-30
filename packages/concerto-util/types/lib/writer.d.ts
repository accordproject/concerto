export = Writer;
/**
 * Writer buffers text to be written in memory. It handles simple
 * indentation and tracks the number of lines written.
 * @private
 * @class
 * @memberof module:concerto-util
 */
declare class Writer {
    beforeBuffer: string;
    buffer: string;
    linesWritten: number;
    /**
     * Writes text to the start of the buffer
     * @param {int} tabs - the number of tabs to use
     * @param {string} text - the text to write
     */
    writeBeforeLine(tabs: int, text: string): void;
    /**
     * Append text to the buffer
     * @param {int} tabs - the number of tabs to use
     * @param {string} text - the text to write
     */
    writeLine(tabs: int, text: string): void;
    /**
     * Returns the number of lines that have been written to the buffer.
     * @return {int} the number of lines written to the buffer.
     */
    getLineCount(): int;
    /**
     * Append text to the buffer, prepending tabs
     * @param {int} tabs - the number of tabs to use
     * @param {string} text - the text to write
     */
    writeIndented(tabs: int, text: string): void;
    /**
     * Append text to the buffer (no automatic newline). The
     * text may contain newline, and these will increment the linesWritten
     * counter.
     * @param {string} msg - the text to write
     */
    write(msg: string): void;
    /**
     * Returns the text that has been buffered in this Writer.
     * @return {string} the buffered text.
     */
    getBuffer(): string;
    /**
     * Empties the underyling buffer and resets the line count.
     */
    clearBuffer(): void;
}
