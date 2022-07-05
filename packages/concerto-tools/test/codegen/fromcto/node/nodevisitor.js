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

const NodeVisitor = require('../../../../lib/codegen/fromcto/node/nodevisitor.js');

const { ModelManager } = require('@accordproject/concerto-core');
const {FileWriter} = require('@accordproject/concerto-util');
const fs = require('fs');
const glob = require('glob');
const path = require('path');
const rimraf = require('rimraf');
const ts = require('typescript');

const chai = require('chai');
chai.should();

describe('TypescriptVisitor', function () {
    // The TypeScript compiler is slow.
    this.timeout(60000);

    let modelManager;
    let outputDirectory;
    let compiledDirectory;
    let fileWriter;
    let nodeVisitor;
    let generatedModule;

    before(() => {
        const modelFile = path.resolve(__dirname, 'model.cto');
        const model = fs.readFileSync(modelFile, 'utf-8');
        modelManager = new ModelManager();
        modelManager.addCTOModel(model, modelFile);
        outputDirectory = path.resolve(__dirname, 'data', 'output');
        rimraf.sync(outputDirectory);
        compiledDirectory = path.resolve(__dirname, 'data', 'compiled');
        rimraf.sync(compiledDirectory);
        fileWriter = new FileWriter(outputDirectory);
        nodeVisitor = new NodeVisitor();
        modelManager.accept(nodeVisitor, { fileWriter });
        const typescriptFiles = glob.sync('**/*.ts', {
            absolute: true,
            cwd: outputDirectory
        });
        typescriptFiles.should.have.lengthOf(2);
        const program = ts.createProgram(typescriptFiles, {
            emitDecoratorMetadata: true,
            experimentalDecorators: true,
            module: ts.ModuleKind.CommonJS,
            outDir: compiledDirectory,
            strict: true,
            target: ts.ScriptTarget.ES2016
        });
        program.emit();
        generatedModule = require(compiledDirectory);
    });

    it('should create a basic class with serialization', () => {
        const { Basic } = generatedModule;
        const basic1 = new Basic({ value: 'hello, world'});
        const json = basic1.serialize();
        json.should.deep.equal({
            $class: 'org.accordproject.concerto.test@1.2.3.Basic',
            value: 'hello, world'
        });
    });

    it('should create a basic class with parsing from buffers', () => {
        const { Basic } = generatedModule;
        const basic = Basic.parse(Buffer.from(JSON.stringify({
            $class: 'org.accordproject.concerto.test@1.2.3.Basic',
            value: 'hello, world'
        })));
        basic.should.be.an.instanceOf(Basic);
        basic.value.should.equal('hello, world');
    });

    it('should create a basic class with parsing from strings', () => {
        const { Basic } = generatedModule;
        const basic = Basic.parse(JSON.stringify({
            $class: 'org.accordproject.concerto.test@1.2.3.Basic',
            value: 'hello, world'
        }));
        basic.should.be.an.instanceOf(Basic);
        basic.value.should.equal('hello, world');
    });

    it('should create a basic class with parsing from objects', () => {
        const { Basic } = generatedModule;
        const basic = Basic.parse({
            $class: 'org.accordproject.concerto.test@1.2.3.Basic',
            value: 'hello, world'
        });
        basic.should.be.an.instanceOf(Basic);
        basic.value.should.equal('hello, world');
    });

    it('should create a basic class with validation', () => {
        const { Basic } = generatedModule;
        const basic = new Basic({ value: 'hello, world' });
        basic.validate();
        delete basic.value;
        (() => basic.validate()).should.throw;
    });

    it('should handle all types/variations of strings', () => {
        const tests = [
            {
                data: {
                    string: 'hello, world',
                    stringArray: ['hello', 'world'],
                    regexString: '1234567890'
                },
                valid: true
            },
            {
                data: {
                    string: 'hello, world',
                    stringArray: ['hello', 'world'],
                    optionalString: 'optional',
                    regexString: '1234567890'
                },
                valid: true
            },
            {
                data: {
                    string: true, // should be a string
                    stringArray: ['hello', 'world'],
                    regexString: '1234567890'
                },
                valid: false
            },
            {
                data: {
                    string: 'hello, world',
                    stringArray: 'hello, world', // should be a string array
                    regexString: '1234567890'
                },
                valid: false
            },
            {
                data: {
                    string: 'hello, world',
                    stringArray: ['hello', 'world'],
                    regexString: 'oops' // should match the regex
                },
                valid: false
            }
        ];
        const { StringTypes } = generatedModule;
        for (const { data, valid} of tests) {
            const stringTypes = new StringTypes(data);
            if (valid) {
                stringTypes.validate();
            } else {
                (() => stringTypes.validate()).should.throw;
            }
        }
    });
});

