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
    const input1 = path.resolve(__dirname, 'data/input1.json');
    const input2 = path.resolve(__dirname, 'data/input2.json');
    const inputText1 = fs.readFileSync(input1, 'utf8');
    const inputText2 = fs.readFileSync(input2, 'utf8');

    describe('#validateValidateArgs', () => {
        it('no args specified', () => {
            process.chdir(path.resolve(__dirname, 'data'));
            const args  = Commands.validateValidateArgs({
                _: ['validate'],
            });
            args.input.should.match(/input.json$/);
        });

        it('all args specified', () => {
            process.chdir(path.resolve(__dirname, 'data'));
            const args  = Commands.validateValidateArgs({
                _: ['validate'],
                input: 'input1.json'
            });
            args.input.should.match(/input1.json$/);
        });
    });

    describe('#validate (classic)', () => {
        it('should validate against a model', async () => {
            const result = await Commands.validate(input1, models, {offline:false});
            JSON.parse(result).should.deep.equal(JSON.parse(inputText1));
        });

        it('should fail to validate against a model', async () => {
            try {
                const result = await Commands.validate(input2, models, {offline:false});
                JSON.parse(result).should.deep.equal(JSON.parse(inputText2));
            } catch (err) {
                err.message.should.equal('Instance org.accordproject.money.MonetaryAmount#null invalid enum value true for field CurrencyCode');
            }
        });

        it('should validate against a model (offline)', async () => {
            const result = await Commands.validate(input1, offlineModels, {offline:true});
            JSON.parse(result).should.deep.equal(JSON.parse(inputText1));
        });

        it('should fail to validate against a model (offline)', async () => {
            try {
                const result = await Commands.validate(input2, offlineModels, {offline:true});
                JSON.parse(result).should.deep.equal(JSON.parse(inputText2));
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

        it('bad input.json', () => {
            process.chdir(path.resolve(__dirname, 'data'));
            (() => Commands.validateValidateArgs({
                _: ['validate'],
                input: 'input_en.json'
            })).should.throw('A input.json file is required. Try the --input flag or create a input.json file.');
        });

        it('bad model', () => {
            process.chdir(path.resolve(__dirname, 'data'));
            (() => Commands.validateValidateArgs({
                _: ['validate'],
                model: ['missing.cto']
            })).should.throw('A model.cto file is required. Try the --model flag or create a model.cto file.');
        });
    });

    describe('#validate (functional)', () => {
        it('should validate against a model', async () => {
            const result = await Commands.validate(input1, models, {offline:false, functional: true});
            (typeof result === 'undefined').should.equal(true);
        });

        it('should fail to validate against a model', async () => {
            try {
                await Commands.validate(input2, models, {offline:false, functional: true});
            } catch (err) {
                err.message.should.equal('Instance undefined invalid enum value true for field CurrencyCode');
            }
        });
    });

    describe('#compile', () => {

        it('should compile to a Go model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true });
            await Commands.compile('Go', models, dir.path, {offline:false});
            fs.readdirSync(dir.path).length.should.be.above(0);
            dir.cleanup();
        });
        it('should compile to a PlantUML model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true });
            await Commands.compile('PlantUML', models, dir.path, {offline:false});
            fs.readdirSync(dir.path).length.should.be.above(0);
            dir.cleanup();
        });
        it('should compile to a Typescript model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true });
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
            const dir = await tmp.dir({ unsafeCleanup: true });
            await Commands.compile('JSONSchema', models, dir.path, {offline:false});
            fs.readdirSync(dir.path).length.should.be.above(0);
            dir.cleanup();
        });
        it('should compile to a XMLSchema model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true });
            await Commands.compile('XMLSchema', models, dir.path, {offline:false});
            fs.readdirSync(dir.path).length.should.be.above(0);
            dir.cleanup();
        });
        it('should compile to a GraphQL model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true });
            await Commands.compile('GraphQL', models, dir.path, {offline:false});
            fs.readdirSync(dir.path).length.should.be.above(0);
            dir.cleanup();
        });
        it('should compile to a CSharp model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true });
            await Commands.compile('CSharp', models, dir.path, {offline:false});
            fs.readdirSync(dir.path).length.should.be.above(0);
            dir.cleanup();
        });
        it('should not compile to an unknown model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true });
            await Commands.compile('BLAH', models, dir.path, {offline:false});
            fs.readdirSync(dir.path).length.should.be.equal(0);
            dir.cleanup();
        });
    });

    describe('#get', () => {
        it('should save external dependencies', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true });
            await Commands.get(models, dir.path);
            fs.readdirSync(dir.path).should.eql([
                '@models.accordproject.org.cicero.contract.cto',
                'dom.cto',
                'money.cto'
            ]);
            dir.cleanup();
        });

        it('should save external dependencies for an external model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true });
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

    describe('#import', async () => {
        it('should transform cto to metamodel', async () => {
            const expected = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'models/contract.json')));
            const result = JSON.parse(await Commands.import(path.resolve(__dirname, 'models/contract.cto')));
            result.should.deep.equal(expected);
        });

        it('should transform cto to metamodel and save it', async () => {
            const output = await tmp.file({ unsafeCleanup: true });
            const expected = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'models/contract.json')));
            await Commands.import(path.resolve(__dirname, 'models/contract.cto'), undefined, undefined, undefined, output.path);
            const result = JSON.parse(fs.readFileSync(output.path));
            result.should.deep.equal(expected);
            output.cleanup();
        });

        it('should transform cto to metamodel and resolve names', async () => {
            const expected = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'models/contractResolved.json')));
            const contractFile = path.resolve(__dirname, 'models/contract.cto');
            const result = JSON.parse(await Commands.import(contractFile, [contractFile], true));
            result.should.deep.equal(expected);
        });

        it('should transform cto to metamodel and resolve names', async () => {
            const expected = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'models/contractResolvedAll.json')));
            const contractFile = path.resolve(__dirname, 'models/contract.cto');
            const result = JSON.parse(await Commands.import(contractFile, [contractFile], true, true));
            result.should.deep.equal(expected);
        });
    });

    describe('#export', async () => {
        it('should transform a metamodel to cto', async () => {
            const expected = fs.readFileSync(path.resolve(__dirname, 'models/contract2.cto'), 'utf-8');
            const metamodel = path.resolve(__dirname, 'models/contract.json');
            const result = await Commands.export(metamodel);
            result.should.equal(expected);
        });

        it('should transform a metamodel to cto and save it', async () => {
            const output = await tmp.file({ unsafeCleanup: true });
            const expected = fs.readFileSync(path.resolve(__dirname, 'models/contract2.cto'), 'utf-8');
            const metamodel = path.resolve(__dirname, 'models/contract.json');
            await Commands.export(metamodel, output.path);
            const result = fs.readFileSync(output.path, 'utf-8');
            result.should.equal(expected);
            output.cleanup();
        });
    });
});