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
    sample: './data/test0.json',
    ctoFiles: ['./models/test0.cto'],
    expected: './data/test0.expect'
}, {
    name: 'root hierarchy',
    sample: './data/test1.json',
    ctoFiles: ['./models/test1.cto'],
    expected: './data/test1.json'
}];

describe('1.0.0', () => {
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
});
