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

const ClassDeclaration = require('../../lib/introspect/classdeclaration');
const ModelFile = require('../../lib/introspect/modelfile');
const ModelManager = require('../../lib/modelmanager');
const Util = require('../composer/composermodelutility');

require('chai').should();
const sinon = require('sinon');

describe('TransactionDeclaration', () => {
    let mockClassDeclaration;
    let sandbox;
    let modelManager;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
        modelManager = new ModelManager();
        Util.addComposerModel(modelManager);
        mockClassDeclaration = sinon.createStubInstance(ClassDeclaration);
        mockClassDeclaration.getProperties.returns([]);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#validate', () => {

        it('should cover the other error paths', () => {
            const model = `
            namespace org.acme
            transaction T {}
            `;

            const modelFile = new ModelFile(modelManager, model);
            let td = modelFile.getTransactionDeclaration('T');
            td.validate();

        });
    });
});
