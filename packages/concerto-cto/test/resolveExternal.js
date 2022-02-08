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
const chai = require('chai');

// eslint-disable-next-line no-unused-vars
const should = chai.should();
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));

const { resolveExternal } = require('../lib/parserMain');

/**
 * Get the name and content of all cto files
 * @returns {*} an array of name/content tuples
 */
function getModelFiles() {
    const result = [];
    const files = fs.readdirSync('./test/external');

    files.forEach(function(file) {
        if(file.endsWith('.json')) {
            const model = JSON.parse(fs.readFileSync('./test/external/' + file, 'utf8'));
            const resolved = JSON.parse(fs.readFileSync('./test/external/' + file + '.resolved', 'utf8'));
            result.push({file, model, resolved});
        }
    });

    return result;
}

describe('#resolveExternal', () => {
    getModelFiles().forEach(({ file, model, resolved }) => {
        it(`Should resolve external models in ${file}`, async () => {
            const result = await resolveExternal(model, {}, null);
            // console.log(model);
            result.should.deep.equal(resolved);
        });
    });
});
