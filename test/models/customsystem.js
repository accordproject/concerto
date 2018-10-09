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

describe('Custom System Model', function() {
    describe('#getModelManagerCustomSystem', function() {
        it('check parsing and model manager', function() {
            let modelManager = new ModelManager();
            modelManager.should.not.be.null;

            const table = new Map();
            table.set('MyTransaction', 'Transaction');
            table.set('MyAsset', 'Asset');
            table.set('MyEvent', 'Event');
            table.set('MyParticipant', 'Participant');

            // parse a model file from disk and add to the ModelManager
            let fileName = './test/data/model/customsystem-base.cto';
            let systemModel = fs.readFileSync(fileName, 'utf8');
            systemModel.should.not.be.null;
            modelManager.addModelFile(systemModel,fileName, false, table);

            fileName = './test/data/model/customsystem-extends.cto';
            let file = fs.readFileSync(fileName, 'utf8');
            file.should.not.be.null;
            modelManager.addModelFile(file,fileName);
            modelManager.getModelFiles().filter((modelFile) => {
                return !modelFile.isSystemModelFile();
            }).length.should.equal(1);

            let systemModelFile = modelManager.getModelFile('org.hyperledger.composer.customsystem');
            systemModelFile.getNamespace().should.equal('org.hyperledger.composer.customsystem');
            systemModelFile.getAssetDeclarations().length.should.equal(1);
            systemModelFile.getTransactionDeclarations().length.should.equal(1);
            systemModelFile.getEventDeclarations().length.should.equal(1);
            systemModelFile.getParticipantDeclarations().length.should.equal(1);

            let myAsset = systemModelFile.getAssetDeclaration('MyAsset');
            (myAsset.getSuperType()=== null).should.be.true;
            myAsset.isSystemType().should.be.true;
            myAsset.isSystemCoreType().should.be.true;
            myAsset.getSystemType().should.equal('MyAsset');

            let modelFile = modelManager.getModelFile('org.acme');
            modelFile.getNamespace().should.equal('org.acme');
            modelFile.getAssetDeclarations().length.should.equal(1);
            modelFile.getTransactionDeclarations().length.should.equal(1);
            modelFile.getEventDeclarations().length.should.equal(1);
            modelFile.getParticipantDeclarations().length.should.equal(1);

            // test the YourAsset Asset class
            let yourAsset = modelFile.getAssetDeclaration('YourAsset');
            yourAsset.should.not.be.null;
            yourAsset.getIdentifierFieldName().should.equal('myAssetId');
            yourAsset.getProperties().length.should.equal(1);
            yourAsset.getSystemType().should.equal('MyAsset');

            // validator, default
            let identifierField = yourAsset.getProperty('myAssetId');
            (identifierField.getType() === 'String').should.be.true;
            identifierField.getName().should.equal('myAssetId');
            (identifierField.getDefaultValue() === null).should.be.true;
            identifierField.isOptional().should.be.false;

        });
    });
});
