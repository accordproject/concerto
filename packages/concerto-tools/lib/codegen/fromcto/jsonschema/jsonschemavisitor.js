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

const AssetDeclaration = require('@accordproject/concerto-core').AssetDeclaration;
const ClassDeclaration = require('@accordproject/concerto-core').ClassDeclaration;
const EnumDeclaration = require('@accordproject/concerto-core').EnumDeclaration;
const ConceptDeclaration = require('@accordproject/concerto-core').ConceptDeclaration;
const EnumValueDeclaration = require('@accordproject/concerto-core').EnumValueDeclaration;
const Field = require('@accordproject/concerto-core').Field;
const ModelFile = require('@accordproject/concerto-core').ModelFile;
const ModelManager = require('@accordproject/concerto-core').ModelManager;
const RelationshipDeclaration = require('@accordproject/concerto-core').RelationshipDeclaration;
const TransactionDeclaration = require('@accordproject/concerto-core').TransactionDeclaration;
const debug = require('debug')('concerto-core:jsonschemavisitor');
const util = require('util');

/**
 * Convert the contents of a {@link ModelManager} instance to a set of JSON
 * Schema v4 files - one per concrete asset and transaction type.
 * Set a fileWriter property (instance of {@link FileWriter}) on the parameters
 * object to control where the generated code is written to disk.
 * @private
 * @class
 * @memberof module:concerto-tools
 */
class JSONSchemaVisitor {

    /**
     * Gets an object with all the decorators for a model element. The object
     * is keyed by decorator name, while the values are the decorator arguments.
     * @param {object} decorated a ClassDeclaration or a Property
     */
    getDecorators(decorated) {
        // add information about decorators
        return decorated.getDecorators() && decorated.getDecorators().length > 0 ?
            decorated.getDecorators().reduce( (acc, d) => {
                acc[d.getName()] = d.getArguments();
                return acc;
            }, {})
        : null;
    }

    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visit(thing, parameters) {
        if (thing instanceof ModelManager) {
            return this.visitModelManager(thing, parameters);
        } else if (thing instanceof ModelFile) {
            return this.visitModelFile(thing, parameters);
        } else if (thing instanceof AssetDeclaration) {
            return this.visitAssetDeclaration(thing, parameters);
        } else if (thing instanceof TransactionDeclaration) {
            return this.visitTransactionDeclaration(thing, parameters);
        } else if (thing instanceof EnumDeclaration) {
            return this.visitEnumDeclaration(thing, parameters);
        } else if (thing instanceof ConceptDeclaration) {
            return this.visitConceptDeclaration(thing, parameters);
        } else if (thing instanceof ClassDeclaration) {
            return this.visitClassDeclaration(thing, parameters);
        } else if (thing instanceof Field) {
            return this.visitField(thing, parameters);
        } else if (thing instanceof RelationshipDeclaration) {
            return this.visitRelationshipDeclaration(thing, parameters);
        } else if (thing instanceof EnumValueDeclaration) {
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

        // Save the model manager so that we have access to it later.
        parameters.modelManager = modelManager;

        // Visit all of the files in the model manager.
        let result = {
            $schema : 'http://json-schema.org/draft-07/schema#' // default for https://github.com/ajv-validator/ajv
        };
        modelManager.getModelFiles().forEach((modelFile) => {
            result = { ... result, ... modelFile.accept(this, parameters) };
        });

        if(parameters.rootType) {
            const classDecl = modelManager.getType(parameters.rootType);
            const schema = classDecl.accept(this, parameters)
            result = { ... result, ... schema.schema };
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

        // Save the model file so that we have access to it later.
        parameters.modelFile = modelFile;

        // Visit all of the asset and transaction declarations, but ignore the abstract ones.
        let result = {
            definitions : {}
        };
        modelFile.getAllDeclarations().filter((declaration) => {
            return !declaration.isAbstract();
        }).
            forEach((declaration) => {
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
            pattern: classDeclaration.getFullyQualifiedName().split('.').join('\\.'),
            description: 'The class identifier for this type'
        };

        result.schema.required.push('$class');

        // Walk over all of the properties of this class and its super classes.
        classDeclaration.getProperties().forEach((property) => {

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
            result.schema['$decorators'] = decorators;
        }

        // Return the created schema.
        return result;
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

            const validator = field.getValidator();

            // Render the type as JSON Schema.
            jsonSchema = {};

            if(field.getDefaultValue() !== null) {
                jsonSchema.default = field.getDefaultValue();
            }

            switch (field.getType()) {
            case 'String':
                jsonSchema.type = 'string';
                if(validator) {
                    jsonSchema.pattern = `^${validator.getRegex().toString().slice(1,-1)}$`
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
            let type = parameters.modelFile.getModelManager().getType(field.getFullyQualifiedTypeName());
            jsonSchema = { $ref: `#/definitions/${type.getFullyQualifiedName()}` };
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
            jsonSchema['$decorators'] = decorators;
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
            result.schema['$decorators'] = decorators;
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
            jsonSchema['$decorators'] = decorators;
        }

        // Return the schema.
        return jsonSchema;
    }

}

module.exports = JSONSchemaVisitor;
