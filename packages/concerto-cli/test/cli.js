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
const sinon = require('sinon');

chai.should();
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const Commands = require('../lib/commands');
const { Parser } = require('@accordproject/concerto-cto');

describe('concerto-cli', () => {
    const models = [path.resolve(__dirname, 'models/dom.cto'),path.resolve(__dirname, 'models/money.cto')];
    const offlineModels = [path.resolve(__dirname, 'models/contract.cto'),path.resolve(__dirname, 'models/dom.cto'),path.resolve(__dirname, 'models/money.cto')];
    const input1 = path.resolve(__dirname, 'data/input1.json');
    const input2 = path.resolve(__dirname, 'data/input2.json');
    const inputText1 = fs.readFileSync(input1, 'utf8');
    const inputText2 = fs.readFileSync(input2, 'utf8');

    afterEach(() => {
        sinon.restore();
    });

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
                err.message.should.equal('Model violation in the "org.accordproject.money.MonetaryAmount" instance. Invalid enum value of "true" for the field "CurrencyCode".');
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
                err.message.should.equal('Model violation in the "org.accordproject.money.MonetaryAmount" instance. Invalid enum value of "true" for the field "CurrencyCode".');
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
                err.message.should.equal('Model violation in the "undefined" instance. Invalid enum value of "true" for the field "CurrencyCode".');
            }
        });
    });

    describe('#compile', () => {

        it('should compile to a Go model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true });
            await Commands.compile('GoLang', models, dir.path, {offline:false});
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
        it('should compile to an OData model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true });
            await Commands.compile('OData', models, dir.path, {offline:false});
            fs.readdirSync(dir.path).length.should.be.above(0);
            dir.cleanup();
        });
        it('should not compile to an unknown model', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true });
            await Commands.compile('BLAH', models, dir.path, {offline:false});
            fs.readdirSync(dir.path).length.should.be.equal(0);
            dir.cleanup();
        });
        it('should compile to a TypeScript model with the metamodel', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true });
            await Commands.compile('Typescript', models, dir.path, {metamodel: true, offline:false});
            fs.readdirSync(dir.path).should.contain('concerto.metamodel@1.0.0.ts');
            dir.cleanup();
        });
        it('should compile to a CSharp model with the metamodel', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true });
            await Commands.compile('CSharp', models, dir.path, {metamodel: true, offline:false});
            fs.readdirSync(dir.path).should.contain('concerto.metamodel@1.0.0.cs');
            dir.cleanup();
        });
        it('should compile to a TypeScript model in strict mode', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true });
            await Commands.compile('Typescript', [], dir.path, {metamodel: true, offline:false, strict: true});
            fs.readdirSync(dir.path).should.not.contain('concerto.ts');
            fs.readdirSync(dir.path).should.contain('concerto@1.0.0.ts');
            dir.cleanup();
        });
        it('should compile to a CSharp model in strict mode', async () => {
            const dir = await tmp.dir({ unsafeCleanup: true });
            await Commands.compile('CSharp', [], dir.path, {metamodel: true, offline:false, strict: true});
            fs.readdirSync(dir.path).should.not.contain('concerto.cs');
            fs.readdirSync(dir.path).should.contain('concerto@1.0.0.cs');
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

    describe('#parse', async () => {
        it('should transform cto to metamodel', async () => {
            const expected = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'models/contract.json')));
            const result = JSON.parse(await Commands.parse([path.resolve(__dirname, 'models/contract.cto')]));
            result.should.deep.equal(expected);
        });

        it('should transform cto to metamodel and save it', async () => {
            const output = await tmp.file({ unsafeCleanup: true });
            const expected = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'models/contract.json')));
            await Commands.parse([path.resolve(__dirname, 'models/contract.cto')], undefined, undefined, output.path);
            const result = JSON.parse(fs.readFileSync(output.path));
            result.should.deep.equal(expected);
            output.cleanup();
        });

        it('should transform cto to metamodel and resolve names', async () => {
            const expected = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'models/contractResolved.json')));
            const contractFile = path.resolve(__dirname, 'models/contract.cto');
            const result = JSON.parse(await Commands.parse([contractFile], true));
            result.should.deep.equal(expected);
        });

        it('should transform cto to metamodel and resolve names', async () => {
            const expected = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'models/contractResolvedAll.json')));
            const contractFile = path.resolve(__dirname, 'models/contract.cto');
            const result = JSON.parse(await Commands.parse([contractFile], true, true));
            result.should.deep.equal(expected);
        });

        it('should transform cto to metamodel without location info', async () => {
            const contractFile = path.resolve(__dirname, 'models/contract.cto');
            const result = JSON.parse(await Commands.parse([contractFile], true, true, null, { excludeLineLocations: true }));
            JSON.stringify(result).should.not.contain('location');
        });
    });

    describe('#print', async () => {
        it('should transform a metamodel to cto', async () => {
            const expected = fs.readFileSync(path.resolve(__dirname, 'models/contract2.cto'), 'utf-8');
            const metamodel = path.resolve(__dirname, 'models/contract.json');
            const result = await Commands.print(metamodel);
            result.should.equal(expected);
        });

        it('should transform a metamodel to cto and save it', async () => {
            const output = await tmp.file({ unsafeCleanup: true });
            const expected = fs.readFileSync(path.resolve(__dirname, 'models/contract2.cto'), 'utf-8');
            const metamodel = path.resolve(__dirname, 'models/contract.json');
            await Commands.print(metamodel, output.path);
            const result = fs.readFileSync(output.path, 'utf-8');
            result.should.equal(expected);
            output.cleanup();
        });
    });

    describe('#version (simple)', async () => {
        let ctoPath;
        let metamodelPath;

        beforeEach(async () => {
            const sourceCtoPath = path.resolve(__dirname, 'models', 'version.cto');
            const sourceCto = fs.readFileSync(sourceCtoPath, 'utf-8');
            ctoPath = (await tmp.file({ unsafeCleanup: true })).path;
            fs.writeFileSync(ctoPath, sourceCto, 'utf-8');
            metamodelPath = (await tmp.file({ unsafeCleanup: true })).path;
            const metamodel = Parser.parse(sourceCto);
            fs.writeFileSync(metamodelPath, JSON.stringify(metamodel, null, 2), 'utf-8');
        });

        const tests = [
            { name: 'patch', release: 'patch', expectedNamespace: 'org.accordproject.concerto.test@1.2.4' },
            { name: 'minor', release: 'minor', expectedNamespace: 'org.accordproject.concerto.test@1.3.0' },
            { name: 'major', release: 'major', expectedNamespace: 'org.accordproject.concerto.test@2.0.0' },
            { name: 'explicit', release: '4.5.6', expectedNamespace: 'org.accordproject.concerto.test@4.5.6' },
            { name: 'prerelease', release: '5.6.7-pr.3472381', expectedNamespace: 'org.accordproject.concerto.test@5.6.7-pr.3472381' },
            { name: 'keep-and-set-prerelease', release: 'keep', prerelease: 'pr.1234567', expectedNamespace: 'org.accordproject.concerto.test@1.2.3-pr.1234567' }
        ];

        tests.forEach(({ name, release, prerelease, expectedNamespace }) => {

            it(`should patch bump a cto file [${name}]`, async () => {
                await Commands.version(release, [ctoPath], prerelease);
                const cto = fs.readFileSync(ctoPath, 'utf-8');
                const metamodel = Parser.parse(cto);
                metamodel.namespace.should.equal(expectedNamespace);
            });

            it(`should patch bump a metamodel file [${name}]`, async () => {
                await Commands.version(release, [metamodelPath], prerelease);
                const metamodel = JSON.parse(fs.readFileSync(metamodelPath, 'utf-8'));
                metamodel.namespace.should.equal(expectedNamespace);
            });

        });

        it('should reject an invalid release', async () => {
            await Commands.version('foobar', [ctoPath]).should.be.rejectedWith(/invalid release "foobar"/);
        });

        it('should reject an invalid version', async () => {
            const sourceCtoPath = path.resolve(__dirname, 'models', 'badversion.cto');
            await Commands.version('patch', [sourceCtoPath]).should.be.rejectedWith(/invalid current version "undefined"/);
        });

        it('should ignore namespaces in comments if possible #1', async () => {
            const release = 'keep';
            const prerelease = 'pr.1234567';
            const sourceCtoPath = path.resolve(__dirname, 'models', 'version-in-comment.cto');
            const sourceCto = fs.readFileSync(sourceCtoPath, 'utf-8');
            const ctoPath = (await tmp.file({ unsafeCleanup: true })).path;
            fs.writeFileSync(ctoPath, sourceCto, 'utf-8');
            await Commands.version(release, [ctoPath], prerelease);
            const cto = fs.readFileSync(ctoPath, 'utf-8');
            const metamodel = Parser.parse(cto);
            metamodel.namespace.should.equal('org.accordproject.concerto.test@1.2.3-pr.1234567');
        });

        it('should ignore namespaces in comments if possible #2', async () => {
            const release = 'keep';
            const prerelease = 'pr.1234567';
            const sourceCtoPath = path.resolve(__dirname, 'models', 'version-in-comment2.cto');
            const sourceCto = fs.readFileSync(sourceCtoPath, 'utf-8');
            const ctoPath = (await tmp.file({ unsafeCleanup: true })).path;
            fs.writeFileSync(ctoPath, sourceCto, 'utf-8');
            await Commands.version(release, [ctoPath], prerelease);
            const cto = fs.readFileSync(ctoPath, 'utf-8');
            const metamodel = Parser.parse(cto);
            metamodel.namespace.should.equal('org.accordproject.concerto.test@1.2.3-pr.1234567');
        });
    });

    describe('#version (imports)', async () => {
        let ctoPaths;
        let metamodelPaths;

        beforeEach(async () => {
            ctoPaths = [];
            metamodelPaths = [];
            for (const name of ['version-a.cto', 'version-b.cto', 'version-c.cto']) {
                const sourceCtoPath = path.resolve(__dirname, 'models', name);
                const sourceCto = fs.readFileSync(sourceCtoPath, 'utf-8');
                const ctoPath = (await tmp.file({ unsafeCleanup: true })).path;
                ctoPaths.push(ctoPath);
                fs.writeFileSync(ctoPath, sourceCto, 'utf-8');
                const metamodelPath = (await tmp.file({ unsafeCleanup: true })).path;
                metamodelPaths.push(metamodelPath);
                const metamodel = Parser.parse(sourceCto);
                fs.writeFileSync(metamodelPath, JSON.stringify(metamodel, null, 2), 'utf-8');
            }
        });

        const tests = [
            { name: 'patch', release: 'patch', files: [
                {
                    expectedNamespace: 'org.accordproject.concerto.test.a@1.2.4',
                    expectedString: 'org.accordproject.concerto.test.b@2.3.5'
                },
                {
                    expectedNamespace: 'org.accordproject.concerto.test.b@2.3.5',
                    expectedString: 'org.accordproject.concerto.test.c@3.4.6'
                },
                {
                    expectedNamespace: 'org.accordproject.concerto.test.c@3.4.6'
                }
            ]},
            { name: 'minor', release: 'minor', files: [
                {
                    expectedNamespace: 'org.accordproject.concerto.test.a@1.3.0',
                    expectedString: 'org.accordproject.concerto.test.b@2.4.0'
                },
                {
                    expectedNamespace: 'org.accordproject.concerto.test.b@2.4.0',
                    expectedString: 'org.accordproject.concerto.test.c@3.5.0'
                },
                {
                    expectedNamespace: 'org.accordproject.concerto.test.c@3.5.0'
                }
            ]},
            { name: 'major', release: 'major', files: [
                {
                    expectedNamespace: 'org.accordproject.concerto.test.a@2.0.0',
                    expectedString: 'org.accordproject.concerto.test.b@3.0.0'
                },
                {
                    expectedNamespace: 'org.accordproject.concerto.test.b@3.0.0',
                    expectedString: 'org.accordproject.concerto.test.c@4.0.0'
                },
                {
                    expectedNamespace: 'org.accordproject.concerto.test.c@4.0.0'
                }
            ]},
            { name: 'explicit', release: '4.5.6', files: [
                {
                    expectedNamespace: 'org.accordproject.concerto.test.a@4.5.6',
                    expectedString: 'org.accordproject.concerto.test.b@4.5.6'
                },
                {
                    expectedNamespace: 'org.accordproject.concerto.test.b@4.5.6',
                    expectedString: 'org.accordproject.concerto.test.c@4.5.6'
                },
                {
                    expectedNamespace: 'org.accordproject.concerto.test.c@4.5.6'
                }
            ]},
            { name: 'prerelease', release: '5.6.7-pr.3472381', files: [
                {
                    expectedNamespace: 'org.accordproject.concerto.test.a@5.6.7-pr.3472381',
                    expectedString: 'org.accordproject.concerto.test.b@5.6.7-pr.3472381'
                },
                {
                    expectedNamespace: 'org.accordproject.concerto.test.b@5.6.7-pr.3472381',
                    expectedString: 'org.accordproject.concerto.test.c@5.6.7-pr.3472381'
                },
                {
                    expectedNamespace: 'org.accordproject.concerto.test.c@5.6.7-pr.3472381'
                }
            ]},
        ];

        tests.forEach(({ name, release, files }) => {

            it(`should patch bump a cto file [${name}]`, async () => {
                await Commands.version(release, ctoPaths);
                for (const [i, file] of files.entries()) {
                    const { expectedNamespace, expectedString } = file;
                    const cto = fs.readFileSync(ctoPaths[i], 'utf-8');
                    if (expectedString) {
                        cto.should.contain(expectedString);
                    }
                    const metamodel = Parser.parse(cto);
                    metamodel.namespace.should.equal(expectedNamespace);
                }
            });

            it(`should patch bump a metamodel file [${name}]`, async () => {
                await Commands.version(release, metamodelPaths);
                for (const [i, file] of files.entries()) {
                    const { expectedNamespace, expectedString } = file;
                    const data = fs.readFileSync(metamodelPaths[i], 'utf-8');
                    if (expectedString) {
                        data.should.contain(expectedString);
                    }
                    const metamodel = JSON.parse(data);
                    metamodel.namespace.should.equal(expectedNamespace);
                }
            });
        });

    });

    describe('#compare', async () => {
        let processExitStub;

        beforeEach(() => {
            processExitStub = sinon.stub(process, 'exit');
        });

        it('should compare two cto models that require a major change', async () => {
            const aPath = path.resolve(__dirname, 'models', 'compare-a.cto');
            const bPath = path.resolve(__dirname, 'models', 'compare-b.cto');
            await Commands.compare(aPath, bPath);
        });

        it('should compare two cto models that require a minor/patch change', async () => {
            const bPath = path.resolve(__dirname, 'models', 'compare-b.cto');
            const cPath = path.resolve(__dirname, 'models', 'compare-c.cto');
            await Commands.compare(bPath, cPath);
        });

        it('should compare two cto models that have no changes', async () => {
            const aPath = path.resolve(__dirname, 'models', 'compare-a.cto');
            await Commands.compare(aPath, aPath);
        });

        it('should compare two cto models that have a namespace change', async () => {
            const aPath = path.resolve(__dirname, 'models', 'compare-a.cto');
            const bPath = path.resolve(__dirname, 'models', 'compare-a-badns.cto');
            await Commands.compare(aPath, bPath);
            processExitStub.should.have.been.calledWith(1);
        });

        it('should compare two json models that require a major change', async () => {
            const aPath = path.resolve(__dirname, 'models', 'compare-a.json');
            const bPath = path.resolve(__dirname, 'models', 'compare-b.json');
            await Commands.compare(aPath, bPath);
        });

        it('should compare two json models that require a minor/patch change', async () => {
            const bPath = path.resolve(__dirname, 'models', 'compare-b.json');
            const cPath = path.resolve(__dirname, 'models', 'compare-c.json');
            await Commands.compare(bPath, cPath);
        });

        it('should compare two json models that have no changes', async () => {
            const aPath = path.resolve(__dirname, 'models', 'compare-a.json');
            await Commands.compare(aPath, aPath);
        });

        it('should compare two json models that have a namespace change', async () => {
            const aPath = path.resolve(__dirname, 'models', 'compare-a.json');
            const bPath = path.resolve(__dirname, 'models', 'compare-a-badns.json');
            await Commands.compare(aPath, bPath);
            processExitStub.should.have.been.calledWith(1);
        });
    });

    describe('#infer', async () => {
        it('should infer a Concerto model from a JSON Schema', async () => {
            const obj = await Commands.inferConcertoSchema(
                path.resolve(__dirname, 'models/jsonschema.json'),
                'concerto.test.jsonSchema',
            );
            obj.should.equal(`namespace concerto.test.jsonSchema

concept Root {
   o String name optional
   o Root[] children optional
}

`);
        });

        it('should infer a Concerto model from an Open API Spec', async () => {
            const obj = await Commands.inferConcertoSchema(
                path.resolve(__dirname, 'models/petstore.json'),
                'petstore',
                'Root',
                'openapi'
            );
            obj.should.equal(`namespace petstore

concept Pet {
   o NewPet pet optional
}

concept NewPet {
   o String name
   o String tag optional
}

concept ErrorModel {
   o Integer code
   o String message
}

`);
        });
    });


    describe('#generate', async () => {
        it('should generate an object, including metamodel', async () => {
            const obj = await Commands.generate(
                offlineModels,
                'org.accordproject.money.MonetaryAmount',
                'sample',
                { offline: true, optionalFields: true, metamodel: true }
            );
            obj.$class.should.equal('org.accordproject.money.MonetaryAmount');
            (typeof obj.currencyCode).should.equal('string');
            (typeof obj.doubleValue).should.equal('number');
        });

        it('should generate an object', async () => {
            const obj = await Commands.generate(
                offlineModels,
                'org.accordproject.money.MonetaryAmount',
                'sample',
                { offline: true, optionalFields: true }
            );
            obj.$class.should.equal('org.accordproject.money.MonetaryAmount');
            (typeof obj.currencyCode).should.equal('string');
            (typeof obj.doubleValue).should.equal('number');
        });

        it('should generate an identified object', async () => {
            const obj = await Commands.generate(
                offlineModels,
                'org.accordproject.cicero.dom.ContractTemplate',
                'sample',
                { offline: true, optionalFields: true }
            );
            obj.$class.should.equal('org.accordproject.cicero.dom.ContractTemplate');
            Object.keys(obj).should.eql(['$class', 'metadata', 'content', 'id', '$identifier']);
        });
    });
});
