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

const ModelManager = require('../../src/modelmanager');
const ParserUtil = require('./parserutility');
const fs = require('fs');
const path = require('path');

require('chai').should();

describe('ModelFile type parsing', () => {

    const invalidModel = fs.readFileSync(path.resolve(__dirname, '../data/parser/types.cto'), 'utf8');

    let modelManager;

    beforeEach(() => {
        modelManager = new ModelManager();
    });

    afterEach(() => {
    });

    describe('#constructor', () => {

        it('should be valid', () => {
            const mf = ParserUtil.newModelFile(modelManager,invalidModel, 'types.cto');
            mf.validate();
        });

        it('should be invalid due to decimal default', () => {
            const model = `
            namespace org.acme@1.0.0

            concept Address {
                o Integer foo default=104.0
            }
            `;
            (() => {
                const mf = ParserUtil.newModelFile(modelManager, model, 'test.cto');
                mf.validate();
            }).should.throw();
        });

        it('should be invalid due to no decimal default', () => {
            const model = `
            namespace org.acme@1.0.0

            concept Address {
                o Double foo default=104
            }
            `;
            (() => {
                const mf = ParserUtil.newModelFile(modelManager, model, 'test.cto');
                mf.validate();
            }).should.throw();
        });

        it('should be invalid due to decimal range', () => {
            const model = `
            namespace org.acme@1.0.0

            concept Address {
                o Integer foo range=[0.1, 0.2]
            }
            `;
            (() => {
                const mf = ParserUtil.newModelFile(modelManager, model, 'test.cto');
                mf.validate();
            }).should.throw();
        });

        it('should be invalid due to decimal default', () => {
            const model = `
            namespace org.acme@1.0.0

            concept Address {
                o Integer foo default=104.0
            }
            `;
            (() => {
                const mf = ParserUtil.newModelFile(modelManager, model, 'test.cto');
                mf.validate();
            }).should.throw();
        });

        it('should be invalid due to no decimal range', () => {
            const model = `
            namespace org.acme@1.0.0

            concept Address {
                o Double foo range=[0, 1]
            }
            `;
            (() => {
                const mf = ParserUtil.newModelFile(modelManager, model, 'test.cto');
                mf.validate();
            }).should.throw();
        });
    });
});
