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

import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiThings from 'chai-things';
import sinon from 'sinon';
import Writer from '../src/writer';

chai.use(chaiAsPromised);
chai.use(chaiThings);

describe('Writer', () => {
    let sandbox: sinon.SinonSandbox;
    let writer: Writer;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        writer = new Writer();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#constructor', () => {
        it('should initialize buffers and line count', () => {
            expect(writer.buffer).to.equal('');
            expect(writer.beforeBuffer).to.equal('');
            expect(writer.linesWritten).to.equal(0);
            expect(writer.getLineCount()).to.equal(0);
            expect(writer.getBuffer()).to.equal('');
        });
    });

    describe('#clearBuffer', () => {
        it('should reset buffers and line count', () => {
            writer.writeBeforeLine(0, 'Before');
            writer.writeLine(0, 'Line');
            expect(writer.getBuffer()).to.equal('Before\nLine\n');
            expect(writer.getLineCount()).to.equal(2); // Fixed: 1 from writeBeforeLine, 1 from writeLine's newline

            writer.clearBuffer();
            expect(writer.buffer).to.equal('');
            expect(writer.beforeBuffer).to.equal('');
            expect(writer.linesWritten).to.equal(0);
            expect(writer.getLineCount()).to.equal(0);
            expect(writer.getBuffer()).to.equal('');
        });
    });

    describe('#writeBeforeLine', () => {
        it('should write to beforeBuffer with indent', () => {
            writer.writeBeforeLine(1, 'Hello World');
            expect(writer.beforeBuffer).to.equal('   Hello World\n');
            expect(writer.getBuffer()).to.equal('   Hello World\n');
            expect(writer.getLineCount()).to.equal(1);
        });

        it('should write to beforeBuffer with zero indent', () => {
            writer.writeBeforeLine(0, 'Hello World');
            expect(writer.beforeBuffer).to.equal('Hello World\n');
            expect(writer.getBuffer()).to.equal('Hello World\n');
            expect(writer.getLineCount()).to.equal(1);
        });
    });

    describe('#writeLine', () => {
        it('should write to buffer with indent', () => {
            writer.writeLine(1, 'Hello World');
            expect(writer.buffer).to.equal('   Hello World\n');
            expect(writer.getBuffer()).to.equal('   Hello World\n');
            expect(writer.getLineCount()).to.equal(1); // Fixed: Only the newline from write('\n') counts
        });

        it('should write to buffer with zero indent', () => {
            writer.writeLine(0, 'Hello World');
            expect(writer.buffer).to.equal('Hello World\n');
            expect(writer.getBuffer()).to.equal('Hello World\n');
            expect(writer.getLineCount()).to.equal(1); // Fixed: Only the newline from write('\n') counts
        });

        it('should handle text with newlines', () => {
            writer.writeLine(1, 'Line1\nLine2');
            expect(writer.buffer).to.equal('   Line1\nLine2\n');
            expect(writer.getBuffer()).to.equal('   Line1\nLine2\n');
            expect(writer.getLineCount()).to.equal(2); // Fixed: 1 from text, 1 from write('\n')
        });
    });

    describe('#writeIndented', () => {
        it('should write to buffer with indent, no newline', () => {
            writer.writeIndented(1, 'Hello World');
            expect(writer.buffer).to.equal('   Hello World');
            expect(writer.getBuffer()).to.equal('   Hello World');
            expect(writer.getLineCount()).to.equal(0); // No newlines
        });

        it('should write to buffer with zero indent', () => {
            writer.writeIndented(0, 'Hello World');
            expect(writer.buffer).to.equal('Hello World');
            expect(writer.getBuffer()).to.equal('Hello World');
            expect(writer.getLineCount()).to.equal(0);
        });

        it('should handle text with newlines', () => {
            writer.writeIndented(1, 'Line1\nLine2');
            expect(writer.buffer).to.equal('   Line1\nLine2');
            expect(writer.getBuffer()).to.equal('   Line1\nLine2');
            expect(writer.getLineCount()).to.equal(1); // 1 newline in the text
        });
    });

    describe('#write', () => {
        it('should throw if input is not a string', () => {
            expect(() => (writer as any).write(false)).to.throw(/Can only append strings/);
            expect(() => (writer as any).write(123)).to.throw(/Can only append strings/);
            expect(() => (writer as any).write(null)).to.throw(/Can only append strings/);
        });

        it('should append a string with no newlines', () => {
            writer.write('Hello World');
            expect(writer.buffer).to.equal('Hello World');
            expect(writer.getBuffer()).to.equal('Hello World');
            expect(writer.getLineCount()).to.equal(0);
        });

        it('should append a string with newlines (\n)', () => {
            writer.write('Line1\nLine2');
            expect(writer.buffer).to.equal('Line1\nLine2');
            expect(writer.getBuffer()).to.equal('Line1\nLine2');
            expect(writer.getLineCount()).to.equal(1);
        });

        it('should append a string with newlines (\r\n)', () => {
            writer.write('Line1\r\nLine2');
            expect(writer.buffer).to.equal('Line1\r\nLine2');
            expect(writer.getBuffer()).to.equal('Line1\r\nLine2');
            expect(writer.getLineCount()).to.equal(1);
        });

        it('should append a string with newlines (\r)', () => {
            writer.write('Line1\rLine2');
            expect(writer.buffer).to.equal('Line1\rLine2');
            expect(writer.getBuffer()).to.equal('Line1\rLine2');
            expect(writer.getLineCount()).to.equal(1);
        });

        it('should handle multiple newlines', () => {
            writer.write('Line1\nLine2\r\nLine3\rLine4');
            expect(writer.buffer).to.equal('Line1\nLine2\r\nLine3\rLine4');
            expect(writer.getBuffer()).to.equal('Line1\nLine2\r\nLine3\rLine4');
            expect(writer.getLineCount()).to.equal(3); // 3 newlines
        });
    });

    describe('#getBuffer', () => {
        it('should combine beforeBuffer and buffer', () => {
            writer.writeBeforeLine(0, 'Before');
            writer.writeLine(0, 'Line');
            expect(writer.getBuffer()).to.equal('Before\nLine\n');
        });
    });

    describe('#getLineCount', () => {
        it('should return correct line count with multiple writes', () => {
            writer.writeBeforeLine(0, 'Before');
            writer.writeLine(0, 'Line1\nLine2');
            writer.writeIndented(0, 'Indented\nIndented2');
            expect(writer.getLineCount()).to.equal(4); // Fixed: 1 + 2 + 1
        });
    });
});