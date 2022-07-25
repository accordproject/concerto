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
const FileWriter = require('@accordproject/concerto-util').FileWriter;

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
            thing.isModelManager.returns(true);
            let mockSpecialVisit = sinon.stub(csharpVisitor, 'visitModelManager');
            mockSpecialVisit.returns('Duck');

            csharpVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitModelFile for a ModelFile', () => {
            let thing = sinon.createStubInstance(ModelFile);
            thing.isModelFile.returns(true);
            let mockSpecialVisit = sinon.stub(csharpVisitor, 'visitModelFile');
            mockSpecialVisit.returns('Duck');

            csharpVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitEnumDeclaration for a EnumDeclaration', () => {
            let thing = sinon.createStubInstance(EnumDeclaration);
            thing.isEnum.returns(true);
            let mockSpecialVisit = sinon.stub(csharpVisitor, 'visitEnumDeclaration');
            mockSpecialVisit.returns('Duck');

            csharpVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitClassDeclaration for a ClassDeclaration', () => {
            let thing = sinon.createStubInstance(ClassDeclaration);
            thing.isClassDeclaration.returns(true);
            let mockSpecialVisit = sinon.stub(csharpVisitor, 'visitClassDeclaration');
            mockSpecialVisit.returns('Duck');

            csharpVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitField for a Field', () => {
            let thing = sinon.createStubInstance(Field);
            thing.isField.returns(true);
            let mockSpecialVisit = sinon.stub(csharpVisitor, 'visitField');
            mockSpecialVisit.returns('Duck');

            csharpVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitRelationship for a RelationshipDeclaration', () => {
            let thing = sinon.createStubInstance(RelationshipDeclaration);
            thing.isRelationship.returns(true);
            let mockSpecialVisit = sinon.stub(csharpVisitor, 'visitRelationship');
            mockSpecialVisit.returns('Duck');

            csharpVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitEnumValueDeclaration for a EnumValueDeclaration', () => {
            let thing = sinon.createStubInstance(EnumValueDeclaration);
            thing.isEnumValue.returns(true);
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
            mockModelManager.isModelManager.returns(true);
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

            const myParams = {
                ...param,
                namespacePrefix: 'Concerto.Models.'
            };
            csharpVisitor.visitModelFile(mockModelFile, myParams);

            param.fileWriter.openFile.withArgs('org.acme.cs').calledOnce.should.be.ok;
            param.fileWriter.writeLine.callCount.should.equal(8);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, 'using System;']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([0, 'using System.Text.Json.Serialization;']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([0, 'using Concerto.Serialization;']);
            param.fileWriter.writeLine.getCall(3).args.should.deep.equal([0, 'namespace Concerto.Models.org.acme {']);
            param.fileWriter.writeLine.getCall(4).args.should.deep.equal([1, 'using Concerto.Models.org.org1;']);
            param.fileWriter.writeLine.getCall(5).args.should.deep.equal([1, 'using Concerto.Models.org.org2;']);
            param.fileWriter.writeLine.getCall(6).args.should.deep.equal([1, 'using Concerto.Models.super;']);
            param.fileWriter.writeLine.getCall(7).args.should.deep.equal([0, '}']);
            param.fileWriter.closeFile.calledOnce.should.be.ok;
            acceptSpy.withArgs(csharpVisitor, myParams).calledThrice.should.be.ok;
        });

        it('should write lines for the imports that are not in own namespace (including super types) ignoring primitives using Newtonsoft.Json', () => {
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

            const newtonsoftParams = {
                ...param,
                useNewtonsoftJson: true,
                namespacePrefix: 'Concerto.Models'
            };
            csharpVisitor.visitModelFile(mockModelFile, newtonsoftParams);

            param.fileWriter.openFile.withArgs('org.acme.cs').calledOnce.should.be.ok;
            param.fileWriter.writeLine.callCount.should.equal(8);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, 'using System;']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([0, 'using NewtonsoftJson = Newtonsoft.Json;']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([0, 'using NewtonsoftConcerto = Concerto.Serialization.Newtonsoft;']);
            param.fileWriter.writeLine.getCall(3).args.should.deep.equal([0, 'namespace Concerto.Models.org.acme {']);
            param.fileWriter.writeLine.getCall(4).args.should.deep.equal([1, 'using Concerto.Models.org.org1;']);
            param.fileWriter.writeLine.getCall(5).args.should.deep.equal([1, 'using Concerto.Models.org.org2;']);
            param.fileWriter.writeLine.getCall(6).args.should.deep.equal([1, 'using Concerto.Models.super;']);
            param.fileWriter.writeLine.getCall(7).args.should.deep.equal([0, '}']);
            param.fileWriter.closeFile.calledOnce.should.be.ok;
            acceptSpy.withArgs(csharpVisitor, newtonsoftParams).calledThrice.should.be.ok;
        });


        it('should write lines for the imports that are not in own namespace ignoring primitives and write lines for importing system type', () => {
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
                    return false;
                },
                getFullyQualifiedTypeName: () => {
                    return 'org.org1.Property3';
                }
            };

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration.isClassDeclaration.returns(true);
            mockClassDeclaration.getProperties.returns([property1, property2, property3]);
            mockClassDeclaration.accept = acceptSpy;

            let mockModelManager = sinon.createStubInstance(ModelManager);
            mockModelManager.isModelManager.returns(true);

            let mockModelFile = sinon.createStubInstance(ModelFile);
            mockModelFile.isModelFile.returns(true);
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

            const myParams = {
                ...param,
                namespacePrefix: 'Concerto.Models.'
            };
            csharpVisitor.visitModelFile(mockModelFile, myParams);

            param.fileWriter.openFile.withArgs('org.acme.cs').calledOnce.should.be.ok;
            param.fileWriter.writeLine.callCount.should.equal(7);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([0, 'using System;']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([0, 'using System.Text.Json.Serialization;']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([0, 'using Concerto.Serialization;']);
            param.fileWriter.writeLine.getCall(3).args.should.deep.equal([0, 'namespace Concerto.Models.org.acme {']);
            param.fileWriter.writeLine.getCall(4).args.should.deep.equal([1, 'using Concerto.Models.org.org1;']);
            param.fileWriter.writeLine.getCall(5).args.should.deep.equal([1, 'using Concerto.Models.org.org2;']);
            param.fileWriter.writeLine.getCall(6).args.should.deep.equal([0, '}']);
            param.fileWriter.closeFile.calledOnce.should.be.ok;
            acceptSpy.withArgs(csharpVisitor, myParams).calledTwice.should.be.ok;
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
            param.fileWriter.writeLine.withArgs(1, 'public enum Bob {').calledOnce.should.be.ok;
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
            mockClassDeclaration.isClassDeclaration.returns(true);
            mockClassDeclaration.getOwnProperties.returns([{
                accept: acceptSpy
            },
            {
                accept: acceptSpy
            }]);
            mockClassDeclaration.getName.returns('Bob');

            csharpVisitor.visitClassDeclaration(mockClassDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(3);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([1, 'public class Bob {']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([2, '[JsonPropertyName("$class")]\n\t\tpublic override string _class { get;} = "undefined";']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([1, '}']);
        });
        it('should write the class opening and close with Newtonsoft.Json', () => {
            let acceptSpy = sinon.spy();

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            let mockClassDeclaration2 = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration.isClassDeclaration.returns(true);
            mockClassDeclaration.getOwnProperties.returns([{
                accept: acceptSpy
            },
            {
                accept: acceptSpy
            }]);
            mockClassDeclaration.getName.returns('Bob');
            mockClassDeclaration.getAssignableClassDeclarations.returns([mockClassDeclaration, mockClassDeclaration2]);
            csharpVisitor.visitClassDeclaration(mockClassDeclaration, { ...param, useNewtonsoftJson: true});

            param.fileWriter.writeLine.callCount.should.deep.equal(4);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([1, '[NewtonsoftJson.JsonConverter(typeof(NewtonsoftConcerto.ConcertoConverter))]']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([1, 'public class Bob {']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([2, '[NewtonsoftJson.JsonProperty("$class")]\n\t\tpublic override string _class { get;} = "undefined";']);
            param.fileWriter.writeLine.getCall(3).args.should.deep.equal([1, '}']);
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
            mockClassDeclaration.getName.returns('Bob');
            mockClassDeclaration.isAbstract.returns(true);
            mockClassDeclaration.getSuperType.returns('org.acme.Person');

            csharpVisitor.visitClassDeclaration(mockClassDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(3);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([1, 'public abstract class Bob : Person {']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([2, '[JsonPropertyName("$class")]\n\t\tpublic override string _class { get;} = "undefined";']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([1, '}']);
        });
        it('should write the class opening and close with abstract and super type, with explicit System.Text.Json flag', () => {
            let acceptSpy = sinon.spy();

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration.isClassDeclaration.returns(true);
            mockClassDeclaration.getOwnProperties.returns([{
                accept: acceptSpy
            },
            {
                accept: acceptSpy
            }]);
            mockClassDeclaration.getName.returns('Bob');
            mockClassDeclaration.isAbstract.returns(true);
            mockClassDeclaration.getSuperType.returns('org.acme.Person');

            csharpVisitor.visitClassDeclaration(mockClassDeclaration, { ...param, useSystemTextJson: true });

            param.fileWriter.writeLine.callCount.should.deep.equal(3);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([1, 'public abstract class Bob : Person {']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([2, '[JsonPropertyName("$class")]\n\t\tpublic override string _class { get;} = "undefined";']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([1, '}']);
        });
        it('should write the class opening and close with abstract and super type, with both serializer flags', () => {
            let acceptSpy = sinon.spy();

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration.isClassDeclaration.returns(true);
            mockClassDeclaration.getOwnProperties.returns([{
                accept: acceptSpy
            },
            {
                accept: acceptSpy
            }]);
            mockClassDeclaration.getName.returns('Bob');
            mockClassDeclaration.isAbstract.returns(true);
            mockClassDeclaration.getSuperType.returns('org.acme.Person');

            csharpVisitor.visitClassDeclaration(mockClassDeclaration, { ...param, useSystemTextJson: true, useNewtonsoftJson: true });

            param.fileWriter.writeLine.callCount.should.deep.equal(3);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([1, 'public abstract class Bob : Person {']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([2, '[JsonPropertyName("$class")]\n\t\t[NewtonsoftJson.JsonProperty("$class")]\n\t\tpublic override string _class { get;} = "undefined";']);
            param.fileWriter.writeLine.getCall(2).args.should.deep.equal([1, '}']);
        });
        it('should write the class opening and close with virtual modifier for base class', () => {
            let acceptSpy = sinon.spy();

            let mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
            mockClassDeclaration.isClassDeclaration.returns(true);
            mockClassDeclaration.getOwnProperties.returns([{
                accept: acceptSpy
            },
            {
                accept: acceptSpy
            }]);
            mockClassDeclaration.getName.returns('Concept');
            mockClassDeclaration.getFullyQualifiedName.returns('concerto.Concept');
            mockClassDeclaration.isAbstract.returns(true);

            csharpVisitor.visitClassDeclaration(mockClassDeclaration, param);

            param.fileWriter.writeLine.callCount.should.deep.equal(3);
            param.fileWriter.writeLine.getCall(0).args.should.deep.equal([1, 'public abstract class Concept {']);
            param.fileWriter.writeLine.getCall(1).args.should.deep.equal([2, '[JsonPropertyName("$class")]\n\t\tpublic virtual string _class { get;} = "concerto.Concept";']);
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

        it('should write a line for primitive field name and type, where the field name is reserved in C#', () => {
            const mockField = sinon.createStubInstance(Field);
            mockField.isPrimitive.returns(false);
            mockField.getName.returns('bool');
            mockField.getType.returns('String');
            mockField.isPrimitive.returns(true);
            csharpVisitor.visitField(mockField, param);
            param.fileWriter.writeLine.withArgs(2, '[JsonPropertyName("bool")]\n\t\tpublic string _bool { get; set; }').calledOnce.should.be.ok;
        });

        it('should write a line for an optional enum field name and type', () => {
            const mockField = sinon.createStubInstance(Field);
            mockField.isPrimitive.returns(false);
            mockField.getName.returns('myEnum');
            mockField.getType.returns('Enum');
            mockField.isOptional.returns(true);
            mockField.isTypeEnum.returns(true);
            csharpVisitor.visitField(mockField, param);
            param.fileWriter.writeLine.withArgs(2, 'public Enum? myEnum { get; set; }').calledOnce.should.be.ok;
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
            mockEnumValueDeclaration.isEnumValue.returns(true);
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
            mockRelationship.isRelationship.returns(true);
            mockRelationship.getName.returns('Bob');
            mockRelationship.getType.returns('Person');
            csharpVisitor.visitRelationship(mockRelationship, param);

            param.fileWriter.writeLine.withArgs(2, 'public Person Bob { get; set; }').calledOnce.should.be.ok;
        });

        it('should write a line for field name and type thats an array', () => {
            let mockField = sinon.createStubInstance(Field);
            mockField.isField.returns(true);
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

