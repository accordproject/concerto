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

const Factory = require('../src/factory');
const ModelLoader = require('../src/modelloader');
const ModelManager = require('../src/modelmanager');
const TypeNotFoundException = require('../src/typenotfoundexception');
const Serializer = require('../src/serializer');

const chai = require('chai');
require('chai').should();
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));

describe('ModelLoader', () => {

    const modelBase = __dirname + '/data/model/model-base.cto';
    const modelUrl = 'https://models.accordproject.org/concerto/scalar.cto';

    beforeEach(() => {
    });

    afterEach(() => {
    });

    describe('#loadModelManager', function() {
        it('should load models', async function() {
            const modelManager = await ModelLoader.loadModelManager([modelBase]);
            (function() {
                modelManager.getType('String');
            }).should.throw(TypeNotFoundException);
        });

        it('should throw an error for a namespace that does not exist', async function() {
            const modelManager = await ModelLoader.loadModelManager([modelBase]);
            (function() {
                modelManager.getType('org.acme.nosuchns.SimpleAsset');
            }).should.throw(TypeNotFoundException, /org.acme.nosuchns/);
        });

        it('should throw an error for an empty namespace', async function() {
            const modelManager = await ModelLoader.loadModelManager([modelBase]);
            (function() {
                modelManager.getType('NoSuchAsset');
            }).should.throw(TypeNotFoundException, /NoSuchAsset/);
        });

        it('should throw an error for a type that does not exist', async function() {
            const modelManager = await ModelLoader.loadModelManager([modelBase]);
            (function() {
                modelManager.getType('org.acme.base@1.0.0.NoSuchAsset');
            }).should.throw(TypeNotFoundException, /NoSuchAsset/);
        });

        it('should return the class declaration for a valid type', async function() {
            const modelManager = await ModelLoader.loadModelManager([modelBase]);
            const declaration = modelManager.getType('org.acme.base@1.0.0.AbstractAsset');
            declaration.getFullyQualifiedName().should.equal('org.acme.base@1.0.0.AbstractAsset');
        });

        it('should load models when offline', async function() {
            const modelManager = await ModelLoader.loadModelManager([modelBase], { offline: true });
            const declaration = modelManager.getType('org.acme.base@1.0.0.AbstractAsset');
            declaration.getFullyQualifiedName().should.equal('org.acme.base@1.0.0.AbstractAsset');
        });
    });

    describe('#loadModelManagerFromModelFiles', function() {
        it('should load models', async function() {
            const modelManager = await ModelLoader.loadModelManager([modelBase]);
            const files = modelManager.getModelFiles()
                .map(f => f.definitions);
            const modelManager2 = await ModelLoader.loadModelManagerFromModelFiles(files);
            (function() {
                modelManager2.getType('String');
            }).should.throw(TypeNotFoundException);
        });

        it('should throw an error for a namespace that does not exist', async function() {
            const modelManager = await ModelLoader.loadModelManager([modelBase]);
            const files = modelManager.getModelFiles()
                .map(f => f.definitions);
            const modelManager2 = await ModelLoader.loadModelManagerFromModelFiles(files);
            (function() {
                modelManager2.getType('org.acme.nosuchns.SimpleAsset');
            }).should.throw(TypeNotFoundException, /org.acme.nosuchns/);
        });

        it('should throw an error for an empty namespace', async function() {
            const modelManager = await ModelLoader.loadModelManager([modelBase]);
            const files = modelManager.getModelFiles()
                .map(f => f.definitions);
            const modelManager2 = await ModelLoader.loadModelManagerFromModelFiles(files);
            (function() {
                modelManager2.getType('NoSuchAsset');
            }).should.throw(TypeNotFoundException, /NoSuchAsset/);
        });

        it('should throw an error for a type that does not exist', async function() {
            const modelManager = await ModelLoader.loadModelManager([modelBase]);
            const files = modelManager.getModelFiles()
                .map(f => f.definitions);
            const modelManager2 = await ModelLoader.loadModelManagerFromModelFiles(files);
            (function() {
                modelManager2.getType('org.acme.base@1.0.0.NoSuchAsset');
            }).should.throw(TypeNotFoundException, /NoSuchAsset/);
        });

        it('should return the class declaration for a valid type', async function() {
            const modelManager = await ModelLoader.loadModelManager([modelBase]);
            const declaration = modelManager.getType('org.acme.base@1.0.0.AbstractAsset');
            declaration.getFullyQualifiedName().should.equal('org.acme.base@1.0.0.AbstractAsset');
        });

        it('should load models when offline', async function() {
            const modelManager = await ModelLoader.loadModelManager([modelBase]);
            const files = modelManager.getModelFiles()
                .map(f => f.definitions);
            const fileNames = modelManager.getModelFiles()
                .map(f => `${f.getFullyQualifiedName}.cto`);
            const modelManager2 = await ModelLoader.loadModelManagerFromModelFiles(files, fileNames, { offline: true });
            (function() {
                modelManager2.getType('String');
            }).should.throw(TypeNotFoundException);
        });
    });

    describe('#loadModelFromUrl', function() {
        it('should load models', async function() {
            const modelManager = await ModelLoader.loadModelManager([modelUrl]);
            (modelManager instanceof ModelManager).should.be.true;
        });
    });

    describe('#getFactory', () => {

        it('should return a factory', async () => {
            const modelManager = await ModelLoader.loadModelManager([modelBase]);
            modelManager.getFactory().should.be.an.instanceOf(Factory);
        });

    });

    describe('#getSerializer', () => {

        it('should return a serializer', async () => {
            const modelManager = await ModelLoader.loadModelManager([modelBase]);
            modelManager.getSerializer().should.be.an.instanceOf(Serializer);
        });

    });

    describe('#hasInstance', () => {
        it('should return true for a valid ModelManager', async () => {
            const modelManager = await ModelLoader.loadModelManager([modelBase]);
            (modelManager instanceof ModelManager).should.be.true;
        });
    });

});
