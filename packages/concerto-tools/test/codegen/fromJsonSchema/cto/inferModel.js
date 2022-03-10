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

    it('should generate Concerto for complex model', async () => {
        const example = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../cto/data/example.json'), 'utf8'));
        const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../cto/data/schema.json'), 'utf8'));
        const expectedCto = fs.readFileSync(path.resolve(__dirname, '../cto/data/full.cto'), 'utf8');
        const cto = inferModel('org.acme', 'Root', schema);
        cto.should.equal(expectedCto);

        const ajv = new Ajv({ strict: true })
            .addMetaSchema(draft6MetaSchema);
        addFormats(ajv);

        const mm = new ModelManager();
        mm.addCTOFile(cto, undefined, true);
        await mm.updateExternalModels();
        mm.validateModelFiles();

        // Validate the example instance against the JSON Schema
        const validate = ajv.compile(schema);
        validate(example).should.not.throw;

        // Validate the sample example instance against the CTO model
        const concerto = new Concerto(mm);
        concerto.validate(example);

    });

    it('should generate for a simple definition', async () => {
        const cto = inferModel('org.acme', 'Root', {
            $schema: 'http://json-schema.org/draft-07/schema#',
            enum: ['one', 'two']
        });
        cto.should.equal(`namespace org.acme

import org.accordproject.time.* from https://models.accordproject.org/time@0.2.0.cto

enum Root {
   o one
   o two
}

`);
    });

    it('should generate for a simple array definition', async () => {
        const cto = inferModel('org.acme', 'Root', {
            $schema: 'http://json-schema.org/draft-07/schema#',
            type: 'object',
            properties: {
                xs: {
                    type: 'array',
                    items: {
                        enum: ['one', 'two']
                    }
                }
            }
        });
        // TODO This is not a valid CTO model, because we don't generate definitions for inline sub-schemas.
        cto.should.equal(`namespace org.acme

import org.accordproject.time.* from https://models.accordproject.org/time@0.2.0.cto

concept Root {
   o Xs[] xs optional
}

`);
    });

    it('should generate for a recursive definition', async () => {
        const cto = inferModel('org.acme', 'Root', {
            'type': 'object',
            'properties': {
                'name': { 'type': 'string' },
                'children': {
                    'type': 'array',
                    'items': { '$ref': '#' }
                }
            }
        }
        );
        cto.should.equal(`namespace org.acme

import org.accordproject.time.* from https://models.accordproject.org/time@0.2.0.cto

concept Root {
   o String name optional
   o Root[] children optional
}

`);
    });

    it('should generate Concerto for for a schema that uses the 2020 draft', async () => {
        const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../cto/data/2020-schema.json'), 'utf8'));
        const cto = inferModel('org.acme', 'Root', schema);
        cto.should.equal(`namespace com.example

import org.accordproject.time.* from https://models.accordproject.org/time@0.2.0.cto

concept Veggie {
   o String veggieName
   o Boolean veggieLike
}

concept Arrays {
   o String[] fruits optional
   o Veggie[] vegetables optional
}

`);
    });

    it('should generate Concerto for for a schema that property modifiers', async () => {
        const schema = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../cto/data/modifiers-schema.json'), 'utf8'));
        const cto = inferModel('org.acme', 'Root', schema);
        cto.should.equal(`namespace com.example

import org.accordproject.time.* from https://models.accordproject.org/time@0.2.0.cto

concept Geographical_location {
   o String name default="home" regex=/[\\w\\s]+/ optional
   o Double latitude
   o Double longitude range=[-180,180]
   o Double elevation range=[-11034,] optional
   o Integer yearDiscovered range=[,2022] optional
}

`);
    });


    it('should not generate for a simple definition with an unsupported type', async () => {
        (function () {
            inferModel('org.acme', 'Root', {
                $schema: 'http://json-schema.org/draft-07/schema#',
                type: 'object',
                properties: {
                    foo: {
                        const: 'value'
                    }
                }
            });
        }).should.throw('Unsupported definition: {"const":"value"}');
    });

    it('should not generate when additionalProperties are allowed', async () => {
        (function () {
            inferModel('org.acme', 'Root', {
                $schema: 'http://json-schema.org/draft-07/schema#',
                definitions: {
                    Foo: {
                        type: 'object',
                        properties: {},
                        additionalProperties: true,
                    }
                }
            });
        }).should.throw('\'additionalProperties\' are not supported in Concerto');
    });

    it('should not generate when unsupported formats are used', async () => {
        (function () {
            inferModel('org.acme', 'Root', {
                $schema: 'http://json-schema.org/draft-07/schema#',
                definitions: {
                    Foo: {
                        type: 'object',
                        properties: {
                            email: {
                                type: 'string',
                                format: 'email'
                            }
                        }
                    }
                }
            });
        }).should.throw('Format \'email\' in \'email\' is not supported');
    });

    it('should not generate when unsupported type keywords are used', async () => {
        (function () {
            inferModel('org.acme', 'Root', {
                $schema: 'http://json-schema.org/draft-07/schema#',
                definitions: {
                    Foo: {
                        type: 'null',
                    }
                }
            });
        }).should.throw('Type keyword \'null\' in definition \'Foo\' not supported.');
    });

    it('should not generate when unsupported type keywords are used in an object', async () => {
        (function () {
            inferModel('org.acme', 'Root', {
                $schema: 'http://json-schema.org/draft-07/schema#',
                definitions: {
                    Foo: {
                        type: 'object',
                        properties: {
                            email: {
                                type: 'null',
                            }
                        }
                    }
                }
            });
        }).should.throw('Type keyword \'null\' in \'email\' is not supported');
    });

    it('should not generate when unsupported definitions', async () => {
        (function () {
            inferModel('org.acme', 'Root', {
                'allOf': [
                    { 'type': 'string' }
                ]
            });
        }).should.throw('Keyword(s) \'allOf\' in definition \'Root\' not supported.');
    });
});