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
const sinon = require('sinon');
const pkgJSON = require('../../package.json');

const chai = require('chai');
chai.should();
chai.use(require('chai-things'));

describe('ModelFile', () => {

    const versionMissing = fs.readFileSync(path.resolve(__dirname, '../data/model/carlease.cto'), 'utf8');
    const versionValid = fs.readFileSync(path.resolve(__dirname, '../data/model/versionValid.cto'), 'utf8');
    const versionInvalid = fs.readFileSync(path.resolve(__dirname, '../data/model/versionInvalid.cto'), 'utf8');

    let modelManager;

    beforeEach(() => {
        modelManager = new ModelManager();
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('#concertoVersion', () => {

        it('should throw when concerto version is not compatible with model', () => {
            (() => {
                ParserUtil.newModelFile(modelManager, versionInvalid);
            }).should.throw(/ModelFile expects Concerto version/);
        });

        it('should return when concerto version is compatible with model', () => {
            let mf = ParserUtil.newModelFile(modelManager, versionValid);
            mf.getConcertoVersion().should.equal('>= 1.0.0');
        });

        it('should return when concerto version is compatible with model with a pre-release version', () => {
            const version = pkgJSON.version;
            const newVersion = `${version}-unittest.${new Date().getTime()}`;
            sinon.replace(pkgJSON, 'version', newVersion);
            let mf = ParserUtil.newModelFile(modelManager, versionValid);
            mf.getConcertoVersion().should.equal('>= 1.0.0');
        });

        it('should return when model has no concerto version range', () => {
            let mf = ParserUtil.newModelFile(modelManager, versionMissing);
            (mf.getConcertoVersion() === null).should.equal(true);
        });
    });
});
