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

const debug = require('debug')('concerto-core:jsonschemavisitor');
const util = require('util');
const ModelUtil = require('@accordproject/concerto-core').ModelUtil;

/**
 * Convert the contents of a {@link ModelManager} to Proto3 files.
 *
 * @private
 * @class
 * @memberof module:concerto-tools
 */
class ProtobufVisitor {
    /**
     * Transform a Concerto namespace (with a version) to a package name compliant with Proto 3.
     * @param {Object} concertoNamespace - the Concerto namespace
     * @return {Object} a package name compliant with Proto 3
     * @public
     */
    concertoNamespaceToProto3SafePackageName(concertoNamespace) {
        // Proto3 needs the namespace to have a standard Java-like format, so the "@" and the dots in the version need to be replaces with underscores.
        const {name,version} = ModelUtil.parseNamespace(concertoNamespace);
        return `${name}.v${version ? version.replace(/\./g,'_') : ''}`;
    }

    /**
     * Transform a Concerto meta property into a Proto3 field rule.
     * @param {Object} field - the Concerto meta property
     * @return {Object} the Proto3 field rule
     * @public
     */
    concertoToProto3FieldRule(field) {
        // An array (repeated) in Proto3 is implicitly optional.
        if (field.isArray()) {
            return 'repeated';
        } else if (field.isOptional()) {
            return 'optional';
        } else {
            return null;
        }
    }

    /**
     * Transform a Concerto primitive type into a Proto3 one.
     * @param {Object} field - the Concerto primitive type
     * @return {Object} the Proto3 primitive type
     * @public
     */
    concertoToProto3PrimitiveType(field) {
        switch (field.getType()) {
        case 'String':
            return 'string';
        case 'Double':
            return 'double';
        case 'Integer':
            return 'sint64';
        case 'Long':
            return 'sint64';
        case 'DateTime':
            return 'google.protobuf.Timestamp';
        case 'Boolean':
            return 'bool';
        }
    }

    /**
     * Transform a Concerto class or enum type into a Proto3 message or enum one.
     * @param {Object} field - the Concerto class or enum type
     * @return {Object} the Proto3 message or enum type
     * @public
     */
    concertoToProto3MessageOrEnumType(field) {
        return this.doesClassHaveSubclassesRecursively(
            field.parent.modelFile.declarations
                .find(
                    classDeclaration => classDeclaration.getName() === field.getType()
                )
        )
            ?  `_Subclasses_of_class_${field.getType()}`
            : field.getType();
    }

    /**
     * Transform Concerto class imports to Proto3 import line strings.
     * @param {Object[]} imports - the imports of a Concerto class
     * @return {string[]} an array of import line strings
     * @public
     */
    createImportLineStrings(imports) {
        return imports
            .filter(importObject => ModelUtil.parseNamespace(importObject.namespace).name !== 'concerto')
            .map(importObject => `${this.concertoNamespaceToProto3SafePackageName(importObject.namespace)}.proto`);
    }

    /**
     * Recursively get the names of the subclasses of a class.
     * @param {Object} classDeclaration - the class declaration object
     * @return {String[]} an array of the names of the subclasses of the class
     * @public
     */
    getNamesOfSubclassesOfClassRecursively(classDeclaration) {
        return typeof classDeclaration?.getAssignableClassDeclarations === 'function'
            ? classDeclaration.getAssignableClassDeclarations()
                ?.filter(
                    assignableClass => assignableClass.getName() !== classDeclaration.getName()
                )
                .map(assignableClass => assignableClass.getName())
            : [];
    }

