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
const DecoratorManager = require('../lib/decoratormanager');
const ModelManager = require('../lib/modelmanager');

const chai = require('chai');
require('chai').should();
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));

describe('DecoratorManager', () => {

    beforeEach(() => {
    });

    afterEach(() => {
    });

    describe('#falsyOrEqual', function() {
        it('should match null', async function() {
            DecoratorManager.falsyOrEqual( null, 'one').should.be.true;
        });

        it('should match undefined', async function() {
            DecoratorManager.falsyOrEqual( undefined, 'one').should.be.true;
        });

        it('should match token', async function() {
            DecoratorManager.falsyOrEqual( 'one', 'one').should.be.true;
        });

        it('should not match token', async function() {
            DecoratorManager.falsyOrEqual( 'one', 'two').should.be.false;
        });
    });

    describe('#decorateModels', function() {
        it('should add decorator', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync('./test/data/decoratorcommands/test.cto', 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync('./test/data/decoratorcommands/web.json', 'utf-8');
            const decoratedModelManager = DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                {validate: true});

            const ssnDecl = decoratedModelManager.getType('test@1.0.0.SSN');
            ssnDecl.should.not.be.null;
            ssnDecl.getDecorator('PII').should.not.be.null;

            const decl = decoratedModelManager.getType('test@1.0.0.Person');
            decl.should.not.be.null;
            decl.getDecorator('Editable').should.not.be.null;

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
        });

        it('should fail with invalid command', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync('./test/data/decoratorcommands/test.cto', 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync('./test/data/decoratorcommands/invalid-command.json', 'utf-8');

            (() => {
                DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs));
            }).should.throw(/Unknown command type INVALID/);
        });
    });

    describe('#validateCommand', function() {
        it('should detect invalid type', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync('./test/data/decoratorcommands/test.cto', 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync('./test/data/decoratorcommands/invalid-type.json', 'utf-8');

            (() => {
                DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                    {validate: true, validateCommands: true});
            }).should.throw(/No type "concerto.metamodel@1.0.0.Foo" in namespace "concerto.metamodel@1.0.0" for "DecoratorCommand.type"/);
        });

        it('should detect invalid target namespace', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync('./test/data/decoratorcommands/test.cto', 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync('./test/data/decoratorcommands/invalid-target-namespace.json', 'utf-8');

            (() => {
                DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                    {validate: true, validateCommands: true});
            }).should.throw(/Decorator Command references namespace "missing@1.0.0" which does not exist./);
        });

        it('should detect invalid target declaration', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync('./test/data/decoratorcommands/test.cto', 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync('./test/data/decoratorcommands/invalid-target-declaration.json', 'utf-8');

            (() => {
                DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                    {validate: true, validateCommands: true});
            }).should.throw(/No type "test@1.0.0.Missing" in namespace "test@1.0.0" for "DecoratorCommand.target.declaration./);
        });

        it('should detect invalid target property', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync('./test/data/decoratorcommands/test.cto', 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync('./test/data/decoratorcommands/invalid-target-property.json', 'utf-8');

            (() => {
                DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                    {validate: true, validateCommands: true});
            }).should.throw(/Decorator Command references property "test@1.0.0.Person.missing" which does not exist./);
        });
    });

    describe('#validate', function() {
        it('should detect decorator command set that is invalid', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync('./test/data/decoratorcommands/test.cto', 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync('./test/data/decoratorcommands/invalid-model.json', 'utf-8');

            (() => {
                DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                    {validate: true});
            }).should.throw(/Type "Invalid" is not defined in namespace "org.accordproject.decoratorcommands@0.2.0"/);
        });

        it('should detect decorator command set with an invalid command type', async function() {
            // load a model to decorate
            const testModelManager = new ModelManager({strict:true});
            const modelText = fs.readFileSync('./test/data/decoratorcommands/test.cto', 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync('./test/data/decoratorcommands/invalid-command.json', 'utf-8');

            (() => {
                DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs),
                    {validate: true});
            }).should.throw(/Model violation in the "concerto.metamodel@1.0.0.Decorator" instance. Invalid enum value of "INVALID" for the field "CommandType"/);
        });
    });
});
