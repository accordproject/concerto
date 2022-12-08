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

const util = require('util');

/**
 * Convert the contents of a ModelManager to Avro IDL code.
 * All generated code is placed into the 'Protocol' protocol. Set a
 * fileWriter property (instance of FileWriter) on the parameters
 * object to control where the generated code is written to disk.
 *
 * @private
 * @class
 * @memberof module:concerto-tools
 */
class AvroVisitor {
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
            throw new Error(
                'Unrecognised type: ' +
                    typeof thing +
                    ', value: ' +
                    util.inspect(thing, {
                        showHidden: true,
                        depth: 2,
                    })
            );
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
        parameters.fileWriter.openFile(modelFile.getNamespace() + '.avdl');

        parameters.fileWriter.writeLine(
            0,
            `@namespace("${modelFile.getNamespace()}")`
        );
        parameters.fileWriter.writeLine(0, 'protocol MyProtocol {\n');

        modelFile.getImports().forEach((imp) => {
            parameters.fileWriter.writeLine(1, `import idl ${imp}.avdl`);
        });
        parameters.fileWriter.writeLine(1, '');

        modelFile
            .getAllDeclarations()
            .filter((declaration) => !declaration.isScalarDeclaration?.())
            .forEach((decl) => {
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
        parameters.fileWriter.writeLine(
            1,
            'enum ' + enumDeclaration.getName() + ' {'
        );

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
        parameters.fileWriter.writeLine(
            1,
            `record ${classDeclaration.getName()} {`
        );
        classDeclaration.getProperties().forEach((property) => {
            property.accept(this, parameters);
        });
        parameters.fileWriter.writeLine(1, '}\n');
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

        let fieldOrScalar = field;

        if(field.isTypeScalar()) {
            fieldOrScalar = field.getScalarField();
        }

        let avroType = this.toAvroType(fieldOrScalar.getType());

        if (fieldOrScalar.isArray()) {
            avroType = `array<${avroType}>`;
        }

        if (fieldOrScalar.isOptional()) {
            avroType = `union { null, ${avroType} }`;
        }

        parameters.fileWriter.writeLine(2, `${avroType} ${fieldOrScalar.getName()};`);
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
        parameters.fileWriter.writeLine(2, name);
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
        let avroType = 'string';

        if (relationship.isArray()) {
            avroType = `array<${avroType}>`;
        }

        if (relationship.isOptional()) {
            avroType = `union { null, ${avroType} }`;
        }

        parameters.fileWriter.writeLine(
            2,
            `${avroType} ${relationship.getName()};`
        );
        return null;
    }

    /**
     * Converts a Concerto type to a Typescript  type. Primitive types are converted
     * everything else is passed through unchanged.
     * @param {string} type  - the concerto type
     * @param {boolean} useInterface  - whether to use an interface type
     * @param {boolean} useUnion  - whether to use a union type
     * @return {string} the corresponding type in Typescript
     * @private
     */
    toAvroType(type, useInterface, useUnion) {
        switch (type) {
        case 'DateTime':
            return 'string';
        case 'Boolean':
            return 'boolean';
        case 'String':
            return 'string';
        case 'Double':
            return 'double';
        case 'Long':
            return 'long';
        case 'Integer':
            return 'int';
        default: {
            return type;
        }
        }
    }
}

module.exports = AvroVisitor;
