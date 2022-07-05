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

const { NumberValidator } = require('@accordproject/concerto-core');
const { StringValidator } = require('@accordproject/concerto-core');
const { ModelUtil } = require('@accordproject/concerto-core');
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
class NodeVisitor {
    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @public
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
            const namespace = ModelUtil.parseNamespace(modelFile.getNamespace()).name;
            if (namespace !== 'concerto' || parameters.skipConcerto === false) {
                modelFile.accept(this, parameters);
            }
        });
        parameters.fileWriter.openFile('index.ts');
        parameters.fileWriter.writeLine(0, '/* eslint-disable */');
        modelManager.getModelFiles(true).forEach((modelFile) => {
            const namespace = ModelUtil.parseNamespace(modelFile.getNamespace()).name;
            if (namespace !== 'concerto' || parameters.skipConcerto === false) {
                parameters.fileWriter.writeLine(0, `export * from './${modelFile.getNamespace()}'`);
            }
        });
        parameters.fileWriter.closeFile();
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

        parameters.fileWriter.writeLine(0, '/* eslint-disable */');
        parameters.fileWriter.writeLine(0, `// Generated code for namespace: ${modelFile.getNamespace()}`);
        parameters.fileWriter.writeLine(0, '\n// generic imports');
        const runtimeImport = parameters.runtimeImport || '@accordproject/concerto-runtime';
        parameters.fileWriter.writeLine(0, `import * as Concerto from '${runtimeImport}';`);

        // Compute the types we need to import (based on all the types of the properites
        // as well as all the super types) for all the classes in this model file
        parameters.fileWriter.writeLine(0, '\n// model imports');
        const properties = new Map();
        modelFile.getAllDeclarations()
            .filter(v => !v.isEnum())
            .forEach(classDeclaration => {
                if (classDeclaration.getSuperType()) {
                    const superTypeNamespace = ModelUtil.parseNamespace(
                        ModelUtil.getNamespace(classDeclaration.getSuperType())
                    ).name;
                    if (superTypeNamespace === 'concerto') {
                        return;
                    }
                    const typeName = ModelUtil.getShortName(classDeclaration.getSuperType());
                    if (!properties.has(superTypeNamespace)) {
                        properties.set(superTypeNamespace, new Set());
                    }
                    properties.get(superTypeNamespace).add(`${typeName}`);
                    properties.get(superTypeNamespace).add(`${typeName}Data`);
                }

                classDeclaration.getProperties().forEach(property => {
                    if (!property.isPrimitive()) {
                        const typeNamespace = ModelUtil.parseNamespace(
                            ModelUtil.getNamespace(property.getFullyQualifiedTypeName())
                        ).name;
                        if (typeNamespace === 'concerto') {
                            return;
                        }
                        const typeName = ModelUtil.getShortName(property.getFullyQualifiedTypeName());
                        if (!properties.has(typeNamespace)) {
                            properties.set(typeNamespace, new Set());
                        }
                        properties.get(typeNamespace).add(`${typeName}`);
                        properties.get(typeNamespace).add(`${typeName}Data`);
                    }
                });

            });

        modelFile.getImports().map(importString => ModelUtil.getNamespace(importString)).filter(namespace => namespace !== modelFile.getNamespace()) // Skip own namespace.
            .filter((v, i, a) => a.indexOf(v) === i) // Remove any duplicates from direct imports
            .forEach(namespace => {
                const propertyTypeNames = properties.get(namespace);
                if (propertyTypeNames) {
                    const csvPropertyTypeNames = Array.from(propertyTypeNames).join(', ');
                    parameters.fileWriter.writeLine(0, `import {${csvPropertyTypeNames}} from './${namespace}';`);
                }
            });

        parameters.fileWriter.writeLine(0, '\n// classes');
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
        this.visitClassDeclarationForInterface(classDeclaration, parameters);
        this.visitClassDeclarationForClass(classDeclaration, parameters);
        return null;
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitClassDeclarationForInterface(classDeclaration, parameters) {

        let superType = ' ';
        if (classDeclaration.getSuperType()) {
            const superTypeNamespace = ModelUtil.parseNamespace(
                ModelUtil.getNamespace(classDeclaration.getSuperType())
            ).name;
            const typeNamespace = ModelUtil.parseNamespace(classDeclaration.getModelFile().getNamespace()).name;
            if (superTypeNamespace === 'concerto' && typeNamespace !== 'concerto') {
                superType = ` extends Concerto.${ModelUtil.getShortName(classDeclaration.getSuperType())}Data `;
            } else {
                superType = ` extends ${ModelUtil.getShortName(classDeclaration.getSuperType())}Data `;
            }
        }

        parameters.fileWriter.writeLine(0, 'export interface ' + classDeclaration.getName() + 'Data' + superType + '{');

        parameters.fileWriter.writeLine(1, '$class: string;');

        classDeclaration.getOwnProperties().forEach((property) => {
            property.accept(this, { ...parameters, isInterface: true });
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
    visitClassDeclarationForClass(classDeclaration, parameters) {

        let superType = ' ';
        if (classDeclaration.getSuperType()) {
            const superTypeNamespace = ModelUtil.parseNamespace(
                ModelUtil.getNamespace(classDeclaration.getSuperType())
            ).name;
            const typeNamespace = ModelUtil.parseNamespace(classDeclaration.getModelFile().getNamespace()).name;
            if (superTypeNamespace === 'concerto' && typeNamespace !== 'concerto') {
                superType = ` extends Concerto.${ModelUtil.getShortName(classDeclaration.getSuperType())} `;
            } else {
                superType = ` extends ${ModelUtil.getShortName(classDeclaration.getSuperType())} `;
            }
        }

        parameters.fileWriter.writeLine(0, `@Concerto.Typed(${JSON.stringify({ namespace: classDeclaration.getNamespace(), name: classDeclaration.getName() })})`);
        parameters.fileWriter.writeLine(0, 'export class ' + classDeclaration.getName() + superType + '{');

        parameters.fileWriter.writeLine(1, `public static $class = '${classDeclaration.getFullyQualifiedName()}';`);
        parameters.fileWriter.writeLine(1, `public $class = ${classDeclaration.getName()}.$class;`);
        parameters.fileWriter.writeLine(0, '');

        classDeclaration.getOwnProperties().forEach((property) => {
            property.accept(this, parameters);
            parameters.fileWriter.writeLine(0, '');
        });

        parameters.fileWriter.writeLine(1, `public constructor(data?: Partial<${classDeclaration.getName()}>) {`);
        if (classDeclaration.getSuperType()) {
            parameters.fileWriter.writeLine(2, 'super();');
        }
        parameters.fileWriter.writeLine(2, 'Object.assign(this, data);');
        parameters.fileWriter.writeLine(1, '}');
        parameters.fileWriter.writeLine(0, '');

        parameters.fileWriter.writeLine(1, `public static parse(data: Buffer): ${classDeclaration.getName()}`);
        parameters.fileWriter.writeLine(1, `public static parse(data: string): ${classDeclaration.getName()}`);
        parameters.fileWriter.writeLine(1, `public static parse(data: object): ${classDeclaration.getName()}`);
        parameters.fileWriter.writeLine(1, `public static parse(data: ${classDeclaration.getName()}Data): ${classDeclaration.getName()}`);
        parameters.fileWriter.writeLine(1, `public static parse(data: unknown): ${classDeclaration.getName()} {`);
        parameters.fileWriter.writeLine(2, `return Concerto.parse(${classDeclaration.getName()}, data);`);
        parameters.fileWriter.writeLine(1, '}');
        parameters.fileWriter.writeLine(0, '');

        parameters.fileWriter.writeLine(1, `public serialize(): ${classDeclaration.getName()}Data {`);
        parameters.fileWriter.writeLine(2, 'return Concerto.serialize(this);');
        parameters.fileWriter.writeLine(1, '}');
        parameters.fileWriter.writeLine(0, '');

        parameters.fileWriter.writeLine(1, 'public validate(): void {');
        parameters.fileWriter.writeLine(2, 'return Concerto.validate(this);');
        parameters.fileWriter.writeLine(1, '}');

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
        let { isInterface } = parameters;
        let array = '';
        let optional = isInterface ? '' : '!';

        if (field.isArray()) {
            array = '[]';
        }

        if (field.isOptional()) {
            optional = '?';
        }

        if (field.getName() === '$identifier') {
            return;
        }

        const decorators = field.getDecorators();
        const hasLiteral = decorators?.some(decorator => decorator.getName() === 'literal');
        let literal = '';
        if (hasLiteral) {
            const decoratorArguments = decorators.find(decorator => decorator.getName() === 'literal').getArguments();
            decoratorArguments.length > 0 && (literal = ` = ${field.getType()}.${decoratorArguments}`);
        }

        const tsType = this.toTsType(field, isInterface);

        if (!isInterface) {
            const tsDecorator = this.toTsDecorator(field, isInterface);
            parameters.fileWriter.writeLine(1, tsDecorator);
        }

        if (literal) {
            parameters.fileWriter.writeLine(1, field.getName() + literal + ';');
        } else {
            parameters.fileWriter.writeLine(1, field.getName() + optional + ': ' + tsType + array + literal + ';');
        }

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
        let { isInterface } = parameters;
        let array = '';
        let optional = isInterface ? '' : '!';

        if (relationship.isArray()) {
            array = '[]';
        }

        if (relationship.isOptional()) {
            optional = '?';
        }

        // we export all relationships
        if (!isInterface) {
            const decorator = '@Concerto.ConcertoRelationship' + (relationship.isArray() ? 'Array' : '');
            const options = {
                type: relationship.getType()
            };
            if (relationship.isOptional()) {
                options.optional = true;
            }
            const serializedOptions = this.serializeDecoratorOptions(options);
            parameters.fileWriter.writeLine(1, `${decorator}(${serializedOptions})`);
        }
        parameters.fileWriter.writeLine(1, relationship.getName() + optional + ': string' + array + ';');
        return null;
    }

    /**
     * Converts a Concerto type to a Typescript  type. Primitive types are converted
     * everything else is passed through unchanged.
     * @param {Field} field  - the concerto field
     * @param {boolean} isInterface - true if generating an interface
     * @return {string} the corresponding type in Typescript
     * @private
     */
    toTsType(field, isInterface) {
        const type = field.getType();
        const isEnum = field.isTypeEnum();
        switch (type) {
        case 'DateTime':
            return isInterface ? 'string' : 'Date';
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
        default: {
            return isInterface && !isEnum ? `${type}Data` : type;
        }
        }
    }

    /**
     * Converts a Concerto field to one or more Typescript decorators. Primitive types are converted
     * everything else is passed through unchanged.
     * @param {Field} field  - the concerto field
     * @return {string[]} the corresponding Typescript decorators
     * @private
     */
    toTsDecorator(field) {
        const type = field.getType();
        const isPrimitive = field.isPrimitive();
        const isOptional = field.isOptional();
        const isArray = field.isArray();
        const isEnum = field.isTypeEnum();
        const options = {};
        if (isOptional) {
            options.optional = true;
        }
        if (!isPrimitive) {
            options.type = type;
        }
        const validator = field.getValidator();
        if (validator) {
            if (validator instanceof NumberValidator) {
                const lowerBound = validator.getLowerBound();
                if (typeof lowerBound === 'number') {
                    options.minimum = lowerBound;
                }
                const upperBound = validator.getUpperBound();
                if (typeof upperBound === 'number') {
                    options.maximum = upperBound;
                }
            } else if (validator instanceof StringValidator) {
                const regex = validator.getRegex();
                options.regex = regex;
            }
        }
        const decorator = '@Concerto.' + (isPrimitive ? type : isEnum ? 'Enum' : 'Object') + (isArray ? 'Array' : '') + 'Property';
        const serializedOptions = this.serializeDecoratorOptions(options);
        return `${decorator}(${serializedOptions})`;
    }

    /**
     * Serialize the specified decorator options.
     * @param {Object} options The decorator options.
     * @returns {string} The serialized decorator options.
     * @private
     */
    serializeDecoratorOptions(options) {
        const serializedOptions = Object.entries(options).map(([key, value]) => {
            const serializedKey = JSON.stringify(key);
            const serializedValue = key === 'type' || value instanceof RegExp ? value : JSON.stringify(value);
            return `${serializedKey}:${serializedValue}`;
        }).join(',');
        return `{${serializedOptions}}`;
    }
}

module.exports = NodeVisitor;
