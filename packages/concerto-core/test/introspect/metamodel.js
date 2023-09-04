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
const {
    validateMetaModel,
    modelManagerFromMetaModel
} = require('../../lib/introspect/metamodel');
const ParserUtil = require('./parserutility');

const { Parser, Printer } = require('@accordproject/concerto-cto');

const fs = require('fs');
const path = require('path');

const chai = require('chai');
chai.should();
chai.use(require('chai-things'));

describe('MetaModel (Person)', () => {
    const personModelPath = path.resolve(__dirname, '../data/model/person.cto');
    const timeModelPath = path.resolve(__dirname, '../data/model/@models.accordproject.org.time@0.3.0.cto');
    const personModel = fs.readFileSync(personModelPath, 'utf8');
    const personMetaModel = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/model/person.json'), 'utf8'));
    const personMetaModelResolved = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/model/personResolved.json'), 'utf8'));

    describe('#toMetaModel', () => {
        it('should convert a CTO model to its metamodel', () => {
            const mm1 = Parser.parse(personModel);
            mm1.should.deep.equal(personMetaModel);
        });

        it('should convert and validate a CTO model to its metamodel with name resolution', async () => {
            const modelManager = await ModelLoader.loadModelManager([personModelPath,timeModelPath], { offline: true });
            const mm1 = Parser.parse(personModel);
            validateMetaModel(mm1);
            const mm1r = modelManager.resolveMetaModel(mm1);
            mm1r.should.deep.equal(personMetaModelResolved);
        });

        it('should convert a ModelFile to its metamodel', async () => {
            const modelManager1 = await ModelLoader.loadModelManager([timeModelPath]);
            const mf1 = ParserUtil.newModelFile(modelManager1, personModel);
            const mm1 = mf1.getAst();
            mm1.should.deep.equal(personMetaModel);
            const model2 = Printer.toCTO(mm1);
            const modelManager2 = await ModelLoader.loadModelManager([timeModelPath]);
            const mf2 = ParserUtil.newModelFile(modelManager2, model2);
            const mm2 = mf2.getAst();
            mm2.should.deep.equal(personMetaModel);
        });

        it('should convert and validate a ModelFile to its metamodel', async () => {
            const modelManager1 = await ModelLoader.loadModelManager([timeModelPath]);
            const mf1 = ParserUtil.newModelFile(modelManager1, personModel);
            const mm1 = mf1.getAst();
            mm1.should.deep.equal(personMetaModel);
            const model2 = Printer.toCTO(mm1);
            const modelManager2 = await ModelLoader.loadModelManager([timeModelPath]);
            const mf2 = ParserUtil.newModelFile(modelManager2, model2);
            const mm2 = mf2.getAst();
            mm2.should.deep.equal(personMetaModel);
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
            const mm1 = Parser.parse(emptyModel);
            validateMetaModel(mm1);
            mm1.should.deep.equal(emptyMetaModel);
        });

        it('should convert and validate a CTO model to its metamodel', () => {
            const mm1 = Parser.parse(emptyModel);
            validateMetaModel(mm1);
            mm1.should.deep.equal(emptyMetaModel);
        });

        it('should convert and validate a CTO model to its metamodel with name resolution', async () => {
            const modelManager = await ModelLoader.loadModelManager([emptyModelPath]);
            const mm1 = Parser.parse(emptyModel);
            validateMetaModel(mm1);
            const mm1r = modelManager.resolveMetaModel(mm1);
            mm1r.should.deep.equal(emptyMetaModelResolved);
        });

        it('should convert a ModelFile to its metamodel', () => {
            const modelManager1 = new ModelManager();
            const mf1 = ParserUtil.newModelFile(modelManager1, emptyModel);
            const mm1 = mf1.getAst();
            mm1.should.deep.equal(emptyMetaModel);
            const model2 = Printer.toCTO(mm1);
            const modelManager2 = new ModelManager();
            const mf2 = ParserUtil.newModelFile(modelManager2, model2);
            const mm2 = mf2.getAst();
            mm2.should.deep.equal(emptyMetaModel);
        });

        it('should convert and validate a ModelFile to its metamodel', () => {
            const modelManager1 = new ModelManager();
            const mf1 = ParserUtil.newModelFile(modelManager1, emptyModel);
            const mm1 = mf1.getAst();
            mm1.should.deep.equal(emptyMetaModel);
            const model2 = Printer.toCTO(mm1);
            const modelManager2 = new ModelManager();
            const mf2 = ParserUtil.newModelFile(modelManager2, model2);
            const mm2 = mf2.getAst();
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
            const mm1 = modelManager.getAst();
            mm1.should.deep.equal(carMetaModel);
        });

        it('should convert and validate a CTO model to its metamodel', async () => {
            const modelManager = await ModelLoader.loadModelManager([vehicleModelPath, carModelPath]);
            const mm1 = modelManager.getAst();
            mm1.should.deep.equal(carMetaModel);
        });

        it('should convert and validate a CTO model to its metamodel with name resolution', async () => {
            const modelManager = await ModelLoader.loadModelManager([vehicleModelPath, carModelPath]);
            const mm1 = modelManager.getAst(true);
            mm1.should.deep.equal(carMetaModelResolved);
        });

        it('should roundtrip a model manager with its metamodel', async () => {
            const modelManager = await ModelLoader.loadModelManager([vehicleModelPath, carModelPath]);
            const mm1 = modelManager.getAst();
            mm1.should.deep.equal(carMetaModel);
            const modelManager2 = modelManagerFromMetaModel(mm1);
            const mm2 = modelManager2.getAst();
            mm2.should.deep.equal(carMetaModel);
        });

    });
});

describe('MetaModel (Version)', () => {
    const versionModelPath = path.resolve(__dirname, '../data/model/versionMeta.cto');
    const versionModel = fs.readFileSync(versionModelPath, 'utf8');
    const versionMetaModel = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../data/model/versionMeta.json'), 'utf8'));

    describe('#toMetaModel', () => {
        it('should convert a CTO model to its metamodel', () => {
            const mm1 = Parser.parse(versionModel);
            validateMetaModel(mm1);
            mm1.should.deep.equal(versionMetaModel);
        });

        it('should convert and validate a CTO model to its metamodel', () => {
            const mm1 = Parser.parse(versionModel);
            validateMetaModel(mm1);
            mm1.should.deep.equal(versionMetaModel);
        });

        it('should convert and validate a ModelFile to its metamodel', () => {
            const modelManager1 = new ModelManager();
            const mf1 = ParserUtil.newModelFile(modelManager1, versionModel);
            const mm1 = mf1.getAst();
            mm1.should.deep.equal(versionMetaModel);
            const model2 = Printer.toCTO(mm1);
            const modelManager2 = new ModelManager();
            const mf2 = ParserUtil.newModelFile(modelManager2, model2);
            const mm2 = mf2.getAst();
            mm2.should.deep.equal(versionMetaModel);
        });
    });
});
