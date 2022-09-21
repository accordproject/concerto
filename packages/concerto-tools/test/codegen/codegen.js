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

const formats = require('../../lib/codegen/codegen.js').formats;
const { ModelManager } = require('@accordproject/concerto-core');
const fs = require('fs');

const chai = require('chai');
const { FileWriter } = require('@accordproject/concerto-util');
chai.should();
chai.use(require('chai-as-promised'));
chai.use(require('chai-things'));

describe.only('codegen', function () {

    let modelManager = null;

    beforeEach(() => {
        modelManager = new ModelManager();
        const cto = fs.readFileSync( './test/codegen/fromcto/data/model/hr.cto', 'utf-8');
        modelManager.addCTOModel(cto, 'hr.cto');
    });

    afterEach(() => {
    });

    describe('#formats', function() {
        it('check we can convert all formats to CTO', function() {
            Object.keys(formats).forEach( format => {
                const visitor = new formats[format];
                visitor.should.not.be.null;
                const parameters = {
                    fileWriter: new FileWriter(`./output/${format}`)
                };
                modelManager.accept(visitor, parameters);
            });
        });
    });
});