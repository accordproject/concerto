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

const IllegalModelException = require('../../src/introspect/illegalmodelexception');
const ClassDeclaration = require('../../src/introspect/classdeclaration');
const AssetDeclaration = require('../../src/introspect/assetdeclaration');
const ConceptDeclaration = require('../../src/introspect/conceptdeclaration');
const ModelFile = require('../../src/introspect/modelfile');
const IntrospectUtils = require('./introspectutils');
const ParserUtil = require('./parserutility');

const ModelManager = require('../../src/modelmanager');
const Util = require('../composer/composermodelutility');

const should = require('chai').should();
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');

describe('ClassDeclaration', () => {

    let modelManager;
    let modelFile;
    let introspectUtils;

    beforeEach(() => {
        modelManager = new ModelManager();
        Util.addComposerModel(modelManager);
        introspectUtils = new IntrospectUtils(modelManager);
        modelFile = ParserUtil.newModelFile(modelManager, 'namespace com.hyperledger.testing@1.0.0', 'org.acme.cto');
    });

    describe('#constructor', () => {

        it('should throw if ast contains invalid type', () => {
            (() => {
                new ClassDeclaration(modelFile, {
                    name: 'suchName',
                    properties: [{
                        $class: 'noSuchType'
                    }]
                });
            }).should.throw(/Unrecognised model element/);
        });

        it('should throw for a bad identifier', () => {
            (() => {
                new ClassDeclaration(modelFile, {
                    name: '2nd',
                    properties: []
                });
            }).should.throw(/Invalid class name '2nd'/);
        });
    });

    describe('#validate', () => {
        it('should throw when an super type identifier is redeclared', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/classdeclaration.identifierextendsfromsupertype.cto', AssetDeclaration);
            (() => {
                asset.validate();
            }).should.throw(/Super class com.testing@1.0.0.p1 has an explicit identifier a1 that cannot be redeclared/);
        });

        it('should throw when not abstract, not enum and not concept without an identifier', () => {
            let asset = introspectUtils.loadLastDeclaration('test/data/parser/classdeclaration.noidentifier.cto', AssetDeclaration);
            asset.superType = null;
            try {
                asset.validate();
            } catch (err) {
                err.should.be.an.instanceOf(IllegalModelException);
                should.exist(err.message);
                err.message.should.match(/Class someAsset is not declared as abstract. It must define an identifying field./);
            }
        });

        it('should not throw when a scalar is used as an identifier', () => {
            const clazz = introspectUtils.loadLastDeclaration('test/data/parser/classdeclaration.scalaridentifier.cto', ConceptDeclaration);
            clazz.validate();
        });

        it('should not throw when a scalar array is used as an identifier', () => {
            const clazz = introspectUtils.loadLastDeclaration('test/data/parser/classdeclaration.scalararray.cto', ConceptDeclaration);
            clazz.validate();
        });
    });

    describe('#accept', () => {

        it('should call the visitor', () => {
            let clz = new ClassDeclaration(modelFile, {
                name: 'suchName',
                properties: [
                ]
            });
            let visitor = {
                visit: sinon.stub()
            };
            clz.accept(visitor, ['some', 'args']);
            sinon.assert.calledOnce(visitor.visit);
            sinon.assert.calledWith(visitor.visit, clz, ['some', 'args']);
        });

    });

    describe('#getName', () => {

        it('should return the class name', () => {
            let clz = new ClassDeclaration(modelFile, {
                name: 'suchName',
                properties: [
                ]
            });
            clz.getName().should.equal('suchName');
            clz.toString().should.equal('ClassDeclaration {id=com.hyperledger.testing@1.0.0.suchName super=Concept enum=false abstract=false}');
        });

    });

    describe('#isXYZ', () => {

        it('should return true for concepts', () => {
            let clz = new ClassDeclaration(modelFile, {
                name: 'suchName',
                $class: `${MetaModelNamespace}.ConceptDeclaration`,
                properties: [
                ]
            });
            clz.isConcept().should.equal(true);
        });

        it('should return true for assets', () => {
            let clz = new ClassDeclaration(modelFile, {
                name: 'suchName',
                $class: `${MetaModelNamespace}.AssetDeclaration`,
                properties: [
                ]
            });
            clz.isAsset().should.equal(true);
        });

        it('should return true for events', () => {
            let clz = new ClassDeclaration(modelFile, {
                name: 'suchName',
                $class: `${MetaModelNamespace}.EventDeclaration`,
                properties: [
                ]
            });
            clz.isEvent().should.equal(true);
        });

        it('should return true for participants', () => {
            let clz = new ClassDeclaration(modelFile, {
                name: 'suchName',
                $class: `${MetaModelNamespace}.ParticipantDeclaration`,
                properties: [
                ]
            });
            clz.isParticipant().should.equal(true);
        });

        it('should return true for enums', () => {
            let clz = new ClassDeclaration(modelFile, {
                name: 'suchName',
                $class: `${MetaModelNamespace}.EnumDeclaration`,
                properties: [
                ]
            });
            clz.isEnum().should.equal(true);
        });

        it('should return true for maps', () => {
            let clz = new ClassDeclaration(modelFile, {
                name: 'suchName',
                $class: `${MetaModelNamespace}.MapDeclaration`,
                properties: [
                ]
            });
            clz.isMapDeclaration().should.equal(true);
        });

        it('should return true for transactions', () => {
            let clz = new ClassDeclaration(modelFile, {
                name: 'suchName',
                $class: `${MetaModelNamespace}.TransactionDeclaration`,
                properties: [
                ]
            });
            clz.isTransaction().should.equal(true);
            clz.isAsset().should.equal(false);
        });
    });


    describe('#getFullyQualifiedName', () => {

        it('should return the fully qualified name if function is in a namespace', () => {
            let clz = new ClassDeclaration(modelFile, {
                name: 'suchName',
                properties: [
                ]
            });
            clz.getFullyQualifiedName().should.equal('com.hyperledger.testing@1.0.0.suchName');
        });

    });

    describe('#getSuperType', function() {
        const modelFileNames = [
            'test/data/parser/classdeclaration.participantwithparents.parent.cto',
            'test/data/parser/classdeclaration.participantwithparents.child.cto'
        ];

        beforeEach(() => {
            const modelFiles = introspectUtils.loadModelFiles(modelFileNames);
            modelManager.addModelFiles(modelFiles);
        });

        it('should return superclass when one exists in the same model file', function() {
            const subclass = modelManager.getType('com.testing.parent@1.0.0.Super');
            should.exist(subclass);
            const superclassName = subclass.getSuperType();
            superclassName.should.equal('com.testing.parent@1.0.0.Base');
        });

        it('should return superclass when one exists in a different model file', function() {
            const subclass = modelManager.getType('com.testing.child@1.0.0.Sub');
            should.exist(subclass);
            const superclassName = subclass.getSuperType();
            superclassName.should.equal('com.testing.parent@1.0.0.Super');
        });

        it('should return concerto.Participant when no super type exists', function() {
            const baseclass = modelManager.getType('com.testing.parent@1.0.0.Base');
            should.exist(baseclass);
            const superclassName = baseclass.getSuperType();
            should.equal(superclassName,'concerto@1.0.0.Participant');
        });

        it('toString',()=>{
            const baseclass = modelManager.getType('com.testing.parent@1.0.0.Base');
            baseclass.toString().should.equal('ClassDeclaration {id=com.testing.parent@1.0.0.Base super=Participant enum=false abstract=true}');
        });
    });

    describe('#getNested', function() {
        const modelFileNames = [
            'test/data/parser/classdeclaration.good.nested.cto'
        ];

        beforeEach(() => {
            const modelFiles = introspectUtils.loadModelFiles(modelFileNames, modelManager);
            modelManager.addModelFiles(modelFiles);
        });

        it('get nested happy path', function() {
            let extremeOuter = modelManager.getType('com.hyperledger.testing@1.0.0.ExtremeOuter');
            should.exist(extremeOuter.getNestedProperty('outerAsset.innerAsset'));
        });
        it('get error with missing propertyname', function() {
            let extremeOuter = modelManager.getType('com.hyperledger.testing@1.0.0.ExtremeOuter');
            (()=>{extremeOuter.getNestedProperty('outerAsset.missing');}).should.throw(/Property missing does not exist on com.hyperledger.testing@1.0.0.Outer/);
        });
        it('get error with primitives', function() {
            let extremeOuter = modelManager.getType('com.hyperledger.testing@1.0.0.ExtremeOuter');
            (()=>{extremeOuter.getNestedProperty('outerAsset.int.innerAsset');}).should.throw(/Property int is a primitive or enum/);
        });
    });

    describe('#getAssignableClassDeclarations', function() {
        const modelFileNames = [
            'test/data/parser/classdeclaration.participantwithparents.parent.cto',
            'test/data/parser/classdeclaration.participantwithparents.child.cto'
        ];

        beforeEach(() => {
            const modelFiles = introspectUtils.loadModelFiles(modelFileNames, modelManager);
            modelManager.addModelFiles(modelFiles);
        });

        it('should return itself only if there are no subclasses', function() {
            const baseclass = modelManager.getType('com.testing.child@1.0.0.Sub');
            should.exist(baseclass);
            const subclasses = baseclass.getAssignableClassDeclarations();
            subclasses.should.have.same.members([baseclass]);
        });

        it('should return all subclass definitions', function() {
            const baseclass = modelManager.getType('com.testing.parent@1.0.0.Base');
            should.exist(baseclass);
            const subclasses = baseclass.getAssignableClassDeclarations();
            const subclassNames = subclasses.map(classDef => classDef.getName());
            subclassNames.should.have.same.members(['Base', 'Super', 'Sub', 'Sub2']);
        });


    });

    describe('#_resolveSuperType', () => {

        it('should return Asset if no super type', () => {
            let classDecl = modelManager.getType('concerto@1.0.0.Asset');
            classDecl._resolveSuperType().should.not.be.null;
        });

        it('should return Concept for a super class', () => {
            modelManager.addCTOModel(`namespace org.acme@1.0.0
            asset TestAsset identified by assetId { o String assetId }`);
            let classDecl = modelManager.getType('org.acme@1.0.0.TestAsset');
            let superClassDecl = classDecl._resolveSuperType();
            should.equal(superClassDecl.getName(), 'Asset');
        });

        it('should return the super class declaration for a super class in the same file', () => {
            modelManager.addCTOModel(`namespace org.acme@1.0.0
            abstract asset BaseAsset { }
            asset TestAsset identified by assetId extends BaseAsset { o String assetId }`);
            let classDecl = modelManager.getType('org.acme@1.0.0.TestAsset');
            let superClassDecl = classDecl._resolveSuperType();
            superClassDecl.getFullyQualifiedName().should.equal('org.acme@1.0.0.BaseAsset');
        });

        it('should return the super class declaration for a super class in another file', () => {
            modelManager.addCTOModel(`namespace org.base@1.0.0
            abstract asset BaseAsset { }`);
            modelManager.addCTOModel(`namespace org.acme@1.0.0
            import org.base@1.0.0.BaseAsset
            asset TestAsset identified by assetId extends BaseAsset { o String assetId }`);
            let classDecl = modelManager.getType('org.acme@1.0.0.TestAsset');
            let superClassDecl = classDecl._resolveSuperType();
            superClassDecl.getFullyQualifiedName().should.equal('org.base@1.0.0.BaseAsset');
        });

    });

    describe('#getSuperTypeDeclaration', () => {

        it('should return Concept if no super type', () => {
            let classDecl = modelManager.getType('concerto@1.0.0.Asset');
            classDecl.getSuperTypeDeclaration().should.not.be.null;
        });
    });

    describe('#validation', function() {
        const modelFileNames = [
            'test/data/parser/validation.cto'
        ];

        beforeEach(() => {

        });

        it('validation of super types',()=>{
            (()=>{
                const modelFiles = introspectUtils.loadModelFiles(modelFileNames, modelManager);
                modelManager.addModelFiles(modelFiles);

            }).should.throw(/cannot extend Asset/);

        });

        it('validation of super types',()=>{
            (()=>{
                const modelFiles = introspectUtils.loadModelFiles(modelFileNames, modelManager);
                modelManager.addModelFiles(modelFiles);

            }).should.throw(/cannot extend Asset/);

        });
    });

    describe('#getAllSuperTypeDeclarations', function() {
        const modelFileNames = [
            'test/data/parser/classdeclaration.participantwithparents.parent.cto',
            'test/data/parser/classdeclaration.participantwithparents.child.cto'
        ];

        beforeEach(() => {
            const modelFiles = introspectUtils.loadModelFiles(modelFileNames, modelManager);
            modelManager.addModelFiles(modelFiles);
        });

        it('should return an array with Concept and Participant if there are no superclasses', function() {
            const testClass = modelManager.getType('com.testing.parent@1.0.0.Base');
            should.exist(testClass);
            const superclasses = testClass.getAllSuperTypeDeclarations();
            const superclassNames = superclasses.map(classDef => classDef.getName());
            superclassNames.should.have.length(2);
        });

        it('should return all superclass definitions', function() {
            const testClass = modelManager.getType('com.testing.child@1.0.0.Sub');
            should.exist(testClass);
            const superclasses = testClass.getAllSuperTypeDeclarations();
            const superclassNames = superclasses.map(classDef => classDef.getName());
            superclassNames.should.have.same.members(['Base', 'Super', 'Participant', 'Concept']);
        });
    });

    describe('#getDirectSubclasses', function() {
        it('should return an array with Sub and Sub2 given they extend Super', function() {
            const modelFileNames = [
                'test/data/parser/classdeclaration.participantwithparents.parent.cto',
                'test/data/parser/classdeclaration.participantwithparents.child.cto'
            ];

            const modelFiles = introspectUtils.loadModelFiles(modelFileNames, modelManager);
            modelManager.addModelFiles(modelFiles);

            const testClass = modelManager.getType('com.testing.parent@1.0.0.Super');
            should.exist(testClass);
            const subclasses = testClass.getDirectSubclasses();
            const subclassNames = subclasses.map(classDef => classDef.getName());
            subclassNames.should.have.length(2);
            subclassNames.should.have.same.members(['Sub', 'Sub2']);
        });

        it('should return an empty array given nothing extends Super', function() {
            const modelFileNames = [
                'test/data/parser/classdeclaration.participantwithparents.parent.cto'
            ];

            const modelFiles = introspectUtils.loadModelFiles(modelFileNames, modelManager);
            modelManager.addModelFiles(modelFiles);

            const testClass = modelManager.getType('com.testing.parent@1.0.0.Super');
            should.exist(testClass);
            const subclasses = testClass.getDirectSubclasses();

            subclasses.should.have.length(0);
        });
    });

    describe('#isEvent', () => {
        const modelFileNames = [
            'test/data/parser/classdeclaration.participantwithparents.parent.cto',
            'test/data/parser/classdeclaration.participantwithparents.child.cto'
        ];

        beforeEach(() => {
            const modelFiles = introspectUtils.loadModelFiles(modelFileNames, modelManager);
            modelManager.addModelFiles(modelFiles);
        });
        it('should return false', () => {
            const testClass = modelManager.getType('com.testing.child@1.0.0.Sub');
            testClass.isEvent().should.be.false;

        });
    });
});


