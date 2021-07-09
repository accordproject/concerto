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
chai.should();
const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');
const draft6MetaSchema = require('ajv/dist/refs/json-schema-draft-06.json');
const addFormats = require('ajv-formats');
const ModelManager = require('@accordproject/concerto-core').ModelManager;
const Concerto = require('@accordproject/concerto-core').Concerto;

const inferModel = require('../../../../lib/codegen/fromJsonSchema/cto/inferModel.js');

describe('inferModel', function () {
    beforeEach(() => {
    });

    it('should generate Concerto', async () => {
        const example = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../cto/data/example.json'), 'utf8'));
        const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../cto/data/schema.json'), 'utf8'));
        const expectedCto = fs.readFileSync(path.resolve(__dirname, '../cto/data/full.cto'), 'utf8');
        const cto = inferModel('org.acme', 'Root', schema);
        // console.log(cto);
        // console.log(expectedCto);
        cto.should.equal(expectedCto);

        const ajv = new Ajv({ strict: true })
            .addMetaSchema(draft6MetaSchema);
        addFormats(ajv);

        const mm = new ModelManager();
        mm.addModelFile(cto, undefined, true);
        await mm.updateExternalModels();
        mm.validateModelFiles();

        // Validate the example instance against the JSON Schema
        const validate = ajv.compile(schema);
        validate(example).should.not.throw;

        // Validate the sample example instance against the CTO model
        const concerto = new Concerto(mm);
        concerto.validate(example);

    });
});