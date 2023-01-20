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

const getValue = require('get-value');

const {
    LocalReference,
    Reference,
    ArrayProperty,
    Property,
    Properties,
    NonEnumDefinition,
    EnumDefinition,
    Definition,
    Definitions,
} = require('./jsonSchemaClasses.js');

/**
 * Convert the contents of a JSON Schema file to a Concerto JSON model.
 * Set the following parameters to use:
 * - metaModelNamespace: the current metamodel namespace.
 * - namespace: the desired namespace of the generated model.
 *
 * @private
 * @class
 */
class JsonSchemaVisitor {
    /**
     * Returns true if the property maps to the Concerto DateTime type.
     * @param {Object} property - a JSON Schema model property.
     *
     * @return {Boolean} "true" if the property maps to the Concerto DateTime
     * type.
     * @private
     */
    isDateTimeProperty(property) {
        return property.body.format &&
            (
                property.body.format === 'date-time' ||
                property.body.format === 'date'
            );
    }
    /**
     * Returns true if the property contains an "anyOf" or a "oneOf" element.
     * @param {Object} property - a JSON Schema model property.
     *
     * @return {Boolean} "true" if the property contains aan "anyOf" or a
     * "oneOf" element.
     * @private
     */
    doesPropertyContainAlternation(property) {
        return !!(property.body.anyOf || property.body.oneOf);
    }
    /**
     * Flatten a property containing an "anyOf" or a "oneOf" element.
     * @param {Object} property - a JSON Schema model property.
     *
     * @return {Object} a JSON Schema model property with the "anyOf" or
     * "oneOf" elements resolved.
     * @private
     */
    flattenAlternationInProperty(property) {
        // eslint-disable-next-line no-console
        console.warn(
            `Keyword '${
                property.body.anyOf ? 'anyOf' : 'oneOf'
            }' in definition '${
                property.path[property.path.length - 1]
            }' is not fully supported. Defaulting to first alternative.`
        );

        const propertyWithoutAlternations = Object.fromEntries(
            Object.entries(property.body)
                .filter(
                    property => ![
                        'anyOf', 'oneOf'
                    ].includes(property[0])
                )
        );

        const alternation = (
            property.body.anyOf ||
            property.body.oneOf
        )[0];

        return {
            ...propertyWithoutAlternations,
            ...alternation,
        };
    }
    /**
     * Returns true if the property contains a JSON Schema model reference.
     * @param {Object} property - a JSON Schema model property.
     *
     * @return {Boolean} "true" if the property contains a JSON Schema model
     * reference.
     * @private
     */
    isReference(property) {
        return typeof property.body.$ref === 'string';
    }
    /**
     * Returns true if the string is a JSON Schema model local
     * reference one.
     * @param {String} potentialReferenceString - a JSON Schema model local
     * reference string.
     *
     * @return {Boolean} "true" if the string is a JSON Schema model local
     * reference one.
     * @private
     */
    isStringLocalReference(potentialReferenceString) {
        return potentialReferenceString.charAt(0) === '#';
    }
    /**
     * Parses a local reference string.
     * @param {Object} referenceString - a JSON Schema model local reference
     * string.
     *
     * @return {String[]} the path to the reffered object.
     * @private
     */
    parseLocalReferenceString(referenceString) {
        return referenceString
            .slice(1, referenceString.length)
            .split('/')
            .filter(pathSegment => pathSegment.length > 0);
    }
    /**
     * Infers a primitive Concerto type from a JSON Schema model property.
     * @param {Object} property - a JSON Schema model property.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the primitive Concerto type inferred from the JSON
     * Schema model property.
     * @private
     */
    inferPrimitiveConcertoType(property, parameters) {
        if (property.body.type) {
            switch (property.body.type) {
            case 'string':
                if (
                    this.isDateTimeProperty(property)
                ) {
                    return `${parameters.metaModelNamespace}.DateTimeProperty`;
                }

                if (property.body.format) {
                    // eslint-disable-next-line no-console
                    console.warn(
                        `Format '${property.body.format}' in '${
                            property.path[property.path.length - 1]
                        }' is not supported. It has been ignored.`
                    );
                }

                return `${parameters.metaModelNamespace}.StringProperty`;
            case 'boolean':
                return `${parameters.metaModelNamespace}.BooleanProperty`;
            case 'number':
                return `${parameters.metaModelNamespace}.DoubleProperty`;
            case 'integer':
                // Could also be Long?
                return `${parameters.metaModelNamespace}.IntegerProperty`;
            default:
                throw new Error(
                    `Type keyword '${property.body.type}' in '${
                        property.path[property.path.length - 1]
                    }' is not supported.`
                );
            }
        }
    }
    /**
     * Normalizes a name by replacing forbidden characters with "$_".
     * @param {Object} name - a name.
     *
     * @return {Object} a normalized name.
     * @private
     */
    normalizeName(name) {
        return name.replaceAll(/\/|{|}/ig, '$_');
    }
    /**
     * Infers a Concerto concept name from a JSON Schema model inline property
     * path.
     * @param {Object} propertyPath - a JSON Schema model property path.
     * @param {Object} options - the options:
     * - removePropertiesSegment: removes any occurances of "properties" from
     * the generated name.
     *
     * @return {Object} the Concerto concept name inferred from the JSON Schema
     * model inline object property path.
     * @private
     */
    inferInlineObjectConceptName(propertyPath, options) {
        return `${
            propertyPath
                // Note: We're running the risk of removing objects legitimately named "properties".
                .filter(
                    (segment) => options.removePropertiesSegment &&
                        segment !== 'properties'
                )
                .join('$_')
        }`;
    }
    /**
     * Infers a type-specific validator, appropriate to a Concerto primitive.
     * @param {Object} property - a JSON Schema model property.
     * @param {Object} metaModelNamespace - the Concerto meta model namespace.
     *
     * @return {Object} the Concerto field validator inferred from the JSON
     * Schema model property.
     * @private
     */
    inferTypeSpecificValidator(property, metaModelNamespace) {
        if (
            (
                property.body.type === 'integer' ||
                property.body.type === 'number'
            ) &&
            (property.body.minimum || property.body.exclusiveMaximum)
        ) {
            return {
                validator: {
                    $class: `${metaModelNamespace}.${
                        property.body.type === 'number'
                            ? 'DoubleDomainValidator'
                            : 'IntegerDomainValidator'
                    }`,
                    // Note: Concerto does not provide syntax for exclusive minimum or inclusive maximum
                    // https://json-schema.org/understanding-json-schema/reference/numeric.html#range
                    ...(
                        property.body.minimum
                            ? { lower: property.body.minimum }
                            : {}
                    ),
                    ...(
                        property.body.exclusiveMaximum
                            ? { upper: property.body.exclusiveMaximum }
                            : {}
                    ),
                }
            };
        }

        if (
            property.body.type === 'string' &&
            !this.isDateTimeProperty(property) &&
            property.body.pattern
        ) {
            return {
                validator: {
                    $class: `${metaModelNamespace}.StringRegexValidator`,
                    pattern: property.body.pattern,
                    flags: 'u',
                }
            };
        }

        return {};
    }
    /**
     * Infers a type-specific property, mapping to a Concerto primitive.
     * @param {Object} property - a JSON Schema model property.
     * @param {Object} metaModelNamespace - the Concerto meta model namespace.
     *
     * @return {Object} the Concerto field inferred from the JSON Schema model
     * property.
     * @private
     */
    inferTypeSpecificProperties(property, metaModelNamespace) {
        if (
            ['boolean', 'integer', 'number', 'string']
                .includes(property.body.type)
        ) {
            return {
                // Warning: The semantics of this default property differs between JSON Schema and Concerto
                // JSON Schema does not fill in missing values during validation, whereas Concerto does
                // https://json-schema.org/understanding-json-schema/reference/generic.html#id2
                ...(
                    ['boolean', 'number', 'string']
                        .includes(typeof property.body.default) &&
                        { defaultValue: property.body.default }
                ),
                ...this.inferTypeSpecificValidator(property, metaModelNamespace)
            };
        }
    }
    /**
     * Local reference property visitor.
     * @param {Object} reference - a JSON Schema model local reference property.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the Concerto fields and declarations inferred from
     * the JSON Schema model local reference property. A property can spawn
     * declarations as well, if it contains inline objects.
     * @private
     */
    visitLocalReference(reference, parameters) {
        const pathToDefinition = this.parseLocalReferenceString(reference.body);
        const pathToDefinitions = parameters.pathToDefinitions ||
            ['definitions'];

        if (
            pathToDefinition.slice(0, -1).toString() ===
            pathToDefinitions.toString()
        ) {
            const definitionName = pathToDefinition[
                pathToDefinition.length - 1
            ];

            const definition = getValue(
                parameters.jsonSchemaModel,
                [
                    ...(
                        parameters.pathToDefinitions ||
                            ['definitions']
                    ),
                    definitionName
                ],
            );

            return (
                new Definition(definition, pathToDefinition)
            ).accept(this, parameters);
        }
    }
    /**
     * Reference property visitor.
     * @param {Object} reference - a JSON Schema model reference property.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the Concerto fields and declarations inferred from
     * the JSON Schema model reference property. A property can spawn
     * declarations as well, if it contains inline objects.
     * @private
     */
    visitReference(reference, parameters) {
        if (this.isStringLocalReference(reference.body)) {
            return (new LocalReference(reference.body, reference.path))
                .accept(this, parameters);
        }
        // TODO: Handle remote reference.
        // TODO: Handle URL reference.
    }
    /**
     * Array property visitor.
     * @param {Object} arrayProperty - a JSON Schema model array property.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the Concerto fields and declarations inferred from
     * the JSON Schema model array property. A property can spawn declarations
     * as well, if it contains inline objects.
     * @private
     */
    visitArrayProperty(arrayProperty, parameters) {
        parameters.assignableFields = {
            ...parameters.assignableFields,
            isArray: true,
        };

        return (new Property(arrayProperty.body.items, arrayProperty.path))
            .accept(this, parameters);
    }
    /**
     * Property visitor.
     * @param {Object} property - a JSON Schema model property.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the Concerto fields and declarations inferred from
     * the JSON Schema model property. A property can spawn declarations as
     * well, if it contains inline objects.
     * @private
     */
    visitProperty(property, parameters) {
        const propertyName = property.path[
            property.path.length - 1
        ];

        const propertyProperties = {
            ...{
                name: propertyName,
                isArray: false,
                isOptional: !parameters.required
                    ?.includes(propertyName),
            },
            ...parameters.assignableFields
        };
        delete parameters.assignableFields;

        // Handle reserved properties.
        if (['$identifier', '$class'].includes(propertyName)) {
            return;
        }

        // Handle an array.
        if (
            property.body.type === 'array' &&
            typeof property.body.items === 'object'
        ) {
            return (new ArrayProperty(property.body, property.path))
                .accept(this, parameters);
        }

        // Handle anyOf or oneOf.
        if (this.doesPropertyContainAlternation(property)) {
            return (
                new Property(
                    this.flattenAlternationInProperty(
                        property
                    ),
                    property.path
                )
            ).accept(this, parameters);
        }

        // Handle a reference.
        if (this.isReference(property)) {
            const referenced = (
                new Reference(property.body.$ref, property.path)
            ).accept(this, parameters);

            return {
                $class: `${parameters.metaModelNamespace}.ObjectProperty`,
                ...propertyProperties,
                type: {
                    $class: `${parameters.metaModelNamespace}.TypeIdentifier`,
                    name: this.normalizeName(referenced.name)
                }
            };
        }

        // Handle an undefined type.
        if (
            property.body.type === 'object' &&
            // typeof property.body.properties === 'undefined' &&
            (
                typeof property.body.additionalProperties === 'object' ||
                typeof property.body.properties !== 'object'
            )
        ) {
            return {
                $class: `${parameters.metaModelNamespace}.StringProperty`,
                ...propertyProperties,
                decorators: [
                    {
                        $class: 'concerto.metamodel@1.0.0.Decorator',
                        name: 'StringifiedJson',
                    }
                ]
            };
        }

        // Handle an inline object.
        if (
            property.body.type === 'object' &&
            typeof property.body.properties === 'object'
        ) {
            const inlineObjectDerivedConceptName = this.inferInlineObjectConceptName(
                property.path,
                {
                    removePropertiesSegment: true,
                }
            );

            const inlineObjectDerivedConcept = (
                new Definition(
                    property.body,
                    [inlineObjectDerivedConceptName],
                )
            ).accept(this, parameters);

            return [
                {
                    $class: `${parameters.metaModelNamespace}.ObjectProperty`,
                    ...propertyProperties,
                    type: {
                        $class: `${parameters.metaModelNamespace}.TypeIdentifier`,
                        name: this.normalizeName(
                            inlineObjectDerivedConceptName
                        ),
                    }
                },
                inlineObjectDerivedConcept
            ];
        }

        // Handle primitive types.
        return {
            $class: this.inferPrimitiveConcertoType(
                property, parameters
            ),
            ...propertyProperties,
            ...this.inferTypeSpecificProperties(
                property, parameters.metaModelNamespace
            )
        };
    }
    /**
     * Property visitor.
     * @param {Object} properties - the JSON Schema model properties.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the Concerto fields and declarations inferred from
     * the JSON Schema model properties. A property can spawn declarations as
     * well, if it contains inline objects.
     * @private
     */
    visitProperties(properties, parameters) {
        const propertyClasses = Object.entries(properties.body)
            .map(
                ([propertyName, propertyBody]) => new Property(
                    propertyBody,
                    [...properties.path, propertyName]
                )
            );


        return propertyClasses
            .map(
                propertyClass => propertyClass.accept(this, parameters)
            )
            .flat(Infinity)
            .filter(field => field);
    }
    /**
     * Non-enum definition visitor.
     * @param {Object} nonEnumDefinition - a JSON Schema model non-enum
     * definition.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the Concerto declaration or declarations inferred from
     * the JSON Schema model non-enum definition. A definition can spawn more
     * than one Concerto declarations if it contains inline objects.
     * @private
     */
    visitNonEnumDefinition(nonEnumDefinition, parameters) {
        const conceptWithoutProperties = {
            $class: `${parameters.metaModelNamespace}.ConceptDeclaration`,
            name: this.normalizeName(
                nonEnumDefinition.path[
                    nonEnumDefinition.path.length - 1
                ]
            ),
            isAbstract: false,
        };

        if (
            nonEnumDefinition.body.properties !== undefined &&
            nonEnumDefinition.body.properties !== null
        ) {
            const propertiesAndInlineObjectDerived = (
                new Properties(
                    nonEnumDefinition.body.properties,
                    [...nonEnumDefinition.path, 'properties']
                )
            ).accept(this, {
                ...parameters,
                required: nonEnumDefinition.body.required,
            });

            const inlineObjectDerived = [
                `${parameters.metaModelNamespace}.ConceptDeclaration`,
                `${parameters.metaModelNamespace}.EnumDeclaration`,
            ];

            const properties = propertiesAndInlineObjectDerived
                .filter(
                    propertyOrInlineDerivedConcept =>
                        !inlineObjectDerived
                            .includes(propertyOrInlineDerivedConcept.$class)
                );

            const inlineObjectConcepts = propertiesAndInlineObjectDerived
                .filter(
                    propertyOrInlineDerivedConcept =>
                        inlineObjectDerived
                            .includes(propertyOrInlineDerivedConcept.$class)
                );

            const conceptDeclaration = {
                ...conceptWithoutProperties,
                properties
            };

            if (inlineObjectConcepts.length > 0) {
                return [conceptDeclaration, ...inlineObjectConcepts];
            }

            return conceptDeclaration;
        }

        return [conceptWithoutProperties];
    }
    /**
     * Enum definition visitor.
     * @param {Object} enumDefinition - a JSON Schema model enum definition.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the Concerto enum declaration inferred from
     * the JSON Schema model enum definition.
     * @private
     */
    visitEnumDefinition(enumDefinition, parameters) {
        const properties = enumDefinition.body.enum.map(
            enumName => ({
                $class: `${parameters.metaModelNamespace}.EnumProperty`,
                name: enumName,
            })
        );

        const enumDeclaration = {
            $class: `${parameters.metaModelNamespace}.EnumDeclaration`,
            name: this.normalizeName(
                enumDefinition.path[enumDefinition.path.length - 1]
            ),
            properties,
        };

        return enumDeclaration;
    }
    /**
     * Definition visitor.
     * @param {Object} definition - a JSON Schema model definition.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the Concerto declaration or declarations inferred from
     * the JSON Schema model definition. A definition can spawn more than one
     * Concerto declarations if it contains inline objects.
     * @private
     */
    visitDefinition(definition, parameters) {
        if (typeof definition.body.enum === 'object') {
            return (
                new EnumDefinition(definition.body, definition.path)
            ).accept(this, parameters);
        } else {
            return (
                new NonEnumDefinition(definition.body, definition.path)
            ).accept(this, parameters);
        }
    }
    /**
     * Definitions visitor.
     * @param {Object} definitions - the JSON Schema model definitions.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the Concerto declarations inferred from the JSON Schema
     * model definitions.
     */
    visitDefinitions(definitions, parameters) {
        const definitionClasses = Object.entries(definitions.body)
            .map(
                ([definitionName, definitionBody]) => new Definition(
                    definitionBody,
                    [...definitions.path, definitionName]
                )
            );

        return definitionClasses.map(
            definitionClass => definitionClass.accept(this, parameters)
        ).flat();
    }
    /**
     * JSON Schema model visitor.
     * @param {Object} jsonSchemaModel - the JSON Schema model.
     * @param {Object} parameters - the visitor parameters.
     *
     * @return {Object} the Concerto JSON model.
     * @private
     */
    visitJsonSchemaModel(jsonSchemaModel, parameters) {
        const rootDefinitionClass = new Definition(
            jsonSchemaModel.body,
            [`${ jsonSchemaModel.title || 'Root' }`]
        );

        const definitions = getValue(
            jsonSchemaModel.body,
            parameters.pathToDefinitions || ['definitions'],
        );

        const definitionsClass = new Definitions(
            definitions,
            parameters.pathToDefinitions || ['definitions'],
        );

        const parametersWithJsonSchemaModel = {
            ...parameters, jsonSchemaModel: jsonSchemaModel.body
        };

        const declarations = [
            ...rootDefinitionClass.accept(
                this, parametersWithJsonSchemaModel
            ),
            ...definitionsClass.accept(
                this, parametersWithJsonSchemaModel
            ),
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
        if (thing.isLocalReference) {
            return this.visitLocalReference(thing, parameters);
        }
        if (thing.isReference) {
            return this.visitReference(thing, parameters);
        }
        if (thing.isArrayProperty) {
            return this.visitArrayProperty(thing, parameters);
        }
        if (thing.isProperty) {
            return this.visitProperty(thing, parameters);
        }
        if (thing.isProperties) {
            return this.visitProperties(thing, parameters);
        }
        if (thing.isNonEnumDefinition) {
            return this.visitNonEnumDefinition(thing, parameters);
        }
        if (thing.isEnumDefinition) {
            return this.visitEnumDefinition(thing, parameters);
        }
        if (thing.isDefinition) {
            return this.visitDefinition(thing, parameters);
        }
        if (thing.isDefinitions) {
            return this.visitDefinitions(thing, parameters);
        }
        if (thing.isJsonSchemaModel) {
            return this.visitJsonSchemaModel(thing, parameters);
        }
    }
}

module.exports = JsonSchemaVisitor;
