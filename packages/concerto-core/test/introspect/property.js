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

const ClassDeclaration = require('../../lib/introspect/classdeclaration');
const ModelFile = require('../../lib/introspect/modelfile');
const Property = require('../../lib/introspect/property');

const should = require('chai').should();
const sinon = require('sinon');

describe('Property', () => {

    let mockClassDeclaration;
    let mockModelFile;

    beforeEach(() => {
        mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
        mockModelFile = sinon.createStubInstance(ModelFile);
        mockClassDeclaration.getModelFile.returns(mockModelFile);
    });

    describe('#constructor', () => {

        it('throw an error for no name', () => {
            (() => {
                new Property(mockClassDeclaration, {
                    $class: `${MetaModelNamespace}.StringProperty`,
                    name: null
                });
            }).should.throw(/No name for type/);
        });

        it('should not throw for an identifier named null', () => {
            let p = new Property(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.StringProperty`,
                name: 'null'
            });
            p.name.should.equal('null');
        });

        it('should save the incoming property type', () => {
            let p = new Property(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.ObjectProperty`,
                name: 'property',
                type: {
                    $class: `${MetaModelNamespace}.TypeIdentifier`,
                    name: 'suchType',
                }
            });
            p.type.should.equal('suchType');
        });

        it('should handle a missing incoming property type', () => {
            let p = new Property(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.ObjectProperty`,
                name: 'property',
            });
            should.equal(p.type, null);
        });

        it('should not be an array by default', () => {
            let p = new Property(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.StringProperty`,
                name: 'property',
            });
            p.array.should.equal(false);
        });

        it('should mark as an array if required', () => {
            let p = new Property(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.StringProperty`,
                name: 'property',
                isArray: true
            });
            p.array.should.equal(true);
        });

    });

    describe('#hasInstance', () => {
        it('should return true for a valid Property', () => {
            let p = new Property(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.StringProperty`,
                name: 'property',
            });
            (p instanceof Property).should.be.true;
        });
    });

});
