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
    const sample1 = path.resolve(__dirname, 'data/sample1.json');
    const sample2 = path.resolve(__dirname, 'data/sample2.json');
    const sampleText1 = fs.readFileSync(sample1, 'utf8');
    const sampleText2 = fs.readFileSync(sample2, 'utf8');

    describe('#validate', () => {
        it('should validate against a model', async () => {
            const result = await Commands.validate(sample1, models);
            JSON.parse(result).should.deep.equal(JSON.parse(sampleText1));
        });

        it('should fail to validate against a model', async () => {
            try {
                const result = await Commands.validate(sample2, models);
                JSON.parse(result).should.deep.equal(JSON.parse(sampleText1));
            } catch (err) {
                err.message.should.equal('Instance undefined invalid enum value true for field CurrencyCode');
            }
        });
    });

    describe('#generate', () => {

        it('should generate a Go model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true});
            await Commands.generate('Go', models, dir.path, true);
            fs.readdirSync(dir.path).length.should.be.above(0);
            dir.cleanup();
        });
        it('should generate a PlantUML model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true});
            await Commands.generate('PlantUML', models, dir.path, true);
            fs.readdirSync(dir.path).length.should.be.above(0);
            dir.cleanup();
        });
        it('should generate a Typescript model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true});
            await Commands.generate('Typescript', models, dir.path, true);
            fs.readdirSync(dir.path).length.should.be.above(0);
            dir.cleanup();
        });
        it('should generate a Java model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true});
            await Commands.generate('Java', models, dir.path, true);
            fs.readdirSync(dir.path).length.should.be.above(0);
            dir.cleanup();
        });
        it('should generate a JSONSchema model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true});
            await Commands.generate('JSONSchema', models, dir.path, true);
            fs.readdirSync(dir.path).length.should.be.above(0);
            dir.cleanup();
        });
        it('should generate a XMLSchema model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true});
            await Commands.generate('XMLSchema', models, dir.path, true);
            fs.readdirSync(dir.path).length.should.be.above(0);
            dir.cleanup();
        });
        it('should not generate an unknown model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true});
            await Commands.generate('BLAH', models, dir.path, true);
            fs.readdirSync(dir.path).length.should.be.equal(0);
            dir.cleanup();
        });
    });

    describe('#getExternalModels', () => {
        it('should save external dependencies', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true});
            await Commands.getExternalModels(models, dir.path);
            fs.readdirSync(dir.path).should.eql([
                '@models.accordproject.org.cicero.contract.cto',
                'dom.cto',
                'money.cto'
            ]);
            dir.cleanup();
        });
    });
});