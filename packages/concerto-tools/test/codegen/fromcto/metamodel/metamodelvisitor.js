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

const MetamodelVisitor = require('../../../../lib/codegen/fromcto/metamodel/metamodelvisitor.js');

const EnumDeclaration = require('@accordproject/concerto-core').EnumDeclaration;
const ModelFile = require('@accordproject/concerto-core').ModelFile;
const ModelManager = require('@accordproject/concerto-core').ModelManager;
const FileWriter = require('@accordproject/concerto-util').FileWriter;

describe('MetamodelVisitor', function () {
    let metamodelVisitor;
    let mockFileWriter;
    beforeEach(() => {
        metamodelVisitor = new MetamodelVisitor();
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
            let mockSpecialVisit = sinon.stub(metamodelVisitor, 'visitModelManager');
            mockSpecialVisit.returns('Duck');

            metamodelVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitModelFile for a ModelFile', () => {
            let thing = sinon.createStubInstance(ModelFile);
            thing.isModelFile.returns(true);
            let mockSpecialVisit = sinon.stub(metamodelVisitor, 'visitModelFile');
            mockSpecialVisit.returns('Duck');

            metamodelVisitor.visit(thing, param).should.deep.equal('Duck');

            mockSpecialVisit.calledWith(thing, param).should.be.ok;
        });

        it('should return visitEnumDeclaration for a EnumDeclaration', () => {
            let thing = sinon.createStubInstance(EnumDeclaration);
            thing.isEnum.returns(true);

            (() => metamodelVisitor.visit(thing, param)).should.throw('The MetamodelVisitor only supports directly visiting \'ModelManager\' and \'ModelFile\' instances.');
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

            metamodelVisitor.visitModelManager(mockModelManager, param);

            acceptSpy.withArgs(metamodelVisitor, param).calledTwice.should.be.ok;
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
            let mockModelManager = sinon.createStubInstance(ModelManager);
            mockModelManager.isModelManager.returns(true);

            let mockModelFile = sinon.createStubInstance(ModelFile);

            mockModelManager.getModelFiles.returns([mockModelFile]);

            mockModelFile.getModelManager.returns(mockModelManager);
            mockModelFile.getNamespace.returns('org.acme');
            mockModelFile.getDefinitions.returns(`namespace test.person

            import org.accordproject.time.* from https://models.accordproject.org/time@0.2.0.cto
            import org.accordproject.time.TemporalUnit from https://models.accordproject.org/time@0.2.0.cto

            enum Gender {
              o MALE
              o FEMALE
              o OTHER
            }

            abstract participant Individual {
            }

            participant Person extends Individual {
              o String firstName regex=/[a-zA-Z]*/u
              o String lastName
              o Address address
              o Address address2 default="USAddress"
              --> Address address3
              --> Address[] address4
              --> Address address5 optional
              o Gender gender
              o DateTime dob optional
            }

            participant Employee extends Person {
              o String company
              o Boolean onLeave
            }

            concept Address identified {
              o Integer zip default=10001
              o Long zip2 default=10001
              o Double zip3 default=10001.0
              o String city default="NYC"
              o String country default="USA"
              o String[] street
              o Boolean isResidential default=true
              o Boolean isPrivate default=false
            }`);

            metamodelVisitor.visitModelFile(mockModelFile, param);

            param.fileWriter.openFile.withArgs('org.acme.ast.json').calledOnce.should.be.ok;
            param.fileWriter.write.calledOnce.should.be.ok;
            param.fileWriter.write.getCall(0).args.should.deep.equal([JSON.stringify({
                '$class': 'concerto.metamodel.Model',
                'namespace': 'test.person',
                'imports': [
                    {
                        '$class': 'concerto.metamodel.ImportAll',
                        'namespace': 'org.accordproject.time',
                        'uri': 'https://models.accordproject.org/time@0.2.0.cto'
                    },
                    {
                        '$class': 'concerto.metamodel.ImportType',
                        'name': 'TemporalUnit',
                        'namespace': 'org.accordproject.time',
                        'uri': 'https://models.accordproject.org/time@0.2.0.cto'
                    }
                ],
                'declarations': [
                    {
                        '$class': 'concerto.metamodel.EnumDeclaration',
                        'name': 'Gender',
                        'properties': [
                            {
                                '$class': 'concerto.metamodel.EnumProperty',
                                'name': 'MALE',
                                'location': {
                                    '$class': 'concerto.metamodel.Range',
                                    'start': {
                                        'offset': 269,
                                        'line': 7,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    },
                                    'end': {
                                        'offset': 290,
                                        'line': 8,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    }
                                }
                            },
                            {
                                '$class': 'concerto.metamodel.EnumProperty',
                                'name': 'FEMALE',
                                'location': {
                                    '$class': 'concerto.metamodel.Range',
                                    'start': {
                                        'offset': 290,
                                        'line': 8,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    },
                                    'end': {
                                        'offset': 313,
                                        'line': 9,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    }
                                }
                            },
                            {
                                '$class': 'concerto.metamodel.EnumProperty',
                                'name': 'OTHER',
                                'location': {
                                    '$class': 'concerto.metamodel.Range',
                                    'start': {
                                        'offset': 313,
                                        'line': 9,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    },
                                    'end': {
                                        'offset': 333,
                                        'line': 10,
                                        'column': 13,
                                        '$class': 'concerto.metamodel.Position'
                                    }
                                }
                            }
                        ],
                        'location': {
                            '$class': 'concerto.metamodel.Range',
                            'start': {
                                'offset': 241,
                                'line': 6,
                                'column': 13,
                                '$class': 'concerto.metamodel.Position'
                            },
                            'end': {
                                'offset': 334,
                                'line': 10,
                                'column': 14,
                                '$class': 'concerto.metamodel.Position'
                            }
                        }
                    },
                    {
                        '$class': 'concerto.metamodel.ParticipantDeclaration',
                        'name': 'Individual',
                        'isAbstract': true,
                        'properties': [],
                        'location': {
                            '$class': 'concerto.metamodel.Range',
                            'start': {
                                'offset': 348,
                                'line': 12,
                                'column': 13,
                                '$class': 'concerto.metamodel.Position'
                            },
                            'end': {
                                'offset': 395,
                                'line': 13,
                                'column': 14,
                                '$class': 'concerto.metamodel.Position'
                            }
                        }
                    },
                    {
                        '$class': 'concerto.metamodel.ParticipantDeclaration',
                        'name': 'Person',
                        'isAbstract': false,
                        'properties': [
                            {
                                '$class': 'concerto.metamodel.StringProperty',
                                'name': 'firstName',
                                'isArray': false,
                                'isOptional': false,
                                'location': {
                                    '$class': 'concerto.metamodel.Range',
                                    'start': {
                                        'offset': 463,
                                        'line': 16,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    },
                                    'end': {
                                        'offset': 515,
                                        'line': 17,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    }
                                },
                                'validator': {
                                    '$class': 'concerto.metamodel.StringRegexValidator',
                                    'pattern': '[a-zA-Z]*',
                                    'flags': 'u'
                                }
                            },
                            {
                                '$class': 'concerto.metamodel.StringProperty',
                                'name': 'lastName',
                                'isArray': false,
                                'isOptional': false,
                                'location': {
                                    '$class': 'concerto.metamodel.Range',
                                    'start': {
                                        'offset': 515,
                                        'line': 17,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    },
                                    'end': {
                                        'offset': 547,
                                        'line': 18,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    }
                                }
                            },
                            {
                                '$class': 'concerto.metamodel.ObjectProperty',
                                'name': 'address',
                                'type': {
                                    '$class': 'concerto.metamodel.TypeIdentifier',
                                    'name': 'Address'
                                },
                                'isArray': false,
                                'isOptional': false,
                                'location': {
                                    '$class': 'concerto.metamodel.Range',
                                    'start': {
                                        'offset': 547,
                                        'line': 18,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    },
                                    'end': {
                                        'offset': 579,
                                        'line': 19,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    }
                                }
                            },
                            {
                                '$class': 'concerto.metamodel.ObjectProperty',
                                'name': 'address2',
                                'type': {
                                    '$class': 'concerto.metamodel.TypeIdentifier',
                                    'name': 'Address'
                                },
                                'isArray': false,
                                'isOptional': false,
                                'location': {
                                    '$class': 'concerto.metamodel.Range',
                                    'start': {
                                        'offset': 579,
                                        'line': 19,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    },
                                    'end': {
                                        'offset': 632,
                                        'line': 20,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    }
                                },
                                'defaultValue': 'USAddress'
                            },
                            {
                                '$class': 'concerto.metamodel.RelationshipProperty',
                                'name': 'address3',
                                'type': {
                                    '$class': 'concerto.metamodel.TypeIdentifier',
                                    'name': 'Address'
                                },
                                'isArray': false,
                                'isOptional': false,
                                'location': {
                                    '$class': 'concerto.metamodel.Range',
                                    'start': {
                                        'offset': 632,
                                        'line': 20,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    },
                                    'end': {
                                        'offset': 667,
                                        'line': 21,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    }
                                }
                            },
                            {
                                '$class': 'concerto.metamodel.RelationshipProperty',
                                'name': 'address4',
                                'type': {
                                    '$class': 'concerto.metamodel.TypeIdentifier',
                                    'name': 'Address'
                                },
                                'isArray': true,
                                'isOptional': false,
                                'location': {
                                    '$class': 'concerto.metamodel.Range',
                                    'start': {
                                        'offset': 667,
                                        'line': 21,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    },
                                    'end': {
                                        'offset': 704,
                                        'line': 22,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    }
                                }
                            },
                            {
                                '$class': 'concerto.metamodel.RelationshipProperty',
                                'name': 'address5',
                                'type': {
                                    '$class': 'concerto.metamodel.TypeIdentifier',
                                    'name': 'Address'
                                },
                                'isArray': false,
                                'isOptional': true,
                                'location': {
                                    '$class': 'concerto.metamodel.Range',
                                    'start': {
                                        'offset': 704,
                                        'line': 22,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    },
                                    'end': {
                                        'offset': 748,
                                        'line': 23,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    }
                                }
                            },
                            {
                                '$class': 'concerto.metamodel.ObjectProperty',
                                'name': 'gender',
                                'type': {
                                    '$class': 'concerto.metamodel.TypeIdentifier',
                                    'name': 'Gender'
                                },
                                'isArray': false,
                                'isOptional': false,
                                'location': {
                                    '$class': 'concerto.metamodel.Range',
                                    'start': {
                                        'offset': 748,
                                        'line': 23,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    },
                                    'end': {
                                        'offset': 778,
                                        'line': 24,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    }
                                }
                            },
                            {
                                '$class': 'concerto.metamodel.DateTimeProperty',
                                'name': 'dob',
                                'isArray': false,
                                'isOptional': true,
                                'location': {
                                    '$class': 'concerto.metamodel.Range',
                                    'start': {
                                        'offset': 778,
                                        'line': 24,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    },
                                    'end': {
                                        'offset': 814,
                                        'line': 25,
                                        'column': 13,
                                        '$class': 'concerto.metamodel.Position'
                                    }
                                }
                            }
                        ],
                        'location': {
                            '$class': 'concerto.metamodel.Range',
                            'start': {
                                'offset': 409,
                                'line': 15,
                                'column': 13,
                                '$class': 'concerto.metamodel.Position'
                            },
                            'end': {
                                'offset': 815,
                                'line': 25,
                                'column': 14,
                                '$class': 'concerto.metamodel.Position'
                            }
                        },
                        'superType': {
                            '$class': 'concerto.metamodel.TypeIdentifier',
                            'name': 'Individual'
                        }
                    },
                    {
                        '$class': 'concerto.metamodel.ParticipantDeclaration',
                        'name': 'Employee',
                        'isAbstract': false,
                        'properties': [
                            {
                                '$class': 'concerto.metamodel.StringProperty',
                                'name': 'company',
                                'isArray': false,
                                'isOptional': false,
                                'location': {
                                    '$class': 'concerto.metamodel.Range',
                                    'start': {
                                        'offset': 881,
                                        'line': 28,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    },
                                    'end': {
                                        'offset': 912,
                                        'line': 29,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    }
                                }
                            },
                            {
                                '$class': 'concerto.metamodel.BooleanProperty',
                                'name': 'onLeave',
                                'isArray': false,
                                'isOptional': false,
                                'location': {
                                    '$class': 'concerto.metamodel.Range',
                                    'start': {
                                        'offset': 912,
                                        'line': 29,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    },
                                    'end': {
                                        'offset': 942,
                                        'line': 30,
                                        'column': 13,
                                        '$class': 'concerto.metamodel.Position'
                                    }
                                }
                            }
                        ],
                        'location': {
                            '$class': 'concerto.metamodel.Range',
                            'start': {
                                'offset': 829,
                                'line': 27,
                                'column': 13,
                                '$class': 'concerto.metamodel.Position'
                            },
                            'end': {
                                'offset': 943,
                                'line': 30,
                                'column': 14,
                                '$class': 'concerto.metamodel.Position'
                            }
                        },
                        'superType': {
                            '$class': 'concerto.metamodel.TypeIdentifier',
                            'name': 'Person'
                        }
                    },
                    {
                        '$class': 'concerto.metamodel.ConceptDeclaration',
                        'name': 'Address',
                        'isAbstract': false,
                        'properties': [
                            {
                                '$class': 'concerto.metamodel.IntegerProperty',
                                'name': 'zip',
                                'isArray': false,
                                'isOptional': false,
                                'location': {
                                    '$class': 'concerto.metamodel.Range',
                                    'start': {
                                        'offset': 1000,
                                        'line': 33,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    },
                                    'end': {
                                        'offset': 1042,
                                        'line': 34,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    }
                                },
                                'defaultValue': 10001
                            },
                            {
                                '$class': 'concerto.metamodel.LongProperty',
                                'name': 'zip2',
                                'isArray': false,
                                'isOptional': false,
                                'location': {
                                    '$class': 'concerto.metamodel.Range',
                                    'start': {
                                        'offset': 1042,
                                        'line': 34,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    },
                                    'end': {
                                        'offset': 1082,
                                        'line': 35,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    }
                                },
                                'defaultValue': 10001
                            },
                            {
                                '$class': 'concerto.metamodel.DoubleProperty',
                                'name': 'zip3',
                                'isArray': false,
                                'isOptional': false,
                                'location': {
                                    '$class': 'concerto.metamodel.Range',
                                    'start': {
                                        'offset': 1082,
                                        'line': 35,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    },
                                    'end': {
                                        'offset': 1126,
                                        'line': 36,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    }
                                },
                                'defaultValue': 10001
                            },
                            {
                                '$class': 'concerto.metamodel.StringProperty',
                                'name': 'city',
                                'isArray': false,
                                'isOptional': false,
                                'location': {
                                    '$class': 'concerto.metamodel.Range',
                                    'start': {
                                        'offset': 1126,
                                        'line': 36,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    },
                                    'end': {
                                        'offset': 1168,
                                        'line': 37,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    }
                                },
                                'defaultValue': 'NYC'
                            },
                            {
                                '$class': 'concerto.metamodel.StringProperty',
                                'name': 'country',
                                'isArray': false,
                                'isOptional': false,
                                'location': {
                                    '$class': 'concerto.metamodel.Range',
                                    'start': {
                                        'offset': 1168,
                                        'line': 37,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    },
                                    'end': {
                                        'offset': 1213,
                                        'line': 38,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    }
                                },
                                'defaultValue': 'USA'
                            },
                            {
                                '$class': 'concerto.metamodel.StringProperty',
                                'name': 'street',
                                'isArray': true,
                                'isOptional': false,
                                'location': {
                                    '$class': 'concerto.metamodel.Range',
                                    'start': {
                                        'offset': 1213,
                                        'line': 38,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    },
                                    'end': {
                                        'offset': 1245,
                                        'line': 39,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    }
                                }
                            },
                            {
                                '$class': 'concerto.metamodel.BooleanProperty',
                                'name': 'isResidential',
                                'isArray': false,
                                'isOptional': false,
                                'location': {
                                    '$class': 'concerto.metamodel.Range',
                                    'start': {
                                        'offset': 1245,
                                        'line': 39,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    },
                                    'end': {
                                        'offset': 1296,
                                        'line': 40,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    }
                                },
                                'defaultValue': true
                            },
                            {
                                '$class': 'concerto.metamodel.BooleanProperty',
                                'name': 'isPrivate',
                                'isArray': false,
                                'isOptional': false,
                                'location': {
                                    '$class': 'concerto.metamodel.Range',
                                    'start': {
                                        'offset': 1296,
                                        'line': 40,
                                        'column': 15,
                                        '$class': 'concerto.metamodel.Position'
                                    },
                                    'end': {
                                        'offset': 1342,
                                        'line': 41,
                                        'column': 13,
                                        '$class': 'concerto.metamodel.Position'
                                    }
                                },
                                'defaultValue': false
                            }
                        ],
                        'location': {
                            '$class': 'concerto.metamodel.Range',
                            'start': {
                                'offset': 957,
                                'line': 32,
                                'column': 13,
                                '$class': 'concerto.metamodel.Position'
                            },
                            'end': {
                                'offset': 1343,
                                'line': 41,
                                'column': 14,
                                '$class': 'concerto.metamodel.Position'
                            }
                        },
                        'identified': {
                            '$class': 'concerto.metamodel.Identified'
                        }
                    }
                ]
            }, null, 2)]);
            param.fileWriter.closeFile.calledOnce.should.be.ok;
        });
    });
});

