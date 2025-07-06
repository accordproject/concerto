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
        let outputYaml; // the output YAML string returned from jsonToYaml function
        let parsedYaml; // the parsed object from outputYaml
        const dcsFilePath = path.join(__dirname, 'data', 'decoratorcommands', 'dcs-with-all-possible-fields.json' );
        const dcsJson = fs.readFileSync(dcsFilePath, 'utf8');

        beforeEach(function(){
            outputYaml = jsonToYaml(dcsJson); // jsonToYaml expects a JSON string
            parsedYaml = yaml.parse(outputYaml);
        });

        it('should extract decoratorCommandsVersion from $class', function(){
            outputYaml.should.include('decoratorCommandsVersion: 0.4.0');
            parsedYaml.should.have.property('decoratorCommandsVersion', '0.4.0');
        });

        it('should remove all $class fields in output', function(){
            // eslint-disable-next-line require-jsdoc
            function checkClassField(obj){
                if(Array.isArray(obj)){
                    obj.forEach(checkClassField);
                }
                else if(typeof obj === 'object' && obj!== null){
                    Object.keys(obj).should.not.include('$class');
                    Object.values(obj).forEach(checkClassField);
                }
            }
            checkClassField(parsedYaml);
        });

        it('should convert type to action key in output', function(){
            parsedYaml.commands.forEach((command)=>{
                command.should.have.property('action');
            });
        });

        it('should preserve all target fields except the $class', function(){
            const parsedDcsJson = JSON.parse(dcsJson);
            parsedDcsJson.commands.forEach((command, commandIndex)=>{
                const jsonTarget = command.target;
                const yamlTarget = parsedYaml.commands[commandIndex].target;

                Object.keys(jsonTarget).forEach((key)=>{
                    if(key !== '$class'){
                        yamlTarget.should.have.property(key);
                    }
                });
            });
        });

        it('should handle empty arguments as null (empty value)', function(){
            const parsedDcsJson = JSON.parse(dcsJson);
            parsedDcsJson.commands.forEach((command, commandIndex)=>{
                const jsonArguments = command.decorator.arguments;
                const yamlArguments = parsedYaml.commands[commandIndex].decorator.arguments;
                if(jsonArguments.length === 0 ){
                    (yamlArguments === null).should.be.true;
                }
            });
        });

        it('should extract type and value for all arguments type (String, Number, Boolean)', function(){
            const parsedDcsJson = JSON.parse(dcsJson);
            parsedDcsJson.commands.forEach((command, commandIndex)=>{
                const jsonArguments = command.decorator.arguments;
                const yamlArguments = parsedYaml.commands[commandIndex].decorator.arguments;

                jsonArguments.forEach((argument, argumentIndex)=>{
                    const yamlArgument = yamlArguments[argumentIndex];
                    if(argument.$class === 'concerto.metamodel@1.0.0.DecoratorString'){
                        yamlArgument.should.have.property('type', 'String');
                        yamlArgument.should.have.property('value', argument.value);
                    }
                    else if(argument.$class === 'concerto.metamodel@1.0.0.DecoratorNumber'){
                        yamlArgument.should.have.property('type', 'Number');
                        yamlArgument.should.have.property('value', argument.value);
                    }
                    else if(argument.$class === 'concerto.metamodel@1.0.0.DecoratorBoolean'){
                        yamlArgument.should.have.property('type', 'Boolean');
                        yamlArgument.should.have.property('value', argument.value);
                    }
                });
            });
        });

        it('should convert DecoratorTypeReference properly', function(){
            const parsedDcsJson = JSON.parse(dcsJson);
            parsedDcsJson.commands.forEach((command, commandIndex)=>{
                const jsonArguments = command.decorator.arguments;
                const yamlArguments = parsedYaml.commands[commandIndex].decorator.arguments;

                jsonArguments.forEach((argument, argumentIndex)=>{
                    const yamlArgument = yamlArguments[argumentIndex];
                    if(argument.$class === 'concerto.metamodel@1.0.0.DecoratorTypeReference'){
                        yamlArgument.should.have.property('typeReference').and.deep.equal({
                            name: argument.type.name,
                            namespace: argument.type.namespace,
                            isArray: argument.isArray});
                    }
                });
            });
        });

        it('should handle includes and decoratorNamespace fields properly', function(){
            const parsedDcsJson = JSON.parse(dcsJson);

            if(parsedDcsJson.includes){
                parsedYaml.should.have.property('includes');
                parsedYaml.includes.should.be.an('array');
            }

            parsedDcsJson.commands.forEach((command, commandIndex)=>{
                const yamlCommand = parsedYaml.commands[commandIndex];
                if (command.decoratorNamespace) {
                    yamlCommand.should.have.property('decoratorNamespace', command.decoratorNamespace);
                }
            });
        });

        it('should handle multiple commands in the input', function(){
            parsedYaml.should.have.property('commands');
            parsedYaml.commands.should.be.an('array');
            parsedYaml.commands.should.have.length((JSON.parse(dcsJson)).commands.length);
        });

        it('should be a pure function (same input produces same output)', function(){
            const inputDcsJson = fs.readFileSync(dcsFilePath, 'utf8');
            const outputYaml1 = jsonToYaml(inputDcsJson);
            const outputYaml2 = jsonToYaml(inputDcsJson);
            outputYaml1.should.equal(outputYaml2);
        });

        it('should output a valid YAML string', function(){
            outputYaml.should.be.a('string');
            (()=> yaml.parse(outputYaml)).should.not.throw();
        });

        it('should throw error for invalid DCS JSON input', function(){
            const invalidDcsJson = [
                null,
                undefined,
                '',
                'not a json string',
                '{"invalid": "dcsJson"}',
                '{"version": "1.0.0", "commands": []}',
                '{"name": "test", "commands": []}',
                '{"name": "test", "version": "1.0.0"}'
            ];
            invalidDcsJson.forEach((value)=>{
                (()=> jsonToYaml(value)).should.throw();
            });
        });

    });

});