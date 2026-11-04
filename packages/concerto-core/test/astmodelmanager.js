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

        it('should throw IllegalModelException for a null declaration', () => {
            const modelContent = {
                '$class': 'concerto.metamodel@1.0.0.Model',
                'namespace': 'org.acme@1.0.0',
                'imports': [],
                'declarations': [null]
            };

            (() => {
                modelManager.addModel(modelContent, null, 'a.cto');
            }).should.throw(
                IllegalModelException,
                /Declaration cannot be null or undefined/
            );
        });

        it('should throw IllegalModelException for a null import', () => {
            const modelContent = {
                '$class': 'concerto.metamodel@1.0.0.Model',
                'namespace': 'org.acme@1.0.0',
                'imports': [null],
                'declarations': []
            };

            (() => {
                modelManager.addModel(modelContent, null, 'a.cto');
            }).should.throw(
                IllegalModelException,
                /Import cannot be null or undefined/
            );
        });

        it('should throw IllegalModelException for non-array imports', () => {
            const modelContent = {
                '$class': 'concerto.metamodel@1.0.0.Model',
                'namespace': 'org.acme@1.0.0',
                'imports': {},
                'declarations': []
            };

            (() => {
                modelManager.addModel(modelContent, null, 'a.cto');
            }).should.throw(
                IllegalModelException,
                /Model imports must be an array/
            );
        });

        it('should throw IllegalModelException for non-array declarations', () => {
            const modelContent = {
                '$class': 'concerto.metamodel@1.0.0.Model',
                'namespace': 'org.acme@1.0.0',
                'imports': [],
                'declarations': {}
            };

            (() => {
                modelManager.addModel(modelContent, null, 'a.cto');
            }).should.throw(
                IllegalModelException,
                /Model declarations must be an array/
            );
        });

        it('should throw IllegalModelException for a null property in a declaration', () => {
            const modelContent = {
                '$class': 'concerto.metamodel@1.0.0.Model',
                'namespace': 'org.acme@1.0.0',
                'imports': [],
                'declarations': [
                    {
                        '$class': 'concerto.metamodel@1.0.0.ConceptDeclaration',
                        'name': 'A',
                        'isAbstract': false,
                        'properties': [null]
                    }
                ]
            };

            (() => {
                modelManager.addModel(modelContent, null, 'a.cto');
            }).should.throw(
                IllegalModelException,
                /Property cannot be null or undefined, for class A/
            );
        });

        it('should throw IllegalModelException for an ObjectProperty with null type', () => {
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
                                '$class': 'concerto.metamodel@1.0.0.ObjectProperty',
                                'name': 'target',
                                'isArray': false,
                                'isOptional': false,
                                'type': null
                            }
                        ]
                    }
                ]
            };

            (() => {
                modelManager.addModel(modelContent, null, 'a.cto');
            }).should.throw(
                IllegalModelException,
                /ObjectProperty must contain property 'type', for property target/
            );
        });

        it('should throw IllegalModelException for a StringRegexValidator with null pattern', () => {
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
                                'name': 'str',
                                'isArray': false,
                                'isOptional': false,
                                'validator': {
                                    '$class': 'concerto.metamodel@1.0.0.StringRegexValidator',
                                    'pattern': null
                                }
                            }
                        ]
                    }
                ]
            };

            (() => {
                modelManager.addModel(modelContent, null, 'a.cto');
            }).should.throw(
                IllegalModelException,
                /Regex pattern must be specified/
            );
        });

        it('should throw IllegalModelException for an IntegerDomainValidator with undefined bounds', () => {
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
                                '$class': 'concerto.metamodel@1.0.0.IntegerProperty',
                                'name': 'num',
                                'isArray': false,
                                'isOptional': false,
                                'validator': {
                                    '$class': 'concerto.metamodel@1.0.0.IntegerDomainValidator',
                                    'lower': undefined,
                                    'upper': undefined
                                }
                            }
                        ]
                    }
                ]
            };

            (() => {
                modelManager.addModel(modelContent, null, 'a.cto');
            }).should.throw(
                IllegalModelException,
                /Invalid range, lower and-or upper bound must be specified/
            );
        });

        it('should throw IllegalModelException for a CollectionSizeValidator with undefined bounds', () => {
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
                                'name': 'tags',
                                'isArray': true,
                                'isOptional': false,
                                'sizeValidator': {
                                    '$class': 'concerto.metamodel@1.0.0.CollectionSizeValidator',
                                    'minSize': undefined,
                                    'maxSize': undefined
                                }
                            }
                        ]
                    }
                ]
            };

            (() => {
                modelManager.addModel(modelContent, null, 'a.cto');
            }).should.throw(
                IllegalModelException,
                /Invalid collection size, minSize and\/or maxSize must be specified/
            );
        });

        it('should throw IllegalModelException when sizeValidator is applied to a non-array property', () => {
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
                                'name': 'scalarField',
                                'isArray': false,
                                'isOptional': false,
                                'sizeValidator': {
                                    '$class': 'concerto.metamodel@1.0.0.CollectionSizeValidator',
                                    'minSize': 1,
                                    'maxSize': 5
                                }
                            }
                        ]
                    }
                ]
            };

            (() => {
                modelManager.addModel(modelContent, null, 'a.cto');
            }).should.throw(
                IllegalModelException,
                /size validator can only be applied to array or map properties/
            );
        });
    });

});
