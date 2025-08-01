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

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
    IConceptDeclaration,
    IEnumDeclaration,
    IEnumProperty,
    IMapDeclaration,
    IScalarDeclaration,
    IModels,
    MapKeyTypeUnion,
    MapValueTypeUnion,
    PropertyUnion,
    ScalarDeclarationUnion,
    DecoratorLiteralUnion
} from '@accordproject/concerto-types';
import {
    Concertino,
    Declaration, Property,
    ConceptDeclaration,
    ScalarDeclaration,
    EnumOption,
    MetadataMap,
    Vocabulary,
    FullyQualifiedName,
    ScalarType
} from './types';

const SCALAR_TYPES = new Set<ScalarType>([
    'BooleanScalar',
    'IntegerScalar',
    'LongScalar',
    'DoubleScalar',
    'StringScalar',
    'DateTimeScalar',
]);

const CONCEPT_TYPES = new Set<string>([
    'ConceptDeclaration', 'AssetDeclaration', 'TransactionDeclaration', 'EventDeclaration', 'ParticipantDeclaration'
]);

const PROPERTY_TYPE_MAP: Record<string, string> = {
    'concerto.metamodel@1.0.0.StringProperty': 'String',
    'concerto.metamodel@1.0.0.IntegerProperty': 'Integer',
    'concerto.metamodel@1.0.0.LongProperty': 'Long',
    'concerto.metamodel@1.0.0.DoubleProperty': 'Double',
    'concerto.metamodel@1.0.0.BooleanProperty': 'Boolean',
    'concerto.metamodel@1.0.0.DateTimeProperty': 'DateTime',
};

const KEY_TYPE_MAP: Record<string, string> = {
    'concerto.metamodel@1.0.0.StringMapKeyType': 'String',
    'concerto.metamodel@1.0.0.DateTimeMapKeyType': 'DateTime',
};

const VALUE_TYPE_MAP: Record<string, string> = {
    'concerto.metamodel@1.0.0.BooleanMapValueType': 'Boolean',
    'concerto.metamodel@1.0.0.DateTimeMapValueType': 'DateTime',
    'concerto.metamodel@1.0.0.StringMapValueType': 'String',
    'concerto.metamodel@1.0.0.IntegerMapValueType': 'Integer',
    'concerto.metamodel@1.0.0.LongMapValueType': 'Long',
    'concerto.metamodel@1.0.0.DoubleMapValueType': 'Double',
};

/**
 * Gets the scalar type from a Concerto IScalarDeclaration.
 * @param declaration The scalar declaration.
 * @returns The scalar type string.
 */
export function determineScalarType(declaration: IScalarDeclaration): ScalarType {
    const declarationClass = declaration.$class.split('.').pop() as string;
    if (!SCALAR_TYPES.has(declarationClass as ScalarType)) {
        throw new Error(`Unsupported scalar type: ${declarationClass}`);
    }
    return declarationClass as ScalarType;
}

/**
 * Extracts vocabulary and metadata from decorators.
 * @param decorators The decorators array.
 * @returns The extracted info.
 */
function extractDecoratorsInfo(decorators: any[] = []): { vocabulary?: Vocabulary; metadata?: MetadataMap } {
    const vocabulary: Vocabulary = {};
    const metadata: MetadataMap = {};

    decorators.forEach((decorator) => {
        if (decorator.name === 'Term') {
            vocabulary.label = decorator.arguments[0]?.value || null;
        } else if (decorator.name.startsWith('Term_')) {
            const key = decorator.name.split('_')[1];
            vocabulary.additionalTerms = vocabulary.additionalTerms || {};
            vocabulary.additionalTerms[key] = decorator.arguments[0]?.value || null;
        } else {
            metadata[decorator.name] = (decorator.arguments
                ? decorator.arguments.map((arg: DecoratorLiteralUnion) => {
                    if ('type' in arg && arg.$class === 'concerto.metamodel@1.0.0.DecoratorTypeReference') {
                        const result: {type: string, isArray?: boolean } = { type: `${arg.type.namespace}.${arg.type.name}` };
                        if (arg.isArray){
                            result.isArray = true;
                        }
                        return result;
                    } else if ('value' in arg) {
                        return arg.value;
                    }
                }).filter((v: unknown) => v !== undefined)
                : null
            );
        }
    });

    const result: { vocabulary?: Vocabulary; metadata?: MetadataMap } = {};
    if (Object.keys(vocabulary).length > 0) {
        result.vocabulary = vocabulary;
    }
    if (Object.keys(metadata).length > 0) {
        result.metadata = metadata;
    }
    return result;
}

