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

const JSONSchemaVisitor = require('../jsonschema/jsonschemavisitor');

/**
 * Convert the contents of a ModelManager
 * to an Open API 3.0.2 specification document, where
 * each concept declaration with a @resource decorator
 * becomes a RESTful resource addressable via a path.
 *
 * The JSON schema for the types is included in the
 * Open API document and is used to validate request and
 * response bodies.
 *
 * @private
 * @class
 */
class OpenApiVisitor {
    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters  - the parameters
     * @param {string} [parameters.openApiTitle] - the title property
     * of the Open API specification
     * @param {string} [parameters.openApiVersion] - the version property
     * of the Open API specification
     * @return {Object} the result of visiting or null
     * @private
     */
    visit(thing, parameters) {
        if (thing.isModelManager?.()) {
            return this.visitModelManager(thing, parameters);
        } else if (thing.isModelFile?.()) {
            return this.visitModelFile(thing, parameters);
        } else if (thing.isClassDeclaration?.()) {
            return this.visitClassDeclaration(thing, parameters);
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

        // get all the types
        const visitor = new JSONSchemaVisitor();
        const childParameters = {
            refRoot: '#/components/schemas'
        };
        const jsonSchema = modelManager.accept(visitor, childParameters);

        // Visit all of the files in the model manager.
        const title = parameters.openApiTitle ? parameters.openApiTitle : 'Generated Open API from Concerto Models';
        const version = parameters.openApiVersion ? parameters.openApiVersion : '1.0.0';

        let result = {
            openapi: '3.0.2',
            info: {
                title,
                version
            },
            components: {
                schemas: jsonSchema.definitions
            }
        };
        modelManager.getModelFiles().forEach((modelFile) => {
            const schema = modelFile.accept(this, parameters);
            result.paths = { ...result.paths, ...schema.paths };
        });

        if (parameters.fileWriter) {
            parameters.fileWriter.openFile('openapi.json');
            parameters.fileWriter.writeLine(0, JSON.stringify(result, null, 2));
            parameters.fileWriter.closeFile();
        }

        return result;
    }

    /**
     * Visitor design pattern
     * @param {ModelFile} modelFile - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitModelFile(modelFile, parameters) {

        let result = {
            paths: [],
        };
        const isResource = (decl) => {
            const decorators = decl.getDecorators();
            const hasResource = decorators?.some(
                (decorator) => decorator.getName() === 'resource'
            );
            return decl.isClassDeclaration() && hasResource;
        };

        modelFile
            .getAllDeclarations()
            .filter(isResource)
            .forEach((declaration) => {
                const type = declaration.accept(this, parameters);
                Object.keys(type).forEach( path => {
                    result.paths[path] = type[path];
                });
            });

        return result;
    }

    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitClassDeclaration(classDeclaration, parameters) {
        const name = classDeclaration.getName();
        const result = {};
        result[`/${name}`] = {
            'summary': `Path used to manage the list of ${name}.`,
            'description': `The REST endpoint/path used to list and create zero or more \`${name}\` entities.  This path contains a \`GET\` and \`POST\` operation to perform the list and create tasks, respectively.`,
            'get': {
                'responses': {
                    '200': {
                        'content': {
                            'application/json': {
                                'schema': {
                                    'type': 'array',
                                    'items': {
                                        '$ref': `#/components/schemas/${classDeclaration.getFullyQualifiedName()}`
                                    }
                                }
                            }
                        },
                        'description': `Successful response - returns an array of \`${name}\` entities.`
                    }
                },
                'operationId': `get${name}s`,
                'summary': `List All ${name}s`,
                'description': `Gets a list of all \`${name}\` entities.`
            },
            'post': {
                'requestBody': {
                    'description': `A new \`${name}\` to be created.`,
                    'content': {
                        'application/json': {
                            'schema': {
                                '$ref': `#/components/schemas/${classDeclaration.getFullyQualifiedName()}`
                            }
                        }
                    },
                    'required': true
                },
                'responses': {
                    '201': {
                        'description': 'Successful response.'
                    }
                },
                'operationId': `create${name}`,
                'summary': `Create a ${name}`,
                'description': `Creates a new instance of a \`${name}\`.`
            }
        };
        result[`/${name}/{${classDeclaration.getIdentifierFieldName()}}`] = {
            'summary': `Path used to manage a single ${name}.`,
            'description': `The REST endpoint/path used to get, update, and delete single instances of an \`${name}\`.  This path contains \`GET\`, \`PUT\`, and \`DELETE\` operations used to perform the get, update, and delete tasks, respectively.`,
            'get': {
                'responses': {
                    '200': {
                        'content': {
                            'application/json': {
                                'schema': {
                                    '$ref': `#/components/schemas/${classDeclaration.getFullyQualifiedName()}`
                                }
                            }
                        },
                        'description': `Successful response - returns a single \`${name}\`.`
                    }
                },
                'operationId': `get${name}`,
                'summary': `Get a ${name}`,
                'description': `Gets the details of a single instance of a \`${name}\`.`
            },
            'put': {
                'requestBody': {
                    'description': `Updated \`${name}\` information.`,
                    'content': {
                        'application/json': {
                            'schema': {
                                '$ref': `#/components/schemas/${classDeclaration.getFullyQualifiedName()}`
                            }
                        }
                    },
                    'required': true
                },
                'responses': {
                    '202': {
                        'description': 'Successful response.'
                    }
                },
                'operationId': `update${name}`,
                'summary': `Update a ${name}`,
                'description': `Updates an existing \`${name}\`.`
            },
            'delete': {
                'responses': {
                    '204': {
                        'description': 'Successful response.'
                    }
                },
                'operationId': `delete${name}`,
                'summary': `Delete a ${name}`,
                'description': `Deletes an existing \`${name}\`.`
            },
            'parameters': [
                {
                    'name': classDeclaration.getIdentifierFieldName(),
                    'description': `A unique identifier for a \`${classDeclaration.getName()}\`.`,
                    'schema': {
                        'type': 'string'
                    },
                    'in': 'path',
                    'required': true
                }
            ]
        };
        return result;
    }
}

module.exports = OpenApiVisitor;
