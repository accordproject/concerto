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

const ModelManager = require('../../lib/modelmanager');
const Introspector = require('../../lib/introspect/introspector');
const Util = require('../composer/composermodelutility');

const fs = require('fs');

const chai = require('chai');
chai.use(require('chai-things'));
const sinon = require('sinon');
require('chai').should();
const ParserUtil = require('./parserutility');

describe('Introspector', () => {

    describe('#accept', () => {

        it('should call the visitor', () => {
            const introspector = new Introspector(null);
            let visitor = {
                visit: sinon.stub()
            };
            introspector.accept(visitor, ['some', 'args']);
            sinon.assert.calledOnce(visitor.visit);
            sinon.assert.calledWith(visitor.visit, introspector, ['some', 'args']);
        });

    });

    describe('#getClassDeclarations', () => {

        it('should return all class declarations', () => {
            process.env.ENABLE_MAP_TYPE = 'true'; // TODO Remove on release of MapType.
            // create and populate the ModelManager with a model file
            const modelManager = new ModelManager();
            Util.addComposerModel(modelManager);
            modelManager.should.not.be.null;

            let modelBase = fs.readFileSync('./test/data/model/model-base.cto', 'utf8');
            modelBase.should.not.be.null;

            modelManager.addCTOModel(modelBase, 'model-base.cto');
            const introspector = new Introspector(modelManager);
            let classDecl = introspector.getClassDeclarations();
            const scalarDecl = classDecl.filter(declaration =>  declaration.isScalarDeclaration?.());
            const mapDecl = classDecl.filter(declaration =>  declaration.isMapDeclaration?.());
            classDecl.length.should.equal(44);
            scalarDecl.length.should.equal(0);
            mapDecl.length.should.equal(0);
        });
    });

    describe('#getClassDeclaration', () => {

        it('should be able to get a single class declaration', () => {
            process.env.ENABLE_MAP_TYPE = 'true'; // TODO Remove on release of MapType.
            // create and populate the ModelManager with a model file
            const modelManager = new ModelManager();
            Util.addComposerModel(modelManager);
            modelManager.should.not.be.null;

            let modelBase = fs.readFileSync('./test/data/model/model-base.cto', 'utf8');
            modelBase.should.not.be.null;

            modelManager.addCTOModel(modelBase, 'model-base.cto');
            const introspector = new Introspector(modelManager);
            introspector.getClassDeclaration('org.acme.base.Person').should.not.be.null;
        });

        it('should be able to handle the aliased imported types', () => {
            // create and populate the ModelManager with a model file
            const modelManager = new ModelManager({ importAliasing: true });
            Util.addComposerModel(modelManager);
            modelManager.should.not.be.null;

            const model1 = `
            namespace org.example.ext
            asset MyAsset2 identified by assetId {
                o String assetId
            }`;
            const model2 = `
            namespace org.acme
            import org.example.ext.{MyAsset2 as m}
            asset MyAsset identified by assetId {
                o String assetId
                o m[] arr
            }`;
            let modelFile1 = ParserUtil.newModelFile(modelManager, model1);
            modelManager.addModelFile(modelFile1);
            ParserUtil.newModelFile(modelManager, model2);
            const introspector = new Introspector(modelManager);
            introspector.getClassDeclaration('org.example.ext.MyAsset2').should.not.be.null;
        });
    });

    describe('#getModelManager', () => {

        it('should return the model manager', () => {
            const modelManager = new ModelManager();
            Util.addComposerModel(modelManager);
            const introspector = new Introspector(modelManager);
            introspector.getModelManager().should.equal(modelManager);
        });

    });
});
