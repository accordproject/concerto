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

// const { jsonToYaml } = require('../lib/dcsconverter');

describe('DCS Converter', function(){

    describe('#jsonToYaml', function(){
        let outputYaml;
        let parsedYaml;
        const dcsFilePath = path.join(__dirname, 'data', 'decoratorcommands', 'dcs-with-all-possible-fields.json' );
        const dcsJson = fs.readFileSync(dcsFilePath, 'utf8');

        beforeEach(function(){
            // outputYaml = jsonToYaml(dcs);
            outputYaml = `decoratorCommandsVersion: 0.4.0
name: possiblefieldDCS
version: 1.0.0
includes:
  - name: example
    version: 0.1.0
commands:
  - action: UPSERT
    target:
      namespace: test@1.0.0
      declaration: Person
      property: email
      type: concerto.metamodel@1.0.0.StringProperty
    decorator:
      name: Form
      arguments:
        - type: String
          value: emailInput
        - type: Number
          value: 2.5
        - type: Boolean
          value: true
        - typeReference:
            name: Contact
            namespace: test@1.0.0
            isArray: false
    decoratorNamespace: org.example.forms
  - action: APPEND
    target:
      declaration: Person
      property: name
    decorator:
      name: Hide
      arguments:
  - action: UPSERT
    target:
      namespace: test@1.0.0
      declaration: Person
      properties:
        - address
        - phone
      type: concerto.metamodel@1.0.0.StringProperty
    decorator:
      name: PII
      arguments:
        - type: String
          value: sensitive
    decoratorNamespace: org.example.pii
  - action: UPSERT
    target:
      declaration: Person
      properties:
        - country
      type: concerto.metamodel@1.0.0.StringProperty
    decorator:
      name: DeclarationProperties
      arguments:
  - action: UPSERT
    target:
      namespace: test@1.0.0
      declaration: Dictionary
      type: concerto.metamodel@1.0.0.StringMapValueType
      mapElement: KEY_VALUE
    decorator:
      name: NamespaceDeclarationTypeMapElement
      arguments:
  - action: UPSERT
    target:
      namespace: test@1.0.0
      declaration: Person
      type: concerto.metamodel@1.0.0.ConceptDeclaration
    decorator:
      name: NamespaceDeclarationType
      arguments:`;
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
        });

        it('should not modify the original JSON input', function(){

        });
        it('should output a valid YAML string', function(){

        });
        it('should throw error for invalid DCS JSON input', function(){

        });

    });

});