    /**
     * Recursively get the names of the subclasses of a class that are not abstract.
     * @param {Object} classDeclaration - the class declaration object
     * @return {String[]} an array of the names of the nonabstract subclasses of the class
     * @public
     */
    getNamesOfNonabstractSubclassesOfClassRecursively(classDeclaration) {
        return typeof classDeclaration.getAssignableClassDeclarations === 'function'
            ? classDeclaration.getAssignableClassDeclarations()
                ?.filter(
                    assignableClass => assignableClass.getName() !== classDeclaration.getName()
                )
                .filter(
                    assignableClass => !assignableClass.isAbstract()
                )
                .map(assignableClass => assignableClass.getName())
            : [];
    }

    /**
     * Recursively check if a class has subclasses.
     * @param {Object} classDeclaration - the class declaration object
     * @return {Boolean} whether or not the class has subclasses
     * @public
     */
    doesClassHaveSubclassesRecursively(classDeclaration) {
        return this.getNamesOfSubclassesOfClassRecursively(classDeclaration)
            ?.length > 0;
    }

    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @public
     */
    visit(thing, parameters) {
        if (thing.isModelManager?.()) {
            return this.visitModelManager(thing, parameters);
        } else if (thing.isModelFile?.()) {
            return this.visitModelFile(thing, parameters);
        } else if (thing.isAsset?.()) {
            return this.visitAssetDeclaration(thing, parameters);
        } else if (thing.isTransaction?.()) {
            return this.visitTransactionDeclaration(thing, parameters);
        } else if (thing.isEnum?.()) {
            return this.visitEnumDeclaration(thing, parameters);
        } else if (thing.isConcept?.()) {
            return this.visitConceptDeclaration(thing, parameters);
        } else if (thing.isClassDeclaration?.()) {
            return this.visitClassDeclaration(thing, parameters);
        } else if (thing.isTypeScalar?.()) {
            return this.visitField(thing.getScalarField(), parameters);
        } else if (thing.isField?.()) {
            return this.visitField(thing, parameters);
        } else if (thing.isRelationship?.()) {
            return this.visitRelationshipDeclaration(thing, parameters);
        } else if (thing.isEnumValue?.()) {
            return this.visitEnumValueDeclaration(thing, parameters);
        } else if (thing.isScalarDeclaration?.()) {
            return;
        } else {
            throw new Error('Unrecognised type: ' + typeof thing + ', value: ' + util.inspect(thing, { showHidden: true, depth: null }));
        }
    }

    /**
     * Visitor design pattern
     * @param {Object} modelManager - the object being visited
     * @param {Object} parameters - the parameter
     * @private
     */
    visitModelManager(modelManager, parameters) {
        debug('entering visitModelManager');

        // Visit all of the files in the model manager.
        modelManager.getModelFiles().forEach((modelFile) => {
            modelFile.accept(this, parameters);
        });

        return;
    }

    /**
     * Visitor design pattern
     * @param {Object} modelFile - the object being visited
     * @param {Object} parameters - the parameter
     * @private
     */
    visitModelFile(modelFile, parameters) {
        debug('entering visitModelFile', modelFile.getNamespace());

        const fileName = `${this.concertoNamespaceToProto3SafePackageName(modelFile.getNamespace())}.proto`;

        parameters.fileWriter.openFile(fileName);

        parameters.fileWriter.writeLine(0, 'syntax = "proto3";\n');
        parameters.fileWriter.writeLine(
            0, `package ${this.concertoNamespaceToProto3SafePackageName(modelFile.getNamespace())};\n`
        );

        // Define all of the needed imports
        const importStringLines = [
            'google/protobuf/timestamp.proto',
            ...this.createImportLineStrings(modelFile.imports)
        ];

        importStringLines.forEach(fileToImport => {
            parameters.fileWriter.writeLine(0, `import "${fileToImport}";`);
        });

        if (importStringLines.length > 0) {
            parameters.fileWriter.writeLine(0, '');
        }

        // Visit all of the asset and transaction declarations
        modelFile.getAllDeclarations()
            .forEach((declaration) => {
                declaration.accept(this, parameters);
            });

        parameters.fileWriter.closeFile();

        return;
    }

