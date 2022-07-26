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

const EmptyPlugin = require('./emptyplugin');
const ModelUtil = require('@accordproject/concerto-core').ModelUtil;
const util = require('util');

/**
 * Convert the contents of a ModelManager to Java code.
 * Set a fileWriter property (instance of FileWriter) on the parameters
 * object to control where the generated code is written to disk.
 *
 * @private
 * @class
 * @memberof module:concerto-tools
 */
class JavaVisitor {
    /**
     * Create the JavaVisitor.
     */
    constructor() {
        this.plugin = new EmptyPlugin();
    }

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
            throw new Error('Unrecognised type: ' + typeof thing + ', value: ' + util.inspect(thing, { showHidden: true, depth: 2 }));
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

        parameters.fileWriter.openFile( 'org/hyperledger/composer/system/Resource.java');
        parameters.fileWriter.writeLine(0, '// this code is generated and should not be modified');
        parameters.fileWriter.writeLine(0, 'package org.hyperledger.composer.system;');
        parameters.fileWriter.writeLine(0, 'import com.fasterxml.jackson.annotation.*;');

        parameters.fileWriter.writeLine(0, `
@JsonTypeInfo(use = JsonTypeInfo.Id.CLASS, property = "$class")
@JsonIdentityInfo(generator = ObjectIdGenerators.PropertyGenerator.class, property = "$id")
public abstract class Resource
{
    public abstract String getID();
    private String $id;

    @JsonProperty("$id")
    public String get$id() {
        return $id;
    }
    @JsonProperty("$id")
    public void set$id(String i) {
        $id = i;
    }

}
        `);
        parameters.fileWriter.closeFile();

