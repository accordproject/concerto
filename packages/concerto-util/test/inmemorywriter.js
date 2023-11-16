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

const chai = require('chai');
const should = chai.should();
chai.use(require('chai-as-promised'));
chai.use(require('chai-things'));
const sinon = require('sinon');

const Writer = require('../dist/writer');
const InMemoryWriter = require('../dist/inmemorywriter');

describe('InMemoryWriter', function() {

    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#constructor', function() {
        it('main code path', function() {
            let imw = new InMemoryWriter();
            should.exist(imw);
        });
    });

    describe('#openFile', function() {
        it('main code path', function() {
            let imw = new InMemoryWriter();
            should.exist(imw);
            imw.openFile('filename');
            imw.fileName.should.equal('filename');
        });
    });

    describe('#writeLine', function() {
        it('main code path', function() {
            let stub = sandbox.stub(Writer.prototype, 'writeLine');
            stub.returns();
            let imw = new InMemoryWriter();
            imw.fileName = 'filename';
            should.exist(imw);

            imw.writeLine('tabs', 'text');

            sinon.assert.calledWith(stub, 'tabs', 'text');
        });
    });

    describe('#writeBeforeLine', function() {
        it('main code path', function() {
            let stub = sandbox.stub(Writer.prototype, 'writeBeforeLine');
            stub.returns();
            let imw = new InMemoryWriter();
            imw.fileName = 'filename';
            should.exist(imw);

            imw.writeBeforeLine('tabs', 'text');

            sinon.assert.calledWith(stub, 'tabs', 'text');
        });
    });

    describe('#closeFile', function() {
        it('main code path', function() {
            let superClearBuffer = sandbox.stub(Writer.prototype, 'clearBuffer');
            superClearBuffer.returns();

            let superGetBuffer = sandbox.stub(Writer.prototype, 'getBuffer');
            superGetBuffer.returns([0, 1, 2, 3]);

            let imw = new InMemoryWriter();
            should.exist(imw);
            imw.fileName = 'filename';

            imw.closeFile();

            sinon.assert.calledOnce(superClearBuffer);
        });
    });

    describe('#getFilesInMemory', function() {
        it('main code path', function() {
            let superClearBuffer = sandbox.stub(Writer.prototype, 'clearBuffer');
            superClearBuffer.returns();

            let superGetBuffer = sandbox.stub(Writer.prototype, 'getBuffer');
            superGetBuffer.returns('lorem ipsum');

            let imw = new InMemoryWriter();
            should.exist(imw);

            imw.fileName = 'filename.txt';
            imw.writeLine('', 'lorem ipsum');
            imw.closeFile();

            imw.data.size.should.equal(1);
            imw.getFilesInMemory().get('filename.txt').should.equal('lorem ipsum');

            sinon.assert.calledOnce(superClearBuffer);
        });
    });
});
