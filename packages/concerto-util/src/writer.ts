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
 * A utility class for writing text with indentation.
 */
export default class Writer {
    public buffer: string;
    public beforeBuffer: string;
    public linesWritten: number;

    /**
     * Creates a new Writer instance.
     */
    constructor() {
        this.buffer = '';
        this.beforeBuffer = '';
        this.linesWritten = 0;
    }

    /**
     * Clears the buffers.
     */
    clearBuffer(): void {
        this.buffer = '';
        this.beforeBuffer = '';
        this.linesWritten = 0;
    }

    /**
     * Writes a line to the beforeBuffer with the specified indentation.
     * @param indent - The number of spaces to indent.
     * @param line - The line to write.
     */
    writeBeforeLine(indent: number, line: string): void {
        const indentStr = ' '.repeat(indent * 3); // 3 spaces per indent level
        this.beforeBuffer += `${indentStr}${line}\n`;
        this.linesWritten++;
    }

    /**
     * Writes a line to the buffer with the specified indentation.
     * @param indent - The number of spaces to indent.
     * @param line - The line to write.
     */
    writeLine(indent: number, line: string): void {
        const indentStr = ' '.repeat(indent * 3); // 3 spaces per indent level
        this.write(indentStr);
        this.write(line);
        this.write('\n');
        // Remove this.linesWritten++ to avoid double-counting
    }

    /**
     * Writes a line to the buffer with the specified indentation, without a newline.
     * @param indent - The number of spaces to indent.
     * @param line - The line to write.
     */
    writeIndented(indent: number, line: string): void {
        const indentStr = ' '.repeat(indent * 3); // 3 spaces per indent level
        this.write(indentStr);
        this.write(line);
    }

    /**
     * Writes a string to the buffer.
     * @param line - The string to write.
     */
    write(line: string): void {
        if (typeof line !== 'string') {
            throw new Error(`Can only append strings. Argument ${line} has type ${typeof line}`);
        }
        this.buffer += line;
        // Count newlines and adjust linesWritten (subtract 1 because split creates an extra element)
        this.linesWritten += line.split(/\r\n|\r|\n/).length - 1;
    }

    /**
     * Gets the current buffer content.
     * @returns The buffer content.
     */
    getBuffer(): string {
        return this.beforeBuffer + this.buffer;
    }

    /**
     * Gets the number of lines written.
     * @returns The number of lines written.
     */
    getLineCount(): number {
        return this.linesWritten;
    }
}