        modelManager.getModelFiles().forEach((modelFile) => {
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

        modelFile.getAllDeclarations().forEach((decl) => {
            decl.accept(this, parameters);
        });

        return null;
    }

    /**
     * Write a Java class file header. The class file will be created in
     * a file/folder based on the namespace of the class.
     * @param {ClassDeclaration} clazz - the clazz being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    startClassFile(clazz, parameters) {
        const { escapedNamespace } = ModelUtil.escapeNamespace(clazz.getModelFile().getNamespace());
        parameters.fileWriter.openFile( clazz.getModelFile().getNamespace().replace(/\./g, '/') + '/' + clazz.getName() + '.java');
        parameters.fileWriter.writeLine(0, '// this code is generated and should not be modified');
        parameters.fileWriter.writeLine(0, 'package ' + escapedNamespace + ';');
        parameters.fileWriter.writeLine(0, '');
        parameters.fileWriter.writeLine(0, 'import org.hyperledger.composer.system.*;');
        this.plugin.addClassImports(clazz, parameters);
    }

    /**
     * Close a Java class file
     * @param {ClassDeclaration} clazz - the clazz being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    endClassFile(clazz, parameters) {
        parameters.fileWriter.closeFile();
    }


    /**
     * Visitor design pattern
     * @param {EnumDeclaration} enumDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitEnumDeclaration(enumDeclaration, parameters) {

        this.startClassFile(enumDeclaration, parameters);

        parameters.fileWriter.writeLine(0, 'import com.fasterxml.jackson.annotation.JsonIgnoreProperties;');
        parameters.fileWriter.writeLine(0, '@JsonIgnoreProperties({"$class"})');
        this.plugin.addEnumAnnotations(enumDeclaration, parameters);
        parameters.fileWriter.writeLine(0, 'public enum ' + enumDeclaration.getName() + ' {' );

        enumDeclaration.getOwnProperties().forEach((property) => {
            property.accept(this, parameters);
        });

        parameters.fileWriter.writeLine(0, '}' );

        this.endClassFile(enumDeclaration, parameters);

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

        this.startClassFile(classDeclaration, parameters);

        classDeclaration.getModelFile().getImports().forEach((imported) => {
            parameters.fileWriter.writeLine(0, 'import ' + imported + ';' );
        });

        if(classDeclaration.isConcept()) {
            parameters.fileWriter.writeLine(0, 'import com.fasterxml.jackson.annotation.JsonIgnoreProperties;');
            parameters.fileWriter.writeLine(0, '');
            parameters.fileWriter.writeLine(0, '@JsonIgnoreProperties({"$class"})');
        }

        let isAbstract = '';
        if(classDeclaration.isAbstract() ) {
            isAbstract = 'abstract ';
        }
        else {
            isAbstract = '';
        }

        let superType = '';

        if(classDeclaration.getSuperType()) {
            superType = ' extends ' + ModelUtil.getShortName(classDeclaration.getSuperType());
        }

        this.plugin.addClassAnnotations(classDeclaration, parameters);
        parameters.fileWriter.writeLine(0, 'public ' + isAbstract + 'class ' + classDeclaration.getName() + superType + ' {' );

        // add the getID abstract type
        if(classDeclaration.getIdentifierFieldName()) {
            const getterName = 'get' + this.capitalizeFirstLetter(classDeclaration.getIdentifierFieldName());
            parameters.fileWriter.writeLine(1, `
   // the accessor for the identifying field
   public String getID() {
      return this.${getterName}();
   }
`
            );
        }

        // add the properties
        classDeclaration.getOwnProperties().forEach((property) => {
            property.accept(this, Object.assign({}, parameters, {mode: 'field'}));
        });

        // add getters
        classDeclaration.getOwnProperties().forEach((property) => {
            property.accept(this, Object.assign({}, parameters, {mode: 'getter'}));
        });

        // add setters
        classDeclaration.getOwnProperties().forEach((property) => {
            property.accept(this, Object.assign({}, parameters, {mode: 'setter'}));
        });

        // add plugin methods
        this.plugin.addClassMethods(classDeclaration, parameters);

        parameters.fileWriter.writeLine(0, '}' );
        this.endClassFile(classDeclaration, parameters);

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

        const fieldType = this.toJavaType(field.getType()) + array;

        const fieldName = field.getName();
        const getterName = 'get' + this.capitalizeFirstLetter(fieldName);
        const setterName = 'set' + this.capitalizeFirstLetter(fieldName);

        if (parameters.mode) {
            switch (parameters.mode) {
            case 'getter':
                parameters.fileWriter.writeLine(1, 'public ' + fieldType + ' ' + getterName + '() {');
                parameters.fileWriter.writeLine(2, 'return this.' + fieldName + ';');
                parameters.fileWriter.writeLine(1, '}');
                break;
            case 'setter':
                parameters.fileWriter.writeLine(1, 'public void ' + setterName + '(' + fieldType + ' ' + fieldName + ') {');
                parameters.fileWriter.writeLine(2, 'this.' + fieldName + ' = ' + fieldName + ';');
                parameters.fileWriter.writeLine(1, '}');
                break;
            default:
                parameters.fileWriter.writeLine(1, 'private ' + fieldType + ' ' + fieldName + ';' );
            }
        } else {
            parameters.fileWriter.writeLine(1, 'private ' + fieldType + ' ' + fieldName + ';' );
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
        parameters.fileWriter.writeLine(1, enumValueDeclaration.getName() + ',' );
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

        const relationshipType = this.toJavaType(relationship.getType()) + array;

        const relationshipName = relationship.getName();
        const getterName = 'get' + this.capitalizeFirstLetter(relationshipName);
        const setterName = 'set' + this.capitalizeFirstLetter(relationshipName);

        if (parameters.mode) {
            switch (parameters.mode) {
            case 'getter':
                parameters.fileWriter.writeLine(1, 'public ' + relationshipType + ' ' + getterName + '() {');
                parameters.fileWriter.writeLine(2, 'return this.' + relationshipName + ';');
                parameters.fileWriter.writeLine(1, '}');
                break;
            case 'setter':
                parameters.fileWriter.writeLine(1, 'public void ' + setterName + '(' + relationshipType + ' ' + relationshipName + ') {');
                parameters.fileWriter.writeLine(2, 'this.' + relationshipName + ' = ' + relationshipName + ';');
                parameters.fileWriter.writeLine(1, '}');
                break;
            default:
                parameters.fileWriter.writeLine(1, 'private ' + relationshipType + ' ' + relationshipName + ';' );
            }
        } else {
            parameters.fileWriter.writeLine(1, 'private ' + relationshipType + ' ' + relationshipName + ';' );
        }
        return null;
    }

    /**
     * Converts a Concerto type to a Java type. Primitive types are converted
     * everything else is passed through unchanged.
     * @param {string} type  - the concerto type
     * @return {string} the corresponding type in Java
     * @private
     */
    toJavaType(type) {
        switch(type) {
        case 'DateTime':
            return 'java.util.Date';
        case 'Boolean':
            return 'boolean';
        case 'String':
            return 'String';
        case 'Double':
            return 'double';
        case 'Long':
            return 'long';
        case 'Integer':
            return 'int';
        default:
            return type;
        }
    }

    /**
     * Capitalize the first letter of a string
     * @param {string} s - the input string
     * @return {string} the same string with first letter capitalized
     * @private
     */
    capitalizeFirstLetter(s) {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
}

module.exports = JavaVisitor;
