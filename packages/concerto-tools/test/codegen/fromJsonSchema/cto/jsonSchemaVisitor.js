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
const deepEqualInAnyOrder = require('deep-equal-in-any-order');
chai.should();
chai.use(deepEqualInAnyOrder);
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

describe('JsonSchemaVisitor', function () {
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
            const desiredConcertoJsonModel = JSON.parse(
                desiredConcertoJsonModelString
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

            // @ts-ignore
            assert.deepEqualInAnyOrder(
                inferredConcertoJsonModel, desiredConcertoJsonModel
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
        }).should.throw('Type keyword \'bar\' in \'Foo\' is not supported.');
    });
});
