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
const DecoratorManager = require('../src/decoratormanager');
const ModelManager = require('../src/modelmanager');
const VocabularyManager = require('@accordproject/concerto-vocabulary').VocabularyManager;
const Printer = require('@accordproject/concerto-cto').Printer;

const chai = require('chai');
const { DEPRECATION_WARNING, CONCERTO_DEPRECATION_001 } = require('@accordproject/concerto-util/lib/errorcodes');
require('chai').should();
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));

describe('DecoratorManager', () => {

    beforeEach(() => {
        process.env.ENABLE_MAP_TYPE = 'true'; // TODO Remove on release of MapType
    });

    afterEach(() => {
    });

    describe('#falsyOrEqual', function() {
        it('should match null', async function() {
            DecoratorManager.falsyOrEqual( null, ['one']).should.be.true;
        });

        it('should match undefined', async function() {
            DecoratorManager.falsyOrEqual( undefined, ['one']).should.be.true;
        });

        it('should match token', async function() {
            DecoratorManager.falsyOrEqual( 'one', ['one']).should.be.true;
        });

        it('should match token array', async function() {
            DecoratorManager.falsyOrEqual( ['one', 'two'], ['one', 'three']).should.be.true;
        });

        it('should match token', async function() {
            DecoratorManager.falsyOrEqual( 'one', ['one']).should.be.true;
        });

        it('should not match token', async function() {
            DecoratorManager.falsyOrEqual( 'one', ['two']).should.be.false;
        });
    });

    describe('#validate', function() {
        it('should support syntax validation', async function() {
            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/web.json'), 'utf-8');
            const validationModelManager = DecoratorManager.validate( JSON.parse(dcs));
            validationModelManager.should.not.be.null;
        });

        it('should support syntax validation with model files', async function() {
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');
            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/web.json'), 'utf-8');
            const validationModelManager = DecoratorManager.validate(JSON.parse(dcs), testModelManager.getModelFiles());
            validationModelManager.should.not.be.null;
            validationModelManager.getType('test@1.0.0.Person').should.not.be.null;
        });

        it('should fail syntax validation', async function() {
            (() => {
                DecoratorManager.validate( { $class: 'invalid' });
            }).should.throw(/Namespace is not defined for type/);
        });

        it('should fail syntax validation', async function() {
            (() => {
                DecoratorManager.validate( { invalid: true });
            }).should.throw(/Invalid JSON data/);
        });
    });

    describe('#decorateModels', function() {
        it('should support no validation', async function() {
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');
            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/web.json'), 'utf-8');
            let decoratedModelManager = DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs));
            decoratedModelManager.should.not.be.null;
        });

        it('should support syntax validation', async function() {
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');
            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/web.json'), 'utf-8');
            let decoratedModelManager = DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                {validate: true});
            decoratedModelManager.should.not.be.null;
        });

        it('should support semantic validation', async function() {
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');
            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/web.json'), 'utf-8');
            let decoratedModelManager = DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                {validate: true, validateCommands: true});
            decoratedModelManager.should.not.be.null;
        });

        it('should add decorators that target declarations', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/web.json'), 'utf-8');
            const decoratedModelManager = DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                {validate: true, validateCommands: true});

            const ssnDecl = decoratedModelManager.getType('test@1.0.0.SSN');
            ssnDecl.should.not.be.null;
            ssnDecl.getDecorator('PII').should.not.be.null;

            const decl = decoratedModelManager.getType('test@1.0.0.Person');
            decl.should.not.be.null;
            decl.getDecorator('Editable').should.not.be.null;
        });

        /*
        This test is target to the functionality wherein if there exists a namespace targeted decorator, it applies the decorator to
        all the declarations within the namespace, which has been identified as bug and will be deprecated.
        */
        it('should add decorators that target namespace and catch warning - behaviour to be deprecated', async function() {
            // event listner to catch the warning
            process.once('warning', (warning) => {
                chai.expect(warning.message).to.be.equals('DEPRECATED: Functionality for namespace targeted Decorator Command Sets has beed changed. Using namespace targets to apply decorators on all declarations in a namespace will be deprecated soon.');
                chai.expect(warning.name).to.be.equals(DEPRECATION_WARNING);
                chai.expect(warning.code).to.be.equals(CONCERTO_DEPRECATION_001);
                chai.expect(warning.detail).to.be.equals('Please refer to https://concerto.accordproject.org/deprecation/001');
            });
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/web.json'), 'utf-8');
            const decoratedModelManager = DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                {validate: true, validateCommands: true});

            const modelFile = decoratedModelManager.getModelFile('test@1.0.0');
            modelFile.should.not.be.null;
            chai.expect(modelFile.getDecorator('IsValid')).to.be.null;

            const ssnDecl = decoratedModelManager.getType('test@1.0.0.SSN');
            ssnDecl.should.not.be.null;
            ssnDecl.getDecorator('IsValid').should.not.be.null;

            const decl = decoratedModelManager.getType('test@1.0.0.Person');
            decl.should.not.be.null;
            decl.getDecorator('IsValid').should.not.be.null;
        });

        /*
        This test is target to the functionality wherein if there exists a namespace targeted decorator, it applies the decorator to the
        namespace, which is the new feature added can be accessed using the feature flag: ENABLE_DCS_NAMESPACE_TARGET.
        */
        it('should add decorators that target namespace - updated behaviour using environment variable', async function() {
            process.env.ENABLE_DCS_NAMESPACE_TARGET = 'true';
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/web.json'), 'utf-8');
            const decoratedModelManager = DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                {validate: true, validateCommands: true});

            const modelFile = decoratedModelManager.getModelFile('test@1.0.0');
            modelFile.should.not.be.null;
            modelFile.getDecorator('IsValid').should.not.be.null;

            const ssnDecl = decoratedModelManager.getType('test@1.0.0.SSN');
            ssnDecl.should.not.be.null;
            chai.expect(ssnDecl.getDecorator('IsValid')).to.be.null;
            process.env.ENABLE_DCS_NAMESPACE_TARGET = 'false';
        });

        /*
        This test is target to the functionality wherein if there exists a namespace targeted decorator, it applies the decorator to the
        namespace, which is the new feature added can be accessed using the option parameter: enableDcsNamespaceTarget.
        */
        it('should add decorators that target namespace - updated behaviour using options parameter', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/web.json'), 'utf-8');
            const decoratedModelManager = DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                {validate: true, validateCommands: true, enableDcsNamespaceTarget: true});

            const modelFile = decoratedModelManager.getModelFile('test@1.0.0');
            modelFile.should.not.be.null;
            modelFile.getDecorator('IsValid').should.not.be.null;

            const ssnDecl = decoratedModelManager.getType('test@1.0.0.SSN');
            ssnDecl.should.not.be.null;
            chai.expect(ssnDecl.getDecorator('IsValid')).to.be.null;
        });

        it('should add decorators that target properties', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/web.json'), 'utf-8');
            const decoratedModelManager = DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                {validate: true, validateCommands: true});

            const decl = decoratedModelManager.getType('test@1.0.0.Person');
            decl.should.not.be.null;

            const firstNameProperty = decl.getProperty('firstName');
            firstNameProperty.should.not.be.null;
            const decoratorFormFirstName = firstNameProperty.getDecorator('Form');
            decoratorFormFirstName.should.not.be.null;
            decoratorFormFirstName.getArguments()[0].should.equal('inputType');
            decoratorFormFirstName.getArguments()[1].should.equal('text');

            const decoratorCustomFirstName = firstNameProperty.getDecorator('Custom');
            decoratorCustomFirstName.should.not.be.null;

            const bioProperty = decl.getProperty('bio');
            bioProperty.should.not.be.null;
            const decoratorBio = bioProperty.getDecorator('Form');
            decoratorBio.should.not.be.null;
            decoratorBio.getArguments()[0].should.equal('inputType');
            decoratorBio.getArguments()[1].should.equal('textArea');

            const decoratorUnversionedNamespace = bioProperty.getDecorator('UnversionedNamespace');
            decoratorUnversionedNamespace.should.not.be.null;

            // applied using property, no type
            const address1Property = decl.getProperty('address1');
            address1Property.should.not.be.null;
            const decoratorAddress1Property = address1Property.getDecorator('Address');
            decoratorAddress1Property.should.not.be.null;

            // applied using property, string type
            const countryProperty = decl.getProperty('country');
            countryProperty.should.not.be.null;
            const decoratorCountryProperty = countryProperty.getDecorator('Address');
            decoratorCountryProperty.should.not.be.null;

            // applied using properties, string types only
            const address2Property = decl.getProperty('address2');
            address2Property.should.not.be.null;
            const decoratorAddress2Property = address2Property.getDecorator('Address');
            decoratorAddress2Property.should.not.be.null;

            // applied using properties, but not a string property
            const zipProperty = decl.getProperty('zip');
            zipProperty.should.not.be.null;
            const decoratorZipProperty = zipProperty.getDecorator('Address');
            (decoratorZipProperty ===null).should.be.true;

            // applied using properties, no type
            const cityProperty = decl.getProperty('city');
            cityProperty.should.not.be.null;
            const decoratorCity2Property = cityProperty.getDecorator('Address');
            decoratorCity2Property.should.not.be.null;
        });

        it('should decorate the specified MapDeclaration', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true, skipLocationNodes: true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/map-declaration.json'), 'utf-8');
            const decoratedModelManager = DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                {validate: true, validateCommands: true});

            const dictionary = decoratedModelManager.getType('test@1.0.0.Dictionary');
            dictionary.should.not.be.null;
            dictionary.getDecorator('MapDeclarationDecorator').should.not.be.null;
        });

        it('should decorate the specified element on the specified Map Declaration (Map Key)', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true, skipLocationNodes: true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/map-declaration.json'), 'utf-8');
            const decoratedModelManager = DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                {validate: true, validateCommands: true});

            const dictionary = decoratedModelManager.getType('test@1.0.0.Dictionary');
            dictionary.should.not.be.null;
            dictionary.key.getDecorator('Foo').should.not.be.null;
            dictionary.key.getDecorator('Qux').should.not.be.null;
        });

        it('should auto upgrade decoratorcommands $class minor version if it is below DCS_VERSION (asserts decorators are correctly applied)', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true, skipLocationNodes: true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/incompatible_version_dcs.json'), 'utf-8');
            const decoratedModelManager = DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                {validate: true, validateCommands: true, migrate: true});

            const dictionary = decoratedModelManager.getType('test@1.0.0.Dictionary');
            dictionary.should.not.be.null;
            dictionary.key.getDecorator('Foo').should.not.be.null;
            dictionary.key.getDecorator('Qux').should.not.be.null;
        });


        it('should auto upgrade decoratorcommands $class minor version if it is below DCS_VERSION (asserts correct upgrade on DCS $class properties)', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true, skipLocationNodes: true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            let dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/incompatible_version_dcs.json'), 'utf-8');
            dcs = DecoratorManager.migrateTo(JSON.parse(dcs), '0.3.0');

            dcs.$class.should.equal('org.accordproject.decoratorcommands@0.3.0.DecoratorCommandSet');
            dcs.commands[0].$class.should.equal('org.accordproject.decoratorcommands@0.3.0.Command');
            dcs.commands[0].target.$class.should.equal('org.accordproject.decoratorcommands@0.3.0.CommandTarget');
            dcs.commands[0].target.type.should.equal('concerto.metamodel@1.0.0.StringMapKeyType'); // concerto metamodel $class does not change
            dcs.commands[0].decorator.$class.should.equal('concerto.metamodel@1.0.0.Decorator'); // concerto metamodel $class does not change
        });

        it('should decorate the specified type on the specified Map Declaration (Map Key)', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true, skipLocationNodes: true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/map-declaration.json'), 'utf-8');
            const decoratedModelManager = DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                {validate: true, validateCommands: true});

            const dictionary = decoratedModelManager.getType('test@1.0.0.Dictionary');
            dictionary.should.not.be.null;
            dictionary.key.getDecorator('DecoratesKeyByType').should.not.be.null;
        });

        it('should decorate the specified element on the specified Map Declaration (Map Value)', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true, skipLocationNodes: true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/map-declaration.json'), 'utf-8');
            const decoratedModelManager = DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                {validate: true, validateCommands: true});

            const dictionary = decoratedModelManager.getType('test@1.0.0.Dictionary');

            dictionary.should.not.be.null;
            dictionary.value.getDecorator('Bar').should.not.be.null;
            dictionary.value.getDecorator('Quux').should.not.be.null;
        });

        it('should decorate the specified type on the specified Map Declaration (Map Value)', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true, skipLocationNodes: true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/map-declaration.json'), 'utf-8');
            const decoratedModelManager = DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                {validate: true, validateCommands: true});

            const dictionary = decoratedModelManager.getType('test@1.0.0.Dictionary');
            dictionary.should.not.be.null;
            dictionary.value.getDecorator('DecoratesValueByType').should.not.be.null;
        });

        it('should decorate Declaration, Key and Value elements on the specified Map Declaration', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true, skipLocationNodes: true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/map-declaration.json'), 'utf-8');
            const decoratedModelManager = DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                {validate: true, validateCommands: true});

            const dictionary = decoratedModelManager.getType('test@1.0.0.Dictionary');

            dictionary.should.not.be.null;
            dictionary.getDecorator('MapDeclarationDecorator').should.not.be.null;
            dictionary.key.getDecorator('Baz').should.not.be.null;
            dictionary.value.getDecorator('Baz').should.not.be.null;
        });

        it('should decorate a Key and Value element on an unspecified Map Declaration when a type is specified (type takes precedence over element value KEY_VALUE)', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true, skipLocationNodes: true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/map-declaration.json'), 'utf-8');
            const decoratedModelManager = DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                {validate: true, validateCommands: true});

            const dictionary = decoratedModelManager.getType('test@1.0.0.Dictionary');

            dictionary.should.not.be.null;
            dictionary.key.getDecorator('Bazola').should.not.be.null;
            dictionary.value.getDecorator('Bongo').should.not.be.null;
        });

        it('should decorate all Map Declaration Key and Value elements on the model when a declaration is not specified', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true, skipLocationNodes: true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/map-declaration.json'), 'utf-8');
            const decoratedModelManager = DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                {validate: true, validateCommands: true});


            const dictionary    = decoratedModelManager.getType('test@1.0.0.Dictionary');
            const rolodex       = decoratedModelManager.getType('test@1.0.0.Rolodex');

            dictionary.should.not.be.null;
            dictionary.key.getDecorator('DecoratesAllMapKeys').should.not.be.null;
            dictionary.value.getDecorator('DecoratesAllMapValues').should.not.be.null;

            rolodex.should.not.be.null;
            rolodex.key.getDecorator('DecoratesAllMapKeys').should.not.be.null;
            rolodex.value.getDecorator('DecoratesAllMapValues').should.not.be.null;
        });

        it('should fail with invalid command', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/invalid-command.json'), 'utf-8');

            (() => {
                DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs));
            }).should.throw(/Unknown command type INVALID/);
        });
    });

    describe('#validateCommand', function() {
        it('should detect invalid type', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/invalid-type.json'), 'utf-8');

            (() => {
                DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                    {validate: true, validateCommands: true});
            }).should.throw(/No type "concerto.metamodel@1.0.0.Foo" in namespace "concerto.metamodel@1.0.0" for "DecoratorCommand.type"/);
        });

        it('should detect invalid target namespace', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/invalid-target-namespace.json'), 'utf-8');

            (() => {
                DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                    {validate: true, validateCommands: true});
            }).should.throw(/Decorator Command references namespace "missing@1.0.0" which does not exist./);
        });

        it('should detect invalid target declaration', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/invalid-target-declaration.json'), 'utf-8');

            (() => {
                DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                    {validate: true, validateCommands: true});
            }).should.throw(/No type "test@1.0.0.Missing" in namespace "test@1.0.0" for "DecoratorCommand.target.declaration./);
        });

        it('should detect invalid target property', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/invalid-target-property.json'), 'utf-8');

            (() => {
                DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                    {validate: true, validateCommands: true});
            }).should.throw(/Decorator Command references property "test@1.0.0.Person.missing" which does not exist./);
        });

        it('should detect invalid target properties', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/invalid-target-properties.json'), 'utf-8');

            (() => {
                DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                    {validate: true, validateCommands: true});
            }).should.throw(/Decorator Command references property "test@1.0.0.Person.missing" which does not exist./);
        });

        it('should detect target referencing both property and properties', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/invalid-target-property-properties.json'), 'utf-8');

            (() => {
                DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                    {validate: true, validateCommands: true});
            }).should.throw(/Decorator Command references both property and properties. You must either reference a single property or a list of properites./);
        });
    });

    describe('#validate', function() {
        it('should detect decorator command set that is invalid', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/invalid-model.json'), 'utf-8');

            (() => {
                DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                    {validate: true});
            }).should.throw(/Type "Invalid" is not defined in namespace "org.accordproject.decoratorcommands@0.3.0"/);
        });

        it('should detect decorator command set with an invalid command type', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/invalid-command.json'), 'utf-8');

            (() => {
                DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                    {validate: true});
            }).should.throw(/Model violation in the "concerto.metamodel@1.0.0.Decorator" instance. Invalid enum value of "INVALID" for the field "CommandType"/);
        });
    });

    describe('#extractDecorators', function() {
        it('should be able to extract decorators and vocabs from a model withoup options', async function() {
            const testModelManager = new ModelManager({strict:true,});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/extract-test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');
            const resp = DecoratorManager.extractDecorators( testModelManager);
            const dcs = resp.decoratorCommandSet;
            dcs.should.not.be.null;
        });
        it('should ensure that extraction and re-application of decorators and vocabs from a model is an identity operation', async function() {
            const testModelManager = new ModelManager();
            const sourceCTO = [];
            const updatedCTO = [];
            const modelTextWithoutNamespace = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/extract-test.cto'), 'utf-8');
            testModelManager.addCTOModel(modelTextWithoutNamespace, 'test.cto');
            const options = {
                removeDecoratorsFromModel:true,
                locale:'en'
            };
            const namespaceSource = testModelManager.getNamespaces().filter(namespace=>namespace!=='concerto@1.0.0' && namespace!=='concerto');
            namespaceSource.forEach(name=>{
                let model = testModelManager.getModelFile(name);
                let modelAst=model.getAst();
                let data =  Printer.toCTO(modelAst);
                sourceCTO.push(data);
            });
            const resp = DecoratorManager.extractDecorators( testModelManager, options);
            const dcs = resp.decoratorCommandSet;
            const vocabs= resp.vocabularies;
            let newModelManager=resp.modelManager;
            const vocManager = new VocabularyManager();
            vocabs.forEach(content => {
                vocManager.addVocabulary(content);
            });
            const vocabKeySet=[];
            const namespaceUpdated = newModelManager.getNamespaces().filter(namespace=>namespace!=='concerto@1.0.0' && namespace!=='concerto');
            namespaceUpdated.forEach(name=>{
                let vocab = vocManager.getVocabulariesForNamespace(name);
                vocab.forEach(voc=>vocabKeySet.push(voc.getLocale()));
            });
            vocabKeySet.map(voc=>{
                let commandSet = vocManager.generateDecoratorCommands(newModelManager, voc);
                newModelManager = DecoratorManager.decorateModels(newModelManager, commandSet);
            });
            dcs.forEach(content => {
                newModelManager = DecoratorManager.decorateModels(newModelManager, (content));
            });
            namespaceUpdated.forEach(name=>{
                let model = newModelManager.getModelFile(name);
                let modelAst=model.getAst();
                let data =  Printer.toCTO(modelAst);
                updatedCTO.push(data);
            });
            sourceCTO.should.be.deep.equal(updatedCTO);
        });
        it('should give proper response in there is no vocabulary on any model', async function() {
            const testModelManager = new ModelManager({strict:true,});
            const modelText = fs.readFileSync(path.join(__dirname,'/data/decoratorcommands/model-without-vocab.cto'), 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');
            const resp = DecoratorManager.extractDecorators( testModelManager);
            const vocab = resp.vocabularies;
            vocab.should.be.deep.equal([]);
        });
    });

});
