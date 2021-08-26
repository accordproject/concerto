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

const TypescriptVisitor = require('../../../../lib/codegen/fromcto/typescript/typescriptvisitor.js');

const ClassDeclaration = require('@accordproject/concerto-core').ClassDeclaration;
const EnumDeclaration = require('@accordproject/concerto-core').EnumDeclaration;
const EnumValueDeclaration = require('@accordproject/concerto-core').EnumValueDeclaration;
const Field = require('@accordproject/concerto-core').Field;
const ModelFile = require('@accordproject/concerto-core').ModelFile;
const ModelManager = require('@accordproject/concerto-core').ModelManager;
const RelationshipDeclaration = require('@accordproject/concerto-core').RelationshipDeclaration;
const FileWriter = require('../../../../lib/filewriter');

describe('TypescriptVisitor', function () {
    let typescriptVisitor;
    let mockFileWriter;
    beforeEach(() => {
        typescriptVisitor = new TypescriptVisitor();
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
            let mockSpecialVisit = sinon.stub(typescriptVisitor, 'visitModelManager');
            mockSpecialVisit.returns('Duck');

            typescriptVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitModelFile for a ModelFile', () => {
            let thing = sinon.createStubInstance(ModelFile);
            thing._isModelFile = true;
            let mockSpecialVisit = sinon.stub(typescriptVisitor, 'visitModelFile');
            mockSpecialVisit.returns('Duck');

            typescriptVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitEnumDeclaration for a EnumDeclaration', () => {
            let thing = sinon.createStubInstance(EnumDeclaration);
            thing._isEnumDeclaration = true;
            let mockSpecialVisit = sinon.stub(typescriptVisitor, 'visitEnumDeclaration');
            mockSpecialVisit.returns('Duck');

            typescriptVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitClassDeclaration for a ClassDeclaration', () => {
            let thing = sinon.createStubInstance(ClassDeclaration);
            thing._isClassDeclaration = true;
            let mockSpecialVisit = sinon.stub(typescriptVisitor, 'visitClassDeclaration');
            mockSpecialVisit.returns('Duck');

            typescriptVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitField for a Field', () => {
            let thing = sinon.createStubInstance(Field);
            thing._isField = true;
            let mockSpecialVisit = sinon.stub(typescriptVisitor, 'visitField');
            mockSpecialVisit.returns('Duck');

            typescriptVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitRelationship for a RelationshipDeclaration', () => {
            let thing = sinon.createStubInstance(RelationshipDeclaration);
            thing._isRelationshipDeclaration = true;
            let mockSpecialVisit = sinon.stub(typescriptVisitor, 'visitRelationship');
            mockSpecialVisit.returns('Duck');

            typescriptVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitEnumValueDeclaration for a EnumValueDeclaration', () => {
            let thing = sinon.createStubInstance(EnumValueDeclaration);
            thing._isEnumValueDeclaration = true;
            let mockSpecialVisit = sinon.stub(typescriptVisitor, 'visitEnumValueDeclaration');
            mockSpecialVisit.returns('Goose');

            typescriptVisitor.visit(thing, param).should.deep.equal('Goose');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should throw an error when an unrecognised type is supplied', () => {
            let thing = 'Something of unrecognised type';

            (() => {
                typescriptVisitor.visit(thing, param);
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

            typescriptVisitor.visitModelManager(mockModelManager, param);

            acceptSpy.withArgs(typescriptVisitor, param).calledTwice.should.be.ok;
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

            typescriptVisitor.visitModelFile(mockModelFile, param);

            param.fileWriter.openFile.withArgs('org.acme.ts').calledOnce.should.be.ok;
            param.fileWriter.writeLine.callCount.should.deep.equal(5);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, '// Generated code for namespace: org.acme']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([0, '\n// imports']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([0, 'import {IProperty1,Property1} from \'./org.org1\';']);
            param.fileWriter.writeLine.getCall(3).args.should.deep.equal([0, 'import {IParent,Parent} from \'./super\';']);
            param.fileWriter.writeLine.getCall(4).args.should.deep.equal([0, '\n// types']);
            param.fileWriter.closeFile.calledOnce.should.be.ok;

            acceptSpy.withArgs(typescriptVisitor, param).calledThrice.should.be.ok;
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

            typescriptVisitor.visitModelFile(mockModelFile, param);

            param.fileWriter.openFile.withArgs('org.acme.ts').calledOnce.should.be.ok;
            param.fileWriter.writeLine.callCount.should.deep.equal(4);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, '// Generated code for namespace: org.acme']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([0, '\n// imports']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([0, 'import {IProperty1,Property1,IProperty3,Property3} from \'./org.org1\';']);
            param.fileWriter.writeLine.getCall(3).args.should.deep.equal([0, '\n// types']);
            param.fileWriter.closeFile.calledOnce.should.be.ok;

            acceptSpy.withArgs(typescriptVisitor, param).calledTwice.should.be.ok;
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

            typescriptVisitor.visitEnumDeclaration(mockEnumDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(2);
            param.fileWriter.writeLine.withArgs(0, 'export enum Bob {').calledOnce.should.be.ok;
            param.fileWriter.writeLine.withArgs(0, '}\n').calledOnce.should.be.ok;

            acceptSpy.withArgs(typescriptVisitor, param).calledTwice.should.be.ok;
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

            typescriptVisitor.visitClassDeclaration(mockClassDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(9);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, 'export interface IBob {']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([0, '}\n']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([0, 'export class Bob implements IBob {']);
            param.fileWriter.writeLine.getCall(3).args.should.deep.equal([1, 'public static $class: string']);
            param.fileWriter.writeLine.getCall(4).args.should.deep.equal([1, 'public constructor(data: IBob) {']);
            param.fileWriter.writeLine.getCall(5).args.should.deep.equal([2, 'Object.assign(this, data);']);
            param.fileWriter.writeLine.getCall(6).args.should.deep.equal([2, 'Bob.$class = \'undefined\'']);
            param.fileWriter.writeLine.getCall(7).args.should.deep.equal([1, '}']);
            param.fileWriter.writeLine.getCall(8).args.should.deep.equal([0, '}\n']);
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

            typescriptVisitor.visitClassDeclaration(mockClassDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(10);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, 'export interface IBob extends IPerson {']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([0, '}\n']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([0, 'export abstract class Bob extends Person implements IBob {']);
            param.fileWriter.writeLine.getCall(3).args.should.deep.equal([1, 'public static $class: string']);
            param.fileWriter.writeLine.getCall(4).args.should.deep.equal([1, 'public constructor(data: IBob) {']);
            param.fileWriter.writeLine.getCall(5).args.should.deep.equal([2, 'super(data);']);
            param.fileWriter.writeLine.getCall(6).args.should.deep.equal([2, 'Object.assign(this, data);']);
            param.fileWriter.writeLine.getCall(7).args.should.deep.equal([2, 'Bob.$class = \'undefined\'']);
            param.fileWriter.writeLine.getCall(8).args.should.deep.equal([1, '}']);
            param.fileWriter.writeLine.getCall(9).args.should.deep.equal([0, '}\n']);
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
            typescriptVisitor.visitField(mockField, param);
            param.fileWriter.writeLine.withArgs(1, 'name: string;').calledOnce.should.be.ok;
        });
        it('should write a line for primitive field name and type using definite assignment', () => {
            const mockField = sinon.createStubInstance(Field);
            mockField.isPrimitive.returns(false);
            mockField.getName.returns('name');
            mockField.getType.returns('String');
            mockField.isPrimitive.returns(true);
            param.useDefiniteAssignment = true;
            typescriptVisitor.visitField(mockField, param);
            param.useDefiniteAssignment = false;
            param.fileWriter.writeLine.withArgs(1, 'name!: string;').calledOnce.should.be.ok;
        });

        it('should convert classes to interfaces', () => {
            const mockField = sinon.createStubInstance(Field);
            mockField.isPrimitive.returns(false);
            mockField.getName.returns('Bob');
            mockField.getType.returns('Person');

            const mockModelManager = sinon.createStubInstance(ModelManager);
            const mockModelFile = sinon.createStubInstance(ModelFile);
            const mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);

            mockModelManager.getType.returns(mockClassDeclaration);
            mockClassDeclaration.isEnum.returns(false);
            mockModelFile.getModelManager.returns(mockModelManager);
            mockClassDeclaration.getModelFile.returns(mockModelFile);
            mockField.getParent.returns(mockClassDeclaration);
            typescriptVisitor.visitField(mockField, param);

            param.fileWriter.writeLine.withArgs(1, 'Bob: IPerson;').calledOnce.should.be.ok;
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
            typescriptVisitor.visitField(mockField, param);

            param.fileWriter.writeLine.withArgs(1, 'Bob: IPerson[];').calledOnce.should.be.ok;
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

            typescriptVisitor.visitEnumValueDeclaration(mockEnumValueDeclaration, param);

            param.fileWriter.writeLine.withArgs(1, 'Bob,').calledOnce.should.be.ok;
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
            typescriptVisitor.visitRelationship(mockRelationship, param);

            param.fileWriter.writeLine.withArgs(1, 'Bob: IPerson;').calledOnce.should.be.ok;
        });
        it('should write a line for field name and type using definite assignment', () => {
            let mockRelationship = sinon.createStubInstance(RelationshipDeclaration);
            mockRelationship._isRelationshipDeclaration = true;
            mockRelationship.getName.returns('Bob');
            mockRelationship.getType.returns('Person');
            param.useDefiniteAssignment = true;
            typescriptVisitor.visitRelationship(mockRelationship, param);
            param.useDefiniteAssignment = false;
            param.fileWriter.writeLine.withArgs(1, 'Bob!: IPerson;').calledOnce.should.be.ok;
        });

        it('should write a line for field name and type thats an array', () => {
            let mockField = sinon.createStubInstance(Field);
            mockField._isField = true;
            mockField.getName.returns('Bob');
            mockField.getType.returns('Person');
            mockField.isArray.returns(true);
            typescriptVisitor.visitRelationship(mockField, param);

            param.fileWriter.writeLine.withArgs(1, 'Bob: IPerson[];').calledOnce.should.be.ok;
        });
    });

    describe('toTsType', () => {
        it('should return Date for DateTime', () => {
            typescriptVisitor.toTsType('DateTime').should.deep.equal('Date');
        });
        it('should return boolean for Boolean', () => {
            typescriptVisitor.toTsType('Boolean').should.deep.equal('boolean');
        });
        it('should return string for String', () => {
            typescriptVisitor.toTsType('String').should.deep.equal('string');
        });
        it('should return number for Double', () => {
            typescriptVisitor.toTsType('Double').should.deep.equal('number');
        });
        it('should return number for Long', () => {
            typescriptVisitor.toTsType('Long').should.deep.equal('number');
        });
        it('should return number for Integer', () => {
            typescriptVisitor.toTsType('Integer').should.deep.equal('number');
        });
        it('should return passed in type by default', () => {
            typescriptVisitor.toTsType('Penguin').should.deep.equal('Penguin');
        });
    });
});

