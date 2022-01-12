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

const chai = require('chai');

// eslint-disable-next-line no-unused-vars
const should = chai.should();
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));

const { Vocabulary } = require('..');

describe('Vocabulary', () => {

    it('constructor - missing vocabulary manager', () => {
        should.Throw(() => new Vocabulary(), Error);
    });

    it('constructor - missing vocabulary object', () => {
        const vocabularyManager = {};
        should.Throw(() => new Vocabulary(vocabularyManager), Error);
    });

    it('constructor - missing vocabulary declarations', () => {
        const vocabularyManager = {};
        const voc = {};
        should.Throw(() => new Vocabulary(vocabularyManager, voc), Error);
    });

    it('constructor - missing vocabulary locale', () => {
        const vocabularyManager = {};
        const voc = {
            declarations: []
        };
        should.Throw(() => new Vocabulary(vocabularyManager, voc), Error);
    });

    it('constructor - missing vocabulary namespace', () => {
        const vocabularyManager = {};
        const voc = {
            declarations: [],
            locale: 'en'
        };
        should.Throw(() => new Vocabulary(vocabularyManager, voc), Error);
    });

    it('constructor - invalid locale', () => {
        const vocabularyManager = {};
        const voc = {
            declarations: [],
            locale: 'en_US',
            namespace: 'org.acme'
        };
        should.Throw(() => new Vocabulary(vocabularyManager, voc), Error);
    });

    it('constructor - invalid locale case', () => {
        const vocabularyManager = {};
        const voc = {
            declarations: [],
            locale: 'en-US',
            namespace: 'org.acme'
        };
        should.Throw(() => new Vocabulary(vocabularyManager, voc), Error);
    });

    it('constructor', () => {
        const vocabularyManager = {};
        const obj = {
            declarations: [],
            locale: 'en-us',
            namespace: 'org.acme'
        };
        const voc = new Vocabulary(vocabularyManager, obj);
        voc.should.not.be.null;
    });

    it('toJSON', () => {
        const vocabularyManager = {};
        const obj = {
            declarations: [],
            locale: 'en',
            namespace: 'org.acme'
        };
        const voc = new Vocabulary(vocabularyManager, obj);
        const json = voc.toJSON();
        json.should.not.be.null;
    });
});
