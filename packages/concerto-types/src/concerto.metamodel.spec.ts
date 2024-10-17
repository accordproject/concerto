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
import { ModelManager, ModelFile, Concerto } from '@accordproject/concerto-core';
const { MetaModelUtil, MetaModelNamespace } = require('@accordproject/concerto-metamodel');
import { createGenerator } from "ts-json-schema-generator";
import Ajv from "ajv";
import path from "path";

test('Chained TypeScript and JSONSchema conversion respects inheritance when flattening subclasses to a union type', () => {

    // TS to JSON Schema conversion
    const config = {
        path: path.resolve('../src/generated/union/concerto-metamodel@1.0.0.ts'),
        tsconfig: path.resolve('../concerto-types/tsconfig.json'),
        type: 'IDecorator',
    }
    const jsonSchema = createGenerator(config).createSchema(config.type);
    expect(jsonSchema).toMatchSnapshot();

    // Test instance
    const data = {
        $class: `concerto.metamodel@1.0.0.Decorator`,
        name: 'displayName',
        arguments: [
            {
                value: 'Account ID',
                $class: `concerto.metamodel@1.0.0.DecoratorString`,
            }
        ],
    }

    // Validate the instance with Ajv, a JSON Schema validator
    const ajv = new Ajv()
    const validate = ajv.compile(jsonSchema)
    const valid = validate(data)
    expect(validate.errors).toBeNull();

    // Validate the instance with Concerto
    const modelManager = new ModelManager();
    modelManager.addModelFile(new ModelFile(modelManager, MetaModelUtil.metaModelAst, undefined, MetaModelNamespace));
    const concerto = new Concerto(modelManager);
    expect(() => concerto.validate(data)).not.toThrow();
});
