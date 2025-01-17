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
const Decorator = require('../../src/introspect/decorator');

require('chai').should();
const sinon = require('sinon');
const ModelManager = require('../../lib/modelmanager');
const ModelFile = require('../../lib/introspect/modelfile');

const fs = require('fs');
const path = require('path');
const { expect } = require('chai');

describe('Decorator', () => {

    let mockAssetDeclaration;

    const ast = {
        $class: `${MetaModelNamespace}.Decorator`,
        name: 'Test',
        arguments: [
            {
                $class: `${MetaModelNamespace}.DecoratorString`,
                value:'one'
            },
            {
                $class: `${MetaModelNamespace}.DecoratorString`,
                value:'two'
            },
            {
                $class: `${MetaModelNamespace}.DecoratorString`,
                value:'three'
            }
        ]
    };

    beforeEach(() => {
        mockAssetDeclaration = sinon.createStubInstance(AssetDeclaration);
    });

    describe('#constructor', () => {

        it('should store values', () => {

            const d = new Decorator(mockAssetDeclaration, ast);
            d.getParent().should.equal(mockAssetDeclaration);
            d.getName().should.equal('Test');
            d.getArguments().should.deep.equal(['one','two','three']);
            d.isDecorator().should.equal(true);

        });
    });

    describe('#accept', () => {

        it('should call the visitor', () => {
            const d = new Decorator(mockAssetDeclaration, ast);
            let visitor = {
                visit: sinon.stub()
            };
            d.accept(visitor, ['some', 'args']);
            sinon.assert.calledOnce(visitor.visit);
            sinon.assert.calledWith(visitor.visit, d, ['some', 'args']);
        });

    });
});

describe('Decorator - Test for Decorator arguments using Import Aliasing', () => {

    let modelManager;
    let resolvedModelManager;

    beforeEach(() => {
        modelManager = new ModelManager({ strict: true, importAliasing: true, enableMapType: true});

        const childModelCTO = fs.readFileSync(path.resolve(__dirname, '../data/aliasing/child.cto'), 'utf8');
        const parentModelCTO = fs.readFileSync(path.resolve(__dirname, '../data/aliasing/parent.cto'), 'utf8');

        modelManager.addCTOModel(childModelCTO, 'child@1.0.0.cto');
        modelManager.addCTOModel(parentModelCTO, 'parent@1.0.0.cto');
        const resolvedMetamodelChild = modelManager.resolveMetaModel(modelManager.getAst().models[0]);
        const resolvedMetamodelParent = modelManager.resolveMetaModel(modelManager.getAst().models[1]);
        resolvedModelManager = new ModelManager({ strict: true, importAliasing: true, enableMapType: true});
        const resolvedModelFileChild = new ModelFile(resolvedModelManager, resolvedMetamodelChild, 'child@1.0.0.cto');
        const resolvedModelFileParent = new ModelFile(resolvedModelManager, resolvedMetamodelParent, 'parent@1.0.0.cto');
        resolvedModelManager.addModelFiles([resolvedModelFileChild, resolvedModelFileParent], ['child@1.0.0.cto', 'parent@1.0.0.cto']);
    });

    describe('#validate', () => {

        it('should be able get validate a decorator on a classDeclaration whose argument is an imported type which is aliased', () => {
            const classDeclaration = resolvedModelManager.getType('parent@1.0.0.Child');
            const decorator = classDeclaration.getDecorators()[0];
            expect(decorator.validate.bind(decorator)).to.not.throw();
        });

        it('should be able get validate a decorator on a namespace whose argument is an imported type which is aliased', () => {
            const classDeclaration = resolvedModelManager.getModelFile('parent@1.0.0');
            const decorator = classDeclaration.getDecorators()[0];
            expect(decorator.validate.bind(decorator)).to.not.throw();
        });
    });
});
