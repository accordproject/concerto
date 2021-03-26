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

const ModelLoader = require('../..').ModelLoader;
const Factory = require('../..').Factory;
const Serializer = require('../..').Serializer;

const loadJson = (file) => JSON.parse(fs.readFileSync(path.join(__dirname,file), 'utf8'));
const validate = async (sample, ctoFiles, options) => {
    const json = loadJson(sample);

    const modelManager = await ModelLoader.loadModelManager(ctoFiles.map((file) => path.join(__dirname,file)), options);
    const factory = new Factory(modelManager);
    const serializer = new Serializer(factory, modelManager);

    const object = serializer.fromJSON(json);
    return serializer.toJSON(object);
};

const positive = [{
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
    name: 'root hierarchy',
    sample: './data/identifier1.json',
    ctoFiles: ['./models/identifier1.cto'],
    expected: './data/identifier1.expect'
}, {
    name: 'root hierarchy',
    sample: './data/identifier1a.json',
    ctoFiles: ['./models/identifier1.cto'],
    expected: './data/identifier1a.expect'
}, {
    name: 'root hierarchy',
    sample: './data/identifier1b.json',
    ctoFiles: ['./models/identifier1.cto'],
    expected: './data/identifier1b.expect'
}];

const negative = [{
    name: 'root hierarchy',
    sample: './data/hierarchy2err.json',
    ctoFiles: ['./models/hierarchy2.cto'],
    expected: 'Unexpected properties for type org.test.C: c, t'
}];

describe('Validation (1.0.0)', () => {
    let sandbox;

    beforeEach(function() {
        sandbox = sinon.createSandbox();
        sandbox.stub(uuid, 'v4').returns(mockId);
    });

    afterEach(() => {
        sandbox.restore();
    });

    describe('#positive', () => {
        positive
            .forEach(({ name, sample, ctoFiles, expected }) => {
                it(`should be valid (${name})`, async function() {
                    const resultActual = await validate(sample, ctoFiles);
                    const resultExpected = loadJson(expected);
                    resultActual.should.deep.equal(resultExpected);
                });
            });
    });

    describe('#negative', () => {
        negative
            .forEach(({ name, sample, ctoFiles, expected }) => {
                it(`should be valid (${name})`, async function() {
                    try {
                        await validate(sample, ctoFiles);
                    } catch (errorActual) {
                        errorActual.name.should.equal('ValidationException');
                        errorActual.message.should.deep.equal(expected);
                    }
                });
            });
    });
});
