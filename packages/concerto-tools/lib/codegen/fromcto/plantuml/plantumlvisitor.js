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
const DiagramVisitor = require('../../../common/diagramvisitor');

/**
 * Convert the contents of a ModelManager
 * to PlantUML format files.
 * Set a fileWriter property (instance of FileWriter) on the parameters
 * object to control where the generated code is written to disk.
 *
 * @protected
 * @class
 * @memberof module:concerto-tools
 */
class PlantUMLVisitor extends DiagramVisitor {
    /**
     * Visitor design pattern
     * @param {ModelManager} modelManager - the object being visited
     * @param {Object} parameters  - the parameter
     * @protected
     */
    visitModelManager(modelManager, parameters) {
        parameters.fileWriter.openFile('model.puml');
        parameters.fileWriter.writeLine(0, '@startuml');
        parameters.fileWriter.writeLine(0, 'title' );
        parameters.fileWriter.writeLine(0, 'Model' );
        parameters.fileWriter.writeLine(0, 'endtitle' );

        super.visitModelManager(modelManager, parameters);

        parameters.fileWriter.writeLine(0, '@enduml');
        parameters.fileWriter.closeFile();
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @protected
     */
    visitAssetDeclaration(classDeclaration, parameters) {
        this.writeDeclaration(classDeclaration, parameters, '(A,green)' );
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @protected
     */
    visitEnumDeclaration(classDeclaration, parameters) {
        this.writeDeclaration(classDeclaration, parameters, '(E,grey)' );
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @protected
     */
    visitParticipantDeclaration(classDeclaration, parameters) {
        this.writeDeclaration(classDeclaration, parameters, '(P,lightblue)' );
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @protected
     */
    visitTransactionDeclaration(classDeclaration, parameters) {
        this.writeDeclaration(classDeclaration, parameters, '(T,yellow)' );
    }


    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @protected
     */
    visitClassDeclaration(classDeclaration, parameters) {
        this.writeDeclaration(classDeclaration, parameters );
    }

    /**
     * Write a class declaration
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @param {string} [style] - the style for the prototype (optional)
     * @protected
     */
    writeDeclaration(classDeclaration, parameters, style) {
        parameters.fileWriter.writeLine(0, 'class ' + this.escapeString(classDeclaration.getFullyQualifiedName()) + (style ? ` << ${style} >> ` : ' ') + '{' );

        super.visitClassDeclaration(classDeclaration, parameters, style);

        parameters.fileWriter.writeLine(0, '}' );

        if (!classDeclaration.isEnum()){
            classDeclaration.getOwnProperties().forEach((property) => {
                const source = classDeclaration.getFullyQualifiedName();
                const target = property.getFullyQualifiedTypeName();
                const label = property.getName();
                const array = property.isArray() ? '"*"':'"1"';
                if (property.isRelationship?.()) {
                    const type = `"1" ${DiagramVisitor.AGGREGATION} ${array}`;
                    parameters.fileWriter.writeLine(0, `${source} ${type} ${target} : ${label}`);
                } else if (parameters.showCompositionRelationships && !property.isPrimitive()){
                    const type = `"1" ${DiagramVisitor.COMPOSITION} ${array}`;
                    parameters.fileWriter.writeLine(0, `${source} ${type} ${target} : ${label}`);
                }
            });
        }

        super.writeDeclarationSupertype(classDeclaration, parameters);
    }

    /**
     * Escape fully qualified names. We preserve the dots in the
     * package name, remove the '@' symbol because it is invalid
     * and remove the dots in the version (because otherwise packages get created)
     * @param {String} input - the object being visited
     * @return {String} string  - the parameter
     * @protected
     */
    escapeString(input) {
        const hasNamespace = ModelUtil.getNamespace(input) !== '';
        if(hasNamespace) {
            const typeName = ModelUtil.getShortName(input);
            const ns = ModelUtil.getNamespace(input);
            const {name,version} = ModelUtil.parseNamespace(ns);
            return `${name}_${version.replace(/\./g, '_')}.${typeName}`;
        }
        else {
            return input;
        }
    }
}

module.exports = PlantUMLVisitor;
