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

const Declaration = require('../../lib/introspect/declaration');
const ModelFile = require('../../lib/introspect/modelfile');

require('chai').should();
const should = require('chai').should();
const sinon = require('sinon');

describe('Declaration', () => {

    let modelFile;
    let declaration;

    beforeEach(() => {
        modelFile = sinon.createStubInstance(ModelFile);
        declaration = new Declaration(modelFile, { ast: true });
    });

    describe('#constructor', () => {

        it('should throw if ast not specified', () => {
            (() => {
                new Declaration(null);
            }).should.throw(/ast not specified/);
        });

    });

    describe('#isIdentified', () => {
        it('should be false', () => {
            declaration.isIdentified().should.equal(false);
        });
    });

    describe('#isMapDeclaration', () => {
        it('should be false', () => {
            declaration.isMapDeclaration().should.equal(false);
        });
    });

    describe('#isSystemIdentified', () => {
        it('should be false', () => {
            declaration.isSystemIdentified().should.equal(false);
        });
    });

    describe('#getIdentifierFieldName', () => {
        it('should be null', () => {
            should.equal(declaration.getIdentifierFieldName(), null);
        });
    });

    describe('#getType', () => {
        it('should be null', () => {
            should.equal(declaration.getType(), null);
        });
    });

    describe('#toString', () => {
        it('should be null', () => {
            should.equal(declaration.toString(), null);
        });
    });
});
