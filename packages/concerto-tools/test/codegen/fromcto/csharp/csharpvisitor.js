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

const CSharpVisitor = require('../../../../lib/codegen/fromcto/csharp/csharpvisitor.js');

const ClassDeclaration = require('@accordproject/concerto-core').ClassDeclaration;
const EnumDeclaration = require('@accordproject/concerto-core').EnumDeclaration;
const EnumValueDeclaration = require('@accordproject/concerto-core').EnumValueDeclaration;
const Field = require('@accordproject/concerto-core').Field;
const ModelFile = require('@accordproject/concerto-core').ModelFile;
const ModelManager = require('@accordproject/concerto-core').ModelManager;
const RelationshipDeclaration = require('@accordproject/concerto-core').RelationshipDeclaration;
const FileWriter = require('../../../../lib/filewriter');

describe('CSharpVisitor', function () {
    let csharpVisitor;
    let mockFileWriter;
    beforeEach(() => {
        csharpVisitor = new CSharpVisitor();
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
            thing._isModelManager = true;
            let mockSpecialVisit = sinon.stub(csharpVisitor, 'visitModelManager');
            mockSpecialVisit.returns('Duck');

            csharpVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitModelFile for a ModelFile', () => {
            let thing = sinon.createStubInstance(ModelFile);
            thing._isModelFile = true;
            let mockSpecialVisit = sinon.stub(csharpVisitor, 'visitModelFile');
            mockSpecialVisit.returns('Duck');

            csharpVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitEnumDeclaration for a EnumDeclaration', () => {
            let thing = sinon.createStubInstance(EnumDeclaration);
            thing._isEnumDeclaration = true;
            let mockSpecialVisit = sinon.stub(csharpVisitor, 'visitEnumDeclaration');
            mockSpecialVisit.returns('Duck');

            csharpVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitClassDeclaration for a ClassDeclaration', () => {
            let thing = sinon.createStubInstance(ClassDeclaration);
            thing._isClassDeclaration = true;
            let mockSpecialVisit = sinon.stub(csharpVisitor, 'visitClassDeclaration');
            mockSpecialVisit.returns('Duck');

            csharpVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitField for a Field', () => {
            let thing = sinon.createStubInstance(Field);
            thing._isField = true;
            let mockSpecialVisit = sinon.stub(csharpVisitor, 'visitField');
            mockSpecialVisit.returns('Duck');

            csharpVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitRelationship for a RelationshipDeclaration', () => {
            let thing = sinon.createStubInstance(RelationshipDeclaration);
            thing._isRelationshipDeclaration = true;
            let mockSpecialVisit = sinon.stub(csharpVisitor, 'visitRelationship');
            mockSpecialVisit.returns('Duck');

            csharpVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitEnumValueDeclaration for a EnumValueDeclaration', () => {
            let thing = sinon.createStubInstance(EnumValueDeclaration);
            thing._isEnumValueDeclaration = true;
            let mockSpecialVisit = sinon.stub(csharpVisitor, 'visitEnumValueDeclaration');
            mockSpecialVisit.returns('Goose');

            csharpVisitor.visit(thing, param).should.deep.equal('Goose');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should throw an error when an unrecognised type is supplied', () => {
            let thing = 'Something of unrecognised type';

            (() => {
                csharpVisitor.visit(thing, param);
            }).should.throw('Unrecognised type: string, value: \'Something of unrecognised type\'');
        });
    });

    describe('visitModelManager', () => {
        it('should call accept for each model file', () => {
            let acceptSpy = sinon.spy();

            let param = {};

            let mockModelManager = sinon.createStubInstance(ModelManager);
            mockModelManager._isModelManager = true;
            mockModelManager.getModelFiles.returns([{
                accept: acceptSpy
            },
            {
                accept: acceptSpy
            }
            ]);

            csharpVisitor.visitModelManager(mockModelManager, param);

            acceptSpy.withArgs(csharpVisitor, param).calledTwice.should.be.ok;
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

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration.isEnum.returns(false);
            mockClassDeclaration.getSuperType.returns('super.Parent');
            mockClassDeclaration.getProperties.returns([property1, property2, property3]);
            mockClassDeclaration.accept = acceptSpy;

            let mockClassDeclaration2 = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration.isEnum.returns(false);
            mockClassDeclaration2.getSuperType.returns('super.Parent');
            mockClassDeclaration2.getProperties.returns([]);
            mockClassDeclaration2.accept = acceptSpy;

            let mockModelFile = sinon.createStubInstance(ModelFile);
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

            csharpVisitor.visitModelFile(mockModelFile, param);

            param.fileWriter.openFile.withArgs('org.acme.cs').calledOnce.should.be.ok;
            param.fileWriter.writeLine.callCount.should.equal(7);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, 'using System;']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([0, 'using System.Text.Json.Serialization;']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([0, 'namespace org.acme {']);
            param.fileWriter.writeLine.getCall(3).args.should.deep.equal([1, 'using org.org1;']);
            param.fileWriter.writeLine.getCall(4).args.should.deep.equal([1, 'using org.org2;']);
            param.fileWriter.writeLine.getCall(5).args.should.deep.equal([1, 'using super;']);
            param.fileWriter.writeLine.getCall(6).args.should.deep.equal([0, '}']);
            param.fileWriter.closeFile.calledOnce.should.be.ok;
            acceptSpy.withArgs(csharpVisitor, param).calledThrice.should.be.ok;
        });

        it('should write lines for the imports that are not in own namespace ignoring primitives and write lines for importing system type', () => {
            let acceptSpy = sinon.spy();
            let mockEnum = sinon.createStubInstance(EnumDeclaration);
            mockEnum._isEnumDeclaration = true;
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
                    return false;
                },
                getFullyQualifiedTypeName: () => {
                    return 'org.org1.Property3';
                }
            };

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration._isClassDeclaration = true;
            mockClassDeclaration.getProperties.returns([property1, property2, property3]);
            mockClassDeclaration.accept = acceptSpy;

            let mockModelManager = sinon.createStubInstance(ModelManager);
            mockModelManager._isModelManager = true;

            let mockModelFile = sinon.createStubInstance(ModelFile);
            mockModelFile._isModelFile = true;
            mockModelFile.getNamespace.returns('org.acme');
            mockModelFile.getAllDeclarations.returns([
                mockEnum,
                mockClassDeclaration
            ]);
            mockModelFile.getImports.returns([
                'org.org1.Import1',
                'org.org1.Import2',
                'org.org2.Import1'
            ]);
            mockModelFile.getModelManager.returns(mockModelManager);

            csharpVisitor.visitModelFile(mockModelFile, param);

            param.fileWriter.openFile.withArgs('org.acme.cs').calledOnce.should.be.ok;
            param.fileWriter.writeLine.callCount.should.equal(6);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, 'using System;']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([0, 'using System.Text.Json.Serialization;']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([0, 'namespace org.acme {']);
            param.fileWriter.writeLine.getCall(3).args.should.deep.equal([1, 'using org.org1;']);
            param.fileWriter.writeLine.getCall(4).args.should.deep.equal([1, 'using org.org2;']);
            param.fileWriter.writeLine.getCall(5).args.should.deep.equal([0, '}']);
            param.fileWriter.closeFile.calledOnce.should.be.ok;
            acceptSpy.withArgs(csharpVisitor, param).calledTwice.should.be.ok;
        });
    });

    describe('visitEnumDeclaration', () => {
        it('should write the export enum and call accept on each property', () => {
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

            csharpVisitor.visitEnumDeclaration(mockEnumDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(2);
            param.fileWriter.writeLine.withArgs(1, 'enum Bob {').calledOnce.should.be.ok;
            param.fileWriter.writeLine.withArgs(1, '}\n').calledOnce.should.be.ok;

            acceptSpy.withArgs(csharpVisitor, param).calledTwice.should.be.ok;
        });
    });

    describe('visitClassDeclaration', () => {
        let param;
        beforeEach(() => {
            param = {
                fileWriter: mockFileWriter
            };
        });
        it('should write the class opening and close', () => {
            let acceptSpy = sinon.spy();

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration._isClassDeclaration = true;
            mockClassDeclaration.getOwnProperties.returns([{
                accept: acceptSpy
            },
            {
                accept: acceptSpy
            }]);
            mockClassDeclaration.getName.returns('Bob');

            csharpVisitor.visitClassDeclaration(mockClassDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(3);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([1, 'class Bob {']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([2, '[JsonPropertyName("$class")]\n      public new string _class { get;} = "undefined";']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([1, '}']);
        });
        it('should write the class opening and close with abstract and super type', () => {
            let acceptSpy = sinon.spy();

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration._isClassDeclaration = true;
            mockClassDeclaration.getOwnProperties.returns([{
                accept: acceptSpy
            },
            {
                accept: acceptSpy
            }]);
            mockClassDeclaration.getName.returns('Bob');
            mockClassDeclaration.isAbstract.returns(true);
            mockClassDeclaration.getSuperType.returns('org.acme.Person');

            csharpVisitor.visitClassDeclaration(mockClassDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(3);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([1, 'abstract class Bob : Person {']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([2, '[JsonPropertyName("$class")]\n      public new string _class { get;} = "undefined";']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([1, '}']);
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
            const mockField = sinon.createStubInstance(Field);
            mockField.isPrimitive.returns(false);
            mockField.getName.returns('name');
            mockField.getType.returns('String');
            mockField.isPrimitive.returns(true);
            csharpVisitor.visitField(mockField, param);
            param.fileWriter.writeLine.withArgs(2, 'public string name { get; set; }').calledOnce.should.be.ok;
        });

        it('should write a line for field name and type thats an array', () => {
            const mockField = sinon.createStubInstance(Field);
            mockField.isPrimitive.returns(false);
            mockField.getName.returns('Bob');
            mockField.getType.returns('Person');
            mockField.isArray.returns(true);

            const mockModelManager = sinon.createStubInstance(ModelManager);
            const mockModelFile = sinon.createStubInstance(ModelFile);
            const mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);

            mockModelManager.getType.returns(mockClassDeclaration);
            mockClassDeclaration.isEnum.returns(false);
            mockModelFile.getModelManager.returns(mockModelManager);
            mockClassDeclaration.getModelFile.returns(mockModelFile);
            mockField.getParent.returns(mockClassDeclaration);
            csharpVisitor.visitField(mockField, param);
            param.fileWriter.writeLine.withArgs(2, 'public Person[] Bob { get; set; }').calledOnce.should.be.ok;
        });
    });

    describe('visitEnumValueDeclaration', () => {
        it('should write a line with the name of the enum value', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockEnumValueDeclaration = sinon.createStubInstance(EnumValueDeclaration);
            mockEnumValueDeclaration._isEnumValueDeclaration = true;
            mockEnumValueDeclaration.getName.returns('Bob');

            csharpVisitor.visitEnumValueDeclaration(mockEnumValueDeclaration, param);
            param.fileWriter.writeLine.withArgs(2, 'Bob,').calledOnce.should.be.ok;
        });
    });

    describe('visitRelationship', () => {
        let param;
        beforeEach(() => {
            param = {
                fileWriter: mockFileWriter
            };
        });
        it('should write a line for field name and type', () => {
            let mockRelationship = sinon.createStubInstance(RelationshipDeclaration);
            mockRelationship._isRelationshipDeclaration = true;
            mockRelationship.getName.returns('Bob');
            mockRelationship.getType.returns('Person');
            csharpVisitor.visitRelationship(mockRelationship, param);

            param.fileWriter.writeLine.withArgs(2, 'public Person Bob { get; set; }').calledOnce.should.be.ok;
        });

        it('should write a line for field name and type thats an array', () => {
            let mockField = sinon.createStubInstance(Field);
            mockField._isField = true;
            mockField.getName.returns('Bob');
            mockField.getType.returns('Person');
            mockField.isArray.returns(true);
            csharpVisitor.visitRelationship(mockField, param);

            param.fileWriter.writeLine.withArgs(2, 'public Person[] Bob { get; set; }').calledOnce.should.be.ok;
        });
    });

    describe('toCSharpType', () => {
        it('should return Date for DateTime', () => {
            csharpVisitor.toCSharpType('DateTime').should.deep.equal('DateTime');
        });
        it('should return boolean for Boolean', () => {
            csharpVisitor.toCSharpType('Boolean').should.deep.equal('bool');
        });
        it('should return string for String', () => {
            csharpVisitor.toCSharpType('String').should.deep.equal('string');
        });
        it('should return number for Double', () => {
            csharpVisitor.toCSharpType('Double').should.deep.equal('float');
        });
        it('should return number for Long', () => {
            csharpVisitor.toCSharpType('Long').should.deep.equal('long');
        });
        it('should return number for Integer', () => {
            csharpVisitor.toCSharpType('Integer').should.deep.equal('int');
        });
        it('should return passed in type by default', () => {
            csharpVisitor.toCSharpType('Penguin').should.deep.equal('Penguin');
        });
    });
});