/**
 * Processes enum values from Concerto to Concertino format.
 * @param properties The enum properties.
 * @returns The enum values object.
 */
function transformEnumValues(properties: IEnumProperty[]): Record<string, EnumOption> {
    const result: Record<string, EnumOption> = {};
    properties.forEach((property) => {
        result[property.name] = extractDecoratorsInfo(property.decorators);
    });
    return result;
}

/**
 * Determines the property type string for a property.
 * @param property The property object.
 * @param context The context object.
 * @returns The property type string.
 */
export function determinePropertyType(property: PropertyUnion, { modelNamespace }: { modelNamespace: string }): string {
    if ('type' in property) {
        return `${property.type.namespace || modelNamespace}.${property.type.name}`;
    }
    const propertyType = PROPERTY_TYPE_MAP[property.$class];
    if (!propertyType) {
        throw new Error(`Unsupported property class: ${property.$class}`);
    }
    return propertyType;
}

/**
 * Extracts meta properties (regex, length, range, default) from a property or scalar declaration.
 * Note: mutates propertyEntry
 * @param property The property or scalar declaration.
 * @param propertyEntry The target entry to mutate.
 */
function extractMetaProperties(property: PropertyUnion | ScalarDeclarationUnion, propertyEntry: Property | ScalarDeclaration): void {
    if ('validator' in property && property.validator) {
        if (['String', 'StringScalar'].includes(propertyEntry.type)) {
            if ('pattern' in property.validator && property.validator?.pattern) {
                propertyEntry.regex = `/${property.validator?.pattern}/${property.validator?.flags}`;
            }
        } else if (
            ['Integer', 'IntegerScalar', 'Long', 'LongScalar', 'Double', 'DoubleScalar'].includes(propertyEntry.type) &&
            'lower' in property.validator
        ) {
            const lower = property.validator.lower === undefined ? null : property.validator.lower;
            const upper = property.validator.upper === undefined ? null : property.validator.upper;
            propertyEntry.range = [lower, upper];
        }
    }
    if ('lengthValidator' in property && property.lengthValidator && ['String', 'StringScalar'].includes(propertyEntry.type)){
        const min = property.lengthValidator.minLength === undefined ? null : property.lengthValidator.minLength;
        const max = property.lengthValidator.maxLength === undefined ? null : property.lengthValidator.maxLength;
        propertyEntry.length = [min, max];
    }
    if ('defaultValue' in property && property.defaultValue !== undefined && property.defaultValue !== null) {
        propertyEntry.default = property.defaultValue;
    }
}

/**
 * Processes properties of a concept declaration from Concerto to Concertino format.
 * @param properties The properties array.
 * @param context The context object.
 * @returns The properties object.
 */
function transformProperties(
    properties: PropertyUnion[],
    { modelNamespace, declaration }: { modelNamespace: string; declaration: IConceptDeclaration }
): Record<string, Property> {
    const result: Record<string, Property> = {};
    const primitiveTypes = new Set(['String', 'Integer', 'Long', 'Double', 'Boolean', 'DateTime']);
    for (const property of properties) {
        const propertyEntry: Property = {
            name: property.name,
            type: determinePropertyType(property, { modelNamespace }),
            ...extractDecoratorsInfo(property.decorators),
        };
        if (primitiveTypes.has(propertyEntry.type)) {
            propertyEntry.scalarType = propertyEntry.type;
        }
        if (property.isArray) {propertyEntry.isArray = true;}
        if (property.isOptional) {propertyEntry.isOptional = true;}
        if (property.$class.endsWith('RelationshipProperty')) {propertyEntry.isRelationship = true;}
        extractMetaProperties(property, propertyEntry);
        if (declaration.identified && 'name' in declaration.identified && property.name === declaration.identified.name) {
            propertyEntry.isIdentifier = true;
        }
        result[property.name] = propertyEntry;
    }
    return result;
}

/**
 * Processes the key type of a MapDeclaration.
 * @param key The key type object.
 * @param context The context object.
 * @returns The key type string.
 */
function mapKeyTypeToString(key: MapKeyTypeUnion, { modelNamespace }: { modelNamespace: string }): string {
    let keyType = KEY_TYPE_MAP[key.$class];
    if (!keyType && 'type' in key) {
        keyType = `${key.type.namespace || modelNamespace}.${key.type.name}`;
    }
    return keyType;
}