    /**
     * Visitor design pattern
     * @param {Object} assetDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitAssetDeclaration(assetDeclaration, parameters) {
        debug('entering visitAssetDeclaration', assetDeclaration.getName());
        return this.visitClassDeclarationCommon(assetDeclaration, parameters);
    }

    /**
     * Visitor design pattern
     * @param {Object} transactionDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitTransactionDeclaration(transactionDeclaration, parameters) {
        debug('entering visitTransactionDeclaration', transactionDeclaration.getName());
        return this.visitClassDeclarationCommon(transactionDeclaration, parameters);
    }

    /**
     * Visitor design pattern
     * @param {Object} conceptDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitConceptDeclaration(conceptDeclaration, parameters) {
        debug('entering visitConceptDeclaration', conceptDeclaration.getName());
        return this.visitClassDeclarationCommon(conceptDeclaration, parameters);
    }

    /**
     * Visitor design pattern
     * @param {Object} classDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitClassDeclaration(classDeclaration, parameters) {
        debug('entering visitClassDeclaration', classDeclaration.getName());
        return this.visitClassDeclarationCommon(classDeclaration, parameters);
    }

    /**
     * Visit a Concerto class
     * @param {Object} classDeclaration - the Concerto class being visited
     * @param {Object} parameters - the parameters
     * @private
     */
    visitClassDeclarationCommon(classDeclaration, parameters) {
        debug('entering visitClassDeclarationCommon', classDeclaration.getName());

        // Don't write abstract classes as average messages.
        if (!classDeclaration.isAbstract()) {
            // Check if the class contains properties.
            const classContainsProperties = classDeclaration.getProperties()?.length > 0;

            // Write the beginning of the message and the opening bracket (the closing one as well if the class is empty).
            parameters.fileWriter.writeLine(0, `message ${classDeclaration.getName()} {${classContainsProperties ? '' : '}\n'}`);

            if (classContainsProperties) {
                classDeclaration.getProperties()
                    // Remove property if it starts with a $ and is not a $identifier.
                    .filter(
                        (property) => !(
                            property.getName().charAt(0) === '$' &&
                            property.getName() !== '$identifier'
                        )
                    )
                    // Remove property if it is an $identifier, but there already is another identifier defined.
                    .filter(
                        (property) => !(
                            property.getName() === '$identifier' &&
                            typeof classDeclaration.getIdentifierFieldName() === 'string'
                        )
                    )
                    // Sort properties alpabetically in order to avoid the Proto3 index changes that would occur when Concerto properties are rearranged.
                    .sort((propertyA, propertyB) => propertyA.getName().localeCompare(propertyB.getName()))
                    .forEach(
                        (property, i) => {
                            property.accept(
                                this,
                                {
                                    ...parameters,
                                    fieldIndex: i + 1,
                                },
                            );
                        }
                    );
                // Write the closing bracket.
                parameters.fileWriter.writeLine(0, '}\n');
            }
        }

        // Find the subclasses of a class
        const nonabstractSubclassesOfClass = this.getNamesOfNonabstractSubclassesOfClassRecursively(classDeclaration);

        // if the class has subclasses that aren't abstract, then an auxiliary oneof message should be written. This is used to immitate aspects of Concerto inheritance.
        if (nonabstractSubclassesOfClass?.length > 0) {
            // Write the beginning of the message and the opening bracket.
            parameters.fileWriter.writeLine(0, `message _Subclasses_of_class_${classDeclaration.getName()} {`);
            // Write the beginning of the oneof statement.
            parameters.fileWriter.writeLine(0, `  oneof _class_oneof_${classDeclaration.getName()} {`);
            // Write the oneof options.
            (
                // If the extended class is not abstract, then included it as a subclass of the utility message.
                !classDeclaration.isAbstract()
                    ? [classDeclaration.getName(), ...nonabstractSubclassesOfClass]
                    : nonabstractSubclassesOfClass
            )
                // Sort properties derived from subclasses alphabetically in order to avoid the Proto3 index changes that would occur when Concerto classes are rearranged.
                .sort((subclassNameA, subclassNameB) => subclassNameA.localeCompare(subclassNameB))
                // Write properties.
                .forEach(
                    (subclassName, i) => {
                        parameters.fileWriter.writeLine(0, `    ${subclassName} _subclass_of_class_${classDeclaration.getName()}_${subclassName} = ${i + 1};`);
                    }
                );
            // Write the oneof closing bracket.
            parameters.fileWriter.writeLine(0, '  }');
            // Write the message closing bracket.
            parameters.fileWriter.writeLine(0, '}\n');
        }

        return;
    }

