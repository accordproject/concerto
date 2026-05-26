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

const { writeModelsToFileSystem } = require('../src/modelwriter');

const chai = require('chai');
chai.should();
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));
const tmp = require('tmp-promise');

describe('modelwriter', () => {
    describe('#writeModelsToFileSystem', () => {
        it('should write models to the file system', async () => {
            const input = JSON.parse(fs.readFileSync('./test/data/models.json', 'utf8'));
            const dir = await tmp.dir({ unsafeCleanup: true});
            writeModelsToFileSystem(input, dir.path);
            fs.readdirSync(dir.path).should.eql([
                '@external.cto',
                'internal.cto',
                'system.cto',
            ]);
            dir.cleanup();
        });

        it('should write models to the file system, without external models', async () => {
            const input = JSON.parse(fs.readFileSync('./test/data/models.json', 'utf8'));
            const dir = await tmp.dir({ unsafeCleanup: true});
            writeModelsToFileSystem(input, dir.path, {
                includeExternalModels: false
            });
            fs.readdirSync(dir.path).should.eql([
                'internal.cto',
                'system.cto',
            ]);
            dir.cleanup();
        });

        it('should throw an error if the path is not provided', async () => {
            (() => writeModelsToFileSystem(null)).should.throw('`path` is a required parameter of writeModelsToFileSystem');
        });
    });
});
