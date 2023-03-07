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
const { assert } = chai;
const fs = require('fs');
const path = require('path');
const Printer = require('@accordproject/concerto-cto').Printer;

const JsonSchemaVisitor = require(
    '../../../../lib/codegen/fromJsonSchema/cto/jsonSchemaVisitor'
);
const { JsonSchemaModel } = require(
    '../../../../lib/codegen/fromJsonSchema/cto/jsonSchemaClasses'
);

const jsonSchemaVisitor = new JsonSchemaVisitor();
const jsonSchemaVisitorParameters = {
    metaModelNamespace: 'concerto.metamodel@1.0.0',
    namespace: 'com.test@1.0.0',
};

describe('JsonSchemaVisitor', () => {
    it(
        'should generate a Concerto JSON and CTO from a JSON schema',
        async () => {
            const jsonSchemaModel = JSON.parse(
                fs.readFileSync(
                    path.resolve(
                        __dirname, '../cto/data/jsonSchemaModel.json'
                    ), 'utf8'
                )
            );
            const desiredConcertoJsonModelString = fs.readFileSync(
                path.resolve(
                    __dirname, '../cto/data/concertoJsonModel.json'
                ), 'utf8'
            );
            const desiredConcertoModel = fs.readFileSync(
                path.resolve(
                    __dirname, '../cto/data/concertoModel.cto'
                ), 'utf8'
            );

            const jsonSchemaModelClass = new JsonSchemaModel(jsonSchemaModel);

            const inferredConcertoJsonModel = jsonSchemaModelClass.accept(
                jsonSchemaVisitor, jsonSchemaVisitorParameters
            );

            const inferredConcertoModel = Printer.toCTO(
                inferredConcertoJsonModel.models[0]
            );

            assert.equal(
                JSON.stringify(inferredConcertoJsonModel, null, 4) + '\n',
                desiredConcertoJsonModelString
            );

            assert.equal(
                inferredConcertoModel + '\n',
                desiredConcertoModel
            );
        });

    it('should not generate when unsupported type keywords are used', async () => {
        (function () {
            const jsonSchemaModelClass = new JsonSchemaModel({
                $schema: 'http://json-schema.org/draft-07/schema#',
                type: 'object',
                properties: {
                    Foo: { type: 'bar' }
                }
            });

            jsonSchemaModelClass.accept(
                jsonSchemaVisitor, jsonSchemaVisitorParameters
            );
        }).should.throw('schema is invalid: data/properties/Foo/type must be equal to one of the allowed values, data/properties/Foo/type must be array, data/properties/Foo/type must match a schema in anyOf');
    });

    it('should generate for a simple definition', async () => {
        const inferredConcertoJsonModel = JsonSchemaVisitor
            .parse({
                $schema: 'http://json-schema.org/draft-07/schema#',
                enum: ['one', 'two']
            })
            .accept(
                jsonSchemaVisitor, jsonSchemaVisitorParameters
            );

        const inferredConcertoModel = Printer.toCTO(
            inferredConcertoJsonModel.models[0]
        );

        inferredConcertoModel.should.equal(`namespace com.test@1.0.0

enum Root {
  o one
  o two
}`);
    });

    it('should generate for a simple array definition', async () => {
        const inferredConcertoJsonModel = JsonSchemaVisitor
            .parse({
                $schema: 'http://json-schema.org/draft-07/schema#',
                type: 'object',
                properties: {
                    xs: {
                        type: 'array',
                        items: {
                            enum: ['one', 'two', 3]
                        }
                    }
                }
            })
            .accept(
                jsonSchemaVisitor, jsonSchemaVisitorParameters
            );

        const inferredConcertoModel = Printer.toCTO(
            inferredConcertoJsonModel.models[0]
        );

        inferredConcertoModel.should.equal(`namespace com.test@1.0.0

concept Root {
  o Root$_properties$_xs[] xs optional
}

enum Root$_properties$_xs {
  o one
  o two
  o _3
}`);
    });

    it('should generate for a recursive definition', async () => {
        const inferredConcertoJsonModel = JsonSchemaVisitor
            .parse({
                'type': 'object',
                'properties': {
                    'name': { 'type': 'string' },
                    'children': {
                        'type': 'array',
                        'items': { '$ref': '#' }
                    }
                }
            })
            .accept(
                jsonSchemaVisitor, jsonSchemaVisitorParameters
            );

        const inferredConcertoModel = Printer.toCTO(
            inferredConcertoJsonModel.models[0]
        );

        inferredConcertoModel.should.equal(`namespace com.test@1.0.0

concept Root {
  o String name optional
  o Root[] children optional
}`);
    });

    it('should generate Concerto for for a schema that uses the 2020 draft', async () => {
        const schema = JSON.parse(
            fs.readFileSync(
                path.resolve(__dirname, '../cto/data/2020-schema.json'), 'utf8'
            )
        );

        const inferredConcertoJsonModel = JsonSchemaVisitor
            .parse(schema)
            .accept(
                jsonSchemaVisitor,
                {
                    ...jsonSchemaVisitorParameters,
                    pathToDefinitions: ['$defs']
                }
            );

        const inferredConcertoModel = Printer.toCTO(
            inferredConcertoJsonModel.models[0]
        );

        inferredConcertoModel.should.equal(`namespace com.test@1.0.0

concept arrays {
  o String[] fruits optional
  o veggie[] vegetables optional
}

concept veggie {
  o String veggieName
  o Boolean veggieLike
}`);
    });

    it('should generate Concerto for for a schema that property modifiers', async () => {
        const schema = JSON.parse(
            fs.readFileSync(
                path.resolve(__dirname, '../cto/data/modifiers-schema.json'),
                'utf8'
            )
        );

        const inferredConcertoJsonModel = JsonSchemaVisitor
            .parse(schema)
            .accept(
                jsonSchemaVisitor,
                {
                    ...jsonSchemaVisitorParameters,
                    pathToDefinitions: ['$defs']
                }
            );

        const inferredConcertoModel = Printer.toCTO(
            inferredConcertoJsonModel.models[0]
        );

        inferredConcertoModel.should.equal(`namespace com.test@1.0.0

concept geographical_location {
  o String name default="home" regex=/[\\w\\s]+/ optional
  o Double latitude
  o Double longitude range=[-180,180]
  o Double elevation range=[-11034,] optional
  o Integer yearDiscovered range=[,2022] optional
}`);
    });

    it('should not generate for a simple definition with an unsupported type', async () => {
        (
            () => JsonSchemaVisitor
                .parse({
                    $schema: 'http://json-schema.org/draft-07/schema#',
                    type: 'object',
                    properties: {
                        foo: {
                            const: 'value'
                        }
                    }
                })
                .accept(
                    jsonSchemaVisitor, { ...jsonSchemaVisitorParameters }
                )
        ).should.throw(
            'Type keyword \'undefined\' in \'foo\' is not supported.'
        );
    });

    it(
        'should generate when additionalProperties are allowed',
        async () => {
            const inferredConcertoJsonModel = JsonSchemaVisitor
                .parse({
                    $schema: 'http://json-schema.org/draft-07/schema#',
                    definitions: {
                        Foo: {
                            type: 'object',
                            properties: {},
                            additionalProperties: true,
                        }
                    }
                })
                .accept(
                    jsonSchemaVisitor, { ...jsonSchemaVisitorParameters }
                );

            const inferredConcertoModel = Printer.toCTO(
                inferredConcertoJsonModel.models[0]
            );

            console.log(inferredConcertoModel);

            inferredConcertoModel.should.equal(`namespace com.test@1.0.0

@StringifiedJson
scalar Foo extends String`);
        }
    );

    it('should quietly accept unsupported formats', async () => {
        const inferredConcertoJsonModel = JsonSchemaVisitor
            .parse({
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
            })
            .accept(
                jsonSchemaVisitor, { ...jsonSchemaVisitorParameters }
            );

        const inferredConcertoModel = Printer.toCTO(
            inferredConcertoJsonModel.models[0]
        );

        inferredConcertoModel.should.equal(`namespace com.test@1.0.0

concept Foo {
  o String email optional
}`);
    });

    it('should not generate when unsupported type keywords are used', async () => {
        (
            () => JsonSchemaVisitor
                .parse({
                    $schema: 'http://json-schema.org/draft-07/schema#',
                    definitions: {
                        Foo: {
                            type: 'null',
                        }
                    }
                })
                .accept(
                    jsonSchemaVisitor, { ...jsonSchemaVisitorParameters }
                )
        ).should.throw(
            'Type keyword \'null\' in definition \'Foo\' is not supported.'
        );
    });

    it(
        'should not generate when unsupported type keywords are used in an object',
        async () => {
            (
                () => JsonSchemaVisitor
                    .parse({
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
                    })
                    .accept(
                        jsonSchemaVisitor,
                        { ...jsonSchemaVisitorParameters }
                    )
            ).should.throw(
                'Type keyword \'null\' in \'email\' is not supported.'
            );
        }
    );

    it('should quietly accept array definitions', async () => {
        const inferredConcertoJsonModel = JsonSchemaVisitor
            .parse({
                type: 'array'
            })
            .accept(
                jsonSchemaVisitor, { ...jsonSchemaVisitorParameters }
            );

        const inferredConcertoModel = Printer.toCTO(
            inferredConcertoJsonModel.models[0]
        );

        inferredConcertoModel.should.equal('namespace com.test@1.0.0');
    });

    it('should quietly accept unsupported definitions', async () => {
        const inferredConcertoJsonModel = JsonSchemaVisitor
            .parse({
                'allOf': [
                    { 'type': 'string' }
                ]
            })
            .accept(
                jsonSchemaVisitor, { ...jsonSchemaVisitorParameters }
            );

        const inferredConcertoModel = Printer.toCTO(
            inferredConcertoJsonModel.models[0]
        );

        inferredConcertoModel.should.equal('namespace com.test@1.0.0');
    });
});
