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
const FileWriter = require('../../../../lib/filewriter');
const ModelManager = require('@accordproject/concerto-core').ModelManager;
const LoopbackVisitor = require('../../../../lib/codegen/fromcto/loopback/loopbackvisitor');
const path = require('path');

require('chai').should();
const sinon = require('sinon');

describe('LoopbackVisitor with Circular Model', () => {

    let mockFileWriter;
    let modelManager;
    let visitor;

    let sandbox;

    [undefined, true, false].forEach((namespaces) => {

        describe(`namespaces = ${namespaces}`, () => {

            beforeEach(() => {
                mockFileWriter = sinon.createStubInstance(FileWriter);
                modelManager = new ModelManager();
                modelManager.addModelFile(fs.readFileSync(path.resolve(__dirname, '../data/model/circular.cto'), 'utf8'), 'model-base.cto');
                visitor = new LoopbackVisitor(namespaces);
                sandbox = sinon.sandbox.create();
            });

            afterEach(() => {
                sandbox.restore();
            });

            describe('#visit', () => {

                it('should generate Loopback model files for each type when given a model manager', () => {

                    // Visit all of the loaded model files and check that they were all generated
                    const schemas = modelManager.accept(visitor, { fileWriter: mockFileWriter });
                    schemas.length.should.equal(29);
                });

            });

        });
    });

});
