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

const { AstModelManager } = require('../src/astmodelmanager');
const { IllegalModelException } = require('../src/introspect/illegalmodelexception');
const { TypeNotFoundException } = require('../src/typenotfoundexception');

const chai = require('chai');
chai.should();
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));
const sinon = require('sinon');

describe('AstModelManager', () => {
    let sandbox;
    let modelManager;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        modelManager = new AstModelManager();
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#isModelManager', () => {
        it('should return true', () => {
            modelManager.isModelManager().should.be.true;
        });
    });

    describe('#addModelFile and #astProcessFile', () => {
        it('should add a model file and process it with AstProcessFile', () => {
            const modelContent = {
                '$class': 'concerto.metamodel@1.0.0.Model',
                'decorators': [],
                'namespace': 'org.example.test@1.0.0',
                'imports': [],
                'declarations': [
                    {
                        '$class': 'concerto.metamodel@1.0.0.ConceptDeclaration',
                        'name': 'TestConcept',
                        'isAbstract': false,
                        'properties': [
                            {
                                '$class': 'concerto.metamodel@1.0.0.StringProperty',
                                'name': 'name',
                                'isArray': false,
                                'isOptional': false
                            },
                            {
                                '$class': 'concerto.metamodel@1.0.0.IntegerProperty',
                                'name': 'value',
                                'isArray': false,
                                'isOptional': false
                            }
                        ],
                        'decorators': []
                    }
                ]
            };

            modelManager.addModel(modelContent, null, 'test.cto');

            modelManager.getModelFile('org.example.test@1.0.0').should.not.be.undefined;
        });

        it('should throw IllegalModelException for a null decorator', () => {
            const modelContent = {
                '$class': 'concerto.metamodel@1.0.0.Model',
                'namespace': 'org.acme@1.0.0',
                'imports': [],
                'declarations': [
                    {
                        '$class': 'concerto.metamodel@1.0.0.ConceptDeclaration',
                        'name': 'A',
                        'isAbstract': false,
                        'properties': [
                            {
                                '$class': 'concerto.metamodel@1.0.0.StringProperty',
                                'name': 's',
                                'isArray': false,
                                'isOptional': false,
                                'decorators': [null]
                            }
                        ]
                    }
                ]
            };

            (() => {
                modelManager.addModel(modelContent, null, 'a.cto');
            }).should.throw(
                IllegalModelException,
                /Decorator cannot be null or undefined/
            );
        });
    });

    describe('#addModelFiles', () => {
        it('should add multiple model files from AST objects', () => {
            const modelContent1 = {
                '$class': 'concerto.metamodel@1.0.0.Model',
                'namespace': 'org.example.test1@1.0.0',
                'imports': [],
                'declarations': [
                    {
                        '$class': 'concerto.metamodel@1.0.0.ConceptDeclaration',
                        'name': 'Concept1',
                        'isAbstract': false,
                        'properties': [],
                        'decorators': []
                    }
                ]
            };
            const modelContent2 = {
                '$class': 'concerto.metamodel@1.0.0.Model',
                'namespace': 'org.example.test2@1.0.0',
                'imports': [],
                'declarations': [
                    {
                        '$class': 'concerto.metamodel@1.0.0.ConceptDeclaration',
                        'name': 'Concept2',
                        'isAbstract': false,
                        'properties': [],
                        'decorators': []
                    }
                ]
            };

            const added = modelManager.addModelFiles([modelContent1, modelContent2]);
            added.should.have.lengthOf(2);
            modelManager.getModelFile('org.example.test1@1.0.0').should.not.be.undefined;
            modelManager.getModelFile('org.example.test2@1.0.0').should.not.be.undefined;
            modelManager.getType('org.example.test1@1.0.0.Concept1').getName().should.equal('Concept1');
            modelManager.getType('org.example.test2@1.0.0.Concept2').getName().should.equal('Concept2');
        });

        it('should rollback added models if a later AST is invalid', () => {
            const validModel = {
                '$class': 'concerto.metamodel@1.0.0.Model',
                'namespace': 'org.example.valid@1.0.0',
                'imports': [],
                'declarations': [
                    {
                        '$class': 'concerto.metamodel@1.0.0.ConceptDeclaration',
                        'name': 'ValidConcept',
                        'isAbstract': false,
                        'properties': [],
                        'decorators': []
                    }
                ]
            };
            const invalidModel = {
                '$class': 'concerto.metamodel@1.0.0.Model',
                'namespace': 'org.example.invalid@1.0.0',
                'imports': [],
                'declarations': [
                    {
                        '$class': 'concerto.metamodel@1.0.0.ConceptDeclaration',
                        'name': 'InvalidConcept',
                        'isAbstract': false,
                        'properties': [
                            {
                                '$class': 'concerto.metamodel@1.0.0.RelationshipProperty',
                                'name': 'target',
                                'type': {
                                    '$class': 'concerto.metamodel@1.0.0.TypeIdentifier',
                                    'name': 'NonExistentType'
                                },
                                'isArray': false,
                                'isOptional': false,
                                'decorators': []
                            }
                        ],
                        'decorators': []
                    }
                ]
            };

            (() => {
                modelManager.addModelFiles([validModel, invalidModel]);
            }).should.throw(IllegalModelException, /NonExistentType/);

            chai.expect(modelManager.getModelFile('org.example.valid@1.0.0')).to.be.undefined;
            chai.expect(modelManager.getModelFile('org.example.invalid@1.0.0')).to.be.undefined;
        });
    });

    describe('#updateModelFile', () => {
        it('should update a model file from an AST object', () => {
            const initialContent = {
                '$class': 'concerto.metamodel@1.0.0.Model',
                'namespace': 'org.example.update@1.0.0',
                'imports': [],
                'declarations': [
                    {
                        '$class': 'concerto.metamodel@1.0.0.ConceptDeclaration',
                        'name': 'InitialConcept',
                        'isAbstract': false,
                        'properties': [],
                        'decorators': []
                    }
                ]
            };

            modelManager.addModel(initialContent);
            modelManager.getType('org.example.update@1.0.0.InitialConcept').getName().should.equal('InitialConcept');

            const updatedContent = {
                '$class': 'concerto.metamodel@1.0.0.Model',
                'namespace': 'org.example.update@1.0.0',
                'imports': [],
                'declarations': [
                    {
                        '$class': 'concerto.metamodel@1.0.0.ConceptDeclaration',
                        'name': 'UpdatedConcept',
                        'isAbstract': false,
                        'properties': [],
                        'decorators': []
                    }
                ]
            };

            modelManager.updateModelFile(updatedContent);
            modelManager.getType('org.example.update@1.0.0.UpdatedConcept').getName().should.equal('UpdatedConcept');
            (() => {
                modelManager.getType('org.example.update@1.0.0.InitialConcept');
            }).should.throw(TypeNotFoundException, /InitialConcept/);
        });
    });

    describe('#validateModelFile', () => {
        it('should validate an AST object model', () => {
            const modelContent = {
                '$class': 'concerto.metamodel@1.0.0.Model',
                'namespace': 'org.example.validate@1.0.0',
                'imports': [],
                'declarations': [
                    {
                        '$class': 'concerto.metamodel@1.0.0.ConceptDeclaration',
                        'name': 'ValidConcept',
                        'isAbstract': false,
                        'properties': [],
                        'decorators': []
                    }
                ]
            };

            (() => {
                modelManager.validateModelFile(modelContent);
            }).should.not.throw();
        });

        it('should throw IllegalModelException for an invalid AST object model', () => {
            const invalidContent = {
                '$class': 'concerto.metamodel@1.0.0.Model',
                'namespace': 'org.example.validate.invalid@1.0.0',
                'imports': [],
                'declarations': [
                    {
                        '$class': 'concerto.metamodel@1.0.0.ConceptDeclaration',
                        'name': 'InvalidConcept',
                        'isAbstract': false,
                        'properties': [
                            {
                                '$class': 'concerto.metamodel@1.0.0.RelationshipProperty',
                                'name': 'target',
                                'type': {
                                    '$class': 'concerto.metamodel@1.0.0.TypeIdentifier',
                                    'name': 'NonExistentType'
                                },
                                'isArray': false,
                                'isOptional': false,
                                'decorators': []
                            }
                        ],
                        'decorators': []
                    }
                ]
            };

            (() => {
                modelManager.validateModelFile(invalidContent);
            }).should.throw(IllegalModelException, /NonExistentType/);
        });
    });

});
