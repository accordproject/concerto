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

const { ModelUtil } = require('@accordproject/concerto-core');
const util = require('util');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const { ModelFile } = require('@accordproject/concerto-core');
}

/**
 * Convert the contents of a ModelManager to C# code. Set a
 * fileWriter property (instance of FileWriter) on the parameters
 * object to control where the generated code is written to disk.
 *
 * @private
 * @class
 * @memberof module:concerto-tools
 */
class CSharpVisitor {
    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     */
    visit(thing, parameters) {
        if (thing.isModelManager?.()) {
            return this.visitModelManager(thing, parameters);
        } else if (thing.isModelFile?.()) {
            return this.visitModelFile(thing, parameters);
        } else if (thing.isEnum?.()) {
            return this.visitEnumDeclaration(thing, parameters);
        } else if (thing.isClassDeclaration?.()) {
            return this.visitClassDeclaration(thing, parameters);
        } else if (thing.isField?.()) {
            return this.visitField(thing, parameters);
        } else if (thing.isRelationship?.()) {
            return this.visitRelationship(thing, parameters);
        } else if (thing.isEnumValue?.()) {
            return this.visitEnumValueDeclaration(thing, parameters);
        } else {
            throw new Error('Unrecognised type: ' + typeof thing + ', value: ' + util.inspect(thing, {
                showHidden: true,
                depth: 2
            }));
        }
    }

