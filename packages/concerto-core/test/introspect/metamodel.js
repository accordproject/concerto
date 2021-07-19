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

const ModelManager = require('../../lib/modelmanager');
const ModelFile = require('../../lib/introspect/modelfile');
const MetaModel = require('../../lib/introspect/metamodel');
const fs = require('fs');
const path = require('path');

const chai = require('chai');
chai.should();
chai.use(require('chai-things'));

describe('MetaModel', () => {
    const personModel = fs.readFileSync(path.resolve(__dirname, '../data/model/person.cto'), 'utf8');
    const personMetaModel = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/model/person.json'), 'utf8'));

    describe('#toMetaModel', () => {
        it('should convert a CTO model to its metamodel', () => {
            const mm1 = MetaModel.ctoToMetaModel(personModel);
            mm1.should.deep.equal(personMetaModel);
        });

        it('should convert a ModelFile to its metamodel', () => {
            const modelManager1 = new ModelManager();
            const mf1 = new ModelFile(modelManager1, personModel);
            const mm1 = MetaModel.modelFileToMetaModel(mf1);
            mm1.should.deep.equal(personMetaModel);
            const model2 = MetaModel.ctoFromMetaModel(mm1);
            const modelManager2 = new ModelManager();
            const mf2 = new ModelFile(modelManager2, model2);
            const mm2 = MetaModel.modelFileToMetaModel(mf2);
            mm2.should.deep.equal(personMetaModel);
        });
    });
});
