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

const ModelManager = require('@accordproject/concerto-core').ModelManager;
const ModelUtil = require('@accordproject/concerto-core').ModelUtil;
const ModelFile = require('@accordproject/concerto-core').ModelFile;
const ClassDeclaration = require('@accordproject/concerto-core').ClassDeclaration;
const Field = require('@accordproject/concerto-core').Field;
const RelationshipDeclaration = require('@accordproject/concerto-core').RelationshipDeclaration;
const EnumDeclaration = require('@accordproject/concerto-core').EnumDeclaration;
const EnumValueDeclaration = require('@accordproject/concerto-core').EnumValueDeclaration;
const util = require('util');

/**
 * Convert the contents of a ModelManager to TypeScript code.
 * All generated code is placed into the 'main' package. Set a
 * fileWriter property (instance of FileWriter) on the parameters
 * object to control where the generated code is written to disk.
 *
 * @private
 * @class
 * @memberof module:concerto-tools
 */
class TypescriptVisitor {
    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
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
        parameters.fileWriter.openFile(modelFile.getNamespace() + '.ts');

        parameters.fileWriter.writeLine(0, '/* eslint-disable @typescript-eslint/no-empty-interface */');
        parameters.fileWriter.writeLine(0, `// Generated code for namespace: ${modelFile.getNamespace()}`);

        // Compute the types we need to import (based on all the types of the properites
        // as well as all the super types) for all the classes in this model file
        parameters.fileWriter.writeLine(0, '\n// imports');
        const properties = new Map();
        modelFile.getAllDeclarations()
            .filter(v => !v.isEnum())
            .forEach(classDeclaration => {
                if (classDeclaration.getSuperType()) {
                    const typeNamespace = ModelUtil.getNamespace(classDeclaration.getSuperType());
                    const typeName = ModelUtil.getShortName(classDeclaration.getSuperType());
                    if (!properties.has(typeNamespace)) {
                        properties.set(typeNamespace, new Set());
                    }
                    properties.get(typeNamespace).add(`I${typeName}`);
                }

                classDeclaration.getProperties().forEach(property => {
                    if (!property.isPrimitive()) {
                        const typeNamespace = ModelUtil.getNamespace(property.getFullyQualifiedTypeName());
                        const typeName = ModelUtil.getShortName(property.getFullyQualifiedTypeName());
                        if (!properties.has(typeNamespace)) {
                            properties.set(typeNamespace, new Set());
                        }
                        properties.get(typeNamespace).add(`I${typeName}`);
                    }
                });
            });

        modelFile.getImports().map(importString => ModelUtil.getNamespace(importString)).filter(namespace => namespace !== modelFile.getNamespace()) // Skip own namespace.
            .filter((v, i, a) => a.indexOf(v) === i) // Remove any duplicates from direct imports
            .forEach(namespace => {
                const propertyTypeNames = properties.get(namespace);
                if (propertyTypeNames) {
                    const csvPropertyTypeNames = Array.from(propertyTypeNames).join();
                    parameters.fileWriter.writeLine(0, `import {${csvPropertyTypeNames}} from './${namespace}';`);
                }
            });

        parameters.fileWriter.writeLine(0, '\n// interfaces');
        modelFile.getAllDeclarations().forEach((decl) => {
            decl.accept(this, parameters);
        });

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

        parameters.fileWriter.writeLine(0, 'export enum ' + enumDeclaration.getName() + ' {');

        enumDeclaration.getOwnProperties().forEach((property) => {
            property.accept(this, parameters);
        });

        parameters.fileWriter.writeLine(0, '}\n');
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

        let superType = ' ';
        if (classDeclaration.getSuperType()) {
            superType = ` extends I${ModelUtil.getShortName(classDeclaration.getSuperType())} `;
        }

        parameters.fileWriter.writeLine(0, 'export interface I' + classDeclaration.getName() + superType + '{');

        if(!classDeclaration.getSuperType()) {
            parameters.fileWriter.writeLine(1, '$class: string;');
        }

        classDeclaration.getOwnProperties().forEach((property) => {
            property.accept(this, parameters);
        });

        parameters.fileWriter.writeLine(0, '}\n');
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
        let array = '';
        let optional = '';

        if (field.isArray()) {
            array = '[]';
        }

        if (field.isOptional()) {
            optional = '?';
        }

        const isEnumRef = field.isPrimitive() ? false
            : field.getParent().getModelFile().getModelManager().getType(field.getFullyQualifiedTypeName()).isEnum();

        parameters.fileWriter.writeLine(1, field.getName() + optional + ': ' + this.toTsType(field.getType(), !isEnumRef) + array + ';');
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
        const name = enumValueDeclaration.getName();
        parameters.fileWriter.writeLine(1,`${name} = '${name}',`);
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
        let array = '';
        let optional='';

        if (relationship.isArray()) {
            array = '[]';
        }

        if (relationship.isOptional()) {
            optional = '?';
        }

        // we export all relationships
        parameters.fileWriter.writeLine(1, relationship.getName() + optional + ': ' + this.toTsType(relationship.getType(), true) + array + ';');
        return null;
    }

    /**
     * Converts a Concerto type to a Typescript  type. Primitive types are converted
     * everything else is passed through unchanged.
     * @param {string} type  - the concerto type
     * @param {boolean} useInterface  - whether to use an interface type
     * @return {string} the corresponding type in Typescript
     * @private
     */
    toTsType(type, useInterface) {
        switch (type) {
            case 'DateTime':
                return 'Date';
            case 'Boolean':
                return 'boolean';
            case 'String':
                return 'string';
            case 'Double':
                return 'number';
            case 'Long':
                return 'number';
            case 'Integer':
                return 'number';
            default:
                return useInterface ? `I${type}` : type;
        }
    }
}

module.exports = TypescriptVisitor;
