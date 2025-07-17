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
const path = require('path');
const yaml = require('yaml');

const chai = require('chai');
chai.should();

const { jsonToYaml } = require('../lib/dcsconverter');

describe('DCS Converter', function(){

    describe('#jsonToYaml', function(){
        const dcsFilePath = path.resolve(__dirname, 'data/decoratorcommands/possible-decorator-command-targets.json' );
        const dcsJson = fs.readFileSync(dcsFilePath, 'utf8');

        it('should convert DCS JSON to expected YAML format', function(){
            const outputYaml = jsonToYaml(JSON.parse(dcsJson));
            const parsedYaml = yaml.parse(outputYaml);
            const expectedYaml = fs.readFileSync(path.resolve(__dirname, 'data/decoratorcommands/possible-decorator-command-targets.yaml'), 'utf8');
            const parsedExpectedYaml = yaml.parse(expectedYaml);
            parsedYaml.should.deep.equal(parsedExpectedYaml);
            outputYaml.should.equal(expectedYaml);
        });

        it('should handle DecoratorTypeReference properly', function(){
            const dcsWithTypeReference = `{
                "$class": "org.accordproject.decoratorcommands@0.4.0.DecoratorCommandSet",
                "name": "exampleDCS",
                "version": "1.0.0",
                "commands": [
                    {
                        "type": "UPSERT",
                        "target": {
                            "$class": "org.accordproject.decoratorcommands@0.4.0.CommandTarget",
                            "namespace": "test@1.0.0"
                        },
                        "decorator": {
                            "name": "exampleDecorator",
                            "arguments": [
                                {
                                    "$class": "concerto.metamodel@1.0.0.DecoratorTypeReference",
                                    "type": {
                                        "name": "Info",
                                        "namespace": "test@1.0.0"
                                    },
                                    "isArray": false
                                }
                            ]
                        }
                    }
                ]
            }`;

            const expectedYaml =
`decoratorCommandsVersion: 0.4.0
name: exampleDCS
version: 1.0.0
commands:
  - action: UPSERT
    target:
      namespace: test@1.0.0
    decorator:
      name: exampleDecorator
      arguments:
        - typeReference:
            name: Info
            namespace: test@1.0.0
            isArray: false
`;

            const outputYaml = jsonToYaml(JSON.parse(dcsWithTypeReference));
            const parsedYaml = yaml.parse(outputYaml);
            const parsedExpectedYaml = yaml.parse(expectedYaml);
            parsedYaml.should.deep.equal(parsedExpectedYaml);
            outputYaml.should.equal(expectedYaml);
        });

    });

});