/* eslint-disable @typescript-eslint/no-require-imports */
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
const { ModelManager, ModelUtil } = require('@accordproject/concerto-core');
const { FileWriter } = require('@accordproject/concerto-util');
const { CodeGen } = require('@accordproject/concerto-codegen');

const OVERRIDE_DECORATOR = 'CodeGen_TypeScript_Override';

/**
 * Custom TypeScript visitor for Concertino types
 * Extends concerto-codegen's TypescriptVisitor
 */
class ConcertinoTypescriptVisitor extends CodeGen.TypescriptVisitor {

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
        } else if (thing.isMapDeclaration?.()) {
            return this.visitMapDeclaration(thing, parameters);
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
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitClassDeclaration(classDeclaration, parameters) {

        let superType = '';
        const type = classDeclaration.getSuperType();
        if (type) {
            const namespace = ModelUtil.getNamespace(type);
            const shortName = `I${ModelUtil.getShortName(type)}`;
            const fullType = `${namespace}.${shortName}`;
            superType = ` extends ${parameters.aliasedTypesMap?.get(fullType) || shortName}`;
        }
        parameters.fileWriter.writeLine(0, `export interface I${classDeclaration.getName()}${superType} {`);

        if(!classDeclaration.getSuperType()) {
            // EDIT: make $class optional
            parameters.fileWriter.writeLine(1, '$class?: string;');
        }

        classDeclaration.getOwnProperties().forEach((property) => {
            property.accept(this, parameters);
        });

        parameters.fileWriter.writeLine(0, '}\n');

        // If there exists direct subclasses for this declaration then generate a union for it
        const subclasses = classDeclaration.getDirectSubclasses();
        if (subclasses && subclasses.length > 0) {
            parameters.fileWriter.writeLine(0, 'export type ' + classDeclaration.getName() +
                'Union = ' + subclasses.filter(declaration => !declaration.isEnum()).map(subclass => `I${subclass.getName()}`).join(' | \n') + ';\n');
        }
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
        const typeOverride = field.getDecorators().find(decorator => decorator.getName() === OVERRIDE_DECORATOR);
        if (typeOverride) {
            parameters.fileWriter.writeLine(1, field.getName() + ': ' + typeOverride.getArguments()[0] + ';');
            return null;
        }

        // EDIT: propagate optional modifier to scalar
        // TODO: port upstream to codegen
        if (field.isTypeScalar?.()){
            const scalarField = field.getScalarField();
            scalarField.optional = field.isOptional();
            super.visitField(scalarField, parameters);
            return null;
        }

        super.visitField(field, parameters);
        return null;
    }

    /**
     * Visitor design pattern
     * @param {MapDeclaration} mapDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitMapDeclaration(mapDeclaration, parameters) {
        const typeOverride = mapDeclaration.getDecorators().find(decorator => decorator.getName() === OVERRIDE_DECORATOR);
        if (typeOverride) {
            parameters.fileWriter.writeLine(0, 'export type ' + mapDeclaration.getName() + ' = ' + typeOverride.getArguments()[0] + ';');
            return null;
        }

        const mapKeyType = mapDeclaration.getKey().getType();
        const mapValueType = mapDeclaration.getValue().getType();

        let keyType;
        let valueType;

        // Map Key Type
        if (ModelUtil.isPrimitiveType(mapKeyType)) {
            keyType = this.toTsType(mapDeclaration.getKey().getType(), false, false);
        } else if (ModelUtil.isScalar(mapDeclaration.getKey())) {
            const scalarDeclaration = mapDeclaration.getModelFile().getType(mapDeclaration.getKey().getType());
            const scalarType = scalarDeclaration.getType();
            keyType = this.toTsType(scalarType, false, false);
        }

        // Map Value Type
        if (ModelUtil.isPrimitiveType(mapValueType)) {
            valueType = this.toTsType(mapDeclaration.getValue().getType(), false, false);
        } else if (ModelUtil.isScalar(mapDeclaration.getValue())) {
            const scalarDeclaration = mapDeclaration.getModelFile().getType(mapDeclaration.getValue().getType());
            const scalarType = scalarDeclaration.getType();
            valueType = this.toTsType(scalarType, false, false);
        } else {
            valueType = this.toTsType(mapValueType, true, false);
        }

        // EDIT: Use Record instead of Map
        parameters.fileWriter.writeLine(0, 'export type ' + mapDeclaration.getName() + ` = Record<${keyType}, ${valueType}>;\n` );

        return null;
    }
}

/**
 * Main function to generate TypeScript types from the Concertino model
 */
async function generateTypes() {
    try {
        const modelManager = new ModelManager({
            addMetamodel: true,
        });

        // Load the Concertino model
        const ctoFile = path.resolve(__dirname, '../src/spec/concertino.cto');
        const contents = fs.readFileSync(ctoFile, 'utf8');
        modelManager.addCTOModel(contents, ctoFile);

        // Output file path
        const outputFile = path.resolve(__dirname, '../src/generated-types.ts');

        // Create a file writer
        const fileWriter = new FileWriter(path.resolve(__dirname, '../src/spec'));

        // Generate the TypeScript code
        const visitor = new ConcertinoTypescriptVisitor();
        visitor.visit(modelManager, { fileWriter });

        // eslint-disable-next-line no-console
        console.log(`Generated TypeScript types at: ${outputFile}`);
    } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Error generating TypeScript types:', err);
        process.exit(1);
    }
}

// Run the generator
generateTypes();
