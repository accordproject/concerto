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

const ModelFile = require('../../src/introspect/modelfile');
const AssetDeclaration = require('../../src/introspect/assetdeclaration');
const Decorator = require('../../src/introspect/decorator');

require('chai').should();
const sinon = require('sinon');

describe('Decorator', () => {

    let mockAssetDeclaration;
    let mockModelFile;

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
        mockModelFile = sinon.createStubInstance(ModelFile);
    });

    describe('#constructor', () => {

        it('should store values', () => {

            const d = new Decorator(mockModelFile, mockAssetDeclaration, ast);
            d.getParent().should.equal(mockAssetDeclaration);
            d.getName().should.equal('Test');
            d.getArguments().should.deep.equal(['one','two','three']);
            d.isDecorator().should.equal(true);

        });
    });

    describe('#accept', () => {

        it('should call the visitor', () => {
            const d = new Decorator(mockModelFile, mockAssetDeclaration, ast);
            let visitor = {
                visit: sinon.stub()
            };
            d.accept(visitor, ['some', 'args']);
            sinon.assert.calledOnce(visitor.visit);
            sinon.assert.calledWith(visitor.visit, d, ['some', 'args']);
        });

    });
});
