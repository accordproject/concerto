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
const ModelLoader = require('../../lib/modelloader');
const ModelFile = require('../../lib/introspect/modelfile');
const MetaModel = require('../../lib/introspect/metamodel');
const fs = require('fs');
const path = require('path');

const chai = require('chai');
chai.should();
chai.use(require('chai-things'));

describe('MetaModel (Person)', () => {
    const personModelPath = path.resolve(__dirname, '../data/model/person.cto');
    const personModel = fs.readFileSync(personModelPath, 'utf8');
    const personMetaModel = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/model/person.json'), 'utf8'));
    const personMetaModelResolved = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/model/personResolved.json'), 'utf8'));

    describe('#toMetaModel', () => {
        it('should convert a CTO model to its metamodel', () => {
            const mm1 = MetaModel.ctoToMetaModel(personModel, false);
            mm1.should.deep.equal(personMetaModel);
        });

        it('should convert and validate a CTO model to its metamodel', () => {
            const mm1 = MetaModel.ctoToMetaModel(personModel);
            mm1.should.deep.equal(personMetaModel);
        });

        it('should convert and validate a CTO model to its metamodel with name resolution', async () => {
            const modelManager = await ModelLoader.loadModelManager([personModelPath]);
            const mm1 = MetaModel.ctoToMetaModelAndResolve(modelManager, personModel);
            mm1.should.deep.equal(personMetaModelResolved);
        });

        it('should convert a ModelFile to its metamodel', () => {
            const modelManager1 = new ModelManager();
            const mf1 = new ModelFile(modelManager1, personModel);
            const mm1 = MetaModel.modelFileToMetaModel(mf1, false);
            mm1.should.deep.equal(personMetaModel);
            const model2 = MetaModel.ctoFromMetaModel(mm1, false);
            const modelManager2 = new ModelManager();
            const mf2 = new ModelFile(modelManager2, model2);
            const mm2 = MetaModel.modelFileToMetaModel(mf2, false);
            mm2.should.deep.equal(personMetaModel);
        });

        it('should convert and validate a ModelFile to its metamodel', () => {
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

    describe('#meta-metamodel', () => {
        it('should roundtrip the metamodel', () => {
            const metaModel = MetaModel.metaModelCto;
            const mm1 = MetaModel.ctoToMetaModel(metaModel, false);
            const metaModel2 = MetaModel.ctoFromMetaModel(mm1);
            const mm2 = MetaModel.ctoToMetaModel(metaModel2, false);
            mm2.should.deep.equal(mm1);
        });

    });
});

describe('MetaModel (Empty)', () => {
    const emptyModelPath = path.resolve(__dirname, '../data/model/empty.cto');
    const emptyModel = fs.readFileSync(emptyModelPath, 'utf8');
    const emptyMetaModel = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/model/empty.json'), 'utf8'));
    const emptyMetaModelResolved = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/model/emptyResolved.json'), 'utf8'));

    describe('#toMetaModel', () => {
        it('should convert a CTO model to its metamodel', () => {
            const mm1 = MetaModel.ctoToMetaModel(emptyModel, false);
            mm1.should.deep.equal(emptyMetaModel);
        });

        it('should convert and validate a CTO model to its metamodel', () => {
            const mm1 = MetaModel.ctoToMetaModel(emptyModel);
            mm1.should.deep.equal(emptyMetaModel);
        });

        it('should convert and validate a CTO model to its metamodel with name resolution', async () => {
            const modelManager = await ModelLoader.loadModelManager([emptyModelPath]);
            const mm1 = MetaModel.ctoToMetaModelAndResolve(modelManager, emptyModel);
            mm1.should.deep.equal(emptyMetaModelResolved);
        });

        it('should convert a ModelFile to its metamodel', () => {
            const modelManager1 = new ModelManager();
            const mf1 = new ModelFile(modelManager1, emptyModel);
            const mm1 = MetaModel.modelFileToMetaModel(mf1, false);
            mm1.should.deep.equal(emptyMetaModel);
            const model2 = MetaModel.ctoFromMetaModel(mm1, false);
            const modelManager2 = new ModelManager();
            const mf2 = new ModelFile(modelManager2, model2);
            const mm2 = MetaModel.modelFileToMetaModel(mf2, false);
            mm2.should.deep.equal(emptyMetaModel);
        });

        it('should convert and validate a ModelFile to its metamodel', () => {
            const modelManager1 = new ModelManager();
            const mf1 = new ModelFile(modelManager1, emptyModel);
            const mm1 = MetaModel.modelFileToMetaModel(mf1);
            mm1.should.deep.equal(emptyMetaModel);
            const model2 = MetaModel.ctoFromMetaModel(mm1);
            const modelManager2 = new ModelManager();
            const mf2 = new ModelFile(modelManager2, model2);
            const mm2 = MetaModel.modelFileToMetaModel(mf2);
            mm2.should.deep.equal(emptyMetaModel);
        });
    });
});

describe('MetaModel (Car)', () => {
    const vehicleModelPath = path.resolve(__dirname, '../data/model/vehicle.cto');
    const carModelPath = path.resolve(__dirname, '../data/model/car.cto');
    const carMetaModel = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/model/car.json'), 'utf8'));
    const carMetaModelResolved = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/model/carResolved.json'), 'utf8'));

    describe('#toMetaModel', () => {
        it('should convert a model manager to its metamodel', async () => {
            const modelManager = await ModelLoader.loadModelManager([vehicleModelPath, carModelPath]);
            const mm1 = MetaModel.modelManagerToMetaModel(modelManager, false, false);
            mm1.should.deep.equal(carMetaModel);
        });

        it('should convert and validate a CTO model to its metamodel', async () => {
            const modelManager = await ModelLoader.loadModelManager([vehicleModelPath, carModelPath]);
            const mm1 = MetaModel.modelManagerToMetaModel(modelManager, false, true);
            mm1.should.deep.equal(carMetaModel);
        });

        it('should convert and validate a CTO model to its metamodel with name resolution', async () => {
            const modelManager = await ModelLoader.loadModelManager([vehicleModelPath, carModelPath]);
            const mm1 = MetaModel.modelManagerToMetaModel(modelManager, true, true);
            mm1.should.deep.equal(carMetaModelResolved);
        });

        it('should roundtrip a model manager with its metamodel', async () => {
            const modelManager = await ModelLoader.loadModelManager([vehicleModelPath, carModelPath]);
            const mm1 = MetaModel.modelManagerToMetaModel(modelManager);
            mm1.should.deep.equal(carMetaModel);
            const modelManager2 = MetaModel.modelManagerFromMetaModel(mm1);
            const mm2 = MetaModel.modelManagerToMetaModel(modelManager2);
            mm2.should.deep.equal(carMetaModel);
        });

    });
});

describe('MetaMetaModel', () => {
    describe('#meta-metamodel', () => {
        it('should roundtrip the metamodel', () => {
            const metaModel = MetaModel.metaModelCto;
            const mm1 = MetaModel.ctoToMetaModel(metaModel, false);
            const metaModel2 = MetaModel.ctoFromMetaModel(mm1);
            const mm2 = MetaModel.ctoToMetaModel(metaModel2, false);
            mm2.should.deep.equal(mm1);
        });
    });
});
