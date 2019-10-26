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

const Factory = require('../lib/factory');
const ModelLoader = require('../lib/modelloader');
const ModelManager = require('../lib/modelmanager');
const TypeNotFoundException = require('../lib/typenotfoundexception');
const Serializer = require('../lib/serializer');

const chai = require('chai');
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));

describe('ModelLoader', () => {

    let modelBase = './test/data/model/model-base.cto';
    let modelUrl = 'https://models.accordproject.org/patents/patent.cto';

    beforeEach(() => {
    });

    afterEach(() => {
    });

    describe('#loadModelFromFile', function() {
        it('should load models', async function() {
            const modelManager = await ModelLoader.loadModelManager(null, [modelBase]);
            (function() {
                modelManager.getType('String');
            }).should.throw(TypeNotFoundException);
        });

        it('should throw an error for a namespace that does not exist', async function() {
            const modelManager = await ModelLoader.loadModelManager(null, [modelBase]);
            (function() {
                modelManager.getType('org.acme.nosuchns.SimpleAsset');
            }).should.throw(TypeNotFoundException, /org.acme.nosuchns/);
        });

        it('should throw an error for an empty namespace', async function() {
            const modelManager = await ModelLoader.loadModelManager(null, [modelBase]);
            (function() {
                modelManager.getType('NoSuchAsset');
            }).should.throw(TypeNotFoundException, /NoSuchAsset/);
        });

        it('should throw an error for a type that does not exist', async function() {
            const modelManager = await ModelLoader.loadModelManager(null, [modelBase]);
            (function() {
                modelManager.getType('org.acme.base.NoSuchAsset');
            }).should.throw(TypeNotFoundException, /NoSuchAsset/);
        });

        it('should return the class declaration for a valid type', async function() {
            const modelManager = await ModelLoader.loadModelManager(null, [modelBase]);
            const declaration = modelManager.getType('org.acme.base.AbstractAsset');
            declaration.getFullyQualifiedName().should.equal('org.acme.base.AbstractAsset');
        });
    });

    describe('#loadModelFromUrl', function() {
        it('should load models', async function() {
            const modelManager = await ModelLoader.loadModelManager(null, [modelUrl]);
            (modelManager instanceof ModelManager).should.be.true;
        });
    });

    describe('#getFactory', () => {

        it('should return a factory', async () => {
            const modelManager = await ModelLoader.loadModelManager(null, [modelBase]);
            modelManager.getFactory().should.be.an.instanceOf(Factory);
        });

    });

    describe('#getSerializer', () => {

        it('should return a serializer', async () => {
            const modelManager = await ModelLoader.loadModelManager(null, [modelBase]);
            modelManager.getSerializer().should.be.an.instanceOf(Serializer);
        });

    });

    describe('#hasInstance', () => {
        it('should return true for a valid ModelManager', async () => {
            const modelManager = await ModelLoader.loadModelManager(null, [modelBase]);
            (modelManager instanceof ModelManager).should.be.true;
        });
    });

});