/**
 * Processes the value type of a MapDeclaration.
 * @param value The value type object.
 * @param context The context object.
 * @returns The value type info.
 */
function mapValueTypeToObject(
    value: MapValueTypeUnion,
    { modelNamespace }: { modelNamespace: string }
): { type: string; isRelationship?: boolean } {
    let valueType = VALUE_TYPE_MAP[value.$class];
    if (!valueType && 'type' in value) {
        valueType = `${value.type.namespace || modelNamespace}.${value.type.name}`;
    }
    const result: { type: string; isRelationship?: boolean } = { type: valueType };
    if (value.$class.endsWith('RelationshipMapValueType')) {
        result.isRelationship = true;
    }
    return result;
}

/**
 * Processes a MapDeclaration object from Concerto to Concertino format.
 * @param declaration The map declaration.
 * @param context The context object.
 * @returns The Concertino map declaration.
 */
function transformMapDeclaration(declaration: IMapDeclaration, context: { modelNamespace: string }): Declaration {
    return {
        type: 'MapDeclaration',
        key: {
            type: mapKeyTypeToString(declaration.key, context),
            ...extractDecoratorsInfo(declaration.key.decorators),
        },
        value: {
            ...mapValueTypeToObject(declaration.value, context),
            ...extractDecoratorsInfo(declaration.value.decorators),
        },
        ...extractDecoratorsInfo(declaration.decorators),
        name: createFullyQualifiedName(context.modelNamespace, declaration.name),
    };
}

/**
 * Processes a ScalarDeclaration object from Concerto to Concertino format.
 * @param declaration The scalar declaration.
 * @param context The context object.
 * @returns The Concertino scalar declaration.
 */
function transformScalarDeclaration(declaration: ScalarDeclarationUnion, context: { modelNamespace: string }): ScalarDeclaration {
    const result: ScalarDeclaration = {
        type: determineScalarType(declaration),
        ...extractDecoratorsInfo(declaration.decorators),
        name: createFullyQualifiedName(context.modelNamespace, declaration.name),
    };
    extractMetaProperties(declaration, result);
    return result;
}

/**
 * Processes an EnumDeclaration object from Concerto to Concertino format.
 * @param declaration The enum declaration.
 * @param context The context object.
 * @returns The Concertino enum declaration.
 */
function transformEnumDeclaration(declaration: IEnumDeclaration, context: { modelNamespace: string }): Declaration {
    return {
        type: 'EnumDeclaration',
        values: transformEnumValues(declaration.properties),
        ...extractDecoratorsInfo(declaration.decorators),
        name: createFullyQualifiedName(context.modelNamespace, declaration.name),
    };
}

/**
 * Processes a ConceptDeclaration object from Concerto to Concertino format.
 * @param declaration The concept declaration.
 * @param context The context object.
 * @returns The Concertino concept declaration.
 */
function transformConceptDeclaration(declaration: IConceptDeclaration, context: { modelNamespace: string }): Declaration {
    const declarationClass = declaration.$class.split('.').pop() as string;
    const result: Declaration = {
        type: 'ConceptDeclaration',
        properties: transformProperties(declaration.properties, { ...context, declaration }),
        ...extractDecoratorsInfo(declaration.decorators),
        name: createFullyQualifiedName(context.modelNamespace, declaration.name),
    };
    if (declarationClass !== 'ConceptDeclaration') {
        result.prototype = declarationClass;
    }
    if (declaration.superType) {
        if (!declaration.superType.namespace) {
            throw new Error(`Missing namespace for superType in declaration: ${declaration.name}`);
        }
        result.extends = [`${declaration.superType.namespace}.${declaration.superType.name}`];
    }
    if (declaration.isAbstract) {
        result.isAbstract = true;
    }
    result.properties ??= {};
    if (declaration.identified?.$class === 'concerto.metamodel@1.0.0.Identified') {
        result.properties.$identifier = {
            name: '$identifier',
            type: 'String',
            isIdentifier: true,
        };
    }
    if (['TransactionDeclaration', 'EventDeclaration'].includes(declarationClass)) {
        result.properties.$timestamp = {
            name: '$timestamp',
            type: 'DateTime',
        };
    }
    return result;
}

/**
 * Creates a fully qualified name from namespace and local name.
 * @param modelNamespace The namespace string.
 * @param localName The local name.
 * @returns The fully qualified name object.
 */
function createFullyQualifiedName(modelNamespace: string, localName: string): FullyQualifiedName {
    const [namespace, version] = modelNamespace.split('@');
    return { namespace, version, localName };
}

