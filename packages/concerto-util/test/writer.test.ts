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

'use strict';

import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiThings from 'chai-things';
import sinon from 'sinon';
import Writer from '../src/writer';

chai.use(chaiAsPromised);
chai.use(chaiThings);

describe('Writer', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#constructor', () => {
        it('main path', () => {
            const writer = new Writer();
            expect(writer).to.exist;
            writer.clearBuffer();
        });
    });

    describe('#writeBeforeLine', () => {
        it('main path', () => {
            const writer = new Writer();
            expect(writer).to.exist;
            writer.writeBeforeLine(1, 'Hello World');
            expect(writer.beforeBuffer).to.equal('   Hello World\n');
            expect(writer.linesWritten).to.equal(1);
            expect(writer.getLineCount()).to.equal(1);
        });
    });

    describe('#writeLine', () => {
        it('main path', () => {
            const writer = new Writer();
            expect(writer).to.exist;
            writer.writeLine(1, 'Hello World');
            expect(writer.buffer).to.equal('   Hello World\n');
            expect(writer.linesWritten).to.equal(1);
            expect(writer.getBuffer()).to.equal('   Hello World\n');
        });
    });

    describe('#writeIndented', () => {
        it('main path', () => {
            const writer = new Writer();
            expect(writer).to.exist;
            writer.writeIndented(1, 'Hello World');
            expect(writer.linesWritten).to.equal(1);
            expect(writer.getBuffer()).to.equal('   Hello World');
        });
    });

    describe('#write', () => {
        it('writes a line that is not a string', () => {
            const writer = new Writer();
            expect(writer).to.exist;
            // Use type assertion to bypass TypeScript type checking for this test
            expect(() => (writer as any).write(false)).to.throw(/Can only append strings/);
        });
    });
});