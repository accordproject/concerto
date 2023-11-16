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
const DecoratorManager = require('../dist/decoratormanager');
const ModelManager = require('../dist/modelmanager');

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
            const decoratorModelManager = new ModelManager();
            // validate the decorator model
            const decoratorModelText = fs.readFileSync('./test/data/decoratorcommands/decorators.cto', 'utf-8');
            decoratorModelManager.addCTOModel(decoratorModelText, 'decorators.cto', true);
            decoratorModelManager.updateExternalModels();

            // load a model to decorate
            const testModelManager = new ModelManager();
            const modelText = fs.readFileSync('./test/data/decoratorcommands/test.cto', 'utf-8');
            testModelManager.addCTOModel(modelText, 'test.cto');

            const dcs = fs.readFileSync('./test/data/decoratorcommands/web.json', 'utf-8');
            const decoratedModelManager = DecoratorManager.decorateModels( testModelManager, JSON.parse(dcs));

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
    });

});