describe('ClassDeclaration - Test for declarations using Import Aliasing', () => {

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

    describe('#getName', () => {

        it('should return the local aliased name of the Type', () => {
            const classDecl = resolvedModelManager.getType('parent@1.0.0.Child');
            classDecl.getName().should.equal('Child');
        });

    });

    describe('#getFullyQualifiedName', () => {

        it('should return the fully qualified name if function is in a namespace', () => {
            const classDecl = resolvedModelManager.getType('parent@1.0.0.Child');
            classDecl.getFullyQualifiedName().should.equal('parent@1.0.0.Child');
        });

    });

    describe('#getSuperType', function() {

        it('should return superclass when one exists in a different model file and is aliased my importing', function() {
            const subclass = resolvedModelManager.getType('parent@1.0.0.Child');
            const superclassName = subclass.getSuperType();
            superclassName.should.equal('child@1.0.0.Child');
        });
    });

    describe('#getNested', function() {

        it('get nested happy path', function() {
            let aliasedClassDeclration = resolvedModelManager.getType('parent@1.0.0.Student');
            should.exist(aliasedClassDeclration.getNestedProperty('myChild.kid.age'));
        });
    });

    describe('#getAssignableClassDeclarations', function() {

        it('should return all subclass definitions', function() {
            const baseclass = resolvedModelManager.getType('child@1.0.0.Child');
            should.exist(baseclass);
            const subclasses = baseclass.getAssignableClassDeclarations();
            const subclassNames = subclasses.map(classDef => classDef.getName());
            subclassNames.should.have.same.members(['Child', 'Child', 'Student']);
        });
    });

    describe('#_resolveSuperType', () => {

        it('should return the super class declaration for a super class in another file and is aliased while importing', () => {
            let classDecl = resolvedModelManager.getType('parent@1.0.0.Child');
            let superClassDecl = classDecl._resolveSuperType();
            superClassDecl.getFullyQualifiedName().should.equal('child@1.0.0.Child');
        });

    });

    describe('#getAllSuperTypeDeclarations', function() {

        it('should return all superclass definitions with one of the classDeclration being aliased while importing', function() {
            const testClass = resolvedModelManager.getType('parent@1.0.0.Child');
            should.exist(testClass);
            const superclasses = testClass.getAllSuperTypeDeclarations();
            const superclassNames = superclasses.map(classDef => classDef.getName());
            superclassNames.should.have.same.members(['Child', 'Concept']);
        });
    });

    describe('#getDirectSubclasses', function() {
        it('should return an array with Child (in parent@1.0.0) given it extends Child (in parent@1.0.0)', function() {
            const testClass = resolvedModelManager.getType('child@1.0.0.Child');
            should.exist(testClass);
            const subclasses = testClass.getDirectSubclasses();
            const subclassNames = subclasses.map(classDef => classDef.getName());
            subclassNames.should.have.same.members(['Child']);
        });
    });
});
