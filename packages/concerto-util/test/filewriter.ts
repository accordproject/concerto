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
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';
import * as fs from 'fs';
import * as path from 'path';
import mock from 'mock-fs';
import FileWriter from '../src/filewriter';
import Writer from '../src/writer';

chai.use(chaiAsPromised);

describe('FileWriter', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        // Mock the file system
        mock({
            'dir': {}, // Mock the output directory for constructor
            'outputDir': {} // Mock the output directory for closeFile tests
        });
    });

    afterEach(() => {
        sandbox.restore();
        mock.restore(); // Restore the real file system
    });

    describe('#constructor', () => {
        it('main code path', () => {
            const fileWriter = new FileWriter('dir');
            expect(fileWriter).to.exist;
            expect(fileWriter.outputDirectory).to.equal('dir');
        });
    });

    describe('#openFile', () => {
        it('main code path', () => {
            const fileWriter = new FileWriter('dir');
            expect(fileWriter).to.exist;
            fileWriter.openFile('filename');
            expect(fileWriter.fileName).to.equal('filename');
            expect(fileWriter.relativeDir).to.be.undefined;
        });
    });

    describe('#openRelativeFile', () => {
        it('main code path', () => {
            const fileWriter = new FileWriter('dir');
            expect(fileWriter).to.exist;
            fileWriter.openRelativeFile('relativeDir', 'filename');
            expect(fileWriter.fileName).to.equal('filename');
            expect(fileWriter.relativeDir).to.equal('relativeDir');
        });
    });

    describe('#writeLine', () => {
        it('file not opened error code path', () => {
            const stub = sandbox.stub(Writer.prototype, 'writeLine').returns(undefined);
            const fileWriter = new FileWriter('dir');
            expect(fileWriter).to.exist;
            expect(() => fileWriter.writeLine(2, 'text')).to.throw(/not been opened/);
            sinon.assert.notCalled(stub);
        });

        it('main code path', () => {
            const stub = sandbox.stub(Writer.prototype, 'writeLine').returns(undefined);
            const fileWriter = new FileWriter('dir');
            fileWriter.fileName = 'filename';
            expect(fileWriter).to.exist;

            fileWriter.writeLine(2, 'text');

            sinon.assert.calledOnceWithExactly(stub, 2, 'text');
        });
    });

    describe('#writeBeforeLine', () => {
        it('file not opened error code path', () => {
            const stub = sandbox.stub(Writer.prototype, 'writeBeforeLine').returns(undefined);
            const fileWriter = new FileWriter('dir');
            expect(fileWriter).to.exist;
            expect(() => fileWriter.writeBeforeLine(2, 'text')).to.throw(/not been opened/);
            sinon.assert.notCalled(stub);
        });

        it('main code path', () => {
            const stub = sandbox.stub(Writer.prototype, 'writeBeforeLine').returns(undefined);
            const fileWriter = new FileWriter('dir');
            fileWriter.fileName = 'filename';
            expect(fileWriter).to.exist;

            fileWriter.writeBeforeLine(2, 'text');

            sinon.assert.calledOnceWithExactly(stub, 2, 'text');
        });
    });

    describe('#closeFile', () => {
        it('file not opened error code path', () => {
            const fileWriter = new FileWriter('dir');
            expect(fileWriter).to.exist;
            expect(() => fileWriter.closeFile()).to.throw(/No file open/);
        });

        it('main code path', () => {
            const superClearBuffer = sandbox.stub(Writer.prototype, 'clearBuffer').returns(undefined);
            const superGetBuffer = sandbox.stub(Writer.prototype, 'getBuffer').returns('line1\nline2\nline3\n');

            const fileWriter = new FileWriter('dir');
            expect(fileWriter).to.exist;
            fileWriter.fileName = 'filename';
            fileWriter.outputDirectory = 'outputDir';

            fileWriter.closeFile();

            // Verify that the file was written with the expected content
            const expectedPath = path.resolve('outputDir', 'filename');
            const fileContent = fs.readFileSync(expectedPath, 'utf8');
            expect(fileContent).to.equal('line1\nline2\nline3\n');
            sinon.assert.calledOnce(superClearBuffer);
        });

        it('main code path - relativedir', () => {
            const superClearBuffer = sandbox.stub(Writer.prototype, 'clearBuffer').returns(undefined);
            const superGetBuffer = sandbox.stub(Writer.prototype, 'getBuffer').returns('line1\nline2\nline3\n');

            const fileWriter = new FileWriter('dir');
            expect(fileWriter).to.exist;
            fileWriter.fileName = 'filename';
            fileWriter.outputDirectory = 'outputDir';
            fileWriter.relativeDir = 'relativeDir';

            fileWriter.closeFile();

            // Verify that the file was written with the expected content
            const relativePath = path.resolve('outputDir', 'relativeDir');
            const expectedPath = path.resolve(relativePath, 'filename');
            const fileContent = fs.readFileSync(expectedPath, 'utf8');
            expect(fileContent).to.equal('line1\nline2\nline3\n');
            sinon.assert.calledOnce(superClearBuffer);
        });
    });
});