/**
 * Dispatches to the appropriate transformation function based on declaration type.
 * @param object The metamodel object to transform.
 * @param context The context object.
 * @returns The transformed declaration.
 */
export function dispatchDeclaration(object: any, context: { modelNamespace: string }): Declaration {
    if (!object || !object.$class) {
        throw new Error('Invalid object: Missing $class property.');
    }
    const objectClass = object.$class.split('.').pop() as string;
    if (CONCEPT_TYPES.has(objectClass)) {
        return transformConceptDeclaration(object, context);
    } else if (objectClass === 'EnumDeclaration') {
        return transformEnumDeclaration(object, context);
    } else if (SCALAR_TYPES.has(objectClass as ScalarType)) {
        return transformScalarDeclaration(object, context);
    } else if (objectClass === 'MapDeclaration') {
        return transformMapDeclaration(object, context);
    } else {
        throw new Error(`Unsupported object type: ${object.$class}`);
    }
}

/**
 * Gets the inheritance chain for a declaration.
 * @param declaration The declaration object.
 * @param concertino The concertino object.
 * @returns The inheritance chain.
 */
export function getInheritanceChain(declaration: ConceptDeclaration, concertino: Concertino): string[] {
    const chain: string[] = [];
    const stack = [...(declaration.extends || [])];
    while (stack.length > 0) {
        const parent = stack.pop();
        if (parent === undefined) {
            throw new Error('Parent is undefined');
        }
        chain.push(parent);
        const parentDeclaration = concertino.declarations[parent] as ConceptDeclaration;
        if (parentDeclaration && parentDeclaration.extends) {
            stack.push(...parentDeclaration.extends);
        }
    }
    return chain;
}

/**
 * Converts a Concerto metamodel to the Concertino format.
 * @param metamodel The Concerto metamodel.
 * @returns The Concertino format object.
 */
function convertToConcertino(metamodel: IModels): Concertino {
    const concertino: Concertino = {
        declarations: {},
        metadata: {
            concertinoVersion: '0.1.0-alpha.3',
            models: {},
        },
    };
    metamodel.models.forEach((model) => {
        const modelNamespace = model.namespace;
        (model.declarations || []).forEach((declaration) => {
            const declarationEntry = dispatchDeclaration(declaration, { modelNamespace });
            concertino.declarations[`${modelNamespace}.${declaration.name}`] = declarationEntry;
        });
        concertino.metadata.models[modelNamespace] = {
            sourceUri: model.sourceUri,
            concertoVersion: model.concertoVersion,
            imports: model.imports,
            decorators: model.decorators,
        };
    });
    Object.values(concertino.declarations).forEach((declaration) => {
        if (declaration.type === 'ConceptDeclaration') {
            if (declaration.extends) {
                declaration.extends = getInheritanceChain(declaration, concertino);
                const inheritedProperties: Record<string, Property> = {};
                declaration.extends.forEach((parent) => {
                    const currentParent = concertino.declarations[parent];
                    if (currentParent && 'properties' in currentParent && currentParent.properties) {
                        const currentParentProperties = Object.fromEntries(
                            Object.entries(currentParent.properties).map(([key, value]) => {
                                return [key, { ...value, inheritedFrom: parent }];
                            })
                        );
                        Object.assign(inheritedProperties, currentParentProperties);
                    }
                });
                declaration.properties = {
                    ...inheritedProperties,
                    ...declaration.properties,
                };
            }
            declaration.properties = Object.fromEntries(
                Object.entries(declaration.properties || {}).map(([key, value]) => {
                    if (value !== undefined) {
                        const scalarDecl = concertino.declarations[value.type] as ScalarDeclaration;
                        if (scalarDecl && SCALAR_TYPES.has(scalarDecl.type as ScalarType)) {
                            const newDecl = {
                                ...value,
                                scalarType: value.type,
                                type: scalarDecl.type.replace('Scalar', ''),
                            };
                            if (scalarDecl.regex) {newDecl.regex = scalarDecl.regex;}
                            if (scalarDecl.length) {newDecl.length = scalarDecl.length;}
                            if (scalarDecl.range) {newDecl.range = scalarDecl.range;}
                            if (scalarDecl.default) {newDecl.default = scalarDecl.default;}
                            return [key, newDecl];
                        }
                    }
                    return [key, value];
                })
            );
        }
    });
    return concertino;
}

export { convertToConcertino };
