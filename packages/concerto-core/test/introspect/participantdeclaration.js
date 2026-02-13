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

const ModelManager = require('../../src/modelmanager');
const Util = require('../composer/composermodelutility');

require('chai').should();

describe('ParticipantDeclaration', () => {

    let modelManager;

    beforeEach(() => {
        modelManager = new ModelManager();
        Util.addComposerModel(modelManager);
    });

    describe('#getParticipantDeclarations', () => {
        it('should get participants', () => {
            let participants = modelManager.getParticipantDeclarations();
            participants.should.have.lengthOf(2);
            participants[0].declarationKind().should.equal('ParticipantDeclaration');
        });
    });
});
