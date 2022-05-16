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

/**
 * Escapes a string so that it can be enclosed within
 * an XML attribute
 * @param {string} unsafe the string to escape
 * @returns {string} a string safe to include inside an XML attribute
 * @private
 */
function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, function (c) {
        switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        }
    });
}

/**
 * Convert the contents of a ModelManager
 * to an OData Schema.
 * Set a fileWriter property (instance of FileWriter) on the parameters
 * object to control where the generated code is written to disk.
 *
 * @private
 * @class
 * @memberof module:concerto-tools
 */
class ODataVisitor {
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
        } else if (thing.isDecorator?.()) {
            return this.visitDecorator(thing, parameters);
        } else {
            throw new Error('Unrecognised ' + JSON.stringify(thing));
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
        modelManager.getModelFiles(true).forEach((decl) => {
            decl.accept(this, parameters);
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
        parameters.fileWriter.openFile(`${modelFile.getNamespace()}.csdl`);
        parameters.fileWriter.writeLine(0, '<?xml version="1.0"?>');
        parameters.fileWriter.writeLine(0, '<edmx:Edmx xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx" Version="4.0">');
        parameters.fileWriter.writeLine(0, '<edmx:Reference Uri="http://docs.oasis-open.org/odata/odata/v4.0/cs01/vocabularies/Org.OData.Core.V1.xml">');
        parameters.fileWriter.writeLine(1, '<edmx:Include Namespace="Org.OData.Core.V1" Alias="Core" />');
        parameters.fileWriter.writeLine(0, '</edmx:Reference>');

        const importedNamespaces = [];
        for (let importedType of modelFile.getImports()) {
            const clazz = modelFile.getModelManager().getType(importedType);
            if (importedNamespaces.indexOf(clazz.getNamespace()) === -1) {
                importedNamespaces.push(clazz.getNamespace());
            }
        }

        // import the system namespace and then any explicitly required namespaces
        const importedNamespaces2 = [];
        // prevent namespaces being imported multiple times
        for (let importedType of modelFile.getImports()) {
            const clazz = modelFile.getModelManager().getType(importedType);
            if (importedNamespaces2.indexOf(clazz.getNamespace()) === -1) {
                importedNamespaces2.push(clazz.getNamespace());
                parameters.fileWriter.writeLine(0, `<edmx:Reference Uri="./${clazz.getNamespace()}.csdl">`);
                parameters.fileWriter.writeLine(1, `<edmx:Include Namespace="${clazz.getNamespace()}" />`);
                parameters.fileWriter.writeLine(0, '</edmx:Reference>');
            }
        }

        parameters.fileWriter.writeLine(0, '<edmx:DataServices>');
        parameters.fileWriter.writeLine(1, `<Schema xmlns="http://docs.oasis-open.org/odata/ns/edm" Namespace="${modelFile.getNamespace()}">`);

        modelFile.getAllDeclarations().forEach((decl) => {
            decl.accept(this, parameters);
        });

        parameters.fileWriter.writeLine(1, `<EntityContainer Name="${modelFile.getNamespace()}Service">`);
        modelFile.getAllDeclarations().forEach((decl) => {
            if (!decl.isAbstract() && decl.isIdentified()) {
                parameters.fileWriter.writeLine(2, `<EntitySet Name="${decl.getName()}" EntityType="${decl.getFullyQualifiedName()}"/>`);
            }
        });
        parameters.fileWriter.writeLine(1, '</EntityContainer>');

        parameters.fileWriter.writeLine(1, '</Schema>');
        parameters.fileWriter.writeLine(0, '</edmx:DataServices>');
        parameters.fileWriter.writeLine(0, '</edmx:Edmx>');
        parameters.fileWriter.closeFile();

        return null;
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitEnumDeclaration(classDeclaration, parameters) {
        parameters.fileWriter.writeLine(2, `<EnumType Name="${classDeclaration.getName()}">`);
        classDeclaration.getOwnProperties().forEach((property) => {
            property.accept(this, parameters);
        });
        parameters.fileWriter.writeLine(2, '</EnumType>');
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
        const stereoType = classDeclaration.isIdentified() ? 'EntityType' : 'ComplexType';
        const abstract = classDeclaration.isAbstract() ? 'Abstract="true"' : '';
        let superType = '';

        if (classDeclaration.getSuperType()) {
            superType = `BaseType="${classDeclaration.getSuperType()}"`;
        }
        parameters.fileWriter.writeLine(2, `<${stereoType} Name="${classDeclaration.getName()}" ${abstract} ${superType}>`);

        classDeclaration.getDecorators().forEach(decorator => {
            decorator.accept(this, parameters);
        });

        /**
         * Handle Keys (identifiers).
         * In OData a type can only specify a Key if not already specified by a super-type.
         * We therefore have to ensure that the $identifier key doesn't override any
         * user defined keys.
         */
        if (classDeclaration.getNamespace() !== 'concerto') {
            if (classDeclaration.isIdentified() &&
                classDeclaration.getOwnProperty(classDeclaration.getIdentifierFieldName())) {
                parameters.fileWriter.writeLine(3, `<Key><PropertyRef Name="${classDeclaration.getIdentifierFieldName()}"/></Key>`);
            }
        }

        classDeclaration.getOwnProperties().forEach((property) => {
            property.accept(this, parameters);
        });

        parameters.fileWriter.writeLine(2, `</${stereoType}>`);
        return null;
    }

    /**
     * Visitor design pattern
     * @param {Decorator} decorator - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitDecorator(decorator, parameters) {
        parameters.fileWriter.writeLine(4, `<Annotation Term="${decorator.getName()}" Bool="true"/>`);
        decorator.getArguments().forEach((arg, index) => {
            let argType = '';
            switch (typeof arg) {
            case 'number':
                argType = 'Float';
                break;
            case 'boolean':
                argType = 'Bool';
                break;
            default:
                argType = 'String';
            }
            parameters.fileWriter.writeLine(4, `<Annotation Term="${decorator.getName()}${index}" ${argType}="${arg.toString()}" />`);
        });
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
        let defaultValue = field.getDefaultValue() ? `DefaultValue="${escapeXml(field.getDefaultValue())}"` : '';
        const optional = field.isOptional() ? 'Nullable="true"' : '';
        const oDataType = this.toODataType(field.getFullyQualifiedTypeName());
        const type = field.isArray() ? `Collection(${oDataType})` : oDataType;
        parameters.fileWriter.writeLine(3, `<Property Name="${field.getName()}" Type="${type}" ${optional} ${defaultValue}>`);

        field.getDecorators().forEach(decorator => {
            decorator.accept(this, parameters);
        });
        parameters.fileWriter.writeLine(3, '</Property>');
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
        parameters.fileWriter.writeLine(3, `<Member Name="${enumValueDeclaration.getName()}">`);
        enumValueDeclaration.getDecorators().forEach(decorator => {
            decorator.accept(this, parameters);
        });
        parameters.fileWriter.writeLine(3, '</Member>');
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
        const typeName = this.toODataType(relationship.getFullyQualifiedTypeName());
        const type = relationship.isArray()
            ? `Collection(${typeName})` : typeName;
        const optional = relationship.isOptional() ? 'Nullable="true"' : '';
        parameters.fileWriter.writeLine(3, `<NavigationProperty Name="${relationship.getName()}" Type="${type}" ${optional}>`);
        relationship.getDecorators().forEach(decorator => {
            decorator.accept(this, parameters);
        });
        parameters.fileWriter.writeLine(3, '</NavigationProperty>');
        return null;
    }

    /**
     * Converts a Concerto type to an EDM OData type. Primitive types are converted
     * everything else is passed through unchanged.
     * @param {string} type  - the fully qualified concerto type name
     * @return {string} the corresponding type in EDM
     * @private
     */
    toODataType(type) {
        switch (type) {
        case 'DateTime':
            return 'Edm.DateTimeOffset';
        case 'Boolean':
            return 'Edm.Boolean';
        case 'String':
            return 'Edm.String';
        case 'Double':
            return 'Edm.Double';
        case 'Long':
            return 'Edm.Int64';
        case 'Integer':
            return 'Edm.Int32';
        default:
            return type;
        }
    }
}

module.exports = ODataVisitor;
