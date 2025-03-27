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
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';
import Writer from '../src/writer';
import InMemoryWriter from '../src/inmemorywriter';

chai.use(chaiAsPromised);

describe('InMemoryWriter', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#constructor', () => {
        it('main code path', () => {
            const imw = new InMemoryWriter();
            expect(imw).to.exist;
        });
    });

    describe('#openFile', () => {
        it('main code path', () => {
            const imw = new InMemoryWriter();
            expect(imw).to.exist;
            imw.openFile('filename');
            expect(imw.fileName).to.equal('filename');
        });
    });

    describe('#writeLine', () => {
        it('main code path', () => {
            const stub = sandbox.stub(Writer.prototype, 'writeLine').returns(undefined);
            const imw = new InMemoryWriter();
            imw.fileName = 'filename';
            expect(imw).to.exist;

            imw.writeLine(2, 'text');

            sinon.assert.calledOnceWithExactly(stub, 2, 'text');
        });
    });

    describe('#writeBeforeLine', () => {
        it('main code path', () => {
            const stub = sandbox.stub(Writer.prototype, 'writeBeforeLine').returns(undefined);
            const imw = new InMemoryWriter();
            imw.fileName = 'filename';
            expect(imw).to.exist;

            imw.writeBeforeLine(2, 'text');

            sinon.assert.calledOnceWithExactly(stub, 2, 'text');
        });
    });

    describe('#closeFile', () => {
        it('main code path', () => {
            const superClearBuffer = sandbox.stub(Writer.prototype, 'clearBuffer').returns(undefined);
            const superGetBuffer = sandbox.stub(Writer.prototype, 'getBuffer').returns('0123');

            const imw = new InMemoryWriter();
            expect(imw).to.exist;
            imw.fileName = 'filename';

            imw.closeFile();

            sinon.assert.calledOnce(superClearBuffer);
        });
    });

    describe('#getFilesInMemory', () => {
        it('main code path', () => {
            const superClearBuffer = sandbox.stub(Writer.prototype, 'clearBuffer').returns(undefined);
            const superGetBuffer = sandbox.stub(Writer.prototype, 'getBuffer').returns('lorem ipsum\n');

            const imw = new InMemoryWriter();
            expect(imw).to.exist;

            imw.fileName = 'filename.txt';
            imw.writeLine(0, 'lorem ipsum');
            imw.closeFile();

            expect(imw.data.size).to.equal(1);
            expect(imw.getFilesInMemory().get('filename.txt')).to.equal('lorem ipsum\n');

            sinon.assert.calledOnce(superClearBuffer);
        });
    });
});