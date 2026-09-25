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

const { ClassDeclaration } = require('../../src/introspect/classdeclaration');
const { ModelFile } = require('../../src/introspect/modelfile');
const { Property } = require('../../src/introspect/property');
const { ModelManager } = require('../../src/modelmanager');

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
        modelManager = new ModelManager();

        const childModelCTO = fs.readFileSync(path.resolve(__dirname, '../data/aliasing/child.cto'), 'utf8');
        const parentModelCTO = fs.readFileSync(path.resolve(__dirname, '../data/aliasing/parent.cto'), 'utf8');

        modelManager.addCTOModel(childModelCTO, 'child@1.0.0.cto');
        modelManager.addCTOModel(parentModelCTO, 'parent@1.0.0.cto');
        const resolvedMetamodelChild = modelManager.resolveMetaModel(modelManager.getAst().models[0]);
        const resolvedMetamodelParent = modelManager.resolveMetaModel(modelManager.getAst().models[1]);
        resolvedModelManager = new ModelManager();
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

    describe('#getSizeValidator', () => {

        it('should reject size on a non-array String property', () => {
            (() => {
                const mm = new ModelManager();
                mm.addCTOModel('namespace t@1.0.0\nconcept A { o String name size=[1,5] }');
            }).should.throw(/size validator can only be applied to array or map/);
        });

        it('should reject size on a non-array Integer property', () => {
            (() => {
                const mm = new ModelManager();
                mm.addCTOModel('namespace t@1.0.0\nconcept A { o Integer count size=[1,5] }');
            }).should.throw(/size validator can only be applied to array or map/);
        });

        it('should reject size on a non-array, non-map object property', () => {
            (() => {
                const mm = new ModelManager();
                mm.addCTOModel('namespace t@1.0.0\nconcept B { o String x }\nconcept A { o B thing size=[1,5] }');
            }).should.throw(/size validator can only be applied to array or map/);
        });

        it('should reject negative minSize', () => {
            (() => {
                const mm = new ModelManager();
                mm.addCTOModel('namespace t@1.0.0\nconcept A { o String[] tags size=[-1,5] }');
            }).should.throw(/positive integers/);
        });

        it('should reject negative maxSize', () => {
            (() => {
                const mm = new ModelManager();
                mm.addCTOModel('namespace t@1.0.0\nconcept A { o String[] tags size=[1,-5] }');
            }).should.throw(/positive integers/);
        });

        it('should reject minSize greater than maxSize', () => {
            (() => {
                const mm = new ModelManager();
                mm.addCTOModel('namespace t@1.0.0\nconcept A { o String[] tags size=[10,2] }');
            }).should.throw(/minSize must be less than or equal to maxSize/);
        });

        it('should allow size on an array property', () => {
            const mm = new ModelManager();
            mm.addCTOModel('namespace t@1.0.0\nconcept A { o String[] tags size=[1,10] }');
            const prop = mm.getType('t@1.0.0.A').getProperty('tags');
            prop.getSizeValidator().getMinSize().should.equal(1);
            prop.getSizeValidator().getMaxSize().should.equal(10);
        });

        it('should allow size on a map-typed property', () => {
            const mm = new ModelManager();
            mm.addCTOModel('namespace t@1.0.0\nmap M { o String\n o String }\nconcept A { o M data size=[1,5] }');
            const prop = mm.getType('t@1.0.0.A').getProperty('data');
            prop.getSizeValidator().getMinSize().should.equal(1);
            prop.getSizeValidator().getMaxSize().should.equal(5);
        });

        it('should allow size on a map-typed property imported from another namespace', () => {
            const mm = new ModelManager();
            mm.addCTOModel('namespace maps@1.0.0\nmap PhoneBook { o String\n o String }');
            mm.addCTOModel('namespace t@1.0.0\nimport maps@1.0.0.PhoneBook\nconcept A { o PhoneBook contacts size=[1,10] }');
            const prop = mm.getType('t@1.0.0.A').getProperty('contacts');
            prop.getSizeValidator().getMinSize().should.equal(1);
        });

        it('should allow size on a relationship array', () => {
            const mm = new ModelManager();
            mm.addCTOModel('namespace t@1.0.0\nconcept P identified by id { o String id }\nconcept A { --> P[] refs size=[1,3] }');
            const prop = mm.getType('t@1.0.0.A').getProperty('refs');
            prop.getSizeValidator().getMinSize().should.equal(1);
        });

        it('should return null when no size validator', () => {
            const mm = new ModelManager();
            mm.addCTOModel('namespace t@1.0.0\nconcept A { o String[] tags }');
            const prop = mm.getType('t@1.0.0.A').getProperty('tags');
            should.equal(prop.getSizeValidator(), null);
        });

    });

});
