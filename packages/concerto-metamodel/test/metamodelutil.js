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

const MetaModelUtil = require('../lib/metamodelutil');

const fs = require('fs');
const path = require('path');

const chai = require('chai');
chai.should();
chai.use(require('chai-things'));

describe('MetaModel (Person)', () => {
    const personModelPath = path.resolve(__dirname, './cto/person.json');
    const personModel = JSON.parse(fs.readFileSync(personModelPath, 'utf8'));
    const personMetaModelResolved = JSON.parse(fs.readFileSync(path.resolve(__dirname, './cto/personResolved.json'), 'utf8'));

    describe('#toMetaModel', () => {
        it('should convert a CTO model to its metamodel with name resolution', async () => {
            const mm1r = MetaModelUtil.resolveLocalNames(personModel, personModel.models[1]);
            mm1r.should.deep.equal(personMetaModelResolved);
        });
    });
});

describe('MetaModel (Empty)', () => {
    const emptyModelPath = path.resolve(__dirname, './cto/empty.json');
    const emptyModel = JSON.parse(fs.readFileSync(emptyModelPath, 'utf8'));
    const emptyMetaModelResolved = JSON.parse(fs.readFileSync(path.resolve(__dirname, './cto/emptyResolved.json'), 'utf8'));

    describe('#toMetaModel', () => {
        it('should convert a CTO model to its metamodel with name resolution', async () => {
            const mm1r = MetaModelUtil.resolveLocalNames([], emptyModel);
            mm1r.should.deep.equal(emptyMetaModelResolved);
        });
    });
});

describe('MetaModel (Car)', () => {
    const carModelPath = path.resolve(__dirname, './cto/car.json');
    const carModel = JSON.parse(fs.readFileSync(carModelPath, 'utf8'));
    const carMetaModelResolved = JSON.parse(fs.readFileSync(path.resolve(__dirname, './cto/carResolved.json'), 'utf8'));

    describe('#toMetaModel', () => {
        it('should convert a CTO model to its metamodel with name resolution', async () => {
            const mm1r = MetaModelUtil.resolveLocalNamesForAll(carModel);
            mm1r.should.deep.equal(carMetaModelResolved);
        });
    });
});

describe('MetaModel (Car - wrong import)', () => {
    const carModelPath = path.resolve(__dirname, './cto/carWrongImport.json');
    const carModel = JSON.parse(fs.readFileSync(carModelPath, 'utf8'));

    describe('#toMetaModel', () => {
        it('should convert a CTO model to its metamodel with name resolution', async () => {
            return (() => MetaModelUtil.resolveLocalNamesForAll(carModel)).should.Throw('Declaration VehicleWrong in namespace org.vehicle not found');
        });
    });
});

describe('MetaModel (Car - wrong extends)', () => {
    const carModelPath = path.resolve(__dirname, './cto/carWrongExtends.json');
    const carModel = JSON.parse(fs.readFileSync(carModelPath, 'utf8'));

    describe('#toMetaModel', () => {
        it('should convert a CTO model to its metamodel with name resolution', async () => {
            return (() => MetaModelUtil.resolveLocalNamesForAll(carModel)).should.Throw('Name VehicleWrong not found');
        });
    });
});
