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

const fs = require('fs');

const AssetDeclaration = require('../lib/introspect/assetdeclaration');
const ConceptDeclaration = require('../lib/introspect/conceptdeclaration');
const DecoratorFactory = require('../lib/introspect/decoratorfactory');
const EnumDeclaration = require('../lib/introspect/enumdeclaration');
const EventDeclaration = require('../lib/introspect/eventdeclaration');
const Factory = require('../lib/factory');
const ModelFile = require('../lib/introspect/modelfile');
const ModelFileDownloader = require('../lib/introspect/loaders/modelfiledownloader');
const ModelManager = require('../lib/modelmanager');
const ParticipantDeclaration = require('../lib/introspect/participantdeclaration');
const Serializer = require('../lib/serializer');
const TypeNotFoundException = require('../lib/typenotfoundexception');
const Util = require('./composer/composermodelutility');
const COMPOSER_MODEL = require('./composer/composermodel');

const chai = require('chai');
const should = chai.should();
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));
const sinon = require('sinon');
const tmp = require('tmp-promise');

describe('ModelManager', () => {

    let modelBase = fs.readFileSync('./test/data/model/model-base.cto', 'utf8');
    let farm2fork = fs.readFileSync('./test/data/model/farm2fork.cto', 'utf8');
    let composerModel = fs.readFileSync('./test/data/model/composer.cto', 'utf8');
    let invalidModel = fs.readFileSync('./test/data/model/invalid.cto', 'utf8');
    let invalidModel2 = fs.readFileSync('./test/data/model/invalid2.cto', 'utf8');
    let modelManager;
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        modelManager = new ModelManager();
        Util.addComposerModel(modelManager);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#accept', () => {

        it('should call the visitor', () => {
            let visitor = {
                visit: sinon.stub()
            };
            modelManager.accept(visitor, ['some', 'args']);
            sinon.assert.calledOnce(visitor.visit);
            sinon.assert.calledWith(visitor.visit, modelManager, ['some', 'args']);
        });

    });

    describe('#validateModelFile', () => {

        it('should validate model files from strings', () => {
            modelBase.should.not.be.null;
            modelManager.validateModelFile(modelBase);
        });

        it('should validate model files from objects', () => {
            modelBase.should.not.be.null;
            modelManager.validateModelFile(modelBase, 'model-base.cto');
        });

        it('should fail validation of invalid model files from objects', () => {
            invalidModel.should.not.be.null;
            (() => {
                modelManager.validateModelFile(invalidModel);
            }).should.throw();
        });

        it('should fail and set end column to start column and end offset to start offset', () => {
            invalidModel2.should.not.be.null;
            try {
                modelManager.validateModelFile(invalidModel2);
            } catch (err) {
                err.getFileLocation().start.column.should.equal(err.getFileLocation().end.column);
                err.getFileLocation().start.offset.should.equal(err.getFileLocation().start.offset);
            }
        });

        it('should cope with object as modelfile', ()=>{
            let mockModelFile = sinon.createStubInstance(ModelFile);
            modelManager.validateModelFile(mockModelFile);
            sinon.assert.calledOnce(mockModelFile.validate);


        });
    });

    describe('#addModelFile', () => {

        it('should add a model file from a string', () => {
            let res = modelManager.addModelFile(modelBase);
            modelManager.getModelFile('org.acme.base').getNamespace().should.equal('org.acme.base');
            res.should.be.an.instanceOf(ModelFile);
        });

        it('should support associating a file name with a model file', () => {
            let res = modelManager.addModelFile(modelBase, 'model-base.cto');
            modelManager.getModelFile('org.acme.base').getNamespace().should.equal('org.acme.base');
            res.should.be.an.instanceOf(ModelFile);
            res.getName().should.equal('model-base.cto');
        });

        it('should add a model file from an object', () => {
            let mf1 = sinon.createStubInstance(ModelFile);
            mf1.getNamespace.returns('org.doge');
            let res = modelManager.addModelFile(mf1);
            sinon.assert.calledOnce(mf1.validate);
            modelManager.modelFiles['org.doge'].should.equal(mf1);
            res.should.equal(mf1);
        });

        it('should return error for duplicate namespaces for a string', () => {
            modelManager.addModelFile(modelBase);
            let mf1 = sinon.createStubInstance(ModelFile);
            mf1.getNamespace.returns('org.acme.base');
            (() => {
                modelManager.addModelFile(modelBase);
            }).should.throw(/Namespace org.acme.base is already declared/);
        });

        it('should return error for duplicate namespaces from an object', () => {
            modelManager.addModelFile(modelBase);
            let mf1 = sinon.createStubInstance(ModelFile);
            mf1.getNamespace.returns('org.acme.base');
            (() => {
                modelManager.addModelFile(mf1);
            }).should.throw(/Namespace org.acme.base is already declared/);
        });

        it('should return error for duplicate namespaces from an model file with a filename', () => {
            modelManager.addModelFile(modelBase);
            let mf1 = sinon.createStubInstance(ModelFile);
            mf1.getNamespace.returns('org.acme.base');
            mf1.getName.returns('duplFile');
            (() => {
                modelManager.addModelFile(mf1);
            }).should.throw(/Namespace org.acme.base specified in file duplFile is already declared/);
        });

        it('should return error for duplicate namespaces from an model file where original filename was provided', () => {
            modelManager.addModelFile(modelBase, 'origFile');
            let mf1 = sinon.createStubInstance(ModelFile);
            mf1.getNamespace.returns('org.acme.base');
            (() => {
                modelManager.addModelFile(mf1);
            }).should.throw(/Namespace org.acme.base is already declared in file origFile/);
        });

        it('should return error for duplicate namespaces from an model file where original filename and new filename were provided', () => {
            modelManager.addModelFile(modelBase, 'origFile');
            let mf1 = sinon.createStubInstance(ModelFile);
            mf1.getNamespace.returns('org.acme.base');
            mf1.getName.returns('duplFile');
            (() => {
                modelManager.addModelFile(mf1);
            }).should.throw(/Namespace org.acme.base specified in file duplFile is already declared in file origFile/);
        });

    });

    describe('#addModelFiles', () => {

        it('should add model files from strings', () => {
            farm2fork.should.not.be.null;

            composerModel.should.not.be.null;

            let res = modelManager.addModelFiles([composerModel, modelBase, farm2fork]);
            modelManager.getModelFile('org.acme.base').getNamespace().should.equal('org.acme.base');
            res.should.all.be.an.instanceOf(ModelFile);
            res.should.have.lengthOf(3);
        });

        it('should add model files from objects', () => {
            let mf1 = sinon.createStubInstance(ModelFile);
            mf1.getNamespace.returns('org.doge');
            let mf2 = sinon.createStubInstance(ModelFile);
            mf2.getNamespace.returns('org.fry');
            let res = modelManager.addModelFiles([mf1, mf2]);
            sinon.assert.calledOnce(mf1.validate);
            sinon.assert.calledOnce(mf2.validate);
            modelManager.modelFiles['org.doge'].should.equal(mf1);
            modelManager.modelFiles['org.fry'].should.equal(mf2);
            res.should.deep.equal([mf1, mf2]);
        });

        it('should add to existing model files from strings', () => {
            modelManager.addModelFile(modelBase);
            modelManager.getModelFile('org.acme.base').getNamespace().should.equal('org.acme.base');
            modelManager.addModelFiles([composerModel, farm2fork]);
            modelManager.getModelFile('org.acme.base').getNamespace().should.equal('org.acme.base');
            modelManager.getModelFile('org.acme').getNamespace().should.equal('org.acme');
        });

        it('should be able to add model files without validation', () => {
            modelManager.addModelFiles([composerModel, new ModelFile(modelManager, 'namespace foo concept Foo{o Missing m}', 'invalid.cto')], ['1.cto', '2.cto'], true);
        });

        it('should add to existing model files from objects', () => {
            let mf1 = sinon.createStubInstance(ModelFile);
            mf1.getNamespace.returns('org.doge');
            modelManager.addModelFiles([mf1]);
            sinon.assert.calledOnce(mf1.validate);
            modelManager.modelFiles['org.doge'].should.equal(mf1);
            let mf2 = sinon.createStubInstance(ModelFile);
            mf2.getNamespace.returns('org.fry');
            modelManager.addModelFiles([mf2]);
            sinon.assert.calledTwice(mf1.validate);
            sinon.assert.calledOnce(mf2.validate);
            modelManager.modelFiles['org.doge'].should.equal(mf1);
            modelManager.modelFiles['org.fry'].should.equal(mf2);
        });

        it('should restore existing model files on validation error from strings', () => {
            modelManager.addModelFile(modelBase);
            modelManager.getModelFile('org.acme.base').getNamespace().should.equal('org.acme.base');

            try {
                modelManager.addModelFiles([composerModel, 'invalid file']);
            }
            catch(err) {
                // ignore
            }

            modelManager.getModelFile('org.acme.base').getNamespace().should.equal('org.acme.base');
            modelManager.getModelFiles().length.should.equal(2);
        });

        it('should restore existing model files on validation error', () => {
            let mf1 = sinon.createStubInstance(ModelFile);
            mf1.getNamespace.returns('org.doge');
            modelManager.addModelFiles([mf1]);
            sinon.assert.calledOnce(mf1.validate);
            modelManager.modelFiles['org.doge'].should.equal(mf1);
            let mf2 = sinon.createStubInstance(ModelFile);
            mf2.validate.throws(new Error('validation error'));
            mf2.getNamespace.returns('org.fry');
            (() => {
                modelManager.addModelFiles([mf2]);
            }).should.throw(/validation error/);
            sinon.assert.calledTwice(mf1.validate);
            sinon.assert.calledOnce(mf2.validate);
            modelManager.modelFiles['org.doge'].should.equal(mf1);
            should.equal(modelManager.modelFiles['org.fry'], undefined);
        });

        it('should return an error for duplicate namespace from strings', () => {
            (() => {
                modelManager.addModelFiles([composerModel, modelBase, farm2fork, modelBase]);
            }).should.throw(/Namespace org.acme.base is already declared/);
        });

        it('should return an error for duplicate namespace from strings that have filenames', () => {
            (() => {
                modelManager.addModelFiles([composerModel, modelBase, farm2fork, modelBase], ['cm', 'mb', 'f2f', 'mb2']);
            }).should.throw(/Namespace org.acme.base specified in file mb2 is already declared in file mb/);
        });

        it('should return an error for duplicate namespace from objects', () => {
            let mf1 = sinon.createStubInstance(ModelFile);
            mf1.getNamespace.returns('org.doge');
            let mf2 = sinon.createStubInstance(ModelFile);
            mf2.getNamespace.returns('org.doge.base');
            modelManager.addModelFiles([mf1,mf2]);
            (() => {
                modelManager.addModelFiles([mf1]);
            }).should.throw(/Namespace org.doge is already declared/);
        });

        it('should return an error for duplicate namespace from objects, with filenames', () => {
            let mf1 = sinon.createStubInstance(ModelFile);
            mf1.getNamespace.returns('org.doge');
            mf1.getName.returns('mf1');
            let mf2 = sinon.createStubInstance(ModelFile);
            mf2.getNamespace.returns('org.doge.base');
            mf2.getName.returns('mf2');
            let mf3 = sinon.createStubInstance(ModelFile);
            mf3.getNamespace.returns('org.doge');
            mf3.getName.returns('mf1-again');
            modelManager.addModelFiles([mf1,mf2]);
            (() => {
                modelManager.addModelFiles([mf3]);
            }).should.throw(/Namespace org.doge specified in file mf1-again is already declared in file mf1/);
        });


        it('should return the error message for an invalid model file', () => {
            const mf1 = `namespace org.acme1
            asset MyAsset identified by assetId {
                o String assetId
            }`;
            const mf2 = `namespace org.acme2
            asset MyAsset identified /* by */ assetId {
                o String assetId
            }`;
            (() => {
                modelManager.addModelFiles([mf1, mf2]);
            }).should.throw(/Expected.* Line 2 column 27/);
        });

        it('should return the error message for an invalid model file with a file name', () => {
            const mf1 = `namespace org.acme1
            asset MyAsset identified by assetId {
                o String assetId
            }`;
            const mf2 = `namespace org.acme2
            asset MyAsset identified /* by */ assetId {
                o String assetId
            }`;
            (() => {
                modelManager.addModelFiles([mf1, mf2], ['mf1.cto', 'mf2.cto']);
            }).should.throw(/Expected.* File mf2.cto line 2 column 27/);
        });

        it('should handle model files with assets passed in the wrong logical order', () => {
            const mf1 = `namespace ns1
            import ns2.BaseThing
            asset ExtThing extends BaseThing {
            }`;
            const mf2 = `namespace ns2
            abstract asset BaseThing identified by thingId {
                o String thingId
            }`;
            modelManager.addModelFiles([mf1, mf2], ['mf1.cto', 'mf2.cto']);
        });

        it('should handle model files with events passed in the wrong logical order', () => {
            const mf1 = `namespace ns1
            import ns2.BaseThing
            event ExtThing extends BaseThing {
            }`;
            const mf2 = `namespace ns2
            abstract event BaseThing {
            }`;
            modelManager.addModelFiles([mf1, mf2], ['mf1.cto', 'mf2.cto']);
        });

        it('should handle model files with participants passed in the wrong logical order', () => {
            const mf1 = `namespace ns1
            import ns2.BaseThing
            participant ExtThing identified by thingId extends BaseThing {
                o String thingId
            }`;
            const mf2 = `namespace ns2
            abstract participant BaseThing {
            }`;
            modelManager.addModelFiles([mf1, mf2], ['mf1.cto', 'mf2.cto']);
        });

        it('should handle model files with transactions passed in the wrong logical order', () => {
            const mf1 = `namespace ns1
            import ns2.BaseThing
            transaction ExtThing extends BaseThing {
            }`;
            const mf2 = `namespace ns2
            abstract transaction BaseThing {
            }`;
            modelManager.addModelFiles([mf1, mf2], ['mf1.cto', 'mf2.cto']);
        });

    });

    describe('#updateModelFile', () => {

        it('throw if the namespace from an object does not exist', () => {
            let mf1 = sinon.createStubInstance(ModelFile);
            mf1.getNamespace.returns('org.doge');
            (() => {
                modelManager.updateModelFile(mf1);
            }).should.throw(/Model file for namespace org.doge not found/);
        });

        it('throw if the namespace from a string does not exist', () => {
            let model = 'namespace org.doge\nasset TestAsset identified by assetId { o String assetId }';
            (() => {
                modelManager.updateModelFile(model);
            }).should.throw(/Model file for namespace org.doge not found/);
        });

        it('should update from an object', () => {
            let mf1 = sinon.createStubInstance(ModelFile);
            mf1.getNamespace.returns('org.doge');
            mf1.$marker = 'mf1';
            let res = modelManager.addModelFile(mf1);
            sinon.assert.calledOnce(mf1.validate);
            modelManager.modelFiles['org.doge'].should.equal(mf1);
            res.should.equal(mf1);

            let mf2 = sinon.createStubInstance(ModelFile);
            mf2.getNamespace.returns('org.doge');
            mf2.$marker = 'mf2';
            res = modelManager.updateModelFile(mf2);
            sinon.assert.calledOnce(mf2.validate);
            modelManager.modelFiles['org.doge'].should.equal(mf2);
            res.should.equal(mf2);
        });

        it('should update from a string', () => {
            let model = 'namespace org.doge\nasset TestAsset identified by assetId { o String assetId }';
            modelManager.addModelFile(model);
            modelManager.modelFiles['org.doge'].definitions.should.equal(model);

            model = 'namespace org.doge\nasset TestAsset2 identified by assetId2 { o String assetId2 }';
            modelManager.updateModelFile(model);
            modelManager.modelFiles['org.doge'].definitions.should.equal(model);
        });

        it('should keep the original if an update from an object throws', () => {
            let mf1 = sinon.createStubInstance(ModelFile);
            mf1.getNamespace.returns('org.doge');
            mf1.$marker = 'mf1';
            let res = modelManager.addModelFile(mf1);
            sinon.assert.calledOnce(mf1.validate);
            modelManager.modelFiles['org.doge'].should.equal(mf1);
            res.should.equal(mf1);

            let mf2 = sinon.createStubInstance(ModelFile);
            mf2.getNamespace.returns('org.doge');
            mf2.$marker = 'mf2';
            mf2.validate.throws(new Error('fake error'));
            (() => {
                modelManager.updateModelFile(mf2);
            }).should.throw(/fake error/);
            sinon.assert.calledOnce(mf2.validate);
            modelManager.modelFiles['org.doge'].should.equal(mf1);
        });

        it('should keep the original if an update from an string throws', () => {
            let model = 'namespace org.doge\nasset TestAsset identified by assetId { o String assetId }';
            modelManager.addModelFile(model);
            modelManager.modelFiles['org.doge'].definitions.should.equal(model);

            let model2 = 'not a verb org.doge\nasset TestAsset2 identified by assetId2 { o String assetId2 }';
            (() => {
                modelManager.updateModelFile(model2);
            }).should.throw();
            modelManager.modelFiles['org.doge'].definitions.should.equal(model);
        });

    });

    describe('#deleteModelFile', () => {

        it('throw if the model file does not exist', () => {
            let mf1 = sinon.createStubInstance(ModelFile);
            mf1.getNamespace.returns('org.doge');
            (() => {
                modelManager.deleteModelFile(mf1);
            }).should.throw(/Model file does not exist/);
        });

        it('delete the model file', () => {
            let mf1 = sinon.createStubInstance(ModelFile);
            mf1.getNamespace.returns('org.doge');
            mf1.$marker = 'mf1';
            let res = modelManager.addModelFile(mf1);
            sinon.assert.calledOnce(mf1.validate);
            modelManager.modelFiles['org.doge'].should.equal(mf1);
            res.should.equal(mf1);
            modelManager.deleteModelFile('org.doge');
            should.equal(modelManager.modelFiles['org.doge'], undefined);
        });
    });

    describe('#updateExternalModels', () => {

        it('should update external models', () => {

            const externalModelFile = new ModelFile(modelManager, `namespace org.external
concept Foo{ o String baz }`, '@external.cto');
            const mfd = sinon.createStubInstance(ModelFileDownloader);
            mfd.downloadExternalDependencies.returns(Promise.resolve([externalModelFile]));

            // disable validation, we are using an external model
            modelManager.addModelFile(`namespace org.acme
import org.external.* from github://external.cto

concept Bar {
    o Foo foo
}`, 'internal.cto', true);
            modelManager.getModelFile('org.acme').should.not.be.null;

            // import all external models
            const options = {};
            return modelManager.updateExternalModels(options, mfd)
                .then(() => {
                // model should be loaded and tagged as external
                    modelManager.getModelFile('org.external').isExternal().should.be.true;

                    // root model should still be there, and tagged as internal
                    modelManager.getModelFile('org.acme').isExternal().should.be.false;

                    // second update, with the external model already loaded
                    return modelManager.updateExternalModels(options, mfd)
                        .then(() => {
                            // model should be loaded and tagged as external
                            modelManager.getModelFile('org.acme').isExternal().should.be.false;

                            // root model should still be there, and tagged as internal
                            modelManager.getModelFile('org.external').isExternal().should.be.true;
                        });
                });
        });

        it('should rollback changes on error', () => {

            const externalModelFile = new ModelFile(modelManager, `namespace org.external
concept Foo{ o String baz }`, '@external.cto');
            const mfd = sinon.createStubInstance(ModelFileDownloader);
            mfd.downloadExternalDependencies.returns(Promise.resolve([externalModelFile]));

            // disable validation, we are using an external model
            modelManager.addModelFile(`namespace org.acme
import org.external.* from github://external.cto

concept Bar {
    o Missing foo // this type is not defined in the external model
}`, 'internal.cto', true);
            modelManager.getModelFile('org.acme').should.not.be.null;

            // import all external models
            const options = {};
            return modelManager.updateExternalModels(options, mfd)
                .catch((err) => {
                    // external model should not be loaded (changes should have been rolled back)
                    (!modelManager.getModelFile('org.external')).should.be.true;

                    // root model should still be there, and tagged as internal
                    modelManager.getModelFile('org.acme').isExternal().should.be.false;
                });
        });

        it('should fail using bad URL and default model file loader', () => {

            // disable validation, we are using an external model
            modelManager.addModelFile(`namespace org.acme
import org.external.* from github://external.cto

concept Bar {
    o Foo foo
}`, 'internal.cto', true);
            modelManager.getModelFile('org.acme').should.not.be.null;

            // import all external models
            return modelManager.updateExternalModels().should.be.rejectedWith(Error, 'Unable to download external model dependency \'github://external.cto\'');
        });

        it('should fail using bad protocol and default model file loader', () => {

            // disable validation, we are using an external model
            modelManager.addModelFile(`namespace org.acme
import org.external.* from foo://external.cto

concept Bar {
    o Foo foo
}`, 'internal.cto', true);
            modelManager.getModelFile('org.acme').should.not.be.null;

            // import all external models
            return modelManager.updateExternalModels().should.be.rejectedWith(Error, 'Failed to find a model file loader that can handle: foo://external.cto');
        });

        it('should not fail when an external model file can\'t be downloaded, but that isn\'t needed', () => {

            // disable validation, we are using an external model
            modelManager.addModelFile(`namespace org.acme
import org.external.* from github://external.cto

concept Bar {
    o Foo foo
}`, 'internal.cto', true);
            modelManager.addModelFile(`namespace org.external
concept Foo {
    o String foo
}`, 'internal.cto', true);
            modelManager.getModelFile('org.acme').should.not.be.null;

            // import all external models
            return modelManager.updateExternalModels().should.be.fulfilled;
        });
    });

    describe('#writeModelsToFileSystem', () => {
        beforeEach(async () => {
            const externalModelFile = new ModelFile(modelManager, `namespace org.external
            concept Foo{ o String baz }`, '@external.cto');
            const mfd = sinon.createStubInstance(ModelFileDownloader);
            mfd.downloadExternalDependencies.returns(Promise.resolve([externalModelFile]));

            // disable validation, we are using an external model
            modelManager.addModelFile(`namespace org.acme
import org.external.* from github://external.cto

concept Bar {
    o Foo foo
}`, 'internal.cto', true);
            modelManager.getModelFile('org.acme').should.not.be.null;

            // import all external models
            const options = {};
            await modelManager.updateExternalModels(options, mfd);
        });

        it('should write models to the file system', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true});
            modelManager.writeModelsToFileSystem(dir.path);
            fs.readdirSync(dir.path).should.eql([
                '@external.cto',
                'internal.cto',
                'system.cto',
            ]);
            dir.cleanup();
        });

        it('should write models to the file system, without external models', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true});
            modelManager.writeModelsToFileSystem(dir.path, {
                includeExternalModels: false
            });
            fs.readdirSync(dir.path).should.eql([
                'internal.cto',
                'system.cto',
            ]);
            dir.cleanup();
        });

        it('should write models to the file system', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true});
            modelManager.writeModelsToFileSystem(dir.path, {
            });
            fs.readdirSync(dir.path).should.eql([
                '@external.cto',
                'internal.cto',
                'system.cto'
            ]);
            dir.cleanup();
        });

        it('should throw an error if the path is not provided', async () => {
            (() => modelManager.writeModelsToFileSystem(null)).should.throw('`path` is a required parameter of writeModelsToFileSystem');
        });
    });

    describe('#getModels', () => {
        it('should return a list of name / content pairs', () => {
            modelManager.addModelFile(modelBase);
            const models = modelManager.getModels();
            models.length.should.equal(2);
            models[0].should.deep.equal({
                name: 'system.cto', content: COMPOSER_MODEL.contents
            }, {
                name: 'org.acme.base.cto', content: modelBase
            });
        });
        it('should return a list of name / content pairs, with External Models', async () => {
            const externalModelFile = new ModelFile(modelManager, `namespace org.external
            concept Foo{ o String baz }`, '@external.cto');
            const mfd = sinon.createStubInstance(ModelFileDownloader);
            mfd.downloadExternalDependencies.returns(Promise.resolve([externalModelFile]));

            // disable validation, we are using an external model
            modelManager.addModelFile(`namespace org.acme
import org.external.* from github://external.cto

concept Bar {
    o Foo foo
}`, 'internal.cto', true);
            modelManager.getModelFile('org.acme').should.not.be.null;

            // import all external models
            const options = {};
            await modelManager.updateExternalModels(options, mfd);
            const models = modelManager.getModels();
            models.length.should.equal(3);
        });

        it('should return a list of name / content pairs, without External Models', async () => {
            const externalModelFile = new ModelFile(modelManager, `namespace org.external
            concept Foo{ o String baz }`, '@external.cto');
            const mfd = sinon.createStubInstance(ModelFileDownloader);
            mfd.downloadExternalDependencies.returns(Promise.resolve([externalModelFile]));

            // disable validation, we are using an external model
            modelManager.addModelFile(`namespace org.acme
import org.external.* from github://external.cto

concept Bar {
    o Foo foo
}`, 'internal.cto', true);
            modelManager.getModelFile('org.acme').should.not.be.null;

            // import all external models
            const options = {};
            await modelManager.updateExternalModels(options, mfd);
            const models = modelManager.getModels({
                includeExternalModels: false
            });
            models.length.should.equal(2);
        });
    });

    describe('#getNamespaces', () => {

        it('should list all of the namespaces', () => {
            let mf1 = sinon.createStubInstance(ModelFile);
            mf1.getNamespace.returns('org.wow');
            modelManager.addModelFile(mf1);
            let mf2 = sinon.createStubInstance(ModelFile);
            mf2.getNamespace.returns('org.such');
            modelManager.addModelFile(mf2);
            let ns = modelManager.getNamespaces();
            ns.should.include('org.wow');
            ns.should.include('org.such');
        });

    });

    describe('#getDeclarations', () => {
        const numberModelBaseAssets = 13;
        const numberModelBaseEnums = 2;
        const numberModelBaseParticipants = 5;
        const numberModelBaseEvents = 1;
        const numberModelBaseTransactions = 21;
        const numberModelBaseConcepts = 2;

        describe('#getAssetDeclarations', () => {

            it('should return all of the asset declarations', () => {
                modelManager.addModelFile(modelBase);
                let decls = modelManager.getAssetDeclarations();
                decls.should.all.be.an.instanceOf(AssetDeclaration);
                decls.length.should.equal(numberModelBaseAssets);
            });

        });

        describe('#getEnumDeclarations', () => {

            it('should return all of the enum declarations', () => {
                modelManager.addModelFile(modelBase);
                let decls = modelManager.getEnumDeclarations();
                decls.should.all.be.an.instanceOf(EnumDeclaration);
                decls.length.should.equal(numberModelBaseEnums);
            });

        });

        describe('#getParticipantDeclarations', () => {

            it('should return all of the participant declarations', () => {
                modelManager.addModelFile(modelBase);
                let decls = modelManager.getParticipantDeclarations();
                decls.should.all.be.an.instanceOf(ParticipantDeclaration);
                decls.length.should.equal(numberModelBaseParticipants);
            });

        });

        describe('#getEventDeclarations', () => {

            it('should return all of the event declarations', () => {
                modelManager.addModelFile(modelBase);
                let decls = modelManager.getEventDeclarations();
                decls.should.all.be.an.instanceOf(EventDeclaration);
                decls.length.should.equal(numberModelBaseEvents);
            });

        });

        describe('#getTransactionDeclarations', () => {

            it('should return all of the transaction declarations', () => {
                modelManager.addModelFile(modelBase);
                let decls = modelManager.getTransactionDeclarations();
                decls.length.should.equal(numberModelBaseTransactions);
            });

        });

        describe('#getConceptDeclarations', () => {

            it('should return all of the concept declarations', () => {
                modelManager.addModelFile(modelBase);
                let decls = modelManager.getConceptDeclarations();
                decls.should.all.be.an.instanceOf(ConceptDeclaration);
                decls.length.should.equal(numberModelBaseConcepts);
            });
        });
    });

    describe('#resolveType', () => {

        it('should pass through primitive types', () => {
            modelManager.addModelFile(modelBase);
            modelManager.resolveType('org.acme.base.SimpleAsset', 'String').should.equal('String');
        });

        it('should throw an error for a namespace that does not exist', () => {
            modelManager.addModelFile(modelBase);
            (() => {
                modelManager.resolveType('org.acme.base.SimpleAsset', 'org.acme.nosuchns.SimpleAsset');
            }).should.throw(/No registered namespace/);
        });

        it('should throw an error for a type that does not exist', () => {
            modelManager.addModelFile(modelBase);
            (() => {
                modelManager.resolveType('org.acme.base.SimpleAsset', 'org.acme.base.NoSuchAsset');
            }).should.throw(/No type/);
        });

        it('should return the fully qualified type', () => {
            modelManager.addModelFile(modelBase);
            let fqt = modelManager.resolveType('org.acme.base.SimpleAsset', 'org.acme.base.AbstractAsset');
            fqt.should.equal('org.acme.base.AbstractAsset');
        });

    });

    describe('#getType', function() {
        it('should throw an error for a primitive type', function() {
            modelManager.addModelFile(modelBase);
            (function() {
                modelManager.getType('String');
            }).should.throw(TypeNotFoundException);
        });

        it('should throw an error for a namespace that does not exist', function() {
            modelManager.addModelFile(modelBase);
            (function() {
                modelManager.getType('org.acme.nosuchns.SimpleAsset');
            }).should.throw(TypeNotFoundException, /org.acme.nosuchns/);
        });

        it('should throw an error for an empty namespace', function() {
            modelManager.addModelFile(modelBase);
            (function() {
                modelManager.getType('NoSuchAsset');
            }).should.throw(TypeNotFoundException, /NoSuchAsset/);
        });

        it('should throw an error for a type that does not exist', function() {
            modelManager.addModelFile(modelBase);
            (function() {
                modelManager.getType('org.acme.base.NoSuchAsset');
            }).should.throw(TypeNotFoundException, /NoSuchAsset/);
        });

        it('should return the class declaration for a valid type', function() {
            modelManager.addModelFile(modelBase);
            const declaration = modelManager.getType('org.acme.base.AbstractAsset');
            declaration.getFullyQualifiedName().should.equal('org.acme.base.AbstractAsset');
        });
    });

    describe('#getFactory', () => {

        it('should return a factory', () => {
            modelManager.getFactory().should.be.an.instanceOf(Factory);
        });

    });

    describe('#getSerializer', () => {

        it('should return a serializer', () => {
            modelManager.getSerializer().should.be.an.instanceOf(Serializer);
        });

    });

    describe('#getDecoratorFactories', () => {

        it('should return an empty array by default', () => {
            modelManager.getDecoratorFactories().should.deep.equal([]);
        });

        it('should return an array of processors', () => {
            const factory1 = sinon.createStubInstance(DecoratorFactory);
            const factory2 = sinon.createStubInstance(DecoratorFactory);
            modelManager.decoratorFactories = [factory1, factory2];
            modelManager.getDecoratorFactories().should.deep.equal([factory1, factory2]);
        });

    });

    describe('#addDecoratorFactory', () => {

        it('should add a factory to the array', () => {
            modelManager.decoratorFactories.should.deep.equal([]);
            const factory1 = sinon.createStubInstance(DecoratorFactory);
            modelManager.addDecoratorFactory(factory1);
            modelManager.decoratorFactories.should.deep.equal([factory1]);
        });

    });

    describe('#hasInstance', () => {
        it('should return true for a valid ModelManager', () => {
            (modelManager instanceof ModelManager).should.be.true;
        });
    });

});
