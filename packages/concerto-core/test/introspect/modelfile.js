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

const { MetaModelNamespace } = require('@accordproject/concerto-metamodel');

const AssetDeclaration = require('../../src/introspect/assetdeclaration');
const ParticipantDeclaration = require('../../src/introspect/participantdeclaration');
const TransactionDeclaration = require('../../src/introspect/transactiondeclaration');
const EventDeclaration = require('../../src/introspect/eventdeclaration');
const EnumDeclaration = require('../../src/introspect/enumdeclaration');
const IllegalModelException = require('../../src/introspect/illegalmodelexception');
const ModelFile = require('../../src/introspect/modelfile');
const ModelManager = require('../../src/modelmanager');

const fs = require('fs');
const path = require('path');
const Util = require('../composer/composermodelutility');
const ParserUtil = require('./parserutility');

const { Parser } = require('@accordproject/concerto-cto');

const chai = require('chai');
const should = chai.should();
chai.use(require('chai-things'));
const sinon = require('sinon');
const ScalarDeclaration = require('../../src/introspect/scalardeclaration');
const ClassDeclaration = require('../../src/introspect/classdeclaration');

describe('ModelFile', () => {

    const carLeaseModel = fs.readFileSync(path.resolve(__dirname, '../data/model/carlease.cto'), 'utf8');
    let modelManager;
    let sandbox;
    let introspectUtils;

    beforeEach(() => {
        modelManager = new ModelManager();
        Util.addComposerModel(modelManager);
        introspectUtils = new IntrospectUtils(modelManager);
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#constructor', () => {

        it('should throw when null ast provided', () => {
            (() => {
                new ModelFile(modelManager, null);
            }).should.throw(/ast not specified/);
        });

        it('should throw when non object ast provided', () => {
            (() => {
                new ModelFile(modelManager, true);
            }).should.throw(/ModelFile expects a Concerto model AST as input./);
        });

        it('should throw when invalid definitions provided', () => {
            (() => {
                new ModelFile(modelManager, {}, {});
            }).should.throw(/definition as a string/);
        });

        it('should throw when invalid filename provided', () => {
            (() => {
                new ModelFile(modelManager, {}, 'fake', {});
            }).should.throw(/filename as a string/);
        });

        it('should call the parser with the definitions and save the abstract syntax tree', () => {
            const ast = {
                namespace: 'org.acme@1.0.0',
                body: [ ]
            };
            sandbox.stub(Parser, 'parse').returns(ast);
            let mf = ParserUtil.newModelFile(modelManager, 'fake definitions');
            mf.ast.should.equal(ast);
            mf.namespace.should.equal('org.acme@1.0.0');
        });

        it('should call the parser with the definitions and save any imports', () => {
            const imports = [ {
                $class: `${MetaModelNamespace}.ImportType`,
                namespace: 'org.freddo@1.0.0',
                name: 'Bar',
            }, {
                $class: `${MetaModelNamespace}.ImportType`,
                namespace: 'org.doge@1.0.0',
                name: 'Foo',
            } ];
            const ast = {
                $class: `${MetaModelNamespace}.Model`,
                namespace: 'org.acme@1.0.0',
                imports: imports,
                declarations: [ ]
            };
            sandbox.stub(Parser, 'parse').returns(ast);
            let mf = ParserUtil.newModelFile(modelManager, 'fake definitions');
            mf.getImports().should.deep.equal(['org.freddo@1.0.0.Bar', 'org.doge@1.0.0.Foo', 'concerto@1.0.0.Concept', 'concerto@1.0.0.Asset', 'concerto@1.0.0.Transaction', 'concerto@1.0.0.Participant', 'concerto@1.0.0.Event']);
        });

        it('should call the parser with the definitions and save imports with uris', () => {
            const imports = [ {
                $class: `${MetaModelNamespace}.ImportType`,
                namespace: 'org.doge@1.0.0',
                name:'Foo',
            }, {
                $class: `${MetaModelNamespace}.ImportType`,
                namespace: 'org.freddos@1.0.0',
                name: 'Bar',
                uri: 'https://freddos.org/model.cto'
            } ];
            const ast = {
                $class: `${MetaModelNamespace}.Model`,
                namespace: 'org.acme@1.0.0',
                imports: imports,
                declarations: [ ]
            };
            sandbox.stub(Parser, 'parse').returns(ast);
            let mf = ParserUtil.newModelFile(modelManager, 'fake definitions');
            mf.getImports().should.deep.equal(['org.doge@1.0.0.Foo', 'org.freddos@1.0.0.Bar', 'concerto@1.0.0.Concept', 'concerto@1.0.0.Asset', 'concerto@1.0.0.Transaction', 'concerto@1.0.0.Participant', 'concerto@1.0.0.Event']);
            mf.getImportURI('org.freddos@1.0.0.Bar').should.equal('https://freddos.org/model.cto');
            mf.getExternalImports()['org.freddos@1.0.0.Bar'].should.equal('https://freddos.org/model.cto');
            (mf.getImportURI('org.doge.Foo') === null).should.be.true;
        });

        it('should throw for a bad namespace part', () => {
            const ast = {
                $class: `${MetaModelNamespace}.Model`,
                namespace: 'org.foo-bar',
                imports: [],
                declarations: [ ]
            };
            sandbox.stub(Parser, 'parse').returns(ast);

            (() => {
                ParserUtil.newModelFile(modelManager, 'fake definitions');
            }).should.throw(/Invalid namespace part 'foo-bar'/);
        });

        it('should throw for a wildcard import ', () => {
            const strictModelManager = new ModelManager();

            const imports = [{
                $class: `${MetaModelNamespace}.ImportAll`,
                namespace: 'org.freddos@1.0.0',
                uri: 'https://freddos.org/model.cto'
            }];
            const ast = {
                $class: `${MetaModelNamespace}.Model`,
                namespace: 'org.acme@1.0.0',
                imports: imports,
                declarations: [ ]
            };
            sandbox.stub(Parser, 'parse').returns(ast);

            (() => {
                ParserUtil.newModelFile(strictModelManager, 'fake definitions');
            }).should.throw(/Wilcard Imports are not permitted./);
        });

        it('should throw for an unrecognized body element', () => {
            const ast = {
                $class: `${MetaModelNamespace}.Model`,
                namespace: 'org.acme@1.0.0',
                declarations: [ {
                    $class: 'BlahType'
                } ]
            };
            sandbox.stub(Parser, 'parse').returns(ast);
            (() => {
                ParserUtil.newModelFile(modelManager, 'fake definitions');
            }).should.throw(/BlahType/);
        });
    });

    describe('#accept', () => {

        it('should call the visitor', () => {
            let mf = ParserUtil.newModelFile(modelManager, carLeaseModel);
            let visitor = {
                visit: sinon.stub()
            };
            mf.accept(visitor, ['some', 'args']);
            sinon.assert.calledOnce(visitor.visit);
            sinon.assert.calledWith(visitor.visit, mf, ['some', 'args']);
        });

    });

    describe('#validate', () => {

        it('should throw when scalar name is duplicted in a modelfile', () => {
            let asset = introspectUtils.loadModelFile('test/data/parser/scalardeclaration.dupeboolean.cto');
            (() => {
                asset.validate();
            }).should.throw(/Duplicate class/);
        });

        it('should throw when asset name is duplicted in a modelfile', () => {
            let asset = introspectUtils.loadModelFile('test/data/parser/classdeclaration.dupeassetname.cto');
            (() => {
                asset.validate();
            }).should.throw(/Duplicate class/);
        });

        it('should throw when transaction name is duplicted in a modelfile', () => {
            let asset = introspectUtils.loadModelFile('test/data/parser/classdeclaration.dupetransactionname.cto');
            (() => {
                asset.validate();
            }).should.throw(/Duplicate class/);
        });

        it('should throw when participant name is duplicted in a modelfile', () => {
            let asset = introspectUtils.loadModelFile('test/data/parser/classdeclaration.dupeparticipantname.cto');
            (() => {
                asset.validate();
            }).should.throw(/Duplicate class/);
        });

        it('should throw when concept name is duplicted in a modelfile', () => {
            let asset = introspectUtils.loadModelFile('test/data/parser/classdeclaration.dupeconceptname.cto');
            (() => {
                asset.validate();
            }).should.throw(/Duplicate class/);
        });

        it('should throw when enum name is duplicted in a modelfile', () => {
            let asset = introspectUtils.loadModelFile('test/data/parser/classdeclaration.dupeenumname.cto');
            (() => {
                asset.validate();
            }).should.throw(/Duplicate class/);
        });

        it('should throw if an import exists for an invalid namespace', () => {
            const model = `
            namespace org.acme@1.0.0
            import org.acme.ext@1.0.0.MyAsset2
            asset MyAsset identified by assetId {
                o String assetId
            }`;
            let modelFile = ParserUtil.newModelFile(modelManager, model);
            (() => {
                modelFile.validate();
            }).should.throw(IllegalModelException, /org.acme.ext/);
        });

        it('should throw if an import exists for a type that does not exist in a valid namespace', () => {
            const model1 = `
            namespace org.acme.ext@1.0.0
            asset MyAsset2 identified by assetId {
                o String assetId
            }`;
            const model2 = `
            namespace org.acme@1.0.0
            import org.acme.ext@1.0.0.MyAsset3
            asset MyAsset identified by assetId {
                o String assetId
            }`;
            let modelFile1 = ParserUtil.newModelFile(modelManager, model1);
            modelManager.addModelFile(modelFile1);
            let modelFile2 = ParserUtil.newModelFile(modelManager, model2);
            (() => {
                modelFile2.validate();
            }).should.throw(IllegalModelException, /MyAsset3/);
        });

        it('should not throw if an import exists for a type that exists in a valid namespace', () => {
            const model1 = `
            namespace org.acme.ext@1.0.0
            asset MyAsset2 identified by assetId {
                o String assetId
            }`;
            const model2 = `
            namespace org.acme@1.0.0
            import org.acme.ext@1.0.0.MyAsset2
            asset MyAsset identified by assetId {
                o String assetId
            }`;
            let modelFile1 = ParserUtil.newModelFile(modelManager, model1);
            modelManager.addModelFile(modelFile1);
            let modelFile2 = ParserUtil.newModelFile(modelManager, model2);
            (() => modelFile2.validate()).should.not.throw();
        });

        it('should throw when attempting to import types from different versions of the same namespace', () => {
            const myModelManager = new ModelManager();

            const freddo1 = `namespace org.freddos@1.0.0
            concept Chocolate {}`;

            const freddo2 = `namespace org.freddos@2.0.0
            concept Chocolate {}`;

            const acme = `namespace org.acme@1.0.0
            import org.freddos@1.0.0.{ Chocolate }
            import org.freddos@2.0.0.{ Chocolate }
            `;

            let modelFile1 = ParserUtil.newModelFile(myModelManager, freddo1);
            myModelManager.addModelFile(modelFile1);

            let modelFile2 = ParserUtil.newModelFile(myModelManager, freddo2);
            myModelManager.addModelFile(modelFile2);

            let modelFile3 = ParserUtil.newModelFile(myModelManager, acme);

            (() => {
                modelFile3.validate();
            }).should.throw('Importing types from different versions ("1.0.0", "2.0.0") of the same namespace "org.freddos@2.0.0" is not permitted.');
        });

        it('should throw when declaring an ambiguous type', () => {
            const myModelManager = new ModelManager();

            const model1 = `namespace A@1.0.0

            concept B {
                o String name
            }`;

            const model2 = `namespace B@1.0.0

            import A@1.0.0.{B}

            concept B {
            }`;


            let modelFile1 = ParserUtil.newModelFile(myModelManager, model1);
            myModelManager.addModelFile(modelFile1);

            let modelFile2 = ParserUtil.newModelFile(myModelManager, model2);

            (() => {
                myModelManager.addModelFile(modelFile2);
            }).should.throw('Type \'B\' clashes with an imported type with the same name.');
        });

        it('should recognise a user-space type with the same name as a Prototype', () => {
            const model1 = `
            namespace A@1.0.0
            concept Transaction {}
            `;

            let modelFile1 = ParserUtil.newModelFile(modelManager, model1);

            (() => {
                modelManager.addModelFile(modelFile1);
            }).should.throw('Type \'Transaction\' clashes with an imported type with the same name.');
        });

    });

    describe('#getDefinitions', () => {

        it('should return the definitions for the model', () => {
            let modelFile = ParserUtil.newModelFile(modelManager, carLeaseModel);
            modelFile.getDefinitions().should.equal(carLeaseModel);
        });

    });

    describe('#getName', () => {

        it('should return the name of the model', () => {
            let modelFile = ParserUtil.newModelFile(modelManager, carLeaseModel, 'car lease');
            modelFile.getName().should.equal('car lease');
        });

    });

    describe('#isModelFile', () => {
        it('should return true if this is a ModelFile', () => {
            let modelFile = ParserUtil.newModelFile(modelManager, carLeaseModel, 'car lease');
            modelFile.isModelFile().should.equal(true);
        });
    });

    describe('#isExternal', () => {
        it('should return true if this ModelFile was downloaded from an external URI.', () => {
            let modelFile = ParserUtil.newModelFile(modelManager, carLeaseModel, '@carlease');
            modelFile.isExternal().should.equal(true);
        });

        it('should return false if this ModelFile was not downloaded from an external URI.', () => {
            let modelFile = ParserUtil.newModelFile(modelManager, carLeaseModel, 'carlease');
            modelFile.isExternal().should.equal(false);
        });
    });


    describe('#isImportedType', () => {

        it('should return false for a non-existent type', () => {
            const model = `
            namespace org.acme@1.0.0
            asset MyAsset identified by assetId {
                o String assetId
            }`;
            let modelFile = ParserUtil.newModelFile(modelManager, model);
            modelFile.isImportedType('Fred').should.be.false;
        });

        it('should return false for a local type', () => {
            const model = `
            namespace org.acme@1.0.0
            asset MyAsset identified by assetId {
                o String assetId
            }`;
            let modelFile = ParserUtil.newModelFile(modelManager, model);
            modelFile.isImportedType('MyAsset').should.be.false;
        });

        it('should return true for an explicitly imported type', () => {
            const model = `
            namespace org.acme@1.0.0
            import org.acme.ext@1.0.0.MyAsset2
            asset MyAsset identified by assetId {
                o String assetId
            }`;
            let modelFile = ParserUtil.newModelFile(modelManager, model);
            modelFile.isImportedType('MyAsset2').should.be.true;
        });
    });

    describe('#resolveImport', () => {

        it('should find the fully qualified name of the import', () => {
            const model = `
            namespace org.acme@1.0.0
            import org.doge@1.0.0.Coin`;
            let modelFile = ParserUtil.newModelFile(modelManager, model);
            modelFile.resolveImport('Coin').should.equal('org.doge@1.0.0.Coin');
        });

        it('should find the fully qualified name of a type using a wildcard import', () => {
            const model1 = `
            namespace org.acme.ext@1.0.0
            asset MyAsset2 identified by assetId {
                o String assetId
            }`;
            const model2 = `
            namespace org.acme@1.0.0
            import org.acme.ext@1.0.0.MyAsset2
            asset MyAsset identified by assetId {
                o String assetId
            }`;
            let modelFile1 = ParserUtil.newModelFile(modelManager, model1);
            modelManager.addModelFile(modelFile1);
            let modelFile2 = ParserUtil.newModelFile(modelManager, model2);
            modelFile2.resolveImport('MyAsset2').should.equal('org.acme.ext@1.0.0.MyAsset2');
        });

        it('should throw if it cannot resolve a type that is not imported', () => {
            const model = `
            namespace org.acme@1.0.0
            import org.doge@1.0.0.Wow`;
            let modelFile = ParserUtil.newModelFile(modelManager, model);
            (() => {
                modelFile.resolveImport('Coin');
            }).should.throw(/Coin/);
        });

        it('relatioship to an asset that does not exist', () => {
            const model2 = `
            namespace org.acme@1.0.0

            asset MyAsset identified by assetId {
                o String assetId
                --> DontExist relationship
            }`;

            let modelFile2 = ParserUtil.newModelFile(modelManager, model2);
            (() => {
                modelFile2.validate();
            }).should.throw(/DontExist/);
        });


    });

    describe('#aliasedImport', () => {

        beforeEach(()=>{
            modelManager.enableAliasedType=true;
        });
        it('should resolve aliased name of import type', () => {
            const model = `
            namespace org.acme
            import org.saluja.{doc as d}`;

            let modelFile = ParserUtil.newModelFile(modelManager, model);
            modelFile.resolveImport('d').should.equal('org.saluja.doc');
        });

        it('should not throw if an aliased import exists for a type that exists in a valid namespace', () => {
            const model1 = `
            namespace org.saluja.ext
            asset MyAsset2 identified by assetId {
                o String assetId
            }`;
            const model2 = `
            namespace org.acme
            import org.saluja.ext.{MyAsset2 as m}
            asset MyAsset identified by assetId {
                o String assetId
                o m[] arr
            }`;
            let modelFile1 = ParserUtil.newModelFile(modelManager, model1);
            modelManager.addModelFile(modelFile1);
            let modelFile2 = ParserUtil.newModelFile(modelManager, model2);
            (() => modelFile2.validate()).should.not.throw();
        });

        it('should not throw if an duplicate types aliased to distinct aliased names', () => {
            const model1 = `
            namespace org.saluja
            asset MyAsset identified by assetId {
                o String assetId
            }`;
            const model2 = `
            namespace org.acme
            asset MyAsset identified by assetId {
                o String assetId
            }`;

            const model3 = `
            namespace org.acme2
            import org.saluja.{MyAsset as m1}
            import org.acme.{MyAsset as m2}

            asset MyAsset identified by assetId {
                o String assetId
                o m1[] arr1
                o m2[] arr2
            }`;
            let modelFile1 = ParserUtil.newModelFile(modelManager, model1);
            modelManager.addModelFile(modelFile1);
            let modelFile2 = ParserUtil.newModelFile(modelManager, model2);
            modelManager.addModelFile(modelFile2);
            let modelFile3 = ParserUtil.newModelFile(modelManager, model3);
            (() => modelFile3.validate()).should.not.throw();
        });

        it('should not throw if map value is an aliased type', () => {
            const model1 = `
            namespace org.saluja
            asset Student identified by rollno {
                o String rollno
            }`;
            const model2 = `
            namespace org.acme
            import org.saluja.{Student as stud}

            map StudMap{
            o DateTime
            o stud
            }`;
            modelManager.enableMapType=true;
            let modelFile1 = ParserUtil.newModelFile(modelManager, model1);
            modelManager.addModelFile(modelFile1);
            let modelFile2 = ParserUtil.newModelFile(modelManager, model2);
            (() => modelFile2.validate()).should.not.throw();
        });

        it('should not throw if declaration is extended on a aliased type declaration', () => {
            const model1 = `
            namespace org.saluja

            scalar nickname extends String
            asset Vehicle identified by serialno {
                o String serialno
            }`;
            const model2 = `
            namespace org.acme
            import org.saluja.{Vehicle as V,nickname as nk}

            asset Car extends V{
                o String company
                o nk shortname
            }`;
            modelManager.enableMapType = true;
            let modelFile1 = ParserUtil.newModelFile(modelManager, model1);
            modelManager.addModelFile(modelFile1);
            let modelFile2 = ParserUtil.newModelFile(modelManager, model2);
            (() => modelFile2.validate()).should.not.throw();
        });
    });


    describe('#isDefined', () => {

        let modelManager;
        let modelFile;

        before(() => {
            modelManager = new ModelManager();
            Util.addComposerModel(modelManager);
            modelFile = modelManager.addCTOModel(`namespace org.acme@1.0.0
            asset MyAsset identified by assetId {
                o String assetId
            }`);
        });

        it('should return true for a primitive type', () => {
            modelFile.isDefined('String').should.be.true;
        });

        it('should return true for a local type', () => {
            modelFile.isDefined('MyAsset').should.be.true;
        });

        it('should return false for a local type that does not exist', () => {
            modelFile.isDefined('NoAsset').should.be.false;
        });

    });

    describe('#getType', () => {

        it('should passthrough the type name for primitive types', () => {
            const ast = {
                namespace: 'org.acme@1.0.0',
                body: [ ]
            };
            sandbox.stub(Parser, 'parse').returns(ast);
            let mf = ParserUtil.newModelFile(modelManager, 'fake definitions');
            mf.getType('String').should.equal('String');
        });

        it('should return false if imported, non primative\'s modelFile doesn\'t exist', () => {
            const ast = {
                namespace: 'org.acme@1.0.0',
                body: [ ]
            };
            sandbox.stub(Parser, 'parse').returns(ast);
            let mf = ParserUtil.newModelFile(modelManager, 'fake');
            mf.isImportedType = () => { return true; };
            mf.resolveImport = () => { return 'org.acme@1.0.0'; };
            should.not.exist(mf.getType('TNTAsset'));
        });
    });

    describe('#getAssetDeclaration', () => {

        it('should return the specified asset declaration', () => {
            let modelFile = ParserUtil.newModelFile(modelManager, carLeaseModel);
            let asset = modelFile.getAssetDeclaration('Vehicle');
            asset.should.be.an.instanceOf(AssetDeclaration);
        });

        it('should return null if it cannot find the specified asset declaration', () => {
            let modelFile = ParserUtil.newModelFile(modelManager, carLeaseModel);
            let asset = modelFile.getAssetDeclaration('Blobby');
            should.equal(asset, null);
        });

    });

    describe('#getParticipantDeclaration', () => {

        it('should return the specified Participant declaration', () => {
            let modelFile = ParserUtil.newModelFile(modelManager, carLeaseModel);
            let participant = modelFile.getParticipantDeclaration('Regulator');
            participant.should.be.an.instanceOf(ParticipantDeclaration);
        });

        it('should return null if it cannot find the specified Participant declaration', () => {
            let modelFile = ParserUtil.newModelFile(modelManager, carLeaseModel);
            let participant = modelFile.getParticipantDeclaration('Blobby');
            should.equal(participant, null);
        });

    });

    describe('#getTransactionDeclaration', () => {

        it('should return the specified Transaction declaration', () => {
            let modelFile = ParserUtil.newModelFile(modelManager, carLeaseModel);
            let transaction = modelFile.getTransactionDeclaration('VehicleCreated');
            transaction.should.be.an.instanceOf(TransactionDeclaration);
        });

        it('should return null if it cannot find the specified Transaction declaration', () => {
            let modelFile = ParserUtil.newModelFile(modelManager, carLeaseModel);
            let transaction = modelFile.getTransactionDeclaration('Blobby');
            should.equal(transaction, null);
        });

    });

    describe('#getEventDeclaration', () => {

        it('should return the specified Event declaration', () => {
            let modelFile = ParserUtil.newModelFile(modelManager, carLeaseModel);
            let event = modelFile.getEventDeclaration('TestEvent');
            event.should.be.an.instanceOf(EventDeclaration);
        });

        it('should return null if it cannot find the specified Event declaration', () => {
            let modelFile = ParserUtil.newModelFile(modelManager, carLeaseModel);
            let transaction = modelFile.getEventDeclaration('Blobby');
            should.equal(transaction, null);
        });

    });

    describe('#getEventDeclarations', () => {

        it('should return the expected number of Event declarations with system types', () => {
            let modelFile = ParserUtil.newModelFile(modelManager, carLeaseModel);
            let events = modelFile.getEventDeclarations();
            events.length.should.equal(1);
        });

        it('should return the expected number of Event declarations with system types', () => {
            let modelFile = ParserUtil.newModelFile(modelManager, carLeaseModel);
            let events = modelFile.getEventDeclarations(true);
            events.length.should.equal(1);
        });

        it('should return the expected number of Event declarations without system types', () => {
            let modelFile = ParserUtil.newModelFile(modelManager, carLeaseModel);
            let events = modelFile.getEventDeclarations();
            events.length.should.equal(1);
        });
    });

    describe('#getEnumDeclarations', () => {

        it('should return the expected number of Enum declarations', () => {
            let modelFile = ParserUtil.newModelFile(modelManager, carLeaseModel);
            let decls = modelFile.getEnumDeclarations();
            decls.should.all.be.an.instanceOf(EnumDeclaration);
            decls.length.should.equal(1);
        });

    });

    describe('#getScalarDeclarations', () => {
        it('should return the expected number of Scalar declarations', () => {
            let modelFile = ParserUtil.newModelFile(modelManager, carLeaseModel);
            let decls = modelFile.getScalarDeclarations();
            decls.should.all.be.an.instanceOf(ScalarDeclaration);
            decls.length.should.equal(1);
        });
    });

    describe('#getClassDeclarations', () => {
        it('should return the expected number of Class declarations', () => {
            let modelFile = ParserUtil.newModelFile(modelManager, carLeaseModel);
            let decls = modelFile.getClassDeclarations();
            decls.should.all.be.an.instanceOf(ClassDeclaration);
            decls.length.should.equal(16);
        });
    });

    describe('#getFullyQualifiedTypeName', () => {
        it('should return null if not prmative, imported or local type', () => {
            const ast = {
                namespace: 'org.acme@1.0.0',
                body: [ ]
            };
            sandbox.stub(Parser, 'parse').returns(ast);
            let mf = ParserUtil.newModelFile(modelManager, 'fake');
            mf.isImportedType = () => { return false; };
            mf.isLocalType = () => { return false; };
            should.not.exist(mf.getFullyQualifiedTypeName('TNTAsset'));
        });

        it('should return the type name if its a primative type', () => {
            const ast = {
                namespace: 'org.acme@1.0.0',
                body: [ ]
            };
            sandbox.stub(Parser, 'parse').returns(ast);
            let modelFile = ParserUtil.newModelFile(modelManager, 'something');

            modelFile.getFullyQualifiedTypeName('String').should.equal('String');
        });
    });

});
