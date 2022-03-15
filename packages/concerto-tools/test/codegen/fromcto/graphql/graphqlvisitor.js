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

const GraphQLVisitor = require('../../../../lib/codegen/fromcto/graphql/graphqlvisitor.js');

const ModelFile = require('@accordproject/concerto-core').ModelFile;
const ModelManager = require('@accordproject/concerto-core').ModelManager;
const ClassDeclaration = require('@accordproject/concerto-core').ClassDeclaration;
const EnumValueDeclaration = require('@accordproject/concerto-core').EnumValueDeclaration;
const Field = require('@accordproject/concerto-core').Field;
const RelationshipDeclaration = require('@accordproject/concerto-core').RelationshipDeclaration;
const FileWriter = require('@accordproject/concerto-util').FileWriter;

const MODEL_WITH_DECORATORS = `
namespace test

concept Address {
}

participant Owner {
}

@single
asset Vehicle {
  @single
  o String model
  @role( "boolean", true, "string", "value", "int", 1, "float", 3.14, "ref", Address, 'arrayRef', Address[] )
  o String make
  o Integer age
  o Double price
  o Boolean secondHand
  o String color optional
  --> Owner owner
  --> Owner previousOwner optional
}
`;

describe('GraphQLVisitor', function () {
    let graphQLVisitor;
    let mockFileWriter;
    beforeEach(() => {
        graphQLVisitor = new GraphQLVisitor();
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
            let mockSpecialVisit = sinon.stub(graphQLVisitor, 'visitModelManager');
            mockSpecialVisit.returns('Duck');

            graphQLVisitor.visit(thing, param).should.deep.equal('Duck');
            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should call visitModelFile for a ModelFile', () => {
            let thing = sinon.createStubInstance(ModelFile);
            thing.isModelFile.returns(true);
            let mockSpecialVisit = sinon.stub(graphQLVisitor, 'visitModelFile');
            mockSpecialVisit.returns('Duck');

            graphQLVisitor.visit(thing, param).should.deep.equal('Duck');
            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitClassDeclaration for a ClassDeclaration', () => {
            let thing = sinon.createStubInstance(ClassDeclaration);
            thing.isClassDeclaration.returns(true);
            let mockSpecialVisit = sinon.stub(graphQLVisitor, 'visitClassDeclaration');
            mockSpecialVisit.returns('Duck');

            graphQLVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitField for a Field', () => {
            let thing = sinon.createStubInstance(Field);
            thing.isField.returns(true);
            let mockSpecialVisit = sinon.stub(graphQLVisitor, 'visitField');
            mockSpecialVisit.returns('Duck');

            graphQLVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitRelationship for a RelationshipDeclaration', () => {
            let thing = sinon.createStubInstance(RelationshipDeclaration);
            thing.isRelationship.returns(true);
            let mockSpecialVisit = sinon.stub(graphQLVisitor, 'visitRelationship');
            mockSpecialVisit.returns('Duck');

            graphQLVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitEnumValueDeclaration for a EnumValueDeclaration', () => {
            let thing = sinon.createStubInstance(EnumValueDeclaration);
            thing.isEnumValue.returns(true);
            let mockSpecialVisit = sinon.stub(graphQLVisitor, 'visitEnumValueDeclaration');
            mockSpecialVisit.returns('Duck');

            graphQLVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should throw an error when an unrecognised type is supplied', () => {
            let thing = 'Something of unrecognised type';

            (() => {
                graphQLVisitor.visit(thing, param);
            }).should.throw('Unrecognised \'Something of unrecognised type\'');
        });
    });

    describe('visitModelManager', () => {

        it('should write to the model.gql file and call accept for each model file', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let acceptSpy = sinon.spy();
            let mockModelManagerDefinition = sinon.createStubInstance(ModelManager);
            mockModelManagerDefinition.isModelManager.returns(true);
            mockModelManagerDefinition.getModelFiles.returns([{
                accept: acceptSpy
            },
            {
                accept: acceptSpy
            }]);

            graphQLVisitor.visitModelManager(mockModelManagerDefinition, param);
            param.fileWriter.openFile.withArgs('model.gql').calledOnce.should.be.ok;
            param.fileWriter.writeLine.callCount.should.deep.equal(1);
            param.fileWriter.closeFile.calledOnce.should.be.ok;
            acceptSpy.withArgs(graphQLVisitor, param).calledTwice.should.be.ok;
        });
    });

    describe('visitModelFile', () => {
        let param;

        beforeEach(() => {
            param = {
                fileWriter: mockFileWriter
            };
        });

        it('should visit all declaration in a model file', () => {
            let acceptSpy = sinon.spy();
            let mockModelFileDefinition = sinon.createStubInstance(ModelFile);
            mockModelFileDefinition.isModelFile.returns(true);
            mockModelFileDefinition.getNamespace.returns;
            mockModelFileDefinition.getAllDeclarations.returns([{
                accept: acceptSpy
            },
            {
                accept: acceptSpy
            }]);

            graphQLVisitor.visitModelFile(mockModelFileDefinition, param);
            acceptSpy.withArgs(graphQLVisitor, param).calledTwice.should.be.ok;
        });
    });

    describe('visitClassDeclaration', () => {
        it('should write the class declaration for a class', () => {
            let acceptSpy = sinon.spy();

            let param = {
                fileWriter: mockFileWriter
            };

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration.isClassDeclaration.returns(true);
            mockClassDeclaration.getName.returns('Person');
            mockClassDeclaration.getFullyQualifiedName.returns('org.acme.Person');
            mockClassDeclaration.getProperties.returns([{
                accept: acceptSpy
            },
            {
                accept: acceptSpy
            }]);

            graphQLVisitor.visitClassDeclaration(mockClassDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(2);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, 'type Person {']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([0, '}']);

            acceptSpy.withArgs(graphQLVisitor, param).calledTwice.should.be.ok;
        });

        it('should write the class declaration for an enum', () => {
            let acceptSpy = sinon.spy();

            let param = {
                fileWriter: mockFileWriter
            };

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration.isClassDeclaration.returns(true);
            mockClassDeclaration.getName.returns('Size');
            mockClassDeclaration.isEnum.returns(true);
            mockClassDeclaration.getFullyQualifiedName.returns('org.acme.Size');
            mockClassDeclaration.getProperties.returns([{
                accept: acceptSpy
            },
            {
                accept: acceptSpy
            }]);

            graphQLVisitor.visitClassDeclaration(mockClassDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(2);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, 'enum Size {']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([0, '}']);

            acceptSpy.withArgs(graphQLVisitor, param).calledTwice.should.be.ok;
        });

        it('should write the class declaration for a class (namespaces)', () => {
            let acceptSpy = sinon.spy();

            let param = {
                fileWriter: mockFileWriter
            };

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration.isClassDeclaration.returns(true);
            mockClassDeclaration.getName.returns('Person');
            mockClassDeclaration.getFullyQualifiedName.returns('org.acme.Person');
            mockClassDeclaration.getProperties.returns([{
                accept: acceptSpy
            },
            {
                accept: acceptSpy
            }]);

            graphQLVisitor = new GraphQLVisitor(true);
            graphQLVisitor.visitClassDeclaration(mockClassDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(2);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, 'type org_acme_Person {']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([0, '}']);

            acceptSpy.withArgs(graphQLVisitor, param).calledTwice.should.be.ok;
        });
    });

    describe('visitField', () => {
        it('should write a line for a field', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockField = sinon.createStubInstance(Field);
            mockField.isField.returns(true);
            mockField.getType.returns('string');
            mockField.getName.returns('Bob');

            graphQLVisitor.visitField(mockField, param);
            param.fileWriter.writeLine.withArgs(1, 'Bob: string!').calledOnce.should.be.ok;
        });

        it('should write a line for a field (namespaces)', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockField = sinon.createStubInstance(Field);
            mockField.isField.returns(true);
            mockField.getType.returns('org.acme.Person');
            mockField.getName.returns('Bob');
            mockField.getFullyQualifiedTypeName.returns('org.acme.Person');

            graphQLVisitor = new GraphQLVisitor(true);
            graphQLVisitor.visitField(mockField, param);
            param.fileWriter.writeLine.withArgs(1, 'Bob: org_acme_Person!').calledOnce.should.be.ok;
        });

        it('should write a line for a field thats an array', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockField = sinon.createStubInstance(Field);
            mockField.isField.returns(true);
            mockField.getType.returns('string');
            mockField.getName.returns('Bob');
            mockField.isArray.returns(true);

            graphQLVisitor.visitField(mockField, param);
            param.fileWriter.writeLine.withArgs(1, 'Bob: [string]!').calledOnce.should.be.ok;
        });
    });

    describe('visitEnumValueDeclaration', () => {
        it('should write a line for a enum value', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockEnumValueDecl = sinon.createStubInstance(EnumValueDeclaration);
            mockEnumValueDecl.isEnumValue.returns(true);
            mockEnumValueDecl.getName.returns('Bob');

            graphQLVisitor.visitEnumValueDeclaration(mockEnumValueDecl, param);
            param.fileWriter.writeLine.withArgs(1, 'Bob').calledOnce.should.be.ok;
        });
    });

    describe('visitRelationship', () => {
        it('should write a line for a relationship', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockRelationship = sinon.createStubInstance(RelationshipDeclaration);
            mockRelationship.isRelationship.returns(true);
            mockRelationship.getType.returns('string');
            mockRelationship.getName.returns('Bob');

            graphQLVisitor.visitRelationship(mockRelationship, param);

            param.fileWriter.writeLine.withArgs(1, '+ string Bob');
        });

        it('should write a line for a relationship thats an array', () => {
            let param = {
                fileWriter: mockFileWriter
            };

            let mockRelationship = sinon.createStubInstance(RelationshipDeclaration);
            mockRelationship.isRelationship.returns(true);
            mockRelationship.getType.returns('string');
            mockRelationship.getName.returns('Bob');
            mockRelationship.isArray.returns(true);

            graphQLVisitor.visitRelationship(mockRelationship, param);

            param.fileWriter.writeLine.withArgs(1, '+ string Bob');
        });
    });

    describe('decorators', () => {
        it('should create directives for decorators', () => {
            let param = {
                fileWriter: mockFileWriter
            };
            const modelManager = new ModelManager();
            modelManager.addCTOModel(MODEL_WITH_DECORATORS);
            graphQLVisitor.visit(modelManager, param);
            param.fileWriter.writeBeforeLine.getCall(0).args.should.deep.equal([0, 'directive @single on OBJECT | FIELD_DEFINITION']);
            param.fileWriter.writeBeforeLine.getCall(1).args.should.deep.equal([0, `directive @role(boolean: Boolean
string: String
int: Int
float: Float
ref: String
arrayRef: String) on OBJECT | FIELD_DEFINITION`]);
        });
    });
});