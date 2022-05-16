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

const ODataVisitor = require('../../../../lib/codegen/fromcto/odata/odatavisitor.js');

const ClassDeclaration = require('@accordproject/concerto-core').ClassDeclaration;
const EnumDeclaration = require('@accordproject/concerto-core').EnumDeclaration;
const EnumValueDeclaration = require('@accordproject/concerto-core').EnumValueDeclaration;
const Field = require('@accordproject/concerto-core').Field;
const ModelFile = require('@accordproject/concerto-core').ModelFile;
const ModelManager = require('@accordproject/concerto-core').ModelManager;
const RelationshipDeclaration = require('@accordproject/concerto-core').RelationshipDeclaration;
const Decorator = require('@accordproject/concerto-core').Decorator;
const FileWriter = require('@accordproject/concerto-util').FileWriter;

describe('ODataVisitor', function () {
    let oDataVisitor;
    let mockFileWriter;
    beforeEach(() => {
        oDataVisitor = new ODataVisitor();
        mockFileWriter = sinon.createStubInstance(FileWriter);
    });

    describe('visit', () => {
        let param;
        beforeEach(() => {
            param = {
                property1: 'value1'
            };
        });

        it('should return visitModelManager for a ModelManager', () => {
            let thing = sinon.createStubInstance(ModelManager);
            thing.isModelManager.returns(true);
            let mockSpecialVisit = sinon.stub(oDataVisitor, 'visitModelManager');
            mockSpecialVisit.returns('Duck');

            oDataVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitModelFile for a ModelFile', () => {
            let thing = sinon.createStubInstance(ModelFile);
            thing.isModelFile.returns(true);
            let mockSpecialVisit = sinon.stub(oDataVisitor, 'visitModelFile');
            mockSpecialVisit.returns('Duck');

            oDataVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitEnumDeclaration for a EnumDeclaration', () => {
            let thing = sinon.createStubInstance(EnumDeclaration);
            thing.isEnum.returns(true);
            let mockSpecialVisit = sinon.stub(oDataVisitor, 'visitEnumDeclaration');
            mockSpecialVisit.returns('Duck');

            oDataVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitClassDeclaration for a ClassDeclaration', () => {
            let thing = sinon.createStubInstance(ClassDeclaration);
            thing.isClassDeclaration.returns(true);
            let mockSpecialVisit = sinon.stub(oDataVisitor, 'visitClassDeclaration');
            mockSpecialVisit.returns('Duck');

            oDataVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitField for a Field', () => {
            let thing = sinon.createStubInstance(Field);
            thing.isField.returns(true);
            let mockSpecialVisit = sinon.stub(oDataVisitor, 'visitField');
            mockSpecialVisit.returns('Duck');

            oDataVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitRelationship for a RelationshipDeclaration', () => {
            let thing = sinon.createStubInstance(RelationshipDeclaration);
            thing.isRelationship.returns(true);
            let mockSpecialVisit = sinon.stub(oDataVisitor, 'visitRelationship');
            mockSpecialVisit.returns('Duck');

            oDataVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitEnumValueDeclaration for a EnumValueDeclaration', () => {
            let thing = sinon.createStubInstance(EnumValueDeclaration);
            thing.isEnumValue.returns(true);
            let mockSpecialVisit = sinon.stub(oDataVisitor, 'visitEnumValueDeclaration');
            mockSpecialVisit.returns('Goose');

            oDataVisitor.visit(thing, param).should.deep.equal('Goose');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitDecorator for a Decorator', () => {
            let thing = sinon.createStubInstance(Decorator);
            thing.isDecorator.returns(true);
            let mockSpecialVisit = sinon.stub(oDataVisitor, 'visitDecorator');
            mockSpecialVisit.returns('Goose');

            oDataVisitor.visit(thing, param).should.deep.equal('Goose');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should throw an error when an unrecognised type is supplied', () => {
            let thing = 'Something of unrecognised type';

            (() => {
                oDataVisitor.visit(thing, param);
            }).should.throw('Something of unrecognised type');
        });
    });

    describe('visitModelManager', () => {
        it('should call accept for each model file', () => {
            let acceptSpy = sinon.spy();

            let param = {};

            let mockModelManager = sinon.createStubInstance(ModelManager);
            mockModelManager.isModelManager.returns(true);
            mockModelManager.getModelFiles.returns([{
                accept: acceptSpy
            },
            {
                accept: acceptSpy
            }
            ]);

            oDataVisitor.visitModelManager(mockModelManager, param);

            acceptSpy.withArgs(oDataVisitor, param).calledTwice.should.be.ok;
        });
    });

    describe('visitModelFile', () => {
        let param;
        beforeEach(() => {
            param = {
                fileWriter: mockFileWriter
            };
        });
        it('should write lines for the imports that are not in own namespace (including super types) ignoring primitives', () => {
            let acceptSpy = sinon.spy();
            let mockEnum = sinon.createStubInstance(EnumDeclaration);
            mockEnum.isEnum.returns(true);
            mockEnum.accept = acceptSpy;

            let property1 = {
                isPrimitive: () => {
                    return false;
                },
                getFullyQualifiedTypeName: () => {
                    return 'org.org1.Property1';
                }
            };

            let property2 = {
                isPrimitive: () => {
                    return false;
                },
                getFullyQualifiedTypeName: () => {
                    return 'org.acme.Property2';
                }
            };

            let property3 = {
                isPrimitive: () => {
                    return true;
                },
                getFullyQualifiedTypeName: () => {
                    return 'super.Property3';
                }
            };

            let mockModelManager = sinon.createStubInstance(ModelManager);
            mockModelManager.isModelManager.returns(true);

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration.isEnum.returns(false);
            mockClassDeclaration.getNamespace.returns('org.acme');
            mockClassDeclaration.getSuperType.returns('super.Parent');
            mockClassDeclaration.getProperties.returns([property1, property2, property3]);
            mockClassDeclaration.accept = acceptSpy;

            let mockImportedClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockImportedClassDeclaration.isEnum.returns(false);
            mockImportedClassDeclaration.getNamespace.returns('org.imported');
            mockImportedClassDeclaration.getSuperType.returns('super.Parent');
            mockImportedClassDeclaration.getProperties.returns([]);
            mockImportedClassDeclaration.accept = acceptSpy;

            mockModelManager.getType.returns(mockImportedClassDeclaration);

            let mockClassDeclaration2 = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration2.isEnum.returns(false);
            mockClassDeclaration2.getNamespace.returns('org.acme');
            mockClassDeclaration2.getSuperType.returns('super.Parent');
            mockClassDeclaration2.getProperties.returns([]);
            mockClassDeclaration2.accept = acceptSpy;

            let mockModelFile = sinon.createStubInstance(ModelFile);
            mockModelFile.getModelManager.returns(mockModelManager);
            mockModelFile.getNamespace.returns('org.acme');
            mockModelFile.getAllDeclarations.returns([
                mockEnum,
                mockClassDeclaration,
                mockClassDeclaration2
            ]);
            mockModelFile.getImports.returns([
                'org.org1.Import1',
                'org.org1.Import2',
                'org.org2.Import1',
                'super.Property3',
                'super.Parent'
            ]);

            oDataVisitor.visitModelFile(mockModelFile, param);

            param.fileWriter.openFile.withArgs('org.acme.csdl').calledOnce.should.be.ok;
            param.fileWriter.writeLine.callCount.should.deep.equal(15);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, '<?xml version="1.0"?>']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([0, '<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([0, '<edmx:Reference Uri="http://docs.oasis-open.org/odata/odata/v4.0/cs01/vocabularies/Org.OData.Core.V1.xml">']);
            param.fileWriter.writeLine.getCall(3).args.should.deep.equal([1, '<edmx:Include Namespace="Org.OData.Core.V1" Alias="Core" />']);
            param.fileWriter.writeLine.getCall(4).args.should.deep.equal([0, '</edmx:Reference>']);
            param.fileWriter.writeLine.getCall(5).args.should.deep.equal([0, '<edmx:Reference Uri="./org.imported.csdl">']);
            param.fileWriter.writeLine.getCall(6).args.should.deep.equal([1, '<edmx:Include Namespace="org.imported" />']);
            param.fileWriter.writeLine.getCall(7).args.should.deep.equal([0, '</edmx:Reference>']);
            param.fileWriter.writeLine.getCall(8).args.should.deep.equal([0, '<edmx:DataServices>']);
            param.fileWriter.writeLine.getCall(9).args.should.deep.equal([1, '<Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="org.acme">']);
            param.fileWriter.writeLine.getCall(10).args.should.deep.equal([1, '<EntityContainer Name="org.acmeService">']);
            param.fileWriter.writeLine.getCall(11).args.should.deep.equal([1, '</EntityContainer>']);
            param.fileWriter.writeLine.getCall(12).args.should.deep.equal([1, '</Schema>']);
            param.fileWriter.writeLine.getCall(13).args.should.deep.equal([0, '</edmx:DataServices>']);
            param.fileWriter.writeLine.getCall(14).args.should.deep.equal([0, '</edmx:Edmx>']);
            param.fileWriter.closeFile.calledOnce.should.be.ok;

            acceptSpy.withArgs(oDataVisitor, param).calledThrice.should.be.ok;
        });
        it('should create an EntitySet for all non-abstract identifiables', () => {
            let acceptSpy = sinon.spy();

            let mockModelManager = sinon.createStubInstance(ModelManager);
            mockModelManager.isModelManager.returns(true);

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration.isEnum.returns(false);
            mockClassDeclaration.getNamespace.returns('org.acme');
            mockClassDeclaration.isIdentified.returns(true);
            mockClassDeclaration.getName.returns('TestIdentifiable');
            mockClassDeclaration.getFullyQualifiedName.returns('org.acme.TestIdentifiable');
            mockClassDeclaration.accept = acceptSpy;

            let mockModelFile = sinon.createStubInstance(ModelFile);
            mockModelFile.getModelManager.returns(mockModelManager);
            mockModelFile.getNamespace.returns('org.acme');
            mockModelFile.getAllDeclarations.returns([
                mockClassDeclaration
            ]);

            mockModelFile.getImports.returns([]);

            oDataVisitor.visitModelFile(mockModelFile, param);
            param.fileWriter.writeLine.getCall(8).args.should.deep.equal([2, '<EntitySet Name="TestIdentifiable" EntityType="org.acme.TestIdentifiable"/>']);
        });
    });

    describe('visitEnumDeclaration', () => {
        it('should write the enum and call accept on each property', () => {
            let acceptSpy = sinon.spy();

            let param = {
                fileWriter: mockFileWriter
            };

            let mockEnumDeclaration = sinon.createStubInstance(EnumDeclaration);
            mockEnumDeclaration.isEnum.returns(true);
            mockEnumDeclaration.getName.returns('Bob');
            mockEnumDeclaration.getOwnProperties.returns([{
                accept: acceptSpy
            },
            {
                accept: acceptSpy
            }]);

            oDataVisitor.visitEnumDeclaration(mockEnumDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(2);
            param.fileWriter.writeLine.withArgs(2, '<EnumType Name="Bob">').calledOnce.should.be.ok;
            param.fileWriter.writeLine.withArgs(2, '</EnumType>').calledOnce.should.be.ok;

            acceptSpy.withArgs(oDataVisitor, param).calledTwice.should.be.ok;
        });
    });

    describe('visitClassDeclaration', () => {
        let param;
        beforeEach(() => {
            param = {
                fileWriter: mockFileWriter
            };
        });
        it('should write the complex type opening and close', () => {
            let acceptSpy = sinon.spy();

            const mockDecorator = sinon.createStubInstance(Decorator);
            mockDecorator.getName.returns('MyDecorator');
            mockDecorator.getArguments.returns([]);

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration.isClassDeclaration.returns(true);
            mockClassDeclaration.getOwnProperties.returns([{
                accept: acceptSpy
            },
            {
                accept: acceptSpy
            }]);
            mockClassDeclaration.getName.returns('Bob');
            mockClassDeclaration.getDecorators.returns([mockDecorator]);

            oDataVisitor.visitClassDeclaration(mockClassDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(2);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([2, '<ComplexType Name="Bob"  >']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([2, '</ComplexType>']);
        });
        it('should handle identified classes', () => {
            let acceptSpy = sinon.spy();

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration.isClassDeclaration.returns(true);
            mockClassDeclaration.getDecorators.returns([]);
            mockClassDeclaration.isIdentified.returns(true);
            mockClassDeclaration.getIdentifierFieldName.returns('myid');
            mockClassDeclaration.getOwnProperty.returns(true);
            mockClassDeclaration.getOwnProperties.returns([{
                accept: acceptSpy
            },
            {
                accept: acceptSpy
            }]);
            mockClassDeclaration.getName.returns('Bob');

            oDataVisitor.visitClassDeclaration(mockClassDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(3);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([2, '<EntityType Name="Bob"  >']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([3, '<Key><PropertyRef Name="myid"/></Key>']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([2, '</EntityType>']);
        });
        it('should handle system identified classes', () => {
            let acceptSpy = sinon.spy();

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration.isClassDeclaration.returns(true);
            mockClassDeclaration.getName.returns('Bob');
            mockClassDeclaration.getNamespace.returns('org.acme');
            mockClassDeclaration.getDecorators.returns([]);
            mockClassDeclaration.isSystemIdentified.returns(true);
            mockClassDeclaration.isIdentified.returns(true);
            mockClassDeclaration.getIdentifierFieldName.returns('$identifier');
            mockClassDeclaration.getOwnProperty.returns(true);
            mockClassDeclaration.getOwnProperties.returns([{
                accept: acceptSpy
            },
            {
                accept: acceptSpy
            }]);

            oDataVisitor.visitClassDeclaration(mockClassDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(3);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([2, '<EntityType Name="Bob"  >']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([3, '<Key><PropertyRef Name="$identifier"/></Key>']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([2, '</EntityType>']);
        });
        it('should write the class opening and close with abstract and super type', () => {
            let acceptSpy = sinon.spy();

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration.isClassDeclaration.returns(true);
            mockClassDeclaration.getOwnProperties.returns([{
                accept: acceptSpy
            },
            {
                accept: acceptSpy
            }]);

            let mockModelManager = sinon.createStubInstance(ModelManager);
            mockModelManager.isModelManager.returns(true);

            let mockModelFile = sinon.createStubInstance(ModelFile);
            mockModelFile.isModelFile.returns(true);
            mockModelFile.getModelManager.returns(mockModelManager);

            mockClassDeclaration.getName.returns('Bob');
            mockClassDeclaration.getDecorators.returns([]);
            mockClassDeclaration.isAbstract.returns(true);
            mockClassDeclaration.getSuperType.returns('org.acme.Person');
            mockClassDeclaration.getModelFile.returns(mockModelFile);

            oDataVisitor.visitClassDeclaration(mockClassDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(2);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([2, '<ComplexType Name="Bob" Abstract="true" BaseType="org.acme.Person">']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([2, '</ComplexType>']);
        });
    });

    describe('visitField', () => {
        let param;
        beforeEach(() => {
            param = {
                fileWriter: mockFileWriter
            };
        });
        it('should write a line for primitive field name and type', () => {
            const mockDecorator = sinon.createStubInstance(Decorator);
            mockDecorator.getName.returns('MyDecorator');
            mockDecorator.getArguments.returns([]);
            const mockField = sinon.createStubInstance(Field);
            mockField.getName.returns('name');
            mockField.getFullyQualifiedTypeName.returns('String');
            mockField.isPrimitive.returns(true);
            mockField.getDecorators.returns([mockDecorator]);
            oDataVisitor.visitField(mockField, param);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([3, '<Property Name="name" Type="Edm.String"  >']);
        });

        it('should write a line for primitive field with default value', () => {
            const mockField = sinon.createStubInstance(Field);
            mockField.getName.returns('name');
            mockField.getFullyQualifiedTypeName.returns('String');
            mockField.isPrimitive.returns(true);
            mockField.getDefaultValue.returns('this <is> a & default \' "value"');
            mockField.getDecorators.returns([]);
            oDataVisitor.visitField(mockField, param);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([3, '<Property Name="name" Type="Edm.String"  DefaultValue="this &lt;is&gt; a &amp; default &apos; &quot;value&quot;">']);
        });

        it('should write a line for an optional primitive field', () => {
            const mockField = sinon.createStubInstance(Field);
            mockField.getName.returns('name');
            mockField.getFullyQualifiedTypeName.returns('String');
            mockField.isPrimitive.returns(true);
            mockField.isOptional.returns(true);
            mockField.getDecorators.returns([]);
            oDataVisitor.visitField(mockField, param);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([3, '<Property Name="name" Type="Edm.String" Nullable="true" >']);
        });

        it('should write a line for field name and type thats an array', () => {
            const mockField = sinon.createStubInstance(Field);
            mockField.isPrimitive.returns(false);
            mockField.getName.returns('Bob');
            mockField.getFullyQualifiedTypeName.returns('Person');
            mockField.isArray.returns(true);
            mockField.getDecorators.returns([]);
            oDataVisitor.visitField(mockField, param);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([3, '<Property Name="Bob" Type="Collection(Person)"  >']);
        });
    });

    describe('visitEnumValueDeclaration', () => {
        it('should write a line with the name and value of the enum value', () => {
            let param = {
                fileWriter: mockFileWriter
            };
            const mockDecorator = sinon.createStubInstance(Decorator);
            mockDecorator.getName.returns('MyDecorator');
            mockDecorator.getArguments.returns([]);
            let mockEnumValueDeclaration = sinon.createStubInstance(EnumValueDeclaration);
            mockEnumValueDeclaration.isEnumValue.returns(true);
            mockEnumValueDeclaration.getName.returns('Bob');
            mockEnumValueDeclaration.getDecorators.returns([mockDecorator]);

            oDataVisitor.visitEnumValueDeclaration(mockEnumValueDeclaration, param);

            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([3, '<Member Name="Bob">']);
        });
    });

    describe('visitRelationship', () => {
        let param;
        beforeEach(() => {
            param = {
                fileWriter: mockFileWriter
            };
        });
        it('should write a line for relationship name and type', () => {
            const mockDecorator = sinon.createStubInstance(Decorator);
            mockDecorator.getName.returns('MyDecorator');
            mockDecorator.getArguments.returns([]);
            let mockRelationship = sinon.createStubInstance(RelationshipDeclaration);
            mockRelationship.isRelationship.returns(true);
            mockRelationship.getName.returns('Bob');
            mockRelationship.getFullyQualifiedTypeName.returns('org.acme.Person');
            mockRelationship.getDecorators.returns([mockDecorator]);
            oDataVisitor.visitRelationship(mockRelationship, param);

            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([3, '<NavigationProperty Name="Bob" Type="org.acme.Person" >']);
        });

        it('should write a line for relationship name and type thats an array', () => {
            let mockRelationship = sinon.createStubInstance(RelationshipDeclaration);
            mockRelationship.isRelationship.returns(true);
            mockRelationship.getName.returns('Bob');
            mockRelationship.getFullyQualifiedTypeName.returns('org.acme.Person');
            mockRelationship.isArray.returns(true);
            mockRelationship.getDecorators.returns([]);
            oDataVisitor.visitRelationship(mockRelationship, param);

            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([3, '<NavigationProperty Name="Bob" Type="Collection(org.acme.Person)" >']);
        });

        it('should write a line for relationship that is optional', () => {
            let mockRelationship = sinon.createStubInstance(RelationshipDeclaration);
            mockRelationship.isRelationship.returns(true);
            mockRelationship.isOptional.returns(true);
            mockRelationship.getName.returns('Bob');
            mockRelationship.getFullyQualifiedTypeName.returns('org.acme.Person');
            mockRelationship.getDecorators.returns([]);
            oDataVisitor.visitRelationship(mockRelationship, param);

            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([3, '<NavigationProperty Name="Bob" Type="org.acme.Person" Nullable="true">']);
        });
    });


    describe('visitDecorator', () => {
        let param;
        beforeEach(() => {
            param = {
                fileWriter: mockFileWriter
            };
        });
        it('should write an annotation line for a decorator', () => {
            const mockDecorator = sinon.createStubInstance(Decorator);
            mockDecorator.getName.returns('MyDecorator');
            mockDecorator.getArguments.returns([]);
            oDataVisitor.visitDecorator(mockDecorator, param);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([4, '<Annotation Term="MyDecorator" Bool="true"/>']);
        });
        it('should write an annotation line for a decorator with arguments', () => {
            const mockDecorator = sinon.createStubInstance(Decorator);
            mockDecorator.getName.returns('MyDecorator');
            mockDecorator.getArguments.returns(['one', 2, false]);
            oDataVisitor.visitDecorator(mockDecorator, param);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([4, '<Annotation Term="MyDecorator" Bool="true"/>']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([4, '<Annotation Term="MyDecorator0" String="one" />']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([4, '<Annotation Term="MyDecorator1" Float="2" />']);
            param.fileWriter.writeLine.getCall(3).args.should.deep.equal([4, '<Annotation Term="MyDecorator2" Bool="false" />']);
        });
    });

    describe('toODataType', () => {
        it('should return Date for DateTime', () => {
            oDataVisitor.toODataType('DateTime').should.deep.equal('Edm.DateTimeOffset');
        });
        it('should return boolean for Boolean', () => {
            oDataVisitor.toODataType('Boolean').should.deep.equal('Edm.Boolean');
        });
        it('should return string for String', () => {
            oDataVisitor.toODataType('String').should.deep.equal('Edm.String');
        });
        it('should return number for Double', () => {
            oDataVisitor.toODataType('Double').should.deep.equal('Edm.Double');
        });
        it('should return number for Long', () => {
            oDataVisitor.toODataType('Long').should.deep.equal('Edm.Int64');
        });
        it('should return number for Integer', () => {
            oDataVisitor.toODataType('Integer').should.deep.equal('Edm.Int32');
        });
        it('should return passed in type by default', () => {
            oDataVisitor.toODataType('Penguin').should.deep.equal('Penguin');
        });
    });
});

