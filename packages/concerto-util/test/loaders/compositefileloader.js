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

const CompositeFileLoader = require('../../dist/loaders/compositefileloader');
const HTTPFileLoader = require('../../dist/loaders/httpfileloader');

require('chai').should();
const sinon = require('sinon');

describe('CompositeFileLoader', () => {

    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#constructor', () => {

        it('should have no loaders', () => {
            const cmfl = new CompositeFileLoader();
            cmfl.getFileLoaders().length.should.equal(0);
        });

    });

    describe('#addFileLoader', () => {

        it('should be able to add/get a model file loader', () => {
            const cmfl = new CompositeFileLoader();
            const ml = sinon.createStubInstance(HTTPFileLoader);
            cmfl.addFileLoader(ml);
            cmfl.getFileLoaders().length.should.equal(1);
        });

    });

    describe('#clearFileLoader', () => {

        it('should be able to add/get a model file loader', () => {
            const cmfl = new CompositeFileLoader();
            const ml = sinon.createStubInstance(HTTPFileLoader);
            cmfl.addFileLoader(ml);
            cmfl.getFileLoaders().length.should.equal(1);
            cmfl.clearFileLoaders();
            cmfl.getFileLoaders().length.should.equal(0);
        });

    });

    describe('#accepts', () => {

        it('should delegate accepts call to model file loader', () => {
            const cmfl = new CompositeFileLoader();
            const ml = sinon.createStubInstance(HTTPFileLoader);
            ml.accepts.withArgs('yes').returns(true);
            ml.accepts.withArgs('no').returns(false);
            cmfl.addFileLoader(ml);
            cmfl.accepts('yes').should.equal(true);
            cmfl.accepts('no').should.equal(false);
        });

    });

    describe('#load', () => {

        it('should delegate load call to model file loader', () => {
            const cmfl = new CompositeFileLoader();
            const ml = sinon.createStubInstance(HTTPFileLoader);
            ml.load.returns('result');
            ml.accepts.withArgs('yes').returns(true);
            ml.accepts.withArgs('no').returns(false);
            cmfl.addFileLoader(ml);
            cmfl.load('yes').should.equal('result');
            cmfl.load('yes', {foo: 1}).should.equal('result');

            (() => {
                cmfl.load({url: 'no'});
            }).should.throw(/Failed to find a model file loader/);
        });
    });
});
