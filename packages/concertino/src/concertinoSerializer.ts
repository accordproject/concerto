/* eslint-disable no-use-before-define */
/* eslint-disable valid-jsdoc */
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
} from '@accordproject/concerto-metamodel';
import {
    IConcertino,
    IConcertinoDeclaration,
    IConcertinoProperty,
    IConcertinoConceptDeclaration,
    IConcertinoScalarDeclaration,
    MetadataMap,
    IVocabulary,
    IConcertinoMapDeclaration,
    IConcertinoEnumDeclaration,
    IConcertinoStringProperty,
    IConcertinoIntegerProperty,
    IConcertinoDoubleProperty,
    IConcertinoLongProperty,
    IConcertinoBooleanProperty,
    IConcertinoDateTimeProperty,
    IConcertinoStringScalarDeclaration,
    IConcertinoIntegerScalarDeclaration,
    EnumValueMap,
    PropertyMap,
    Prototype
} from './spec/concertino.metamodel@5.1.0';
import { CONCERTINO_VERSION } from './version';

// Type definition for scalar types as strings for easier mapping
type ScalarType = 'BooleanScalar' | 'IntegerScalar' | 'LongScalar' | 'DoubleScalar' | 'StringScalar' | 'DateTimeScalar';

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

const SCALAR_TYPE_MAP: Record<ScalarType, string> = {
    'BooleanScalar': 'Boolean',
    'IntegerScalar': 'Integer',
    'LongScalar': 'Long',
    'DoubleScalar': 'Double',
    'StringScalar': 'String',
    'DateTimeScalar': 'DateTime',
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
 * The declared name a resolved TypeIdentifier points at. An aliased import
 * (`import a@1.0.0.{Foo as Bar}`) resolves to `name: 'Bar'` and
 * `resolvedName: 'Foo'`, and Concertino names the declared type
 * (`a@1.0.0.Foo`); `a@1.0.0.Bar` does not exist.
 * @param typeIdentifier The type identifier.
 * @returns The declared short name.
 */
function declaredName(typeIdentifier: { name: string; resolvedName?: string }): string {
    return typeIdentifier.resolvedName ?? typeIdentifier.name;
}

/**
 * Whether a decorator can be written to Concertino's `vocabulary` and read
 * back as the same decorator. `@Term("label")` and `@Term_key("term")` can.
 * So can `@Term()`, as a null label. Anything else named `Term` or `Term_*`
 * (no argument list, other argument types or counts) is written to
 * `metadata` instead, which keeps the arguments as they are.
 * @param decorator The decorator.
 * @returns True when the decorator is a vocabulary term.
 */
function isVocabularyTerm(decorator: any): boolean {
    const args = decorator.arguments;
    if (!Array.isArray(args)) {
        return false;
    }
    const isStringArgument = args.length === 1 && args[0]?.$class === 'concerto.metamodel@1.0.0.DecoratorString' && typeof args[0].value === 'string';
    if (decorator.name === 'Term') {
        return args.length === 0 || isStringArgument;
    }
    return decorator.name.startsWith('Term_') && isStringArgument;
}

/**
 * Extracts vocabulary and metadata from decorators.
 *
 * Every vocabulary term (`@Term("label")`, `@Term()`, `@Term_key("term")`)
 * goes to `vocabulary`, wherever it is among the element's decorators. Any
 * other decorator, and a term that `vocabulary` cannot hold as it is (other
 * argument types or counts, or a repeated term), goes to `metadata`, which
 * keeps the arguments as they are.
 *
 * A reader rebuilds the decorators as the vocabulary label, the additional
 * terms, then the metadata entries. When the source order is not that order
 * (`@Foo @Term("x")`, say), `decoratorOrder` lists the decorator names in
 * their source order (since 5.1.0). 5.0.0 kept such a term in `metadata`
 * instead, so its vocabulary missed it.
 * @param decorators The decorators array.
 * @returns The extracted info.
 */
function extractDecoratorsInfo(decorators: any[] = []): { vocabulary?: IVocabulary; metadata?: MetadataMap; decoratorOrder?: string[] } {
    const vocabulary: IVocabulary = {};
    const metadata: MetadataMap = {};
    const order: string[] = [];

    decorators.forEach((decorator) => {
        order.push(decorator.name);
        if (decorator.name === 'Term' && !('label' in vocabulary) && isVocabularyTerm(decorator)) {
            vocabulary.label = decorator.arguments.length === 0 ? null : decorator.arguments[0].value;
        } else if (decorator.name.startsWith('Term_') && isVocabularyTerm(decorator) &&
            !Object.prototype.hasOwnProperty.call(vocabulary.additionalTerms ?? {}, decorator.name.substring('Term_'.length))) {
            // The key is everything after `Term_`, so `@Term_my_type` keeps `my_type`.
            const key = decorator.name.substring('Term_'.length);
            vocabulary.additionalTerms = vocabulary.additionalTerms || {};
            vocabulary.additionalTerms[key] = decorator.arguments[0].value;
        } else {
            metadata[decorator.name] = (decorator.arguments
                ? decorator.arguments.map((arg: DecoratorLiteralUnion) => {
                    if ('type' in arg && arg.$class === 'concerto.metamodel@1.0.0.DecoratorTypeReference') {
                        // A primitive or unresolved type reference (`@Foo(String)`) has no namespace.
                        const type = arg.type.namespace ? `${arg.type.namespace}.${declaredName(arg.type)}` : declaredName(arg.type);
                        const result: {type: string, isArray?: boolean } = { type };
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

    const result: { vocabulary?: IVocabulary; metadata?: MetadataMap; decoratorOrder?: string[] } = {};
    if (Object.keys(vocabulary).length > 0) {
        result.vocabulary = vocabulary;
    }
    if (Object.keys(metadata).length > 0) {
        result.metadata = metadata;
    }
    const readBack = [
        ...('label' in vocabulary ? ['Term'] : []),
        ...Object.keys(vocabulary.additionalTerms ?? {}).map((key) => `Term_${key}`),
        ...Object.keys(metadata),
    ];
    if (readBack.length !== order.length || readBack.some((name, i) => name !== order[i])) {
        result.decoratorOrder = order;
    }
    return result;
}

/**
 * Processes enum values from Concerto to Concertino format.
 * @param properties The enum properties.
 * @returns The enum values object.
 */
function transformEnumValues(properties: IEnumProperty[]): EnumValueMap {
    const result: EnumValueMap = {};
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
        return `${property.type.namespace || modelNamespace}.${declaredName(property.type)}`;
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
function extractMetaProperties(property: PropertyUnion | ScalarDeclarationUnion, propertyEntry: IConcertinoProperty | IConcertinoScalarDeclaration): void {
    if ('validator' in property && property.validator) {
        if (['String', 'StringScalar'].includes(propertyEntry.type)) {
            const stringPropertyEntry = (propertyEntry as IConcertinoStringProperty);
            if ('pattern' in property.validator && property.validator?.pattern) {
                stringPropertyEntry.regex = `/${property.validator?.pattern}/${property.validator?.flags}`;
            }
        } else if (
            ['Integer', 'IntegerScalar', 'Long', 'LongScalar', 'Double', 'DoubleScalar'].includes(propertyEntry.type) &&
            // A one-sided range (`range=[,10]`) has only one of the bounds.
            ('lower' in property.validator || 'upper' in property.validator)
        ) {
            const lower = property.validator.lower === undefined ? null : property.validator.lower;
            const upper = property.validator.upper === undefined ? null : property.validator.upper;
            (propertyEntry as IConcertinoIntegerProperty | IConcertinoDoubleProperty | IConcertinoLongProperty).range = [lower, upper];
        }
    }
    if ('lengthValidator' in property && property.lengthValidator && ['String', 'StringScalar'].includes(propertyEntry.type)){
        const min = property.lengthValidator.minLength === undefined ? null : property.lengthValidator.minLength;
        const max = property.lengthValidator.maxLength === undefined ? null : property.lengthValidator.maxLength;
        (propertyEntry as IConcertinoStringProperty).length = [min, max];
    }
    if ('sizeValidator' in property && (property as any).sizeValidator) {
        const sv = (property as any).sizeValidator;
        const min = sv.minSize === undefined ? null : sv.minSize;
        const max = sv.maxSize === undefined ? null : sv.maxSize;
        (propertyEntry as IConcertinoProperty).size = [min, max];
    }
    if ('defaultValue' in property && property.defaultValue !== undefined && property.defaultValue !== null) {
        (propertyEntry as IConcertinoStringProperty | IConcertinoIntegerProperty | IConcertinoDoubleProperty | IConcertinoLongProperty | IConcertinoBooleanProperty | IConcertinoDateTimeProperty)
            .default = property.defaultValue;
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
): PropertyMap {
    const result: PropertyMap = {};
    for (const property of properties) {
        const propertyEntry: IConcertinoProperty = {
            name: property.name,
            type: determinePropertyType(property, { modelNamespace }),
            ...extractDecoratorsInfo(property.decorators),
        };
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
        keyType = `${key.type.namespace || modelNamespace}.${declaredName(key.type)}`;
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
        valueType = `${value.type.namespace || modelNamespace}.${declaredName(value.type)}`;
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
function transformMapDeclaration(declaration: IMapDeclaration, context: { modelNamespace: string }): IConcertinoMapDeclaration {
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
    };
}

/**
 * Processes a ScalarDeclaration object from Concerto to Concertino format.
 * @param declaration The scalar declaration.
 * @param context The context object.
 * @returns The Concertino scalar declaration.
 */
function transformScalarDeclaration(declaration: ScalarDeclarationUnion, _context: { modelNamespace: string }): IConcertinoScalarDeclaration { // eslint-disable-line @typescript-eslint/no-unused-vars
    const result: IConcertinoScalarDeclaration = {
        type: determineScalarType(declaration),
        ...extractDecoratorsInfo(declaration.decorators),
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
function transformEnumDeclaration(declaration: IEnumDeclaration, _context: { modelNamespace: string }): IConcertinoEnumDeclaration { // eslint-disable-line @typescript-eslint/no-unused-vars
    return {
        type: 'EnumDeclaration',
        values: transformEnumValues(declaration.properties),
        ...extractDecoratorsInfo(declaration.decorators),
    };
}

/**
 * Processes a ConceptDeclaration object from Concerto to Concertino format.
 * @param declaration The concept declaration.
 * @param context The context object.
 * @returns The Concertino concept declaration.
 */
function transformConceptDeclaration(declaration: IConceptDeclaration, context: { modelNamespace: string }): IConcertinoConceptDeclaration {
    const declarationClass = declaration.$class.split('.').pop() as string;
    const result: IConcertinoConceptDeclaration = {
        type: 'ConceptDeclaration',
        properties: transformProperties(declaration.properties, { ...context, declaration }),
        ...extractDecoratorsInfo(declaration.decorators),
    };
    if (declarationClass !== 'ConceptDeclaration') {
        result.prototype = declarationClass as Prototype;
    }
    if (declaration.superType) {
        const superTypeNamespace = declaration.superType.namespace || context.modelNamespace;
        result.extends = [`${superTypeNamespace}.${declaredName(declaration.superType)}`];
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
            isSystem: true,
        };
    }
    // The system properties inherited from the implicit system super type
    // ($timestamp of a transaction or event, $identifier of an asset or
    // participant) are added by addSystemSuperTypes, once the inherited
    // properties are known.
    return result;
}

/**
 * Dispatches to the appropriate transformation function based on declaration type.
 * @param object The metamodel object to transform.
 * @param context The context object.
 * @returns The transformed declaration.
 */
export function dispatchDeclaration(object: any, context: { modelNamespace: string }): IConcertinoDeclaration {
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
export function getInheritanceChain(declaration: IConcertinoConceptDeclaration, concertino: IConcertino): string[] {
    const chain: string[] = [];
    const stack = [...(declaration.extends || [])];
    while (stack.length > 0) {
        const parent = stack.pop();
        if (parent === undefined) {
            throw new Error('Parent is undefined');
        }
        chain.push(parent);
        const parentDeclaration = concertino.declarations[parent] as IConcertinoConceptDeclaration;
        if (parentDeclaration && parentDeclaration.extends) {
            stack.push(...parentDeclaration.extends);
        }
    }
    return chain;
}

const SYSTEM_NAMESPACE = 'concerto@1.0.0';

/**
 * The implicit system super types of each prototype, nearest first, as
 * concerto-core's getAllSuperTypeDeclarations() lists them after the declared
 * super types.
 */
const SYSTEM_SUPER_TYPES: Record<string, string[]> = {
    ConceptDeclaration: [`${SYSTEM_NAMESPACE}.Concept`],
    AssetDeclaration: [`${SYSTEM_NAMESPACE}.Asset`, `${SYSTEM_NAMESPACE}.Concept`],
    ParticipantDeclaration: [`${SYSTEM_NAMESPACE}.Participant`, `${SYSTEM_NAMESPACE}.Concept`],
    TransactionDeclaration: [`${SYSTEM_NAMESPACE}.Transaction`, `${SYSTEM_NAMESPACE}.Concept`],
    EventDeclaration: [`${SYSTEM_NAMESPACE}.Event`, `${SYSTEM_NAMESPACE}.Concept`],
};

/**
 * The system property each system super type declares, as concerto-core
 * adds it: `$identifier` (String) for assets and participants, `$timestamp`
 * (DateTime) for transactions and events.
 */
const SYSTEM_PROPERTIES: Record<string, { name: string; type: string }> = {
    [`${SYSTEM_NAMESPACE}.Asset`]: { name: '$identifier', type: 'String' },
    [`${SYSTEM_NAMESPACE}.Participant`]: { name: '$identifier', type: 'String' },
    [`${SYSTEM_NAMESPACE}.Transaction`]: { name: '$timestamp', type: 'DateTime' },
    [`${SYSTEM_NAMESPACE}.Event`]: { name: '$timestamp', type: 'DateTime' },
};

/**
 * Writes a concept declaration's implicit system super types
 * (`systemSuperTypes`, since 5.1.0) and the system properties it inherits
 * from them: `$timestamp` from `concerto@1.0.0.Transaction` or `Event`, and
 * `$identifier` from `concerto@1.0.0.Asset` or `Participant`, which is the
 * identifier only when no other property is. Each is marked `isSystem` and
 * `inheritedFrom` the system type, so that the properties are the ones
 * concerto-core's getProperties() lists. (5.0.0 wrote `$timestamp` as an own
 * property and left out an inherited `$identifier`.)
 * Note: mutates the declaration.
 * @param fqn The declaration's fully qualified name.
 * @param concept The declaration.
 */
function addSystemSuperTypes(fqn: string, concept: IConcertinoConceptDeclaration): void {
    let systemSuperTypes = SYSTEM_SUPER_TYPES[concept.prototype ?? 'ConceptDeclaration'] ?? [];
    // A declaration of the system model itself has only the ones above it.
    const self = systemSuperTypes.indexOf(fqn);
    if (self >= 0) {
        systemSuperTypes = systemSuperTypes.slice(self + 1);
    }
    if (systemSuperTypes.length === 0) {
        return;
    }
    concept.systemSuperTypes = [...systemSuperTypes];
    const properties = concept.properties ?? {};
    const systemProperties: PropertyMap = {};
    systemSuperTypes.forEach((systemType) => {
        const systemProperty = SYSTEM_PROPERTIES[systemType];
        if (systemProperty && !(systemProperty.name in properties) && !(systemProperty.name in systemProperties)) {
            const property: IConcertinoProperty = { ...systemProperty, inheritedFrom: systemType, isSystem: true };
            if (systemProperty.name === '$identifier' && !Object.values(properties).some((p) => p.isIdentifier)) {
                property.isIdentifier = true;
            }
            systemProperties[systemProperty.name] = property;
        }
    });
    concept.properties = { ...systemProperties, ...properties };
}

/**
 * Flags the properties whose type is an enum (`isEnum`) or a map (`isMap`,
 * since 5.1.0) declared in the document. A type the document does not hold
 * (a partial model) is not flagged.
 * Note: mutates the declaration's properties.
 * @param concept The declaration.
 * @param concertino The document.
 */
function flagPropertyTypes(concept: IConcertinoConceptDeclaration, concertino: IConcertino): void {
    Object.values(concept.properties ?? {}).forEach((property) => {
        const type = concertino.declarations[property.type];
        if (type?.type === 'EnumDeclaration') {
            property.isEnum = true;
        } else if (type?.type === 'MapDeclaration') {
            property.isMap = true;
        }
    });
}

/**
 * Converts a Concerto metamodel to the Concertino format.
 * @param metamodel The Concerto metamodel.
 * @returns The Concertino format object.
 */
function convertToConcertino(metamodel: IModels): IConcertino {
    const concertino: IConcertino = {
        declarations: {},
        metadata: {
            concertinoVersion: CONCERTINO_VERSION,
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

        // Denormalize inherited properties
        if (declaration.type === 'ConceptDeclaration') {
            const concept = (declaration as IConcertinoConceptDeclaration);
            if (concept.extends) {
                concept.extends = getInheritanceChain(concept, concertino);
                const inheritedProperties: Record<string, IConcertinoProperty> = {};
                concept.extends.forEach((parent) => {
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
                concept.properties = {
                    ...inheritedProperties,
                    ...concept.properties,
                };
            }

            // Denormalize metaproperties for scalar declarations
            concept.properties = Object.fromEntries(
                Object.entries(concept.properties || {}).map(([key, value]) => {
                    if (value !== undefined) {
                        const scalarDecl = concertino.declarations[value.type] as IConcertinoScalarDeclaration;
                        if (scalarDecl && SCALAR_TYPES.has(scalarDecl.type as ScalarType)) {
                            const newProperty: IConcertinoProperty = {
                                ...value,
                                scalarType: value.type,
                                type: SCALAR_TYPE_MAP[scalarDecl.type as ScalarType],
                            };
                            if ('regex' in scalarDecl && scalarDecl.regex) {
                                (newProperty as IConcertinoStringProperty).regex = (scalarDecl as IConcertinoStringScalarDeclaration).regex;
                            }
                            if ('length' in scalarDecl && scalarDecl.length) {
                                (newProperty as IConcertinoStringProperty).length = (scalarDecl as IConcertinoStringScalarDeclaration).length;
                            }
                            if ('range' in scalarDecl && scalarDecl.range) {
                                // Works for other number scalar types too. We pick the Integer type to satisfy the compiler
                                (newProperty as IConcertinoIntegerProperty).range = (scalarDecl as IConcertinoIntegerScalarDeclaration).range;
                            }
                            if ('default' in scalarDecl && scalarDecl.default !== undefined && scalarDecl.default !== null) {
                                // Falsy defaults (0, false, '') are defaults too
                                // Works for other number scalar types too. We pick the Integer type to satisfy the compiler
                                (newProperty as IConcertinoIntegerProperty).default = (scalarDecl as IConcertinoIntegerScalarDeclaration).default;
                            }
                            return [key, newProperty];
                        }
                    }
                    return [key, value];
                }).filter((entry): entry is [string, IConcertinoProperty] => entry !== undefined)
            );
        }
    });
    Object.entries(concertino.declarations).forEach(([fqn, declaration]) => {
        if (declaration.type === 'ConceptDeclaration') {
            const concept = declaration as IConcertinoConceptDeclaration;
            addSystemSuperTypes(fqn, concept);
            flagPropertyTypes(concept, concertino);
        }
    });
    return concertino;
}

export { convertToConcertino };
