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

const fs = require('fs');
const path = require('path');
const chai = require('chai');

// eslint-disable-next-line no-unused-vars
const should = chai.should();
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));

const uuid = require('uuid');
const sinon = require('sinon');
const mockId = '00000000-0000-0000-0000-000000000000';
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);
const mockTimestamp = dayjs(0);

const ModelLoader = require('../..').ModelLoader;
const Factory = require('../..').Factory;
const Serializer = require('../..').Serializer;
const Concerto = require('../..').Concerto;

const loadJson = (file) => JSON.parse(fs.readFileSync(path.join(__dirname,file), 'utf8'));
const validateClassic = async (sample, ctoFiles, options) => {
    const json = loadJson(sample);

    const modelManager = await ModelLoader.loadModelManager(ctoFiles.map((file) => path.join(__dirname,file)), options);
    const factory = new Factory(modelManager);
    const serializer = new Serializer(factory, modelManager);

    const object = serializer.fromJSON(json);
    return serializer.toJSON(object);
};
const validateFunctional = async (sample, ctoFiles, options) => {
    const json = loadJson(sample);

    const modelManager = await ModelLoader.loadModelManager(ctoFiles.map((file) => path.join(__dirname,file)), options);
    const concerto = new Concerto(modelManager);

    return concerto.validate(json);
};
const validateToErgo = async (sample, ctoFiles, options) => {
    const json = loadJson(sample);

    const modelManager = await ModelLoader.loadModelManager(ctoFiles.map((file) => path.join(__dirname,file)), options);
    const factory = new Factory(modelManager);
    const serializer = new Serializer(factory, modelManager);

    const object = serializer.fromJSON(json);
    return serializer.toJSON(object, { ergo: true });
};
const validateFromErgo = async (sample, ctoFiles, options) => {
    const json = loadJson(sample);

    const modelManager = await ModelLoader.loadModelManager(ctoFiles.map((file) => path.join(__dirname,file)), options);
    const factory = new Factory(modelManager);
    const serializer = new Serializer(factory, modelManager);

    const object = serializer.fromJSON(json, { ergo: true });
    return serializer.toJSON(object);
};

const positive = [{
    name: 'date',
    sample: './data/date1.json',
    ctoFiles: ['./models/date1.cto'],
    expected: './data/date1.expect'
}, {
    name: 'root hierarchy',
    sample: './data/hierarchy1.json',
    ctoFiles: ['./models/hierarchy1.cto'],
    expected: './data/hierarchy1.expect'
}, {
    name: 'root hierarchy',
    sample: './data/hierarchy2.json',
    ctoFiles: ['./models/hierarchy2.cto'],
    expected: './data/hierarchy2.expect'
}, {
    name: 'generated identifier',
    sample: './data/identifier1.json',
    ctoFiles: ['./models/identifier1.cto'],
    expected: './data/identifier1.expect'
}, {
    name: 'user defined identifier through hierarchy',
    sample: './data/identifier1a.json',
    ctoFiles: ['./models/identifier1.cto'],
    expected: './data/identifier1a.expect'
}, {
    name: 'user defined identifier',
    sample: './data/identifier1b.json',
    ctoFiles: ['./models/identifier1.cto'],
    expected: './data/identifier1b.expect'
}, {
    name: 'timestamp (transaction)',
    sample: './data/timestamp1.json',
    ctoFiles: ['./models/timestamp1.cto'],
    expected: './data/timestamp1.expect'
}, {
    name: 'test1a',
    sample: './data/test1a.json',
    ctoFiles: ['./models/test1.cto'],
    expected: './data/test1a.expect',
    ergo: './data/test1a.ergo'
}, {
    name: 'test1b',
    sample: './data/test1b.json',
    ctoFiles: ['./models/test1.cto'],
    expected: './data/test1b.expect',
    ergo: './data/test1b.ergo'
}];

const negative = [{
    name: 'root hierarchy',
    sample: './data/hierarchy2err.json',
    ctoFiles: ['./models/hierarchy2.cto'],
    error: 'Unexpected properties for type org.test.C: c, t',
    errorFunctional: 'Instance undefined has a property named c which is not declared in org.test.C'
}, {
    name: 'user defined identifier',
    sample: './data/identifier1err.json',
    ctoFiles: ['./models/identifier1.cto'],
    error: 'Invalid or missing identifier for Type A1 in namespace org.test',
    errorFunctional: 'Instance org.test.A1#undefined has an empty identifier.',
}];

describe('Validation (1.0.0)', () => {
    let sandbox;

    beforeEach(function() {
        sandbox = sinon.createSandbox();
        sandbox.stub(uuid, 'v4').returns(mockId);
        sandbox.stub(dayjs, 'utc').returns(mockTimestamp);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#positive', () => {
        positive
            .forEach(({ name, sample, ctoFiles, expected, ergo }) => {
                it(`should validate - classic (${name})`, async function() {
                    const resultActual = await validateClassic(sample, ctoFiles);
                    const resultExpected = loadJson(expected);
                    resultActual.should.deep.equal(resultExpected);
                });

                it(`should validate - functional (${name})`, async function() {
                    const resultActual = await validateFunctional(sample, ctoFiles);
                    (typeof resultActual === 'undefined').should.equal(true);
                });

                if (ergo) {
                    it(`should validate - to ergo (${name})`, async function() {
                        const resultActual = await validateToErgo(sample, ctoFiles);
                        const resultExpected = loadJson(ergo);
                        resultActual.should.deep.equal(resultExpected);
                    });

                    it(`should validate - from ergo (${name})`, async function() {
                        const resultActual = await validateFromErgo(ergo, ctoFiles);
                        const resultExpected = loadJson(expected);
                        resultActual.should.deep.equal(resultExpected);
                    });
                }
            });
    });

    describe('#negative', () => {
        negative
            .forEach(({ name, sample, ctoFiles, error, errorFunctional }) => {
                it(`should not validate - classic (${name})`, async function() {
                    try {
                        await validateClassic(sample, ctoFiles);
                    } catch (errorActual) {
                        //errorActual.name.should.equal('ValidationException');
                        errorActual.message.should.deep.equal(error);
                    }
                });

                it(`should not validate - functional (${name})`, async function() {
                    try {
                        await validateFunctional(sample, ctoFiles);
                    } catch (errorActual) {
                        // errorActual.name.should.equal('ValidationException');
                        errorActual.message.should.deep.equal(errorFunctional);
                    }
                });
            });
    });
});
