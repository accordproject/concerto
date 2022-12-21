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
const ModelUtil = require('@accordproject/concerto-core').ModelUtil;
/**
 * Convert the contents of a ModelManager to Go Lang code.
 * All generated code is placed into the 'main' package. Set a
 * fileWriter property (instance of FileWriter) on the parameters
 * object to control where the generated code is written to disk.
 *
 * @private
 * @class
 * @memberof module:concerto-tools
 */
class GoLangVisitor {
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
        } else if (thing.isTypeScalar?.()) {
            return this.visitField(thing.getScalarField(), parameters);
        } else if (thing.isField?.()) {
            return this.visitField(thing, parameters);
        } else if(thing.isRelationship?.()) {
            return this.visitRelationship(thing, parameters);
        } else if (thing.isEnumValue?.()) {
            return this.visitEnumValueDeclaration(thing, parameters);
        } else if (thing.isScalarDeclaration?.()) {
            return;
        } else {
            throw new Error('Unrecognised type: ' + typeof thing + ', value: ' + util.inspect(thing, { showHidden: false, depth: 1 }));
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
            modelFile.accept(this,parameters);
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
        const packageName = this.toGoPackageName(modelFile.getNamespace());
        parameters.fileWriter.openFile(`${modelFile.getNamespace()}.go`);
        parameters.fileWriter.writeLine(0, `// Package ${packageName} contains domain objects and was generated from Concerto namespace ${modelFile.getNamespace()}.`);
        parameters.fileWriter.writeLine(0, `package ${packageName}`);

        if(this.containsDateTimeField(modelFile)) {
            parameters.fileWriter.writeLine(0, 'import "time"' );
        }

        modelFile.getImports().map(importString => ModelUtil.getNamespace(importString)).filter(namespace => namespace !== modelFile.getNamespace()) // Skip own namespace.
            .filter((v, i, a) => a.indexOf(v) === i) // Remove any duplicates from direct imports
            .forEach(namespace => {
                parameters.fileWriter.writeLine(0, `import "${this.toGoPackageName(namespace)}";`);
            });

        parameters.fileWriter.writeLine(1, '');

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

        parameters.fileWriter.writeLine(0, 'type ' + enumDeclaration.getName() + ' int' );

        parameters.fileWriter.writeLine(0, 'const (' );

        enumDeclaration.getOwnProperties().forEach((property) => {
            property.accept(this,parameters);
        });

        parameters.fileWriter.writeLine(0, ')' );
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
        parameters.fileWriter.writeLine(0, 'type ' + classDeclaration.getName() + ' struct {' );

        //embed the super-type, because Go Lang does not have 'extends'
        if(classDeclaration.getSuperType()) {
            let superPackageName = ModelUtil.getNamespace(classDeclaration.getSuperType());
            let thisPackageName = ModelUtil.getNamespace(classDeclaration.getFullyQualifiedName());
            let useName = superPackageName === thisPackageName ? '' : `${this.toGoPackageName(superPackageName)}.`;
            parameters.fileWriter.writeLine(1, `${useName}${ModelUtil.getShortName(classDeclaration.getSuperType())}`);
        }

        classDeclaration.getOwnProperties().forEach((property) => {
            property.accept(this,parameters);
        });

        parameters.fileWriter.writeLine(0, '}' );
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

        if(field.isArray()) {
            array = '[]';
        }

        // we export all fields by capitalizing them
        // we strip $ as it is not legal in Go
        const name = field.getName().startsWith('$') ? field.getName().substring(1) : field.getName();
        parameters.fileWriter.writeLine(1, ModelUtil.capitalizeFirstLetter(name) + ' ' + array + this.toGoType(field.getType()) + ' `json:"' + field.getName() + '"`' );
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

        if(relationship.isArray()) {
            array = '[]';
        }

        // we export all fields by capitalizing them
        // relationships become pointers to types
        parameters.fileWriter.writeLine(1, `${ModelUtil.capitalizeFirstLetter(relationship.getName())} ${array}*${this.toGoType(relationship.getType())} \`json:"${relationship.getName()}"\``);
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

        // is this the first enum value?
        // if yes, we need to use 'iota' to set the value to zero
        const isFirstValue = enumValueDeclaration.getParent().getOwnProperties()[0].getName() === enumValueDeclaration.getName();
        let iota = '';

        if(isFirstValue) {
            iota =  ' ' + enumValueDeclaration.getParent().getName() + ' = 1 + iota';
        }

        // we export all fields by capitalizing them
        parameters.fileWriter.writeLine(1, ModelUtil.capitalizeFirstLetter(enumValueDeclaration.getName()) + iota );
        return null;
    }

    /**
     * Returns true if the ModelFile contains a class that has a DateTime
     * field.
     * @param {ModelFile} modelFile  - the modelFile
     * @return {boolean} true if the modelFile contains a class that contains
     * a field of type DateTime.
     * @private
     */
    containsDateTimeField(modelFile) {
        let classDeclarations = modelFile.getAllDeclarations()
            .filter(declaration => !declaration.isScalarDeclaration?.());
        for(let n=0; n < classDeclarations.length; n++) {
            let classDecl = classDeclarations[n];
            let fields = classDecl.getProperties();
            for(let i=0; i < fields.length; i++) {
                let field = fields[i];
                if(field.isTypeScalar?.()) {
                    field = field.getScalarField();
                }
                if(field.getType() === 'DateTime') {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Converts a Concerto type to a Go Lang type. Primitive types are converted
     * everything else is passed through unchanged.
     * @param {string} type  - the concerto type
     * @return {string} the corresponding type in Go Lang
     * @private
     */
    toGoType(type) {
        switch(type) {
        case 'DateTime':
            return 'time.Time';
        case 'Boolean':
            return 'bool';
        case 'String':
            return 'string';
        case 'Double':
            return 'float64';
        case 'Long':
            return 'int64';
        case 'Integer':
            return 'int32';
        default:
            return type;
        }
    }

    /**
     * Converts a Concerto namespace to a Go package name.
     * See: https://rakyll.org/style-packages/
     * @param {string} namespace  - the concerto type
     * @return {string} the corresponding package name in Go Lang
     * @private
     */
    toGoPackageName(namespace) {
        return namespace.replace(/@/g, '_').replace(/\./g, '_');
    }
}

module.exports = GoLangVisitor;
