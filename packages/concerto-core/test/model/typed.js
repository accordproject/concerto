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

const { ModelManager } = require('../../src/modelmanager');
const { Typed } = require('../../src/model/typed');
const { ValidationException } = require('../../src/serializer/validationexception');
const Util = require('../composer/composermodelutility');
const dayjs = require('dayjs');

require('chai').should();

describe('Typed', () => {

    let modelManager;
    let baseAssetClassDecl;
    let baseAsset2ClassDecl;
    let asset2ClassDecl;

    beforeEach(() => {
        modelManager = new ModelManager();
        Util.addComposerModel(modelManager);
        modelManager.addCTOModel(`
        namespace org.acme.base@1.0.0
        abstract asset BaseAsset {
        }
        abstract asset BaseAsset2 extends BaseAsset {
        }`);
        baseAssetClassDecl = modelManager.getType('org.acme.base@1.0.0.BaseAsset');
        baseAsset2ClassDecl = modelManager.getType('org.acme.base@1.0.0.BaseAsset2');
        modelManager.addCTOModel(`
        namespace org.acme.ext@1.0.0
        import org.acme.base@1.0.0.BaseAsset2
        asset MyAsset identified by assetId extends BaseAsset2 {
            o String assetId
        }
        asset Asset2 extends MyAsset {
        }`);
        asset2ClassDecl = modelManager.getType('org.acme.ext@1.0.0.Asset2');
    });

    describe('#instanceOf', () => {

        it('should return true for a matching type', () => {
            let typed = new Typed(modelManager, baseAssetClassDecl, 'org.acme.base@1.0.0', 'BaseAsset');
            typed.instanceOf('org.acme.base@1.0.0.BaseAsset').should.be.true;
        });

        it('should return true for a matching super type', () => {
            let typed = new Typed(modelManager, baseAsset2ClassDecl, 'org.acme.base@1.0.0', 'BaseAsset2');
            typed.instanceOf('org.acme.base@1.0.0.BaseAsset').should.be.true;
        });

        it('should return false for a non-matching sub type', () => {
            let typed = new Typed(modelManager, baseAssetClassDecl, 'org.acme.base@1.0.0', 'BaseAsset');
            typed.instanceOf('org.acme.base@1.0.0.BaseAsset2').should.be.false;
        });

        it('should return true for a matching nested super type', () => {
            let typed = new Typed(modelManager, asset2ClassDecl, 'org.acme.ext@1.0.0', 'Asset2');
            typed.instanceOf('org.acme.base@1.0.0.BaseAsset').should.be.true;
        });

    });

    describe('#assignFieldDefaults', () => {

        const defaultValues = {
            'Boolean': true,
            'String': 'foobar',
            'DateTime': '2017-09-26T22:35:53Z',
            'Double': 3.142,
            'Integer': 32768,
            'Long': 10485760,
            'Test': 'THREE',
        };

        Object.keys(defaultValues).forEach((defaultValueType) => {

            it(`should assign the default value for primitive type ${defaultValueType}`, () => {
                const defaultValue = defaultValues[defaultValueType];
                modelManager.addCTOModel(`
                namespace org.acme.defaults@1.0.0
                enum Test {
                    o ONE
                    o TWO
                    o THREE
                }
                asset DefaultAsset identified by assetId {
                    o String assetId
                    o ${defaultValueType} value default=${JSON.stringify(defaultValue)}
                }`);
                const classDecl = modelManager.getType('org.acme.defaults@1.0.0.DefaultAsset');
                const typed = new Typed(modelManager, classDecl, 'org.acme.defaults@1.0.0', 'DefaultAsset');
                typed.assignFieldDefaults();
                if (dayjs.isDayjs(typed.value)) {
                    typed.value.format().should.equal(defaultValue);
                } else {
                    typed.value.should.equal(defaultValue);
                }
            });

        });

        it('should assign the default value for falsy values', () => {
            modelManager.addCTOModel(`namespace org.acme.defaults@1.0.0
            concept DefaultAsset {
                o Boolean bool default=false
                o Integer int default=0
                o Long long default=0
                o Double double default=0.0
            }`);
            const classDecl = modelManager.getType('org.acme.defaults@1.0.0.DefaultAsset');
            const typed = new Typed(modelManager, classDecl, 'org.acme.defaults@1.0.0', 'DefaultAsset');
            typed.assignFieldDefaults();
            typed.bool.should.equal(false);
            typed.int.should.equal(0);
            typed.long.should.equal(0);
            typed.double.should.equal(0.0);
        });

        it('should throw a ValidationException when DateTime default is invalid', () => {
            modelManager.addCTOModel(`namespace org.acme.defaults@1.0.0
            concept DefaultAsset {
                o DateTime invalidDate default="FOO"
            }`);
            const classDecl = modelManager.getType('org.acme.defaults@1.0.0.DefaultAsset');
            const typed = new Typed(modelManager, classDecl, 'org.acme.defaults@1.0.0', 'DefaultAsset');
            (() => typed.assignFieldDefaults()).should.throw(
                ValidationException,
                /Invalid default value 'FOO' for DateTime field 'invalidDate'\./
            );
        });

        it('should not throw for an invalid DateTime default when the check is skipped', () => {
            modelManager.addCTOModel(`namespace org.acme.defaults@1.0.0
            concept DefaultAsset {
                o DateTime invalidDate default="FOO"
            }`);
            const classDecl = modelManager.getType('org.acme.defaults@1.0.0.DefaultAsset');
            const typed = new Typed(modelManager, classDecl, 'org.acme.defaults@1.0.0', 'DefaultAsset');
            typed.assignFieldDefaults(false);
            typed.invalidDate.isValid().should.equal(false);
        });

        it('should reject a date-only DateTime default', () => {
            modelManager.addCTOModel(`namespace org.acme.defaults@1.0.0
            concept DefaultAsset {
                o DateTime dateOnly default="2024-05-01"
            }`);
            const classDecl = modelManager.getType('org.acme.defaults@1.0.0.DefaultAsset');
            const typed = new Typed(modelManager, classDecl, 'org.acme.defaults@1.0.0', 'DefaultAsset');
            (() => typed.assignFieldDefaults()).should.throw(
                ValidationException,
                /Invalid default value '2024-05-01' for DateTime field 'dateOnly'\./
            );
        });

        it('should reject an impossible DateTime default', () => {
            modelManager.addCTOModel(`namespace org.acme.defaults@1.0.0
            concept DefaultAsset {
                o DateTime impossible default="2024-02-30T00:00:00Z"
            }`);
            const classDecl = modelManager.getType('org.acme.defaults@1.0.0.DefaultAsset');
            const typed = new Typed(modelManager, classDecl, 'org.acme.defaults@1.0.0', 'DefaultAsset');
            (() => typed.assignFieldDefaults()).should.throw(
                ValidationException,
                /Invalid default value '2024-02-30T00:00:00Z' for DateTime field 'impossible'\./
            );
        });

        it('should accept a date-only DateTime default when the check is not strict', () => {
            modelManager.addCTOModel(`namespace org.acme.defaults@1.0.0
            concept DefaultAsset {
                o DateTime dateOnly default="2024-05-01"
            }`);
            const classDecl = modelManager.getType('org.acme.defaults@1.0.0.DefaultAsset');
            (() => Typed.checkDateTimeDefault(classDecl.getProperty('dateOnly'), false)).should.not.throw();
        });

        it('should assign a valid DateTime default', () => {
            modelManager.addCTOModel(`namespace org.acme.defaults@1.0.0
            concept DefaultAsset {
                o DateTime validDate default="2024-05-01T00:00:00.000Z"
            }`);
            const classDecl = modelManager.getType('org.acme.defaults@1.0.0.DefaultAsset');
            const typed = new Typed(modelManager, classDecl, 'org.acme.defaults@1.0.0', 'DefaultAsset');
            typed.assignFieldDefaults();
            typed.validDate.toISOString().should.equal('2024-05-01T00:00:00.000Z');
        });

    });

});
