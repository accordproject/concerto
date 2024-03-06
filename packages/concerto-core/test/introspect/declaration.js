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

const Declaration = require('../../src/introspect/declaration');
const ModelFile = require('../../src/introspect/modelfile');

require('chai').should();
const sinon = require('sinon');

describe('Declaration', () => {

    let modelFile;

    beforeEach(() => {
        modelFile = sinon.createStubInstance(ModelFile);
    });

    describe('#constructor', () => {

        it('should throw if model file not specified', () => {
            (() => {
                new Declaration(null);
            }).should.throw(/ModelFile not specified/);
        });

        it('should throw if ast not specified', () => {
            (() => {
                new Declaration(modelFile, null);
            }).should.throw(/ast not specified/);
        });
    });
});
