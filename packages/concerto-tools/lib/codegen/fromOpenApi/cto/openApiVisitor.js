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

const toJsonSchema = require('@openapi-contrib/openapi-schema-to-json-schema');
const migrate = require('json-schema-migrate');

const {
    JsonSchemaModel,
} = require('../../fromJsonSchema/cto/jsonSchemaClasses');
const JsonSchemaVisitor = require('../../fromJsonSchema/cto/jsonSchemaVisitor');

/**
 * Convert the contents of an OpenAPI definition file to a Concerto JSON model.
 * Set the following parameters to use:
 * - metaModelNamespace: the current metamodel namespace.
 * - namespace: the desired namespace of the generated model.
 *
 * @private
 * @class
 */
class OpenApiVisitor {
    /**
     * OpenAPI definition visitor.
     * @param {Object} openApiDefinition - the OpenAPI definition.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the Concerto JSON model.
     * @private
     */
    visitOpenApiDefinition(openApiDefinition, parameters) {
        // Filter and transform objects from OpenAPI URI paths to JSON Schema
        // compatible ones.
        const objectsFromPaths = Object.entries(
            openApiDefinition.body.paths || {}
        ).reduce(
            (acc, path) => {
                const requestBodyVerbs = ['post'];
                const pathUri = path[0];

                const pathRestVerbDeclarations = Object.fromEntries(
                    Object.entries(path[1])
                        .filter(
                            restVerbEntry => requestBodyVerbs
                                .includes(restVerbEntry[0]) &&
                            typeof restVerbEntry[1]
                                .requestBody
                                .content['application/x-www-form-urlencoded']
                                ?.schema === 'object'
                        ).map(
                            restVerbEntry => [
                                `${pathUri}/${restVerbEntry[0]}`,
                                restVerbEntry[1].requestBody
                                    .content['application/x-www-form-urlencoded']
                                    ?.schema
                            ]
                        )
                );

                return {...acc, ...pathRestVerbDeclarations};
            },
            {}
        );

        const reformedOpenApiDefinitionBody = {
            ...openApiDefinition.body,
            paths: objectsFromPaths,
        };

        const jsonSchemaModel = toJsonSchema(reformedOpenApiDefinitionBody);
        migrate.draft2020(jsonSchemaModel);
        const jsonSchemaModelClass = new JsonSchemaModel(jsonSchemaModel);
        const jsonSchemaVisitor = new JsonSchemaVisitor();

        // Retrieve declarations from the components.schemas part of the
        // definition.
        const inferredConcertoJsonModel = jsonSchemaModelClass.accept(
            jsonSchemaVisitor, {
                ...parameters,
                pathToDefinitions: ['components', 'schemas']
            }
        );

        const declarationsFromSchemas = (
            inferredConcertoJsonModel.models[0]?.declarations || []
        ).filter(
            declaration => declaration.properties !== undefined
        );

        // Retrieve declarations from the paths part of the
        // definition.
        const inferredConcertoJsonModelFromPaths = jsonSchemaModelClass.accept(
            jsonSchemaVisitor, {
                ...parameters,
                pathToDefinitions: ['paths']
            }
        );

        const declarationsFromPaths = (
            inferredConcertoJsonModelFromPaths.models[0]?.declarations || []
        ).filter(
            declaration => declaration.properties !== undefined
        );

        // Combine the declarations from all sources.
        const declarations = [
            ...declarationsFromSchemas,
            ...declarationsFromPaths,
        ];

        const convertedModel = {
            $class: `${parameters.metaModelNamespace}.Model`,
            decorators: [],
            namespace: parameters.namespace,
            imports: [],
            declarations,
        };

        const concertoJsonModel = {
            $class: `${parameters.metaModelNamespace}.Models`,
            models: [
                convertedModel
            ],
        };

        return concertoJsonModel;
    }
    /**
     * Visitor dispatch i.e. main entry point to this visitor.
     * @param {Object} thing - the visited entity.
     * @param {Object} parameters - the visitor parameters.
     * Set the following parameters to use:
     * - metaModelNamespace: the current metamodel namespace.
     * - namespace: the desired namespace of the generated model.
     *
     * @return {Object} the result of visiting or undefined.
     * @public
     */
    visit(thing, parameters) {
        if (thing.isOpenApiDefinition) {
            return this.visitOpenApiDefinition(thing, parameters);
        }
    }
}

module.exports = OpenApiVisitor;
