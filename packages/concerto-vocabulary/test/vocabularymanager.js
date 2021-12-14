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
const chai = require('chai');

// eslint-disable-next-line no-unused-vars
const should = chai.should();
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));

const { VocabularyManager } = require('..');
const ModelManager = require('../../concerto-core/lib/modelmanager');

let modelManager = null;
let vocabularyManager = null;

describe('VocabularyManager', () => {
    beforeEach(() => {
        modelManager = new ModelManager();
        const model = fs.readFileSync('./test/org.acme.vehicle.cto', 'utf-8');
        modelManager.addModelFile(model);
        vocabularyManager = new VocabularyManager();
        vocabularyManager.should.not.be.null;
        const enVocString = fs.readFileSync('./test/org.acme.vehicle_en.voc', 'utf-8');
        vocabularyManager.addVocabulary(enVocString);
        const frVocString = fs.readFileSync('./test/org.acme.vehicle_fr.voc', 'utf-8');
        vocabularyManager.addVocabulary(frVocString);
    });

    afterEach(() => {
        modelManager = null;
        vocabularyManager = null;
    });

    it('getVocabulary', () => {
        const voc = vocabularyManager.getVocabulary('org.acme', 'en');
        voc.should.not.be.null;
    });

    it('getVocabulary - undefined', () => {
        const voc = vocabularyManager.getVocabulary('foo', 'en');
        (voc === undefined).should.be.true;
    });

    it('getVocabulary - missing locale', () => {
        const voc = vocabularyManager.getVocabulary('org.acme', 'foo');
        (voc === undefined).should.be.true;
    });

    it('getVocabulariesForNamespace', () => {
        const voc = vocabularyManager.getVocabulariesForNamespace('org.acme');
        voc.length.should.equal(2);
    });

    it('getVocabulariesForLocale', () => {
        const voc = vocabularyManager.getVocabulariesForLocale('en');
        voc.length.should.equal(1);
        const vocFr = vocabularyManager.getVocabulariesForLocale('fr');
        vocFr.length.should.equal(1);
        const missing = vocabularyManager.getVocabulariesForLocale('foo');
        missing.length.should.equal(0);
    });

    it('getTerm - en', () => {
        const voc = vocabularyManager.getVocabulary('org.acme', 'en');
        voc.should.not.be.null;
        const term = voc.getTerm('Vehicle');
        term.should.equal('A road vehicle');
        const term2 = voc.getTerm('Vehicle', 'vin');
        term2.should.equal('Vehicle Identification Number');
    });

    it('getTerm - fr', () => {
        const voc = vocabularyManager.getVocabulary('org.acme', 'fr');
        voc.should.not.be.null;
        const term = voc.getTerm('Vehicle');
        term.should.equal('Véhicule');
        const term2 = voc.getTerm('Vehicle', 'vin');
        term2.should.equal('Le numéro d\'identification du véhicule (NIV).');
    });

    it('validate', () => {
        const result = vocabularyManager.validate(modelManager);
        result.missingVocabularies.length.should.equal(0);
        result.additionalNamespaces.length.should.equal(0);
    });

});
