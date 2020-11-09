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

const chai = require('chai');
chai.should();
const sinon = require('sinon');

const XmlSchemaVisitor = require('../../../../lib/codegen/fromcto/xmlschema/xmlschemavisitor.js');

const ClassDeclaration = require('@accordproject/concerto-core').ClassDeclaration;
const EnumDeclaration = require('@accordproject/concerto-core').EnumDeclaration;
const EnumValueDeclaration = require('@accordproject/concerto-core').EnumValueDeclaration;
const Field = require('@accordproject/concerto-core').Field;
const ModelFile = require('@accordproject/concerto-core').ModelFile;
const ModelManager = require('@accordproject/concerto-core').ModelManager;
const RelationshipDeclaration = require('@accordproject/concerto-core').RelationshipDeclaration;
const fileWriter = require('../../../../lib/filewriter');

describe('XmlSchemaVisitor', function () {
    let xmlSchemaVisitor;
    let mockFileWriter;
    beforeEach(() => {
        xmlSchemaVisitor = new XmlSchemaVisitor();
        mockFileWriter = sinon.createStubInstance(fileWriter);
    });

    describe('visit', () => {
        let param;
        beforeEach(() => {
            param = {
                fileWriter: mockFileWriter
            };
        });

        it('should return visitEnumDeclaration for a EnumDeclaration', () => {
            let thing = sinon.createStubInstance(EnumDeclaration);
            thing._isEnumDeclaration = true;
            let mockSpecialVisit = sinon.stub(xmlSchemaVisitor, 'visitEnumDeclaration');
            mockSpecialVisit.returns('Duck');

            xmlSchemaVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitClassDeclaration for a ClassDeclaration', () => {
            let thing = sinon.createStubInstance(ClassDeclaration);
            thing._isClassDeclaration = true;
            let mockSpecialVisit = sinon.stub(xmlSchemaVisitor, 'visitClassDeclaration');
            mockSpecialVisit.returns('Duck');

            xmlSchemaVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitField for a Field', () => {
            let thing = sinon.createStubInstance(Field);
            thing._isField = true;
            let mockSpecialVisit = sinon.stub(xmlSchemaVisitor, 'visitField');
            mockSpecialVisit.returns('Duck');

            xmlSchemaVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitRelationship for a RelationshipDeclaration', () => {
            let thing = sinon.createStubInstance(RelationshipDeclaration);
            thing._isRelationshipDeclaration = true;
            let mockSpecialVisit = sinon.stub(xmlSchemaVisitor, 'visitRelationship');
            mockSpecialVisit.returns('Duck');

            xmlSchemaVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitEnumValueDeclaration for a EnumValueDeclaration', () => {
            let thing = sinon.createStubInstance(EnumValueDeclaration);
            thing._isEnumValueDeclaration = true;
            let mockSpecialVisit = sinon.stub(xmlSchemaVisitor, 'visitEnumValueDeclaration');
            mockSpecialVisit.returns('Duck');

            xmlSchemaVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should throw an error when an unrecognised type is supplied', () => {
            let thing = 'Something of unrecognised type';

            (() => {
                xmlSchemaVisitor.visit(thing, param);
            }).should.throw('Unrecognised "Something of unrecognised type"');
        });
    });

    describe('visitModelManager', () => {
        it('should visit each of the model files in a ModelManager', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockModelManager = sinon.createStubInstance(ModelManager);
            mockModelManager._isModelManager = true;

            mockModelManager.accept = function(visitor, parameters) {
                return visitor.visit(this, parameters);
            };

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration._isClassDeclaration = true;
            mockClassDeclaration.getNamespace.returns('org.imported');
            mockModelManager.getType.returns(mockClassDeclaration);

            let mockModelFile = sinon.createStubInstance(ModelFile);
            mockModelFile._isModelFile = true;
            mockModelFile.getImports.returns([]);
            mockModelFile.getModelManager.returns(mockModelManager);

            mockModelFile.accept = function(visitor, parameters) {
                return visitor.visit(this, parameters);
            };
            mockModelFile.getNamespace.returns('org.hyperledger.composer.system');
            mockModelFile.getAllDeclarations.returns([mockClassDeclaration]);
            mockModelFile.getImports.returns(['org.imported.ImportedType']);
            mockModelManager.getModelFiles.returns([mockModelFile]);

            xmlSchemaVisitor.visit(mockModelManager, param);

            param.fileWriter.openFile.withArgs('org.hyperledger.composer.system.xsd').calledOnce.should.be.ok;
            param.fileWriter.writeLine.callCount.should.deep.equal(6);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, '<?xml version="1.0"?>']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([0, '<xs:schema xmlns:org.hyperledger.composer.system=\"org.hyperledger.composer.system\" targetNamespace=\"org.hyperledger.composer.system\" elementFormDefault=\"qualified\" xmlns:xs=\"http://www.w3.org/2001/XMLSchema\" ']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([0, 'xmlns:org.imported=\"org.imported\"']);
            param.fileWriter.writeLine.getCall(3).args.should.deep.equal([0, '>']);
            param.fileWriter.writeLine.getCall(4).args.should.deep.equal([0, '<xs:import namespace=\"org.imported\" schemaLocation=\"org.imported.xsd\"/>']);
            param.fileWriter.writeLine.getCall(5).args.should.deep.equal([0, '</xs:schema>']);

            param.fileWriter.closeFile.calledOnce.should.be.ok;
        });
    });

    describe('visitModelFile', () => {
        it('should handle system namespace', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockModelManager = sinon.createStubInstance(ModelManager);
            mockModelManager._isModelManager = true;

            mockModelManager.accept = function(visitor, parameters) {
                return visitor.visit(this, parameters);
            };

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration._isClassDeclaration = true;
            mockClassDeclaration.getNamespace.returns('org.imported');
            mockModelManager.getType.returns(mockClassDeclaration);

            let mockModelFile = sinon.createStubInstance(ModelFile);
            mockModelFile.getImports.returns([]);
            mockModelFile._isModelFile = true;
            mockModelFile.getModelManager.returns(mockModelManager);

            mockModelFile.accept = function(visitor, parameters) {
                return visitor.visit(this, parameters);
            };
            mockModelFile.getNamespace.returns('org.hyperledger.composer.system');
            mockModelFile.getAllDeclarations.returns([mockClassDeclaration]);
            mockModelFile.getImports.returns(['org.imported.ImportedType']);

            mockModelManager.getModelFiles.returns([mockModelFile]);

            xmlSchemaVisitor.visitModelManager(mockModelManager, param);

            param.fileWriter.openFile.withArgs('org.hyperledger.composer.system.xsd').calledOnce.should.be.ok;
            param.fileWriter.writeLine.callCount.should.deep.equal(6);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, '<?xml version="1.0"?>']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([0, '<xs:schema xmlns:org.hyperledger.composer.system=\"org.hyperledger.composer.system\" targetNamespace=\"org.hyperledger.composer.system\" elementFormDefault=\"qualified\" xmlns:xs=\"http://www.w3.org/2001/XMLSchema\" ']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([0, 'xmlns:org.imported=\"org.imported\"']);
            param.fileWriter.writeLine.getCall(3).args.should.deep.equal([0, '>']);
            param.fileWriter.writeLine.getCall(4).args.should.deep.equal([0, '<xs:import namespace=\"org.imported\" schemaLocation=\"org.imported.xsd\"/>']);
            param.fileWriter.writeLine.getCall(5).args.should.deep.equal([0, '</xs:schema>']);

            param.fileWriter.closeFile.calledOnce.should.be.ok;
        });

        it('should not import the same namespace more than once', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockModelManager = sinon.createStubInstance(ModelManager);
            mockModelManager._isModelManager = true;

            mockModelManager.accept = function(visitor, parameters) {
                return visitor.visit(this, parameters);
            };

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration._isClassDeclaration = true;
            mockClassDeclaration.getNamespace.returns('org.imported');
            mockClassDeclaration.getName.returns('ImportedType');
            mockModelManager.getType.withArgs('org.imported.ImportedType').returns(mockClassDeclaration);

            let mockClassDeclaration2 = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration2._isClassDeclaration = true;
            mockClassDeclaration2.getNamespace.returns('org.imported');
            mockClassDeclaration.getName.returns('AnotherImportedType');
            mockModelManager.getType.withArgs('org.imported.AnotherImportedType').returns(mockClassDeclaration2);

            let mockClassDeclaration3 = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration3._isClassDeclaration = true;
            mockClassDeclaration3.getNamespace.returns('org.different');
            mockClassDeclaration3.getName.returns('Type');
            mockModelManager.getType.withArgs('org.different.Type').returns(mockClassDeclaration3);

            let mockModelFile = sinon.createStubInstance(ModelFile);
            mockModelFile._isModelFile = true;
            mockModelFile.getModelManager.returns(mockModelManager);

            mockModelFile.getImports.returns(['org.imported.ImportedType','org.imported.AnotherImportedType', 'org.different.Type']);

            mockModelFile.accept = function(visitor, parameters) {
                return visitor.visit(this, parameters);
            };
            mockModelFile.getNamespace.returns('org.foo');
            mockModelFile.getAllDeclarations.returns([mockClassDeclaration]);
            mockModelManager.getModelFiles.returns([mockModelFile]);

            xmlSchemaVisitor.visitModelManager(mockModelManager, param);

            param.fileWriter.openFile.withArgs('org.foo.xsd').calledOnce.should.be.ok;
            param.fileWriter.writeLine.callCount.should.deep.equal(8);
            let index=0;
            param.fileWriter.writeLine.getCall(index++).args.should.deep.equal([0, '<?xml version="1.0"?>']);
            param.fileWriter.writeLine.getCall(index++).args.should.deep.equal([0, '<xs:schema xmlns:org.foo="org.foo" targetNamespace="org.foo" elementFormDefault="qualified" xmlns:xs="http://www.w3.org/2001/XMLSchema" ']);
            param.fileWriter.writeLine.getCall(index++).args.should.deep.equal([0, 'xmlns:org.imported="org.imported"']);
            param.fileWriter.writeLine.getCall(index++).args.should.deep.equal([0, 'xmlns:org.different="org.different"']);
            param.fileWriter.writeLine.getCall(index++).args.should.deep.equal([0, '>']);
            param.fileWriter.writeLine.getCall(index++).args.should.deep.equal([0, '<xs:import namespace="org.imported" schemaLocation="org.imported.xsd"/>']);
            param.fileWriter.writeLine.getCall(index++).args.should.deep.equal([0, '<xs:import namespace="org.different" schemaLocation="org.different.xsd"/>']);
            param.fileWriter.writeLine.getCall(index++).args.should.deep.equal([0, '</xs:schema>']);

            param.fileWriter.closeFile.calledOnce.should.be.ok;
        });
    });

    describe('visitEnumDeclaration', () => {
        it('should write the class declaration for an enum', () => {
            let acceptSpy = sinon.spy();

            let param = {
                fileWriter: mockFileWriter
            };

            let mockEnumDeclaration = sinon.createStubInstance(EnumDeclaration);
            mockEnumDeclaration._isEnumDeclaration = true;
            mockEnumDeclaration.getName.returns('Person');
            mockEnumDeclaration.getOwnProperties.returns([{
                accept: acceptSpy
            },
            {
                accept: acceptSpy
            }]);

            let mockModelManager = sinon.createStubInstance(ModelManager);
            mockModelManager._isModelManager = true;
            let mockModelFile = sinon.createStubInstance(ModelFile);
            mockModelFile._isModelFile = true;
            mockModelFile.getModelManager.returns(mockModelManager);
            mockEnumDeclaration.getModelFile.returns(mockModelFile);

            xmlSchemaVisitor.visitEnumDeclaration(mockEnumDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(5);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, '<xs:simpleType name="Person">']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([1, '<xs:restriction base="xs:string">']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([1, '</xs:restriction>']);
            param.fileWriter.writeLine.getCall(3).args.should.deep.equal([0, '</xs:simpleType>']);

            acceptSpy.withArgs(xmlSchemaVisitor, param).calledTwice.should.be.ok;
        });

        it('should write the class declaration for an enum with a super type', () => {
            let acceptSpy = sinon.spy();

            let param = {
                fileWriter: mockFileWriter
            };

            let mockSuperType = sinon.createStubInstance(EnumDeclaration);
            mockSuperType._isEnumDeclaration = true;
            mockSuperType.getName.returns('Human');
            mockSuperType.getNamespace.returns('org.acme');
            let mockEnumDeclaration = sinon.createStubInstance(EnumDeclaration);
            mockEnumDeclaration._isEnumDeclaration = true;
            let mockModelManager = sinon.createStubInstance(ModelManager);
            mockModelManager._isModelManager = true;
            mockModelManager.getType.returns(mockSuperType);
            let mockModelFile = sinon.createStubInstance(ModelFile);
            mockModelFile._isModelFile = true;
            mockModelFile.getModelManager.returns(mockModelManager);
            mockEnumDeclaration.getModelFile.returns(mockModelFile);

            mockEnumDeclaration.getName.returns('Person');
            mockEnumDeclaration.getNamespace.returns('org.acme');
            mockEnumDeclaration.getOwnProperties.returns([{
                accept: acceptSpy
            },
            {
                accept: acceptSpy
            }]);
            mockEnumDeclaration.getSuperType.returns('org.acme.Human');

            xmlSchemaVisitor.visitEnumDeclaration(mockEnumDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(9);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, '<xs:simpleType name="Person_Own">']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([1, '<xs:restriction base="xs:string">']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([1, '</xs:restriction>']);
            param.fileWriter.writeLine.getCall(3).args.should.deep.equal([0, '</xs:simpleType>']);
            param.fileWriter.writeLine.getCall(4).args.should.deep.equal([0, '<xs:simpleType name="Person" type="org.acme:Person_Own">']);
            param.fileWriter.writeLine.getCall(5).args.should.deep.equal([1, '<xs:union memberTypes="org.acme:Person_Own  org.acme:Human">']);
            param.fileWriter.writeLine.getCall(6).args.should.deep.equal([1, '</xs:union>']);
            param.fileWriter.writeLine.getCall(7).args.should.deep.equal([0, '</xs:simpleType>']);

            acceptSpy.withArgs(xmlSchemaVisitor, param).calledTwice.should.be.ok;
        });
    });


    describe('visitClassDeclaration', () => {
        it('should write the class declaration for a class', () => {
            let acceptSpy = sinon.spy();

            let param = {
                fileWriter: mockFileWriter
            };

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration._isClassDeclaration = true;
            mockClassDeclaration.getName.returns('Person');
            mockClassDeclaration.getOwnProperties.returns([{
                accept: acceptSpy
            },
            {
                accept: acceptSpy
            }]);

            xmlSchemaVisitor.visitClassDeclaration(mockClassDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(5);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, '<xs:complexType name="Person">']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([1, '<xs:sequence>']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([1, '</xs:sequence>']);
            param.fileWriter.writeLine.getCall(3).args.should.deep.equal([0, '</xs:complexType>']);

            acceptSpy.withArgs(xmlSchemaVisitor, param).calledTwice.should.be.ok;
        });

        it('should write the class declaration for a class with a super type', () => {
            let acceptSpy = sinon.spy();

            let param = {
                fileWriter: mockFileWriter
            };

            let mockSuperType = sinon.createStubInstance(ClassDeclaration);
            mockSuperType._isClassDeclaration = true;
            mockSuperType.getNamespace.returns('org.acme');
            mockSuperType.getName.returns('Human');
            let mockModelManager = sinon.createStubInstance(ModelManager);
            mockModelManager._isModelManager = true;
            mockModelManager.getType.returns(mockSuperType);
            let mockModelFile = sinon.createStubInstance(ModelFile);
            mockModelFile._isModelFile = true;
            mockModelFile.getModelManager.returns(mockModelManager);

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration._isClassDeclaration = true;
            mockClassDeclaration.getModelFile.returns(mockModelFile);
            mockClassDeclaration.getName.returns('Person');
            mockClassDeclaration.getNamespace.returns('org.acme');
            mockClassDeclaration.getOwnProperties.returns([{
                accept: acceptSpy
            },
            {
                accept: acceptSpy
            }]);
            mockClassDeclaration.getSuperType.returns('org.acme.Human');

            xmlSchemaVisitor.visitClassDeclaration(mockClassDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(9);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, '<xs:complexType name="Person">']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([1, '<xs:complexContent>']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([1, '<xs:extension base="org.acme:Human">']);
            param.fileWriter.writeLine.getCall(3).args.should.deep.equal([1, '<xs:sequence>']);
            param.fileWriter.writeLine.getCall(4).args.should.deep.equal([1, '</xs:sequence>']);
            param.fileWriter.writeLine.getCall(5).args.should.deep.equal([1, '</xs:extension>']);
            param.fileWriter.writeLine.getCall(6).args.should.deep.equal([1, '</xs:complexContent>']);
            param.fileWriter.writeLine.getCall(7).args.should.deep.equal([0, '</xs:complexType>']);

            acceptSpy.withArgs(xmlSchemaVisitor, param).calledTwice.should.be.ok;
        });
    });

    describe('visitField', () => {
        it('should write a line for a String field', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockField = sinon.createStubInstance(Field);
            mockField._isField = true;
            mockField.getFullyQualifiedTypeName.returns('String');
            mockField.getName.returns('Bob');

            xmlSchemaVisitor.visitField(mockField, param);
            param.fileWriter.writeLine.withArgs(2, '<xs:element name="Bob" type="xs:string"/>').calledOnce.should.be.ok;
        });

        it('should write a line for a Long field', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockField = sinon.createStubInstance(Field);
            mockField._isField = true;
            mockField.getFullyQualifiedTypeName.returns('Long');
            mockField.getName.returns('Bob');

            xmlSchemaVisitor.visitField(mockField, param);
            param.fileWriter.writeLine.withArgs(2, '<xs:element name="Bob" type="xs:long"/>').calledOnce.should.be.ok;
        });

        it('should write a line for a Double field', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockField = sinon.createStubInstance(Field);
            mockField._isField = true;
            mockField.getFullyQualifiedTypeName.returns('Double');
            mockField.getName.returns('Bob');

            xmlSchemaVisitor.visitField(mockField, param);
            param.fileWriter.writeLine.withArgs(2, '<xs:element name="Bob" type="xs:double"/>').calledOnce.should.be.ok;
        });

        it('should write a line for a DateTime field', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockField = sinon.createStubInstance(Field);
            mockField._isField = true;
            mockField.getFullyQualifiedTypeName.returns('DateTime');
            mockField.getName.returns('Bob');

            xmlSchemaVisitor.visitField(mockField, param);
            param.fileWriter.writeLine.withArgs(2, '<xs:element name="Bob" type="xs:dateTime"/>').calledOnce.should.be.ok;
        });

        it('should write a line for a Boolean field', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockField = sinon.createStubInstance(Field);
            mockField._isField = true;
            mockField.getFullyQualifiedTypeName.returns('Boolean');
            mockField.getName.returns('Bob');

            xmlSchemaVisitor.visitField(mockField, param);
            param.fileWriter.writeLine.withArgs(2, '<xs:element name="Bob" type="xs:boolean"/>').calledOnce.should.be.ok;
        });

        it('should write a line for a Integer field', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockField = sinon.createStubInstance(Field);
            mockField._isField = true;
            mockField.getFullyQualifiedTypeName.returns('Integer');
            mockField.getName.returns('Bob');

            xmlSchemaVisitor.visitField(mockField, param);
            param.fileWriter.writeLine.withArgs(2, '<xs:element name="Bob" type="xs:integer"/>').calledOnce.should.be.ok;
        });

        it('should write a line for an object field', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockField = sinon.createStubInstance(Field);
            mockField._isField = true;
            mockField.getFullyQualifiedTypeName.returns('org.acme.Foo');
            mockField.getName.returns('Bob');

            xmlSchemaVisitor.visitField(mockField, param);
            param.fileWriter.writeLine.withArgs(2, '<xs:element name="Bob" type="org.acme:Foo"/>').calledOnce.should.be.ok;
        });

        it('should write a line for a field thats an array', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockField = sinon.createStubInstance(Field);
            mockField._isField = true;
            mockField.getFullyQualifiedTypeName.returns('String');
            mockField.getName.returns('Bob');
            mockField.isArray.returns(true);

            xmlSchemaVisitor.visitField(mockField, param);
            param.fileWriter.writeLine.withArgs(2, '<xs:element name="Bob" type="xs:string" minOccurs="0" maxOccurs="unbounded"/>').calledOnce.should.be.ok;
        });
    });

    describe('visitEnumValueDeclaration', () => {
        it('should write a line for a enum value', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockEnumValueDecl = sinon.createStubInstance(EnumValueDeclaration);
            mockEnumValueDecl._isEnumValueDeclaration = true;
            mockEnumValueDecl.getName.returns('Bob');

            xmlSchemaVisitor.visitEnumValueDeclaration(mockEnumValueDecl, param);

            param.fileWriter.writeLine.withArgs(2, '<xs:enumeration value="Bob"/>').calledOnce.should.be.ok;
        });
    });

    describe('visitRelationship', () => {
        it('should write a line for a relationship', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockRelationship = sinon.createStubInstance(RelationshipDeclaration);
            mockRelationship._isRelationshipDeclaration = true;
            mockRelationship.getFullyQualifiedTypeName.returns('String');

            xmlSchemaVisitor.visitRelationship(mockRelationship, param);

            param.fileWriter.writeLine.withArgs(1, '+ string Bob');
        });

        it('should write a line for a relationship thats an array', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockRelationship = sinon.createStubInstance(RelationshipDeclaration);
            mockRelationship._isRelationshipDeclaration = true;
            mockRelationship.getFullyQualifiedTypeName.returns('String');
            mockRelationship.getName.returns('Bob');
            mockRelationship.isArray.returns(true);

            xmlSchemaVisitor.visitRelationship(mockRelationship, param);

            param.fileWriter.writeLine.withArgs(1, '+ string Bob');
        });
    });
});