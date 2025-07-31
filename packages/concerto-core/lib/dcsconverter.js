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

const yaml = require('yaml');
const ModelUtil  = require('./modelutil');
const { MetaModelNamespace } = require('@accordproject/concerto-metamodel');

/**
 * handles the target field of a command
 * @param {object} target the value of target
 * @returns {object} the simplified target object
 * @private
 */
function handleTarget(target){
    const targetKeys = Object.keys(target);
    const newTarget = {};
    targetKeys.forEach((key) => {
        if (key !== '$class') {
            newTarget[key] = target[key];
        }
    });
    return newTarget;
}


/**
 * handles each arguments field in a decorator
 * @param {object} argument the argument object from the decorator
 * @param {string} argument.$class the class property of each argument
 * @param {boolean|string|number} [argument.value] the value of each argument
 * @param {object} [argument.type] the type identifier for type reference arguments
 * @param {boolean} [argument.isArray] whether the type reference is an array
 * @returns {object} simplified argument object
 * @private
 */
function handleArguments(argument){
    const mapClassToType = {
        [`${MetaModelNamespace}.DecoratorString`]: 'String',
        [`${MetaModelNamespace}.DecoratorNumber`]: 'Number',
        [`${MetaModelNamespace}.DecoratorBoolean`]: 'Boolean',
    };
    if (argument.$class.endsWith('TypeReference')) {
        return {
            typeReference: {
                name: argument.type.name,
                namespace: argument.type.namespace,
                resolvedName: argument.type.resolvedName,
                isArray: argument.isArray,
            }
        };
    }
    return {
        type: mapClassToType[argument.$class],
        value: argument.value,
    };
}

/**
 * handles the decorator field of a command
 * @param {object} decorator the original value of decorator from DCS JSON
 * @param {string} decorator.name the name of the decorator
 * @param {object[]} [decorator.arguments] the list of arguments
 * @returns {object} simplified decorator object with name and arguments
 * @private
 */
function handleDecorator(decorator){
    return {
        name: decorator.name,
        arguments: (decorator.arguments?.length === 0) ? undefined : decorator.arguments?.map(handleArguments)
        // empty arguments are just omitted in YAML
    };
}


/**
 * handles a single command by simplifying its structure
 * @param {object} command the command object from DCS JSON
 * @param {string} command.type the type of the command ('UPSERT' or 'APPEND')
 * @param {object} command.target the target to apply decorator to
 * @param {object} command.decorator the decorator to apply
 * @returns {object} simplified commands object
 * @private
 */
function handleCommands(command){
    return {
        action: command.type,
        target: handleTarget(command.target),
        decorator: handleDecorator(command.decorator)
    };
}

/**
 * converts DCS JSON to YAML string
 * @param {object} dcsJson the DCS JSON as parsed object
 * @returns {string} the DCS YAML string
 */
function jsonToYaml(dcsJson){
    const dcsNamespace = ModelUtil.getNamespace(dcsJson.$class);
    const simplifiedDcsJson = {
        decoratorCommandsVersion: ModelUtil.parseNamespace(dcsNamespace).version,
        name: dcsJson.name,
        version: dcsJson.version,
        commands: dcsJson.commands.map(handleCommands)
    };

    let yamlString = yaml.stringify(simplifiedDcsJson);

    // change stringified booleans, numbers (if present) to non stringified values
    yamlString = yamlString.replace(/: "(true|false)"/g, ': $1');
    yamlString = yamlString.replace(/: "(\d+(\.\d+)?)"/g, ': $1');

    return yamlString;
}


/**
 * handles each argument of the decorator
 * converts simplified argument objects back to full JSON representation
 * @param {string} MetaModelNamespace - the metamodel namespace
 * @param {object} argument - the simplified argument object
 * @param {string} [argument.type] - the argument type for primitive values
 * @param {*} [argument.value] - the argument value
 * @param {object} [argument.typeReference] - the type reference object for complex types
 * @returns {object} - the fully qualified argument object after restoring required fields
 * @private
 */
function restoreArguments(MetaModelNamespace, argument){
    const mapTypeToClass = {
        'String': `${MetaModelNamespace}.DecoratorString`,
        'Number': `${MetaModelNamespace}.DecoratorNumber`,
        'Boolean': `${MetaModelNamespace}.DecoratorBoolean`,
    };
    if ( Object.keys(argument)[0] === 'typeReference' ) {
        return {
            $class: ModelUtil.getFullyQualifiedName(MetaModelNamespace, 'DecoratorTypeReference'),
            type: {
                $class: ModelUtil.getFullyQualifiedName(MetaModelNamespace, 'TypeIdentifier'),
                name: argument.typeReference.name,
                ... ( argument.typeReference.namespace !== undefined ? { namespace: argument.typeReference.namespace } : {} ),
                ... ( argument.typeReference.resolvedName !== undefined ? { resolvedName: argument.typeReference.resolvedName } : {} ),
            },
            isArray: argument.typeReference.isArray
        };
    }
    return {
        $class: mapTypeToClass[argument.type],
        value: argument.type === 'String' ? String(argument.value) : argument.value  ,
    };
}


/**
 * handles the decorator of each command for yaml to json
 * @param {object} decorator - the decorator to convert
 * @returns {object} - the decorator object after restoring required fields
 * @private
 */
function restoreDecorator(decorator){
    return {
        $class: ModelUtil.getFullyQualifiedName(MetaModelNamespace, 'Decorator'),
        name: decorator.name,
        arguments: decorator.arguments ? decorator.arguments.map((argument) => restoreArguments(MetaModelNamespace, argument)) : [],
    };
}


/**
 * handles the command for yaml to json method
 * @param {string} dcsNamespace - the namespace of the DCS
 * @param {object} command - the command to convert
 * @returns {object} - the command object after restoring required fields
 * @private
 */
function restoreCommands(dcsNamespace, command){
    return {
        $class: ModelUtil.getFullyQualifiedName(dcsNamespace, 'Command'),
        type: command.action,
        target: {
            $class: ModelUtil.getFullyQualifiedName(dcsNamespace, 'CommandTarget'),
            ... command.target
        },
        decorator: restoreDecorator(command.decorator)
    };
}


/**
 * converts DCS YAML string to JSON format
 * @param {string} yamlString the YAML string to convert
 * @returns {object} the DCS JSON
 */
function yamlToJson(yamlString){
    const parsedJson = yaml.parse(yamlString);
    const dcsNamespace = 'org.accordproject.decoratorcommands@' + parsedJson.decoratorCommandsVersion;
    const dcsJson = {
        $class: ModelUtil.getFullyQualifiedName(dcsNamespace, 'DecoratorCommandSet'),
        name: parsedJson.name,
        version: parsedJson.version,
        commands: parsedJson.commands.map((command) => restoreCommands(dcsNamespace, command)),
    };

    return dcsJson;
}


module.exports = { jsonToYaml, yamlToJson };
