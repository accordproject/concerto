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

require('chai').should();
const ModelManager = require('../../lib/modelmanager');

const fs = require('fs');

describe('No System Models', function() {
    describe('#getModelManager', function() {
        it('check parsing and model manager', function() {
            let modelManager = new ModelManager();
            modelManager.should.not.be.null;

            // parse a model file from disk and add to the ModelManager
            let fileName = './test/data/model/carlease-nosystem.cto';
            let carLeaseModel = fs.readFileSync(fileName, 'utf8');
            carLeaseModel.should.not.be.null;
            modelManager.addModelFile(carLeaseModel,fileName);

            let carLeaseModelFile = modelManager.getModelFile('org.acme');
            carLeaseModelFile.getNamespace().should.equal('org.acme');
            carLeaseModelFile.getAssetDeclarations().length.should.equal(2);
            carLeaseModelFile.getTransactionDeclarations().length.should.equal(3);
            carLeaseModelFile.getEventDeclarations().length.should.equal(1);
            carLeaseModelFile.getParticipantDeclarations().length.should.equal(2);
        });
    });
});
