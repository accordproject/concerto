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
const path = require('path');
const tmp = require('tmp-promise');
const fs = require('fs');

chai.should();
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));

const Commands = require('../lib/commands');

describe('cicero-cli', () => {
    const models = [path.resolve(__dirname, 'models/dom.cto'),path.resolve(__dirname, 'models/money.cto')];
    const offlineModels = [path.resolve(__dirname, 'models/contract.cto'),path.resolve(__dirname, 'models/dom.cto'),path.resolve(__dirname, 'models/money.cto')];
    const sample1 = path.resolve(__dirname, 'data/sample1.json');
    const sample2 = path.resolve(__dirname, 'data/sample2.json');
    const sampleText1 = fs.readFileSync(sample1, 'utf8');
    const sampleText2 = fs.readFileSync(sample2, 'utf8');

    describe('#validateValidateArgs', () => {
        it('no args specified', () => {
            process.chdir(path.resolve(__dirname, 'data'));
            const args  = Commands.validateValidateArgs({
                _: ['validate'],
            });
            args.sample.should.match(/sample.json$/);
        });

        it('all args specified', () => {
            process.chdir(path.resolve(__dirname, 'data'));
            const args  = Commands.validateValidateArgs({
                _: ['validate'],
                sample: 'sample1.json'
            });
            args.sample.should.match(/sample1.json$/);
        });
    });

    describe('#validate', () => {
        it('should validate against a model', async () => {
            const result = await Commands.validate(sample1, models, {offline:false});
            JSON.parse(result).should.deep.equal(JSON.parse(sampleText1));
        });

        it('should fail to validate against a model', async () => {
            try {
                const result = await Commands.validate(sample2, models, {offline:false});
                JSON.parse(result).should.deep.equal(JSON.parse(sampleText2));
            } catch (err) {
                err.message.should.equal('Instance org.accordproject.money.MonetaryAmount#null invalid enum value true for field CurrencyCode');
            }
        });

        it('should validate against a model (offline)', async () => {
            const result = await Commands.validate(sample1, offlineModels, {offline:true});
            JSON.parse(result).should.deep.equal(JSON.parse(sampleText1));
        });

        it('should fail to validate against a model (offline)', async () => {
            try {
                const result = await Commands.validate(sample2, offlineModels, {offline:true});
                JSON.parse(result).should.deep.equal(JSON.parse(sampleText2));
            } catch (err) {
                err.message.should.equal('Instance org.accordproject.money.MonetaryAmount#null invalid enum value true for field CurrencyCode');
            }
        });

        it('verbose flag specified', () => {
            process.chdir(path.resolve(__dirname, 'data'));
            Commands.validateValidateArgs({
                _: ['validate'],
                verbose: true
            });
        });

        it('bad sample.json', () => {
            process.chdir(path.resolve(__dirname, 'data'));
            (() => Commands.validateValidateArgs({
                _: ['validate'],
                sample: 'sample_en.json'
            })).should.throw('A sample.json file is required. Try the --sample flag or create a sample.json file.');
        });

        it('bad ctoFiles', () => {
            process.chdir(path.resolve(__dirname, 'data'));
            (() => Commands.validateValidateArgs({
                _: ['validate'],
                ctoFiles: ['missing.cto']
            })).should.throw('A model.cto file is required. Try the --ctoFiles flag or create a model.cto file.');
        });
    });

    describe('#compile', () => {

        it('should compile to a Go model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true});
            await Commands.compile('Go', models, dir.path, {offline:false});
            fs.readdirSync(dir.path).length.should.be.above(0);
            dir.cleanup();
        });
        it('should compile to a PlantUML model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true});
            await Commands.compile('PlantUML', models, dir.path, {offline:false});
            fs.readdirSync(dir.path).length.should.be.above(0);
            dir.cleanup();
        });
        it('should compile to a Typescript model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true});
            await Commands.compile('Typescript', models, dir.path, {offline:false});
            fs.readdirSync(dir.path).length.should.be.above(0);
            dir.cleanup();
        });
        it('should compile to a Java model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true});
            await Commands.compile('Java', models, dir.path);
            fs.readdirSync(dir.path).length.should.be.above(0);
            dir.cleanup();
        });
        it('should compile to a JSONSchema model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true});
            await Commands.compile('JSONSchema', models, dir.path, {offline:false});
            fs.readdirSync(dir.path).length.should.be.above(0);
            dir.cleanup();
        });
        it('should compile to a XMLSchema model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true});
            await Commands.compile('XMLSchema', models, dir.path, {offline:false});
            fs.readdirSync(dir.path).length.should.be.above(0);
            dir.cleanup();
        });
        it('should not compile to an unknown model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true});
            await Commands.compile('BLAH', models, dir.path, {offline:false});
            fs.readdirSync(dir.path).length.should.be.equal(0);
            dir.cleanup();
        });
    });

    describe('#get', () => {
        it('should save external dependencies', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true});
            await Commands.get(models, dir.path);
            fs.readdirSync(dir.path).should.eql([
                '@models.accordproject.org.cicero.contract.cto',
                'dom.cto',
                'money.cto'
            ]);
            dir.cleanup();
        });

        it('should save external dependencies for an external model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true});
            await Commands.get(['https://models.accordproject.org/patents/patent.cto'], dir.path);
            fs.readdirSync(dir.path).should.eql([
                '@models.accordproject.org.address.cto',
                '@models.accordproject.org.geo.cto',
                '@models.accordproject.org.money.cto',
                '@models.accordproject.org.organization.cto',
                '@models.accordproject.org.patents.patent.cto',
                '@models.accordproject.org.person.cto',
                '@models.accordproject.org.product.cto',
                '@models.accordproject.org.usa.residency.cto',
                '@models.accordproject.org.value.cto'
            ]);
            dir.cleanup();
        });
    });
});