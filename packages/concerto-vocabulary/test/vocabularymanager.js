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
const { jestSnapshotPlugin } = require('mocha-chai-jest-snapshot');

// eslint-disable-next-line no-unused-vars
const should = chai.should();
const expect = chai.expect;
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));
chai.use(jestSnapshotPlugin());

const { VocabularyManager } = require('../src');
const ModelManager = require('@accordproject/concerto-core').ModelManager;
const DecoratorManager = require('@accordproject/concerto-core').DecoratorManager;

let modelManager = null;
let vocabularyManager = null;

describe('VocabularyManager', () => {
    beforeEach(() => {
        modelManager = new ModelManager();
        const model = fs.readFileSync('./test/org.acme.cto', 'utf-8');
        modelManager.addCTOModel(model);
        const model2 = fs.readFileSync('./test/org.accordproject.cto', 'utf-8');
        modelManager.addCTOModel(model2);
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

    it('addVocabulary', () => {
        const enVocString = fs.readFileSync('./test/test.voc', 'utf-8');
        const voc = vocabularyManager.addVocabulary(enVocString);
        voc.should.not.be.null;
        voc.getNamespace().should.equal('com.test@1.0.0');
    });

    it('addVocabulary (duplicate)', () => {
        const enVocString = fs.readFileSync('./test/org.acme_en.voc', 'utf-8');
        should.Throw(() => vocabularyManager.addVocabulary(enVocString), Error);
    });

    it('getVocabulary', () => {
        const voc = vocabularyManager.getVocabulary('org.acme@1.0.0', 'en');
        voc.should.not.be.null;
    });

    it('getVocabulary - undefined', () => {
        const voc = vocabularyManager.getVocabulary('foo', 'en');
        (voc === null).should.be.true;
    });

    it('getVocabulary - missing locale', () => {
        const voc = vocabularyManager.getVocabulary('org.acme@1.0.0', 'foo');
        (voc === null).should.be.true;
    });

    it('getVocabulary - lookup', () => {
        const voc = vocabularyManager.getVocabulary('org.acme@1.0.0', 'en-us', { localeMatcher: 'lookup' });
        voc.should.not.be.null;
    });

    it('getVocabulary - lookup fail case insensitive', () => {
        const voc = vocabularyManager.getVocabulary('org.acme@1.0.0', 'en-US');
        (voc === null).should.be.true;
    });

    it('getVocabulary - case insensitive', () => {
        const voc = vocabularyManager.getVocabulary('org.acme@1.0.0', 'en-GB');
        voc.should.not.be.null;
    });

    it('getVocabulary - lookup fail', () => {
        const voc = vocabularyManager.getVocabulary('org.acme@1.0.0', 'zh', { localeMatcher: 'lookup' });
        (voc === null).should.be.true;
    });

    it('getVocabulariesForNamespace', () => {
        const voc = vocabularyManager.getVocabulariesForNamespace('org.acme@1.0.0');
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
        const voc = vocabularyManager.getVocabulary('org.acme@1.0.0', 'en');
        voc.should.not.be.null;
        const terms = voc.getTerms();
        terms.length.should.equal(3);
    });

    it('getTerms - fr', () => {
        const voc = vocabularyManager.getVocabulary('org.acme@1.0.0', 'fr');
        voc.should.not.be.null;
        const terms = voc.getTerms();
        terms.length.should.equal(1);
    });

    it('getTerms - lookup declaration', () => {
        const terms = vocabularyManager.getTerms('org.acme@1.0.0', 'en', 'Truck');
        terms.Truck.should.equal('A truck');
        terms.description.should.equal('A vehicle capable of carrying cargo');
        terms.tooltip.should.equal('Truck');
    });

    it('getTerms - lookup property', () => {
        const terms = vocabularyManager.getTerms('org.acme@1.0.0', 'en', 'Truck', 'weight');
        terms.weight.should.equal('The weight of the truck');
        terms.description.should.equal('The weight of the truck in KG');
        terms.tooltip.should.equal('Truck weight');
    });

    it('getTerms - lookup unicode', () => {
        const terms = vocabularyManager.getTerms('org.acme@1.0.0', 'zh-cn', 'Color');
        terms.Color.should.equal('颜色');
    });

    it('getTerms - lookup unicode property', () => {
        let terms = vocabularyManager.getTerms('org.acme@1.0.0', 'zh-cn', 'Color', 'RED');
        terms.RED.should.equal('红色');

        terms = vocabularyManager.getTerms('org.acme@1.0.0', 'zh-cn', 'Color', 'GREEN');
        terms.GREEN.should.equal('绿色');

        terms = vocabularyManager.getTerms('org.acme@1.0.0', 'zh-cn', 'Color', 'BLUE');
        terms.BLUE.should.equal('蓝色');
    });

    it('getTerms - lookup missing property', () => {
        const terms = vocabularyManager.getTerms('org.acme@1.0.0', 'en-gb', 'Vehicle', 'foo');
        (terms === null).should.be.true;
    });

    it('getTerms - lookup missing locale', () => {
        const terms = vocabularyManager.getTerms('org.acme@1.0.0', 'zh', 'Vehicle', 'vin');
        (terms === null).should.be.true;
    });

    it('getTerms - missingTermGenerator', () => {
        vocabularyManager = new VocabularyManager({
            missingTermGenerator: VocabularyManager.englishMissingTermGenerator
        });
        let terms = vocabularyManager.getTerms('org.acme@1.0.0', 'en', 'Truck', 'grossWeight');
        terms.grossWeight.should.equal('Gross Weight of the Truck');
    });

    it('getTerm - en', () => {
        const voc = vocabularyManager.getVocabulary('org.acme@1.0.0', 'en');
        voc.should.not.be.null;
        const term = voc.getTerm('Vehicle');
        term.should.equal('A road vehicle');
        const term2 = voc.getTerm('Vehicle', 'vin');
        term2.should.equal('Vehicle Identification Number');
    });

    it('getTerm - fr', () => {
        const voc = vocabularyManager.getVocabulary('org.acme@1.0.0', 'fr');
        voc.should.not.be.null;
        const term = voc.getTerm('Vehicle');
        term.should.equal('Véhicule');
        const term2 = voc.getTerm('Vehicle', 'vin');
        term2.should.equal('Le numéro d\'identification du véhicule (NIV)');
    });

    it('findVocabulary', () => {
        const voc = VocabularyManager.findVocabulary('en-gb', vocabularyManager.getVocabulariesForNamespace('org.acme@1.0.0'));
        voc.should.not.be.null;
    });

    it('getTerm - lookup declaration', () => {
        const term = vocabularyManager.getTerm('org.acme@1.0.0', 'en-gb', 'Truck');
        term.should.equal('A lorry');
    });

    it('getTerm - lookup declaration with identifier', () => {
        const term = vocabularyManager.getTerm('org.acme@1.0.0', 'en', 'Truck', null, 'description');
        term.should.equal('A vehicle capable of carrying cargo');
    });

    it('getTerm - lookup declaration', () => {
        const term = vocabularyManager.getTerm('org.acme@1.0.0', 'en-gb', 'Color');
        term.should.equal('A colour');
    });

    it('getTerm - lookup property', () => {
        const term = vocabularyManager.getTerm('org.acme@1.0.0', 'en-gb', 'Vehicle', 'vin');
        term.should.equal('Vehicle Identification Number');
    });

    it('getTerm - lookup property with identifier', () => {
        const term = vocabularyManager.getTerm('org.acme@1.0.0', 'en-gb', 'Vehicle', 'vin', 'tooltip');
        term.should.equal('VIN');
    });

    it('getTerm - lookup unicode', () => {
        const term = vocabularyManager.getTerm('org.acme@1.0.0', 'zh-cn', 'Color');
        term.should.equal('颜色');
    });

    it('getTerm - lookup unicode property', () => {
        let term = vocabularyManager.getTerm('org.acme@1.0.0', 'zh-cn', 'Color', 'RED');
        term.should.equal('红色');

        term = vocabularyManager.getTerm('org.acme@1.0.0', 'zh-cn', 'Color', 'GREEN');
        term.should.equal('绿色');

        term = vocabularyManager.getTerm('org.acme@1.0.0', 'zh-cn', 'Color', 'BLUE');
        term.should.equal('蓝色');
    });

    it('getTerm - lookup missing property', () => {
        const term = vocabularyManager.getTerm('org.acme@1.0.0', 'en-gb', 'Vehicle', 'foo');
        (term === null).should.be.true;
    });

    it('getTerm - lookup missing locale', () => {
        const term = vocabularyManager.getTerm('org.acme@1.0.0', 'zh', 'Vehicle', 'vin');
        (term === null).should.be.true;
    });

    it('getTerm - missingTermGenerator', () => {
        vocabularyManager = new VocabularyManager({
            missingTermGenerator: VocabularyManager.englishMissingTermGenerator
        });
        let term = vocabularyManager.getTerm('org.acme@1.0.0', 'en', 'Truck', 'grossWeight');
        term.should.equal('Gross Weight of the Truck');
    });

    it('resolveTerms - class', () => {
        const terms = vocabularyManager.resolveTerms(modelManager, 'org.acme@1.0.0', 'en-gb', 'Truck');
        terms.Truck.should.equal('A lorry');
    });

    it('resolveTerms - class with identifier', () => {
        const terms = vocabularyManager.resolveTerms(modelManager, 'org.acme@1.0.0', 'en-gb', 'Truck');
        terms.description.should.equal('A heavy goods vehicle');
    });

    it('resolveTerms - property', () => {
        const terms = vocabularyManager.resolveTerms(modelManager, 'org.acme@1.0.0', 'en-gb', 'Truck', 'weight');
        terms.weight.should.equal('The weight of the truck');
    });

    it('resolveTerms - property with identifier', () => {
        const terms = vocabularyManager.resolveTerms(modelManager, 'org.acme@1.0.0', 'en-gb', 'Truck', 'weight', 'description');
        terms.description.should.equal('The weight of the truck in KG');
    });

    it('resolveTerms - property on super type', () => {
        const terms = vocabularyManager.resolveTerms(modelManager, 'org.acme@1.0.0', 'en-gb', 'Truck', 'vin');
        terms.vin.should.equal('Vehicle Identification Number');
    });

    it('resolveTerms - missing property', () => {
        const terms = vocabularyManager.resolveTerms(modelManager, 'org.acme@1.0.0', 'en-gb', 'Truck', 'foo');
        (terms === null).should.be.true;
    });

    it('resolveTerms - missing class', () => {
        const terms = vocabularyManager.resolveTerms(modelManager, 'org.acme@1.0.0', 'en-gb', 'Dog');
        (terms === null).should.be.true;
    });

    it('resolveTerms - missing namespace', () => {
        const terms = vocabularyManager.resolveTerms(modelManager, 'org.foo', 'en-gb', 'Dog');
        (terms === null).should.be.true;
    });

    it('resolveTerm - class', () => {
        const term = vocabularyManager.resolveTerm(modelManager, 'org.acme@1.0.0', 'en-gb', 'Truck');
        term.should.equal('A lorry');
    });

    it('resolveTerm - class with identifier', () => {
        const term = vocabularyManager.resolveTerm(modelManager, 'org.acme@1.0.0', 'en-gb', 'Truck', null, 'description');
        term.should.equal('A heavy goods vehicle');
    });

    it('resolveTerm - property', () => {
        const term = vocabularyManager.resolveTerm(modelManager, 'org.acme@1.0.0', 'en-gb', 'Truck', 'weight');
        term.should.equal('The weight of the truck');
    });

    it('resolveTerm - property with identifier', () => {
        const term = vocabularyManager.resolveTerm(modelManager, 'org.acme@1.0.0', 'en-gb', 'Truck', 'weight', 'description');
        term.should.equal('The weight of the truck in KG');
    });

    it('resolveTerm - property on super type', () => {
        const term = vocabularyManager.resolveTerm(modelManager, 'org.acme@1.0.0', 'en-gb', 'Truck', 'vin');
        term.should.equal('Vehicle Identification Number');
    });

    it('resolveTerm - missing property', () => {
        const term = vocabularyManager.resolveTerm(modelManager, 'org.acme@1.0.0', 'en-gb', 'Truck', 'foo');
        (term === null).should.be.true;
    });

    it('resolveTerm - missing class', () => {
        const term = vocabularyManager.resolveTerm(modelManager, 'org.acme@1.0.0', 'en-gb', 'Dog');
        (term === null).should.be.true;
    });

    it('resolveTerm - missing namespace', () => {
        const term = vocabularyManager.resolveTerm(modelManager, 'org.foo', 'en-gb', 'Dog');
        (term === null).should.be.true;
    });

    it('clear', () => {
        vocabularyManager.clear();
        const voc = vocabularyManager.getVocabulary('org.acme@1.0.0', 'en');
        (voc === null).should.be.true;
    });

    it('removeVocabulary', () => {
        vocabularyManager.removeVocabulary('org.acme@1.0.0', 'en');
        const voc = vocabularyManager.getVocabulary('org.acme@1.0.0', 'en');
        (voc === null).should.be.true;
    });

    it('validate', () => {
        const result = vocabularyManager.validate(modelManager);
        result.missingVocabularies.length.should.equal(1);
        result.missingVocabularies[0].should.equal('org.accordproject@1.0.0');
        result.additionalVocabularies.length.should.equal(1);
        result.additionalVocabularies[0].getNamespace().should.equal('com.example@1.0.0');
        result.vocabularies['org.acme@1.0.0/en'].additionalTerms.should.have.members(['Vehicle.model', 'Truck.horsePower']);
        result.vocabularies['org.acme@1.0.0/en'].missingTerms.should.have.members(['Color.RED', 'Color.BLUE', 'Color.GREEN', 'SSN', 'Vehicle.color']);
        result.vocabularies['org.acme@1.0.0/en-gb'].additionalTerms.should.have.members(['Milkfloat']);
        result.vocabularies['org.acme@1.0.0/fr'].missingTerms.should.have.members(['Color', 'SSN', 'Vehicle.color', 'Truck']);
        result.vocabularies['org.acme@1.0.0/fr'].additionalTerms.should.have.members([]);
        result.vocabularies['org.acme@1.0.0/zh-cn'].missingTerms.should.have.members(['SSN', 'Truck']);
        result.vocabularies['org.acme@1.0.0/zh-cn'].additionalTerms.should.have.members([]);
    });

    it('decorateModels', () => {
        vocabularyManager = new VocabularyManager({
            missingTermGenerator: VocabularyManager.englishMissingTermGenerator
        });
        const enVocString = fs.readFileSync('./test/org.acme_en.voc', 'utf-8');
        vocabularyManager.addVocabulary(enVocString);
        const enGbVocString = fs.readFileSync('./test/org.acme_en-gb.voc', 'utf-8');
        vocabularyManager.addVocabulary(enGbVocString);
        const commandSet = vocabularyManager.generateDecoratorCommands(modelManager, 'en-GB');
        expect(commandSet).toMatchSnapshot();
        const newModelManager = DecoratorManager.decorateModels( modelManager, commandSet);
        const mf = newModelManager.getModelFile('org.acme@1.0.0');
        const vehicleDecl = mf.getAssetDeclaration('Vehicle');
        const decorator = vehicleDecl.getDecorator('Term');
        decorator.getArguments()[0].should.equal('A road vehicle');
        vehicleDecl.getProperty('vin').getDecorator('Term').getArguments()[0].should.equal('Vehicle Identification Number');

        const scalarDeclarations = mf.getScalarDeclarations();
        const ssnDeclaration = scalarDeclarations[0];
        const ssnDecorator = ssnDeclaration.getDecorator('Term');
        ssnDecorator.getArguments()[0].should.equal('SSN');
    });
});
