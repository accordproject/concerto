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

const ModelUtil = require('@accordproject/concerto-core').ModelUtil;

/**
 * Convert the contents of a ModelManager a diagram format (such as PlantUML or Mermaid)
 * Set a fileWriter property (instance of FileWriter) on the parameters
 * object to control where the generated code is written to disk.
 *
 * @private
 * @class
 */
class DiagramVisitor {

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
        } else if (thing.isParticipant?.()) {
            return this.visitParticipantDeclaration(thing, parameters);
        } else if (thing.isTransaction?.()) {
            return this.visitTransactionDeclaration(thing, parameters);
        } else if (thing.isEvent?.()) {
            return this.visitEventDeclaration(thing, parameters);
        } else if (thing.isAsset?.()) {
            return this.visitAssetDeclaration(thing, parameters);
        } else if (thing.isEnum?.()) {
            return this.visitEnumDeclaration(thing, parameters);
        } else if (thing.isClassDeclaration?.()) {
            return this.visitClassDeclaration(thing, parameters);
        } else if (thing.isTypeScalar?.()) {
            return this.visitField(thing.getScalarField(), parameters);
        } else if (thing.isField?.()) {
            return this.visitField(thing, parameters);
        } else if (thing.isRelationship?.()) {
            return this.visitRelationship(thing, parameters);
        } else if (thing.isEnumValue?.()) {
            return this.visitEnumValueDeclaration(thing, parameters);
        } else if (thing.isScalarDeclaration?.()) {
            return;
        } else {
            throw new Error('Unrecognised ' + JSON.stringify(thing) );
        }
    }

    /**
     * Visitor design pattern
     * @param {ModelManager} modelManager - the object being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    visitModelManager(modelManager, parameters) {
        modelManager.getModelFiles().forEach((decl) => {
            decl.accept(this, parameters);
        });
    }

    /**
     * Visitor design pattern
     * @param {ModelFile} modelFile - the object being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    visitModelFile(modelFile, parameters) {
        modelFile.getAllDeclarations().forEach((decl) => {
            decl.accept(this, parameters);
        });
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    visitAssetDeclaration(classDeclaration, parameters) {
        this.visitClassDeclaration(classDeclaration, parameters, 'asset');
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    visitEnumDeclaration(classDeclaration, parameters) {
        this.visitClassDeclaration(classDeclaration, parameters, 'enumeration');
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    visitEventDeclaration(classDeclaration, parameters) {
        this.visitClassDeclaration(classDeclaration, parameters, 'event');
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    visitParticipantDeclaration(classDeclaration, parameters) {
        this.visitClassDeclaration(classDeclaration, parameters, 'participant');
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    visitTransactionDeclaration(classDeclaration, parameters) {
        this.visitClassDeclaration(classDeclaration, parameters, 'transaction');
    }


    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @param {string} type  - the type of the declaration
     * @private
     */
    visitClassDeclaration(classDeclaration, parameters, type = 'concept') {
        classDeclaration.getOwnProperties().forEach((property) => {
            if (!property.isRelationship?.()) {
                property.accept(this, parameters);
            }
        });
    }

    /**
     * Visitor design pattern
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    visitField(field, parameters) {
        let array = '';

        if(field.isArray()) {
            array = '[]';
        }

        parameters.fileWriter.writeLine(1, '+ ' + this.escapeString(field.getType() + array) + ' ' + this.escapeString(field.getName()));
    }

    /**
     * Visitor design pattern
     * @param {EnumValueDeclaration} enumValueDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    visitEnumValueDeclaration(enumValueDeclaration, parameters) {
        parameters.fileWriter.writeLine(1, '+ ' + this.escapeString(enumValueDeclaration.getName()));
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    writeDeclarationSupertype(classDeclaration, parameters) {
        if(classDeclaration.getSuperType()) {
            const namespace = ModelUtil.getNamespace(classDeclaration.getSuperType());
            const isBaseModel = ModelUtil.parseNamespace(namespace).name === 'concerto';
            if (parameters.hideBaseModel && isBaseModel){
                return;
            }
            const source = this.escapeString(classDeclaration.getFullyQualifiedName());
            const target = this.escapeString(classDeclaration.getSuperType());
            parameters.fileWriter.writeLine(0, `${source} ${DiagramVisitor.INHERITANCE} ${target}`);
        }
    }
}

DiagramVisitor.COMPOSITION = '*--';
DiagramVisitor.AGGREGATION = 'o--';
DiagramVisitor.INHERITANCE = '--|>';

module.exports = DiagramVisitor;
