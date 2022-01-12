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
        const model = fs.readFileSync('./test/org.acme.cto', 'utf-8');
        modelManager.addModelFile(model);
        const model2 = fs.readFileSync('./test/org.accordproject.cto', 'utf-8');
        modelManager.addModelFile(model2);
        vocabularyManager = new VocabularyManager();
        vocabularyManager.should.not.be.null;
        const enVocString = fs.readFileSync('./test/org.acme_en.voc', 'utf-8');
        vocabularyManager.addVocabulary(enVocString);
        const enGbVocString = fs.readFileSync('./test/org.acme_en-gb.voc', 'utf-8');
        vocabularyManager.addVocabulary(enGbVocString);
        const frVocString = fs.readFileSync('./test/org.acme_fr.voc', 'utf-8');
        vocabularyManager.addVocabulary(frVocString);
        const zhVocString = fs.readFileSync('./test/org.acme_zh-cn.voc', 'utf-8');
        vocabularyManager.addVocabulary(zhVocString);
        const enVoc2String = fs.readFileSync('./test/com.example_en.voc', 'utf-8');
        vocabularyManager.addVocabulary(enVoc2String);
    });

    afterEach(() => {
        modelManager = null;
        vocabularyManager = null;
    });

    it('addVocabulary (null)', () => {
        should.Throw(() => vocabularyManager.addVocabulary(), Error);
    });

    it('addVocabulary (duplicate)', () => {
        const enVocString = fs.readFileSync('./test/org.acme_en.voc', 'utf-8');
        should.Throw(() => vocabularyManager.addVocabulary(enVocString), Error);
    });

    it('getVocabulary', () => {
        const voc = vocabularyManager.getVocabulary('org.acme', 'en');
        voc.should.not.be.null;
    });

    it('getVocabulary - undefined', () => {
        const voc = vocabularyManager.getVocabulary('foo', 'en');
        (voc === null).should.be.true;
    });

    it('getVocabulary - missing locale', () => {
        const voc = vocabularyManager.getVocabulary('org.acme', 'foo');
        (voc === null).should.be.true;
    });

    it('getVocabulary - lookup', () => {
        const voc = vocabularyManager.getVocabulary('org.acme', 'en-us', { localeMatcher: 'lookup' });
        voc.should.not.be.null;
    });

    it('getVocabulary - lookup fail case insensitive', () => {
        const voc = vocabularyManager.getVocabulary('org.acme', 'en-US');
        (voc === null).should.be.true;
    });

    it('getVocabulary - case insensitive', () => {
        const voc = vocabularyManager.getVocabulary('org.acme', 'en-GB');
        voc.should.not.be.null;
    });

    it('getVocabulary - lookup fail', () => {
        const voc = vocabularyManager.getVocabulary('org.acme', 'zh', { localeMatcher: 'lookup' });
        (voc === null).should.be.true;
    });

    it('getVocabulariesForNamespace', () => {
        const voc = vocabularyManager.getVocabulariesForNamespace('org.acme');
        voc.length.should.equal(4); // en, en-gb, fr, zh-cn
    });

    it('getVocabulariesForLocale', () => {
        const voc = vocabularyManager.getVocabulariesForLocale('en');
        voc.length.should.equal(2);
        const vocFr = vocabularyManager.getVocabulariesForLocale('fr');
        vocFr.length.should.equal(1);
        const missing = vocabularyManager.getVocabulariesForLocale('foo');
        missing.length.should.equal(0);
    });

    it('getTerms - en', () => {
        const voc = vocabularyManager.getVocabulary('org.acme', 'en');
        voc.should.not.be.null;
        const terms = voc.getTerms();
        terms.length.should.equal(3);
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
        term2.should.equal('Le numéro d\'identification du véhicule (NIV)');
    });

    it('findVocabulary', () => {
        const voc = VocabularyManager.findVocabulary('en-gb', vocabularyManager.getVocabulariesForNamespace('org.acme'));
        voc.should.not.be.null;
    });

    it('getTerm - lookup declaration', () => {
        const term = vocabularyManager.getTerm('org.acme', 'en-gb', 'Truck');
        term.should.equal('A lorry (a vehicle capable of carrying cargo)');
    });

    it('getTerm - lookup declaration', () => {
        const term = vocabularyManager.getTerm('org.acme', 'en-gb', 'Color');
        term.should.equal('A colour');
    });

    it('getTerm - lookup property', () => {
        const term = vocabularyManager.getTerm('org.acme', 'en-gb', 'Vehicle', 'vin');
        term.should.equal('Vehicle Identification Number');
    });

    it('getTerm - lookup unicode', () => {
        const term = vocabularyManager.getTerm('org.acme', 'zh-cn', 'Color');
        term.should.equal('颜色');
    });

    it('getTerm - lookup unicode property', () => {
        let term = vocabularyManager.getTerm('org.acme', 'zh-cn', 'Color', 'RED');
        term.should.equal('红色');

        term = vocabularyManager.getTerm('org.acme', 'zh-cn', 'Color', 'GREEN');
        term.should.equal('绿色');

        term = vocabularyManager.getTerm('org.acme', 'zh-cn', 'Color', 'BLUE');
        term.should.equal('蓝色');
    });

    it('getTerm - lookup missing property', () => {
        const term = vocabularyManager.getTerm('org.acme', 'en-gb', 'Vehicle', 'foo');
        (term === null).should.be.true;
    });

    it('getTerm - lookup missing locale', () => {
        const term = vocabularyManager.getTerm('org.acme', 'zh', 'Vehicle', 'vin');
        (term === null).should.be.true;
    });

    it('getTerm - missingTermGenerator', () => {
        vocabularyManager = new VocabularyManager({
            missingTermGenerator: VocabularyManager.englishMissingTermGenerator
        });
        let term = vocabularyManager.getTerm('org.acme', 'en', 'Truck', 'grossWeight');
        term.should.equal('Gross Weight of the Truck');
    });

    it('resolveTerm - class', () => {
        const term = vocabularyManager.resolveTerm(modelManager, 'org.acme', 'en-gb', 'Truck');
        term.should.equal('A lorry (a vehicle capable of carrying cargo)');
    });

    it('resolveTerm - property', () => {
        const term = vocabularyManager.resolveTerm(modelManager, 'org.acme', 'en-gb', 'Truck', 'weight');
        term.should.equal('The weight of the truck in KG');
    });

    it('resolveTerm - property on super type', () => {
        const term = vocabularyManager.resolveTerm(modelManager, 'org.acme', 'en-gb', 'Truck', 'vin');
        term.should.equal('Vehicle Identification Number');
    });

    it('resolveTerm - missing property', () => {
        const term = vocabularyManager.resolveTerm(modelManager, 'org.acme', 'en-gb', 'Truck', 'foo');
        (term === null).should.be.true;
    });

    it('resolveTerm - missing class', () => {
        const term = vocabularyManager.resolveTerm(modelManager, 'org.acme', 'en-gb', 'Dog');
        (term === null).should.be.true;
    });

    it('resolveTerm - missing namespace', () => {
        const term = vocabularyManager.resolveTerm(modelManager, 'org.foo', 'en-gb', 'Dog');
        (term === null).should.be.true;
    });

    it('clear', () => {
        vocabularyManager.clear();
        const voc = vocabularyManager.getVocabulary('org.acme', 'en');
        (voc === null).should.be.true;
    });

    it('removeVocabulary', () => {
        vocabularyManager.removeVocabulary('org.acme', 'en');
        const voc = vocabularyManager.getVocabulary('org.acme', 'en');
        (voc === null).should.be.true;
    });

    it('validate', () => {
        const result = vocabularyManager.validate(modelManager);
        result.missingVocabularies.length.should.equal(1);
        result.missingVocabularies[0].should.equal('org.accordproject');
        result.additionalVocabularies.length.should.equal(1);
        result.additionalVocabularies[0].getNamespace().should.equal('com.example');
        result.vocabularies['org.acme/en'].additionalTerms.should.have.members(['Vehicle.model']);
        result.vocabularies['org.acme/en'].missingTerms.should.have.members(['Color.RED', 'Color.BLUE', 'Color.GREEN', 'Vehicle.color']);
        result.vocabularies['org.acme/en-gb'].additionalTerms.should.have.members(['Milkfloat']);
        result.vocabularies['org.acme/fr'].missingTerms.should.have.members(['Color', 'Vehicle.color', 'Truck']);
        result.vocabularies['org.acme/fr'].additionalTerms.should.have.members([]);
        result.vocabularies['org.acme/zh-cn'].missingTerms.should.have.members(['Truck']);
        result.vocabularies['org.acme/zh-cn'].additionalTerms.should.have.members([]);
    });
});