    /**
     * Visitor design pattern
     * @param {Object} field - the object being visited
     * @param {Object} parameters - the parameter
     * @private
     */
    visitField(field, parameters) {
        debug('entering visitField', field.getName());

        const preposition = this.concertoToProto3FieldRule(field);
        const type = field.isPrimitive()
            // Primitive Concerto types are mapped to specific Proto3 types.
            ? this.concertoToProto3PrimitiveType(field)
            // The rest are references to classes and enums.
            : this.concertoToProto3MessageOrEnumType(field);
        // Proto3 is not happy with the "$" sign, so we are replacing it with an "_".
        const fieldName = field.getName().replace(/\$/g, '_');

        // Write the fields, adding a Proto3 index to them.
        parameters.fileWriter.writeLine(
            0,
            `  ${preposition ? `${preposition} ` : ''}${type} ${fieldName} = ${parameters.fieldIndex ?? '0'};`
        );

        return;
    }

    /**
     * Visitor design pattern
     * @param {Object} enumDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @private
     */
    visitEnumDeclaration(enumDeclaration, parameters) {
        debug('entering visitEnumDeclaration', enumDeclaration.getName());

        const enumContainsOptions = enumDeclaration.getProperties()?.length > 0;

        parameters.fileWriter.writeLine(0, `enum ${enumDeclaration.name} {${enumContainsOptions ? '' : '}\n'}`);

        if (enumContainsOptions) {
            // Walk over all of the properties which should just be enum value declarations.
            enumDeclaration.getProperties()
                // Sort enum value declarations alpabetically in order to avoid the Proto3 index changes that would occur when Concerto enum value declarations are rearranged.
                .sort((enumValueDeclarationA, benumValueDeclarationB) => enumValueDeclarationA.getName().localeCompare(benumValueDeclarationB.getName()))
                .forEach((property, i) => {
                    property.accept(
                        this,
                        {
                            ...parameters,
                            valueDeclarationName: enumDeclaration.name,
                            valueIndex: i
                        }
                    );
                });
            parameters.fileWriter.writeLine(0, '}\n');
        }

        return;
    }

    /**
     * Visitor design pattern
     * @param {Object} enumValueDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @private
     */
    visitEnumValueDeclaration(enumValueDeclaration, parameters) {
        debug('entering visitEnumValueDeclaration', enumValueDeclaration.getName());

        parameters.fileWriter.writeLine(
            0,
            `  ${parameters.valueDeclarationName}_${enumValueDeclaration.getName()} = ${parameters.valueIndex ?? '0'};`
        );

        return;
    }

    /**
     * Visitor design pattern
     * @param {Object} relationshipDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @private
     */
    visitRelationshipDeclaration(relationshipDeclaration, parameters) {
        debug('entering visitRelationship', relationshipDeclaration.getName());

        const preposition = this.concertoToProto3FieldRule(relationshipDeclaration);
        const fieldName = relationshipDeclaration.getName();

        // Write the fields, adding a Proto3 index to them.
        parameters.fileWriter.writeLine(
            0,
            `  ${preposition ? `${preposition} ` : ''}string ${fieldName} = ${parameters.fieldIndex ?? '0'};`
        );
    }
}

module.exports = ProtobufVisitor;
