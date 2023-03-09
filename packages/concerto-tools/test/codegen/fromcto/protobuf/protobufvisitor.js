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
const { assert } = chai;
const sinon = require('sinon');
const fs = require('fs');
const path = require('path');

const ProtobufVisitor = require(
    '../../../../lib/codegen/fromcto/protobuf/protobufvisitor.js'
);

const ModelFile = require('@accordproject/concerto-core').ModelFile;
const ModelManager = require('@accordproject/concerto-core').ModelManager;
const ModelLoader = require('@accordproject/concerto-core').ModelLoader;
const AssetDeclaration = require('@accordproject/concerto-core').AssetDeclaration;
const ClassDeclaration = require('@accordproject/concerto-core').ClassDeclaration;
const EnumDeclaration = require('@accordproject/concerto-core').EnumDeclaration;
const EnumValueDeclaration = require('@accordproject/concerto-core').EnumValueDeclaration;
const Field = require('@accordproject/concerto-core').Field;
const RelationshipDeclaration = require('@accordproject/concerto-core').RelationshipDeclaration;
const TransactionDeclaration = require('@accordproject/concerto-core').TransactionDeclaration;
const FileWriter = require('@accordproject/concerto-util').FileWriter;
const { InMemoryWriter } = require('@accordproject/concerto-util');

