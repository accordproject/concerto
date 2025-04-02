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



import CompositeFileLoader from '../../src/loaders/compositefileloader';
import HTTPFileLoader from '../../src/loaders/httpfileloader';

import chai, { expect } from 'chai';
import sinon, { SinonStub } from 'sinon';
import chaiAsPromised from 'chai-as-promised';

// Enable chai-as-promised
chai.use(chaiAsPromised);

describe('CompositeFileLoader', () => {
    let sandbox: sinon.SinonSandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#constructor', () => {
        it('should have no loaders', () => {
            const cmfl = new CompositeFileLoader();
            expect(cmfl.getFileLoaders().length).to.equal(0);
        });
    });

    describe('#addFileLoader', () => {
        it('should be able to add/get a model file loader', () => {
            const cmfl = new CompositeFileLoader();
            const ml = sinon.createStubInstance(HTTPFileLoader);
            cmfl.addFileLoader(ml);
            expect(cmfl.getFileLoaders().length).to.equal(1);
        });
    });

    describe('#clearFileLoader', () => {
        it('should be able to add/get a model file loader', () => {
            const cmfl = new CompositeFileLoader();
            const ml = sinon.createStubInstance(HTTPFileLoader);
            cmfl.addFileLoader(ml);
            expect(cmfl.getFileLoaders().length).to.equal(1);
            cmfl.clearFileLoaders();
            expect(cmfl.getFileLoaders().length).to.equal(0);
        });
    });

    describe('#accepts', () => {
        it('should delegate accepts call to model file loader', () => {
            const cmfl = new CompositeFileLoader();
            const ml = sinon.createStubInstance(HTTPFileLoader);
            ml.accepts.withArgs('yes').returns(true);
            ml.accepts.withArgs('no').returns(false);
            cmfl.addFileLoader(ml);
            expect(cmfl.accepts('yes')).to.equal(true);
            expect(cmfl.accepts('no')).to.equal(false);
        });
    });

    describe('#load', () => {
        it('should delegate load call to model file loader', async () => {
            const cmfl = new CompositeFileLoader();
            const processFileStub = sinon.stub().returns('processed-result');
            const ml = new HTTPFileLoader(processFileStub);
            sinon.stub(ml, 'load').resolves('processed-result');
            sinon.stub(ml, 'accepts')
                .withArgs('yes').returns(true)
                .withArgs('no').returns(false);
            cmfl.addFileLoader(ml);

            // Test successful load
            const result1 = await cmfl.load('yes');
            expect(result1).to.equal('processed-result');

            const result2 = await cmfl.load('yes', { foo: 1 });
            expect(result2).to.equal('processed-result');

            // Test failure case with try-catch
            try {
                await cmfl.load('no');
                expect.fail('Expected an error to be thrown');
            } catch (err) {
                if (err instanceof Error) {
                    expect(err.message).to.match(/Failed to find a model file loader that can handle: no/);
                } else {
                    expect.fail('Caught an error that is not an instance of Error');
                }
            }
        });
    });
});