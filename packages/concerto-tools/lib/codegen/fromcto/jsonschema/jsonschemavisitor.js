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
const RecursionDetectionVisitor = require('./recursionvisitor');
const { ModelUtil } = require('@accordproject/concerto-core');

/**
 * Convert the contents of a {@link ModelManager} to a JSON Schema, returning
 * the schema for all types under the 'definitions' key. If the 'rootType'
 * parameter option is set to a fully-qualified type name, then the properties
 * of the type are also added to the root of the schema object.
 *
 * If the fileWriter parameter is set then the JSONSchema will be written to disk.
 *
 * Note that by default $ref is used to references types, unless
 * the `inlineTypes` parameter is set, in which case types are expanded inline,
 * UNLESS they contain recursive references, in which case $ref is used.
 *
 * The default value for refRoot is '#/definitions'. Set the refRoot parameter
 * to override.
 *
 * The meta schema used is http://json-schema.org/draft-07/schema#
 *
 * @private
 * @class
 * @memberof module:concerto-tools
 */
class JSONSchemaVisitor {

    /**
     * Gets an object with all the decorators for a model element. The object
     * is keyed by decorator name, while the values are the decorator arguments.
     * @param {object} decorated a ClassDeclaration or a Property
     * @returns {object} the decorators
     */
    getDecorators(decorated) {
        // add information about decorators
        return decorated.getDecorators() && decorated.getDecorators().length > 0
            ? decorated.getDecorators().reduce( (acc, d) => {
                acc[d.getName()] = d.getArguments();
                return acc;
            }, {})
            : null;
    }

    /**
     * Get the validators for a field or a scalar definition in JSON schema form.
     * @param {Object} field - the scalar declaration being visited
     * @return {Object} the result of visiting or null
     * @private
     */
    getFieldOrScalarDeclarationValidatorsForSchema(field) {
        const validator = field.getValidator();
        let jsonSchema = {};

        switch (field.getType()) {
        case 'String':
            jsonSchema.type = 'string';
            if(validator) {
                // Note that regex flags are lost in this transformation
                jsonSchema.pattern = validator.getRegex().source;
            }
            break;
        case 'Double':
            jsonSchema.type = 'number';
            if(validator) {
                if(validator.getLowerBound() !== null) {
                    jsonSchema.minimum = validator.getLowerBound();
                }
                if(validator.getUpperBound() !== null) {
                    jsonSchema.maximum = validator.getUpperBound();
                }
            }
            break;
        case 'Integer':
        case 'Long':
            jsonSchema.type = 'integer';
            if(validator) {
                if(validator.getLowerBound() !== null) {
                    jsonSchema.minimum = Math.trunc(validator.getLowerBound());
                }
                if(validator.getUpperBound() !== null) {
                    jsonSchema.maximum = Math.trunc(validator.getUpperBound());
                }
            }
            break;
        case 'DateTime':
            jsonSchema.format = 'date-time';
            jsonSchema.type = 'string';
            break;
        case 'Boolean':
            jsonSchema.type = 'boolean';
            break;
        }

        return jsonSchema;
    }

