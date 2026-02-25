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

const AstModelManager = require('../src/astmodelmanager');

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
    });

});