    /**
     * Visitor design pattern
     * @param {ModelManager} modelManager - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitModelManager(modelManager, parameters) {
        modelManager.getModelFiles(true).forEach((modelFile) => {
            modelFile.accept(this, parameters);
        });
        return null;
    }

    /**
     * Visitor design pattern
     * @param {ModelFile} modelFile - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitModelFile(modelFile, parameters) {
        // If no serlialization library is specified we default to the .NET one.
        // However, we also allow both options to be specified
        if (!parameters.useSystemTextJson && !parameters.useNewtonsoftJson){
            parameters.useSystemTextJson = true;
        }

        // Ensure non-empty string, that is separated by a period
        let namespacePrefix = parameters.namespacePrefix ? parameters.namespacePrefix : '';
        if (namespacePrefix !== '' && namespacePrefix.slice(-1) !== '.'){
            namespacePrefix += '.';
        }

        const dotNetNamespace = this.getDotNetNamespace(modelFile, namespacePrefix);
        parameters.fileWriter.openFile(modelFile.getNamespace() + '.cs');
        parameters.fileWriter.writeLine(0, 'using System;');

        if (parameters.useSystemTextJson){
            parameters.fileWriter.writeLine(0, 'using System.Text.Json.Serialization;');
            parameters.fileWriter.writeLine(0, 'using Concerto.Serialization;');
        }

        if (parameters.useNewtonsoftJson){
            parameters.fileWriter.writeLine(0, 'using NewtonsoftJson = Newtonsoft.Json;');
            parameters.fileWriter.writeLine(0, 'using NewtonsoftConcerto = Concerto.Serialization.Newtonsoft;');
        }

        parameters.fileWriter.writeLine(0, `namespace ${dotNetNamespace} {`);

        modelFile.getImports()
            .map(importString => ModelUtil.getNamespace(importString))
            .filter(namespace => namespace !== modelFile.getNamespace()) // Skip own namespace.
            .filter((v, i, a) => a.indexOf(v) === i) // Remove any duplicates from direct imports
            .forEach(namespace => {
                const otherModelFile = modelFile.getModelManager()?.getModelFile(namespace);
                if (!otherModelFile) {
                    // Couldn't resolve the other model file.
                    parameters.fileWriter.writeLine(1, `using ${namespacePrefix}${namespace};`);
                    return;
                }
                const otherDotNetNamespace = this.getDotNetNamespace(otherModelFile, namespacePrefix);
                parameters.fileWriter.writeLine(1, `using ${otherDotNetNamespace};`);
            });

        modelFile.getAllDeclarations().forEach((decl) => {
            decl.accept(this, parameters);
        });

        parameters.fileWriter.writeLine(0, '}');
        parameters.fileWriter.closeFile();

        return null;
    }

    /**
     * Visitor design pattern
     * @param {EnumDeclaration} enumDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitEnumDeclaration(enumDeclaration, parameters) {
        // If no serlialization library is specified we default to the .NET one.
        // However, we also allow both options to be specified
        if (!parameters.useSystemTextJson && !parameters.useNewtonsoftJson){
            parameters.useSystemTextJson = true;
        }

        parameters.fileWriter.writeLine(1, 'public enum ' + enumDeclaration.getName() + ' {');

        enumDeclaration.getOwnProperties().forEach((property) => {
            property.accept(this, parameters);
        });

        parameters.fileWriter.writeLine(1, '}\n');
        return null;
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitClassDeclaration(classDeclaration, parameters) {
        // If no serlialization library is specified we default to the .NET one.
        // However, we also allow both options to be specified
        if (!parameters.useSystemTextJson && !parameters.useNewtonsoftJson){
            parameters.useSystemTextJson = true;
        }

        let superType = ' ';
        if (classDeclaration.getSuperType()) {
            superType = ` : ${ModelUtil.getShortName(classDeclaration.getSuperType())} `;
        }

        let abstract = '';
        if(classDeclaration.isAbstract()) {
            abstract = 'abstract ';
        }

        // classDeclaration has any other subtypes
        if (classDeclaration.getAssignableClassDeclarations()?.length > 1 && parameters.useNewtonsoftJson){
            parameters.fileWriter.writeLine(1, '[NewtonsoftJson.JsonConverter(typeof(NewtonsoftConcerto.ConcertoConverter))]');
        }
        parameters.fileWriter.writeLine(1, `public ${abstract}class ${classDeclaration.getName()}${superType}{`);
        const override = classDeclaration.getFullyQualifiedName() === 'concerto.Concept' ? 'virtual' : 'override';
        parameters.fileWriter.writeLine(2, this.toCSharpProperty('public '+ override, '$class', 'String','', `{ get;} = "${classDeclaration.getFullyQualifiedName()}";`, parameters));
        classDeclaration.getOwnProperties().forEach((property) => {
            property.accept(this, parameters);
        });
        parameters.fileWriter.writeLine(1, '}');
        return null;
    }

    /**
     * Visitor design pattern
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitField(field, parameters) {
        // If no serlialization library is specified we default to the .NET one.
        // However, we also allow both options to be specified
        if (!parameters.useSystemTextJson && !parameters.useNewtonsoftJson){
            parameters.useSystemTextJson = true;
        }

        let array = '';

        if (field.isArray()) {
            array = '[]';
        }

        let nullableType = '';
        if(field.isOptional() && field.isTypeEnum()){
            nullableType = '?';
        }

        parameters.fileWriter.writeLine(2, this.toCSharpProperty('public', field.getName(),field.getType()+nullableType,array, '{ get; set; }', parameters));
        return null;
    }

    /**
     * Visitor design pattern
     * @param {EnumValueDeclaration} enumValueDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitEnumValueDeclaration(enumValueDeclaration, parameters) {
        parameters.fileWriter.writeLine(2, `${enumValueDeclaration.getName()},`);
        return null;
    }

    /**
     * Visitor design pattern
     * @param {Relationship} relationship - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitRelationship(relationship, parameters) {
        // If no serlialization library is specified we default to the .NET one.
        // However, we also allow both options to be specified
        if (!parameters.useSystemTextJson && !parameters.useNewtonsoftJson){
            parameters.useSystemTextJson = true;
        }

        let array = '';

        if (relationship.isArray()) {
            array = '[]';
        }

        // we export all relationships
        parameters.fileWriter.writeLine(2, this.toCSharpProperty('public', relationship.getName(),relationship.getType(),array, '{ get; set; }', parameters));
        return null;
    }

    /**
     * Ensures that a concerto property name is valid in CSharp
     * @param {string} access the CSharp field access
     * @param {string} propertyName the Concerto property name
     * @param {string} propertyType the Concerto property type
     * @param {string} array the array declaration
     * @param {string} getset the getter and setter declaration
     * @param {Object} [parameters]  - the parameter
     * @returns {string} the property declaration
     */
    toCSharpProperty(access, propertyName, propertyType, array, getset, parameters) {
        const type = this.toCSharpType(propertyType);

        const reservedKeywords = ['abstract','as','base','bool','break','byte','case','catch','char','checked',
            'class','const','continue','decimal','default','delegate','do','double','else',
            'enum','event','explicit','extern','false','finally','fixed','float','for','foreach',
            'goto','if','implicit','in','int','interface','internal','is','lock','long','namespace',
            'new','null','object','operator','out','override','params','private','protected','public',
            'readonly','ref','return','sbyte','sealed','short','sizeof','stackalloc','static',
            'string','struct','switch','this','throw','true','try','typeof','uint','ulong','unchecked',
            'unsafe','ushort','using','virtual','void','volatile','while'];

        let modifiedPropertyName = propertyName;
        let annotations = '';

        if(propertyName.startsWith('$')) {
            modifiedPropertyName = '_' + propertyName.substring(1);
        }

        if(reservedKeywords.includes(propertyName)) {
            modifiedPropertyName = '_' + propertyName;
        }

        if (modifiedPropertyName !== propertyName){
            if (parameters?.useSystemTextJson){
                annotations += `[JsonPropertyName("${propertyName}")]\n\t\t`;
            }
            if (parameters?.useNewtonsoftJson){
                annotations += `[NewtonsoftJson.JsonProperty("${propertyName}")]\n\t\t`;
            }
        }

        return `${annotations}${access} ${type}${array} ${modifiedPropertyName} ${getset}`;
    }

    /**
     * Converts a Concerto type to a CSharp type. Primitive types are converted
     * everything else is passed through unchanged.
     * @param {string} type  - the concerto type
     * @return {string} the corresponding type in CSharp
     * @private
     */
    toCSharpType(type) {
        switch (type) {
        case 'DateTime':
            return 'DateTime';
        case 'Boolean':
            return 'bool';
        case 'String':
            return 'string';
        case 'Double':
            return 'float';
        case 'Long':
            return 'long';
        case 'Integer':
            return 'int';
        default:
            return type;
        }
    }

    /**
     * Get the .NET namespace for a given model file.
     * @private
     * @param {ModelFile} modelFile the model file
     * @param {string} [namespacePrefix] the optional namespace prefix
     * @return {string} the .NET namespace for the model file
     */
    getDotNetNamespace(modelFile, namespacePrefix) {
        const decorator = modelFile.getDecorator('DotNetNamespace');
        if (!decorator) {
            const { name } = ModelUtil.parseNamespace(modelFile.getNamespace());
            if (namespacePrefix) {
                return `${namespacePrefix}${name}`;
            } else {
                return name;
            }
        }
        const args = decorator.getArguments();
        if (args.length !== 1) {
            throw new Error('Malformed @DotNetNamespace decorator');
        }
        return args[0];
    }
}

module.exports = CSharpVisitor;
