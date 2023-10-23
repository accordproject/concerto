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
const ScalarDeclaration = require('../../lib/introspect/scalardeclaration');
const Field = require('../../lib/introspect/field');
const ModelFile = require('../../lib/introspect/modelfile');

// eslint-disable-next-line no-unused-vars
const should = require('chai').should();
const sinon = require('sinon');

describe('Scalars', () => {

    let mockClassDeclaration;
    let mockModelFile;
    let mockScalarDeclaration;

    beforeEach(() => {
        mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
        mockModelFile = sinon.createStubInstance(ModelFile);
        mockClassDeclaration.getModelFile.returns(mockModelFile);
        mockScalarDeclaration = sinon.createStubInstance(ScalarDeclaration);
        mockModelFile.getType.returns(mockScalarDeclaration);
        mockScalarDeclaration.isScalarDeclaration.returns(true);
    });

    describe('#unbox', () => {

        it('should throw for a non scalar property', () => {
            const p = new Field(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.StringProperty`,
                name: 'property',
            });
            (() => {
                p.getScalarField();
            }).should.throw(/Field property is not a scalar property./);
        });

        it('should throw for unknown scalar type', () => {
            mockScalarDeclaration.ast = {
                $class: `${MetaModelNamespace}.FooScalar`,
                name: 'MyScalar',
                defaultValue: 'abc'
            };
            const p = new Field(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.ObjectProperty`,
                name: 'property',
                type: {
                    name: 'MyScalar',
                }
            });
            (() => {
                p.getScalarField();
            }).should.throw(/Unrecognized scalar type/);
        });


        it('should unbox string', () => {
            mockScalarDeclaration.ast = {
                $class: `${MetaModelNamespace}.StringScalar`,
                name: 'MyScalar',
                defaultValue: 'abc'
            };
            const p = new Field(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.ObjectProperty`,
                name: 'property',
                type: {
                    name: 'MyScalar',
                }
            });
            p.getScalarField().getType().should.equal('String');
            p.getScalarField().ast.defaultValue.should.equal('abc');
        });

        it('should unbox integer', () => {
            mockScalarDeclaration.ast = {
                $class: `${MetaModelNamespace}.IntegerScalar`,
                name: 'MyScalar',
                defaultValue: 42
            };
            const p = new Field(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.ObjectProperty`,
                name: 'property',
                type: {
                    name: 'MyScalar',
                }
            });
            p.getScalarField().getType().should.equal('Integer');
            p.getScalarField().ast.defaultValue.should.equal(42);
        });

        it('should unbox boolean', () => {
            mockScalarDeclaration.ast = {
                $class: `${MetaModelNamespace}.BooleanScalar`,
                name: 'MyScalar',
                defaultValue: true
            };
            const p = new Field(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.ObjectProperty`,
                name: 'property',
                type: {
                    name: 'MyScalar',
                }
            });
            p.getScalarField().getType().should.equal('Boolean');
            p.getScalarField().ast.defaultValue.should.equal(true);
        });

        it('should unbox double', () => {
            mockScalarDeclaration.ast = {
                $class: `${MetaModelNamespace}.DoubleScalar`,
                name: 'MyScalar',
                defaultValue: 42.42
            };
            const p = new Field(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.ObjectProperty`,
                name: 'property',
                type: {
                    name: 'MyScalar',
                }
            });
            p.getScalarField().getType().should.equal('Double');
            p.getScalarField().ast.defaultValue.should.equal(42.42);
        });

        it('should unbox long', () => {
            mockScalarDeclaration.ast = {
                $class: `${MetaModelNamespace}.LongScalar`,
                name: 'MyScalar',
                defaultValue: 42
            };
            const p = new Field(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.ObjectProperty`,
                name: 'property',
                type: {
                    name: 'MyScalar',
                }
            });
            p.getScalarField().getType().should.equal('Long');
            p.getScalarField().ast.defaultValue.should.equal(42);
        });

        it('should unbox date/time', () => {
            mockScalarDeclaration.ast = {
                $class: `${MetaModelNamespace}.DateTimeScalar`,
                name: 'MyScalar'
            };
            const p = new Field(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.ObjectProperty`,
                name: 'property',
                type: {
                    name: 'MyScalar',
                }
            });
            p.getScalarField().getType().should.equal('DateTime');
        });

        it('should handle arrays correctly', () => {
            const p = new Field(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.StringProperty`,
                name: 'property',
                array: true
            });
            p.getScalarField().isArray().should.equal(true);
        });

        it('should handle non-arrays correctly', () => {
            const p = new Field(mockClassDeclaration, {
                $class: `${MetaModelNamespace}.StringProperty`,
                name: 'property',
            });
            p.getScalarField().isArray().should.equal(false);
        });
    });
});