    /**
     * Returns true if the class declaration contains recursive references.
     *
     * Basic example:
     * concept Person {
     *   o Person[] children
     * }
     *
     * @param {object} classDeclaration the class being visited
     * @returns {boolean} true if the model is recursive
     */
    isModelRecursive(classDeclaration) {
        const visitor = new RecursionDetectionVisitor();
        return classDeclaration.accept( visitor, {stack : []} );
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
        } else if (thing.isScalarDeclaration?.()) {
            return this.visitScalarDeclaration(thing, parameters);
        } else if (thing.isEnumValue?.()) {
            return this.visitEnumValueDeclaration(thing, parameters);
        } else {
            throw new Error('Unrecognised type: ' + typeof thing + ', value: ' + util.inspect(thing, { showHidden: true, depth: null }));
        }
    }

    /**
     * Visitor design pattern
     * @param {ModelManager} modelManager - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitModelManager(modelManager, parameters) {
        debug('entering visitModelManager');

        // Visit all of the files in the model manager.
        let result = {
            $schema : 'http://json-schema.org/draft-07/schema#', // default for https://github.com/ajv-validator/ajv
            definitions: {}
        };
        modelManager.getModelFiles().forEach((modelFile) => {
            const schema = modelFile.accept(this, parameters);
            result.definitions = { ... result.definitions, ... schema.definitions };
        });

        if(parameters.rootType) {
            const classDecl = modelManager.getType(parameters.rootType);
            const schema = classDecl.accept(this, parameters);
            result = { ... result, ... schema.schema };
        }

        if(parameters.fileWriter) {
            const fileName = parameters.rootType ? `${parameters.rootType}.json` : 'schema.json';
            parameters.fileWriter.openFile(fileName);
            parameters.fileWriter.writeLine(0, JSON.stringify(result, null, 2));
            parameters.fileWriter.closeFile();
        }

        return result;
    }

    /**
     * Visitor design pattern
     * @param {ModelFile} modelFile - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitModelFile(modelFile, parameters) {
        debug('entering visitModelFile', modelFile.getNamespace());

        // Visit all of the asset and transaction declarations
        let result = {
            definitions : {}
        };
        modelFile.getAllDeclarations()
            .forEach((declaration) => {
                const type = declaration.accept(this, parameters);
                result.definitions[type.$id] = type.schema;
            });

        return result;
    }

    /**
     * Visitor design pattern
     * @param {AssetDeclaration} assetDeclaration - the object being visited
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
     * @param {TransactionDeclaration} transactionDeclaration - the object being visited
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
     * @param {ConceptDeclaration} conceptDeclaration - the object being visited
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
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitClassDeclaration(classDeclaration, parameters) {
        debug('entering visitClassDeclaration', classDeclaration.getName());
        return this.visitClassDeclarationCommon(classDeclaration, parameters);
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @param {Object} jsonSchema - the base JSON Schema object to use
     * @return {Object} the result of visiting or null
     * @private
     */
    visitClassDeclarationCommon(classDeclaration, parameters) {
        debug('entering visitClassDeclarationCommon', classDeclaration.getName());

        parameters.inlineTypes = parameters.inlineTypes ? !this.isModelRecursive(classDeclaration) : false;

        const result = {
            $id: classDeclaration.getFullyQualifiedName(),
            schema: {
                title: classDeclaration.getName(),
                description : `An instance of ${classDeclaration.getFullyQualifiedName()}`,
                type: 'object',
                properties: {},
                required: []
            }};

        // Every class declaration has a $class property.
        result.schema.properties.$class = {
            type: 'string',
            default: classDeclaration.getFullyQualifiedName(),
            pattern: `^${classDeclaration.getFullyQualifiedName().split('.').join('\\.')}$`,
            description: `The class identifier for ${classDeclaration.getFullyQualifiedName()}`
        };

        result.schema.required.push('$class');

        // Walk over all of the properties of this class and its super classes.
        classDeclaration.getProperties().forEach((property) => {

            if (property.getName().charAt(0) === '$') { // XXX Probably need a utility function (one is in resourcevalidator)
                return;
            }
            // Get the schema for the property.
            result.schema.properties[property.getName()] = property.accept(this, parameters);

            // If the property is required, add it to the list.
            if (!property.isOptional()) {
                result.schema.required.push(property.getName());
            }
        });

        // add the decorators
        const decorators = this.getDecorators(classDeclaration);
        if(decorators) {
            result.schema.$decorators = decorators;
        }

        // Return the created schema.
        return result;
    }

    /**
     * Visitor design pattern
     * @param {ScalarDeclaration} scalarDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitScalarDeclaration(scalarDeclaration, parameters) {
        debug('entering visitScalarDeclaration', scalarDeclaration.getName());
        return {
            $id: scalarDeclaration.getFullyQualifiedName(),
            schema: this.getFieldOrScalarDeclarationValidatorsForSchema(scalarDeclaration)
        };
    }

    /**
     * Visitor design pattern
     * @param {Field} field - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitField(field, parameters) {
        debug('entering visitField', field.getName());

        // Is this a primitive typed property?
        let jsonSchema;
        if (field.isPrimitive()) {
            // Render the type as JSON Schema.
            jsonSchema = {};

            if(field.getDefaultValue() !== null) {
                jsonSchema.default = field.getDefaultValue();
            }

            jsonSchema = {
                ...jsonSchema,
                ...this.getFieldOrScalarDeclarationValidatorsForSchema(field)
            };

            // If this field has a default value, add it.
            if (field.getDefaultValue()) {
                jsonSchema.default = field.getDefaultValue();
            }

            // If this is the identifying field, mark it as such.
            if (field.getName() === field.getParent().getIdentifierFieldName()) {
                jsonSchema.description = 'The instance identifier for this type';
            }

        // Not primitive, so must be a class or enumeration!
        } else {
            // Look up the type of the property.
            const type = field.getParent().getModelFile().getModelManager().getType(field.getFullyQualifiedTypeName());

            // get all the types that extend the type, including this type
            const derivedTypes = type.getAssignableClassDeclarations();
            let jsonSchemaTypes = [];

            derivedTypes.forEach( (derivedType) => {
                if(!parameters.inlineTypes) {
                    const refRoot = parameters.refRoot ? parameters.refRoot : '#/definitions';
                    jsonSchemaTypes.push({ $ref: `${refRoot}/${derivedType.getFullyQualifiedName()}` });
                } else {
                    // inline the schema
                    jsonSchemaTypes.push(this.visit( derivedType, parameters ).schema);
                }
            });

            jsonSchema = jsonSchemaTypes.length >= 2 ? {
                anyOf : jsonSchemaTypes
            } : jsonSchemaTypes[0];
        }

        // Is the type an array?
        if (field.isArray()) {
            jsonSchema = {
                type: 'array',
                items: jsonSchema
            };
        }

        // add the decorators
        const decorators = this.getDecorators(field);
        if(decorators) {
            jsonSchema.$decorators = decorators;
        }

        // Return the schema.
        return jsonSchema;
    }

    /**
     * Visitor design pattern
     * @param {EnumDeclaration} enumDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitEnumDeclaration(enumDeclaration, parameters) {
        debug('entering visitEnumDeclaration', enumDeclaration.getName());

        const result = {
            $id: enumDeclaration.getFullyQualifiedName(),
            schema: {
                title: enumDeclaration.getName(),
                description : `An instance of ${enumDeclaration.getFullyQualifiedName()}`,
                enum: []
            }};

        // Walk over all of the properties which should just be enum value declarations.
        enumDeclaration.getProperties().forEach((property) => {
            result.schema.enum.push(property.accept(this, parameters));
        });

        // add the decorators
        const decorators = this.getDecorators(enumDeclaration);
        if(decorators) {
            result.schema.$decorators = decorators;
        }

        // Return the schema.
        return result;
    }

    /**
     * Visitor design pattern
     * @param {EnumValueDeclaration} enumValueDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitEnumValueDeclaration(enumValueDeclaration, parameters) {
        debug('entering visitEnumValueDeclaration', enumValueDeclaration.getName());

        // The "schema" in this case is just the name of the value.
        return enumValueDeclaration.getName();

    }

    /**
     * Visitor design pattern
     * @param {RelationshipDeclaration} relationshipDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitRelationshipDeclaration(relationshipDeclaration, parameters) {
        debug('entering visitRelationship', relationshipDeclaration.getName());

        // Create the schema.
        let jsonSchema = {
            type: 'string',
            description: `The identifier of an instance of ${relationshipDeclaration.getFullyQualifiedTypeName()}`
        };

        // Retrieve type of the id field of a relationship declaration
        // if data type is uuid, then add the format.
        const relationshipTypeDecl = relationshipDeclaration.getModelFile().getModelManager().getType(relationshipDeclaration.getFullyQualifiedTypeName());
        const idPropertyName = relationshipTypeDecl.getIdentifierFieldName();
        if (idPropertyName) {
            const qualifiedType = relationshipTypeDecl.getProperty(idPropertyName).getFullyQualifiedTypeName();
            const type = ModelUtil.removeNamespaceVersionFromFullyQualifiedName(qualifiedType);
            if (type === 'concerto.scalar.UUID') {
                jsonSchema.format = 'uuid';
            }
        }

        // Is the type an array?
        if (relationshipDeclaration.isArray()) {
            jsonSchema = {
                type: 'array',
                items: jsonSchema
            };
        }

        // add the decorators
        const decorators = this.getDecorators(relationshipDeclaration);
        if(decorators) {
            jsonSchema.$decorators = decorators;
        }

        // Return the schema.
        return jsonSchema;
    }
}

module.exports = JSONSchemaVisitor;
