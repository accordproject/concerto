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

const ClassDeclaration = require('../../src/introspect/classdeclaration');
const ModelFile = require('../../src/introspect/modelfile');
const Property = require('../../src/introspect/property');
const ModelManager = require('../../src/modelmanager');

const should = require('chai').should();
const sinon = require('sinon');

const fs = require('fs');
const path = require('path');

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

        it('should throw for a bad property identifier', () => {
            (() => {
                new Property(mockClassDeclaration, {
                    $class: `${MetaModelNamespace}.StringProperty`,
                    name: '1st',
                });
            }).should.throw(/Invalid property name '1st'/);
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

describe('Property - Test for property types using Import Aliasing', () => {

    let modelManager;
    let resolvedModelManager;

    beforeEach(() => {
        modelManager = new ModelManager({importAliasing: true, enableMapType: true});

        const childModelCTO = fs.readFileSync(path.resolve(__dirname, '../data/aliasing/child.cto'), 'utf8');
        const parentModelCTO = fs.readFileSync(path.resolve(__dirname, '../data/aliasing/parent.cto'), 'utf8');

        modelManager.addCTOModel(childModelCTO, 'child@1.0.0.cto');
        modelManager.addCTOModel(parentModelCTO, 'parent@1.0.0.cto');
        const resolvedMetamodelChild = modelManager.resolveMetaModel(modelManager.getAst().models[0]);
        const resolvedMetamodelParent = modelManager.resolveMetaModel(modelManager.getAst().models[1]);
        resolvedModelManager = new ModelManager({importAliasing: true, enableMapType: true});
        const resolvedModelFileChild = new ModelFile(resolvedModelManager, resolvedMetamodelChild, 'child@1.0.0.cto');
        const resolvedModelFileParent = new ModelFile(resolvedModelManager, resolvedMetamodelParent, 'parent@1.0.0.cto');
        resolvedModelManager.addModelFiles([resolvedModelFileChild, resolvedModelFileParent], ['child@1.0.0.cto', 'parent@1.0.0.cto']);
    });

    describe('#getType', () => {

        it('should return the local aliased name of the Type', () => {
            const classDeclaration = resolvedModelManager.getType('parent@1.0.0.Child');
            const property = classDeclaration.getProperty('kid');
            property.getType().should.equal('Kid');
        });

    });

    describe('#getFullyQualifiedTypeName', () => {

        it('should return the fully qualified type of name of the base classDeclaration that was imported aliased', () => {
            const classDeclaration = resolvedModelManager.getType('parent@1.0.0.Child');
            const property = classDeclaration.getProperty('kid');
            property.getFullyQualifiedTypeName().should.equal('child@1.0.0.Child');
        });

    });

    describe('#getFullyQualifiedName', () => {

        it('should return the fully qualified name of the property', () => {
            const classDeclaration = resolvedModelManager.getType('parent@1.0.0.Child');
            const property = classDeclaration.getProperty('kid');
            property.getFullyQualifiedName().should.equal('parent@1.0.0.Child.kid');
        });

    });

});