describe('ProtobufVisitor', function () {
    let protobufVisitor;
    let mockFileWriter;
    beforeEach(() => {
        protobufVisitor = new ProtobufVisitor();
        mockFileWriter = sinon.createStubInstance(FileWriter);
    });

    describe('visit', () => {
        let param;
        beforeEach(() => {
            param = {
                property1: 'value1'
            };
        });

        it('should call visitModelManager for a ModelManager', () => {
            let thing = sinon.createStubInstance(ModelManager);
            thing.isModelManager.returns(true);
            let mockSpecialVisit = sinon.stub(protobufVisitor, 'visitModelManager');
            mockSpecialVisit.returns('Duck');

            protobufVisitor.visit(thing, param).should.deep.equal('Duck');
            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should call visitModelFile for a ModelFile', () => {
            let thing = sinon.createStubInstance(ModelFile);
            thing.isModelFile.returns(true);
            let mockSpecialVisit = sinon.stub(protobufVisitor, 'visitModelFile');
            mockSpecialVisit.returns('Duck');

            protobufVisitor.visit(thing, param).should.deep.equal('Duck');
            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitClassDeclaration for a ClassDeclaration', () => {
            let thing = sinon.createStubInstance(ClassDeclaration);
            thing.isClassDeclaration.returns(true);
            let mockSpecialVisit = sinon.stub(protobufVisitor, 'visitClassDeclaration');
            mockSpecialVisit.returns('Duck');

            protobufVisitor.visit(thing, param).should.deep.equal('Duck');
            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitField for a Field', () => {
            let thing = sinon.createStubInstance(Field);
            thing.isField.returns(true);
            let mockSpecialVisit = sinon.stub(protobufVisitor, 'visitField');
            mockSpecialVisit.returns('Duck');

            protobufVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitRelationshipDeclaration for a RelationshipDeclaration', () => {
            let thing = sinon.createStubInstance(RelationshipDeclaration);
            thing.isRelationship.returns(true);
            let mockSpecialVisit = sinon.stub(protobufVisitor, 'visitRelationshipDeclaration');
            mockSpecialVisit.returns('Duck');

            protobufVisitor.visit(thing, param).should.deep.equal('Duck');
            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitEnumValueDeclaration for a EnumValueDeclaration', () => {
            let thing = sinon.createStubInstance(EnumValueDeclaration);
            thing.isEnumValue.returns(true);
            let mockSpecialVisit = sinon.stub(protobufVisitor, 'visitEnumValueDeclaration');
            mockSpecialVisit.returns('Duck');

            protobufVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });
        it('should throw an error when an unrecognised type is supplied', () => {
            let thing = 'Something of unrecognised type';

            (() => {
                protobufVisitor.visit(thing, param);
            }).should.throw('Unrecognised type: string, value: \'Something of unrecognised type\'');
        });
    });

    describe('createImportLineStrings', () => {
        it('should convert a Concerto import to a Proto3 import string', () => {
            protobufVisitor.createImportLineStrings([{
                namespace: 'org.accordproject.address@1.0.0'
            }]).should.deep.equal(['org.accordproject.address.v1_0_0.proto']);
        });
    });

    describe('visitModelFile', () => {
        it('should write an empty model file', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockModelFile = sinon.createStubInstance(ModelFile);
            mockModelFile.getNamespace.returns('org.accordproject.address@1.0.0');
            mockModelFile.imports = [];
            mockModelFile.getAllDeclarations.returns([]);

            protobufVisitor.visitModelFile(mockModelFile, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(4);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, 'syntax = "proto3";\n']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([0, 'package org.accordproject.address.v1_0_0;\n']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([0, 'import "google/protobuf/timestamp.proto";']);
            param.fileWriter.writeLine.getCall(3).args.should.deep.equal([0, '']);
        });
    });

    describe('visitAssetDeclaration', () => {
        it('should write the class declaration for an asset', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockAssetDeclaration = sinon.createStubInstance(AssetDeclaration);
            mockAssetDeclaration.isAsset.returns(true);
            mockAssetDeclaration.getName.returns('Person');
            mockAssetDeclaration.modelFile = { declarations: [] };

            protobufVisitor.visitAssetDeclaration(mockAssetDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(1);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, 'message Person {}\n']);
        });

        it('should write the class declaration for an asset with a super type', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockAssetDeclaration = sinon.createStubInstance(AssetDeclaration);
            mockAssetDeclaration.isAsset.returns(true);
            mockAssetDeclaration.getName.returns('Person');
            mockAssetDeclaration.getSuperType.returns('org.acme.Human');
            mockAssetDeclaration.modelFile = { declarations: [] };

            protobufVisitor.visitAssetDeclaration(mockAssetDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(1);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, 'message Person {}\n']);
        });
    });

    describe('visitEnumDeclaration', () => {
        it('should write the class declaration for an enum', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockEnumDeclaration = sinon.createStubInstance(EnumDeclaration);
            mockEnumDeclaration.isEnum.returns(true);
            mockEnumDeclaration.name = 'Person';

            protobufVisitor.visitEnumDeclaration(mockEnumDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(1);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, 'enum Person {}\n']);
        });
    });

    describe('visitTransactionDeclaration', () => {
        it('should write the class declaration for a transaction', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockTransDeclaration = sinon.createStubInstance(TransactionDeclaration);
            mockTransDeclaration.isTransaction.returns(true);
            mockTransDeclaration.getFullyQualifiedName.returns('org.acme.Person');
            mockTransDeclaration.getName.returns('Person');
            mockTransDeclaration.modelFile = { declarations: [] };

            protobufVisitor.visitTransactionDeclaration(mockTransDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(1);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, 'message Person {}\n']);
        });

        it('should write the class declaration for a transaction with a super type', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockTransDeclaration = sinon.createStubInstance(TransactionDeclaration);
            mockTransDeclaration.isTransaction.returns(true);
            mockTransDeclaration.getName.returns('Person');
            mockTransDeclaration.getSuperType.returns('org.acme.Human');
            mockTransDeclaration.modelFile = { declarations: [] };

            protobufVisitor.visitTransactionDeclaration(mockTransDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(1);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, 'message Person {}\n']);
        });
    });

    describe('visitClassDeclaration', () => {
        it('should write the class declaration for a class', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration.isClassDeclaration.returns(true);
            mockClassDeclaration.getName.returns('Person');
            mockClassDeclaration.modelFile = { declarations: [] };

            protobufVisitor.visitClassDeclaration(mockClassDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(1);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, 'message Person {}\n']);
        });

        it('should write the class declaration for a class with a super type', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration.isClassDeclaration.returns(true);
            mockClassDeclaration.getName.returns('Person');
            mockClassDeclaration.getSuperType.returns('org.acme.Human');
            mockClassDeclaration.modelFile = { declarations: [] };

            protobufVisitor.visitClassDeclaration(mockClassDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(1);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, 'message Person {}\n']);
        });
    });

    describe('visitField', () => {
        it('should return an object representing a Proto3 field coming from a Concerto String', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockField = sinon.createStubInstance(Field);
            mockField.isField.returns(true);
            mockField.isPrimitive.returns(true);
            mockField.getType.returns('String');
            mockField.getName.returns('Bob');

            protobufVisitor.visitField(mockField, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(1);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, '  string Bob = 0;']);
        });

        it('should return an object representing a Proto3 field coming from a Concerto Double', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockField = sinon.createStubInstance(Field);
            mockField.isField.returns(true);
            mockField.isPrimitive.returns(true);
            mockField.getType.returns('Double');
            mockField.getName.returns('Bob');

            protobufVisitor.visitField(mockField, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(1);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, '  double Bob = 0;']);
        });

        it('should return an object representing a Proto3 field coming from a Concerto Integer', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockField = sinon.createStubInstance(Field);
            mockField.isField.returns(true);
            mockField.isPrimitive.returns(true);
            mockField.getType.returns('Integer');
            mockField.getName.returns('Bob');

            protobufVisitor.visitField(mockField, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(1);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, '  sint64 Bob = 0;']);
        });

        it('should return an object representing a Proto3 field coming from a Concerto Long', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockField = sinon.createStubInstance(Field);
            mockField.isField.returns(true);
            mockField.isPrimitive.returns(true);
            mockField.getType.returns('Long');
            mockField.getName.returns('Bob');

            protobufVisitor.visitField(mockField, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(1);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, '  sint64 Bob = 0;']);
        });

        it('should return an object representing a Proto3 field coming from a Concerto DateTime', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockField = sinon.createStubInstance(Field);
            mockField.isField.returns(true);
            mockField.isPrimitive.returns(true);
            mockField.getType.returns('DateTime');
            mockField.getName.returns('Bob');

            protobufVisitor.visitField(mockField, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(1);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, '  google.protobuf.Timestamp Bob = 0;']);
        });

        it('should return an object representing a Proto3 field coming from a Concerto Boolean', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockField = sinon.createStubInstance(Field);
            mockField.isField.returns(true);
            mockField.isPrimitive.returns(true);
            mockField.getType.returns('Boolean');
            mockField.getName.returns('Bob');

            protobufVisitor.visitField(mockField, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(1);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, '  bool Bob = 0;']);
        });

        it('should return an object representing a Proto3 field that is an array', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockField = sinon.createStubInstance(Field);
            mockField.isField.returns(true);
            mockField.isPrimitive.returns(true);
            mockField.getType.returns('String');
            mockField.getName.returns('Bob');
            mockField.isArray.returns(true);

            protobufVisitor.visitField(mockField, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(1);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, '  repeated string Bob = 0;']);
        });
    });

    describe('visit CTO file', () => {
        it('should process an APAP protocol CTO file', async () => {
            const modelManager = await ModelLoader.loadModelManager(
                [path.resolve(__dirname, './data/apapProtocol.cto')]
            );
            const writer = new InMemoryWriter();

            modelManager.accept(
                new ProtobufVisitor(), {
                    fileWriter: writer
                }
            );

            const expectedMetamodelProtobuf = fs.readFileSync(
                path.resolve(
                    __dirname,
                    './data/concerto.metamodel.v0_4_0-expected.proto'
                ),
                'utf8'
            );
            const expectedCommonmarkProtobuf = fs.readFileSync(
                path.resolve(
                    __dirname,
                    './data/org.accordproject.commonmark.v0_5_0-expected.proto'
                ),
                'utf8'
            );
            const expectedApapPartyProtobuf = fs.readFileSync(
                path.resolve(
                    __dirname,
                    './data/org.accordproject.party.v0_2_0-expected.proto'
                ),
                'utf8'
            );
            const expectedApapProtocolProtobuf = fs.readFileSync(
                path.resolve(
                    __dirname,
                    './data/org.accordproject.protocol.v1_0_0-expected.proto'
                ),
                'utf8'
            );

            assert.equal(
                writer.data.get('concerto.metamodel.v0_4_0.proto')
                    .replace(/\r\n/g, '\n'),
                expectedMetamodelProtobuf
            );

            assert.equal(
                writer.data.get('org.accordproject.commonmark.v0_5_0.proto')
                    .replace(/\r\n/g, '\n'),
                expectedCommonmarkProtobuf
            );

            assert.equal(
                writer.data.get('org.accordproject.party.v0_2_0.proto')
                    .replace(/\r\n/g, '\n'),
                expectedApapPartyProtobuf
            );

            assert.equal(
                writer.data.get('org.accordproject.protocol.v1_0_0.proto')
                    .replace(/\r\n/g, '\n'),
                expectedApapProtocolProtobuf
            );
        });
    });
});
