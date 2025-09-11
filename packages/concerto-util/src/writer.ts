/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Writer buffers text to be written in memory. It handles simple
 * indentation and tracks the number of lines written.
 * @private
 * @class
 * @memberof module:concerto-util
 */
export class Writer {
    private beforeBuffer: string;
    private buffer: string;
    private linesWritten: number;

    /**
     * Create a Writer.
     */
    constructor() {
        this.beforeBuffer = '';
        this.buffer = '';
        this.linesWritten = 0;
    }

    /**
     * Writes text to the start of the buffer
     * @param tabs - the number of tabs to use
     * @param text - the text to write
     */
    writeBeforeLine(tabs: number, text: string): void {
        for(let n=0; n < tabs; n++) {
            this.beforeBuffer += '   ';
        }
        this.beforeBuffer += text;
        this.beforeBuffer += '\n';
        this.linesWritten++;
    }

    /**
     * Append text to the buffer
     * @param tabs - the number of tabs to use
     * @param text - the text to write
     */
    writeLine(tabs: number, text: string): void {
        for(let n=0; n < tabs; n++) {
            this.write('   ');
        }
        this.write(text);
        this.write('\n');
        this.linesWritten++;
    }

    /**
     * Returns the number of lines that have been written to the buffer.
     * @returns the number of lines written to the buffer.
     */
    getLineCount(): number {
        return this.linesWritten;
    }


    /**
     * Append text to the buffer, prepending tabs
     * @param tabs - the number of tabs to use
     * @param text - the text to write
     */
    writeIndented(tabs: number, text: string): void {
        for(let n=0; n < tabs; n++) {
            this.write('   ');
        }
        this.write(text);
    }

    /**
     * Append text to the buffer (no automatic newline). The
     * text may contain newline, and these will increment the linesWritten
     * counter.
     * @param msg - the text to write
     */
    write(msg: string): void {
        if(typeof msg !== 'string' ) {
            throw new Error('Can only append strings. Argument ' + msg + ' has type ' + typeof msg);
        }

        this.buffer += msg;
        this.linesWritten += msg.split(/\r\n|\r|\n/).length;
    }

    /**
     * Returns the text that has been buffered in this Writer.
     * @returns the buffered text.
     */
    getBuffer(): string {
        return this.beforeBuffer + this.buffer;
    }

    /**
     * Empties the underyling buffer and resets the line count.
     */
    clearBuffer(): void {
        this.beforeBuffer = '';
        this.buffer = '';
        this.linesWritten = 0;
    }
}

module.exports = Writer;
