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
import { ModelUtil } from '@accordproject/concerto-core';
import { Concertino, Declaration, Property, EnumDeclaration, ConceptDeclaration, MapDeclaration, ScalarDeclaration, MapValue } from './types';
import {
    IBooleanProperty,
    IBooleanScalar,
    IConceptDeclaration,
    IDateTimeScalar,
    IDecorator,
    IDoubleDomainValidator,
    IDoubleProperty,
    IDoubleScalar,
    IEnumDeclaration,
    IEnumProperty,
    IIdentifiedBy,
    IIntegerDomainValidator,
    IIntegerProperty,
    IIntegerScalar,
    ILongDomainValidator,
    ILongProperty,
    ILongScalar,
    IMapDeclaration,
    IMapKeyType,
    IModel,
    IModels,
    IObjectMapKeyType,
    IObjectMapValueType,
    IObjectProperty,
    IStringLengthValidator,
    IStringProperty,
    IStringRegexValidator,
    IStringScalar,
    MapKeyTypeUnion,
    MapValueTypeUnion,
    PropertyUnion,
    ScalarDeclarationUnion,
} from '@accordproject/concerto-types';
import { EnumOption as EnumValue, MetadataMap, Vocabulary } from './types';

/**
 * Extracts scalar validators (regex, range, length) from a ScalarDeclaration.
 * @param {ScalarDeclaration} declaration - The scalar declaration to extract validators from.
 * @returns {{ lengthValidator?: IStringLengthValidator; validator?: IDoubleDomainValidator | IIntegerDomainValidator | ILongDomainValidator | IStringRegexValidator }}
 */
function extractScalarValidators(declaration: ScalarDeclaration) {
    const result: {
    lengthValidator?: IStringLengthValidator;
    validator?: IDoubleDomainValidator | IIntegerDomainValidator | ILongDomainValidator | IStringRegexValidator;
  } = {};


    if (declaration.regex) {
        const regexValidator: IStringRegexValidator = {
            $class: 'concerto.metamodel@1.0.0.StringRegexValidator',
            pattern: declaration.regex,
            flags: ''
        };

        // Check if it's already in the form /pattern/flags
        const match = declaration.regex.match(/^\/(.*)\/([gimuy]*)$/);
        if (match) {
            regexValidator.pattern = match[1];
            regexValidator.flags = match[2];
        }
        result.validator = regexValidator;
    }

    if (declaration.range) {
        result.validator = { $class: `concerto.metamodel@1.0.0.${declaration.type.replace('Scalar', '')}DomainValidator` };
        if (declaration.range[0] !== undefined && declaration.range[0] !== null) {
            (result.validator as IDoubleDomainValidator | IIntegerDomainValidator | ILongDomainValidator).lower = declaration.range[0];
        }
        if (declaration.range[1] !== undefined && declaration.range[1] !== null) {
            (result.validator as IDoubleDomainValidator | IIntegerDomainValidator | ILongDomainValidator).upper = declaration.range[1];
        }
    }

    if (declaration.length) {
        result.lengthValidator = { $class: 'concerto.metamodel@1.0.0.StringLengthValidator' };
        if (declaration.length[0] !== undefined && declaration.length[0] !== null) {
            result.lengthValidator.minLength = declaration.length[0];
        }
        if (declaration.length[1] !== undefined && declaration.length[1] !== null) {
            result.lengthValidator.maxLength = declaration.length[1];
        }
    }

    return result;
}

/**
 * Converts vocabulary and metadata into Concerto decorators.
 * @param {Vocabulary} [vocabulary] - The vocabulary object.
 * @param {MetadataMap} [metadata] - The metadata map.
 * @returns {any[] | undefined} The decorators array or undefined if none.
 */
function decoratorsFromVocabularyAndMetadata(vocabulary?: Vocabulary, metadata?: MetadataMap): any[] | undefined {
    const decorators: any[] = [];

    if (vocabulary?.label === null) {
        decorators.push({
            $class: 'concerto.metamodel@1.0.0.Decorator',
            name: 'Term',
            arguments: [],
        });
    } else if (vocabulary?.label !== undefined) {
        decorators.push({
            $class: 'concerto.metamodel@1.0.0.Decorator',
            name: 'Term',
            arguments: [{ $class: 'concerto.metamodel@1.0.0.DecoratorString', value: vocabulary.label }],
        });
    }

    if (vocabulary?.additionalTerms) {
        Object.entries(vocabulary.additionalTerms).forEach(([key, value]) => {
            decorators.push({
                $class: 'concerto.metamodel@1.0.0.Decorator',
                name: `Term_${key}`,
                arguments: [{ $class: 'concerto.metamodel@1.0.0.DecoratorString', value }],
            });
        });
    }

    if (metadata) {
        Object.entries(metadata).forEach(([name, args]) => {
            const decorator : IDecorator = {
                $class: 'concerto.metamodel@1.0.0.Decorator',
                name,
            };
            if (args) {
                decorator.arguments = args.map((arg) => {
                    if (typeof arg === 'string') {
                        return { $class: 'concerto.metamodel@1.0.0.DecoratorString', value: arg };
                    } else if (typeof arg === 'number') {
                        return { $class: 'concerto.metamodel@1.0.0.DecoratorNumber', value: arg };
                    } else if (typeof arg === 'boolean') {
                        return { $class: 'concerto.metamodel@1.0.0.DecoratorBoolean', value: arg };
                    } else if (typeof arg === 'object' && arg !== null && 'type' in arg) {
                        return {
                            '$class': 'concerto.metamodel@1.0.0.DecoratorTypeReference',
                            'isArray': (arg as { isArray?: boolean}).isArray || false,
                            'type': {
                                '$class': 'concerto.metamodel@1.0.0.TypeIdentifier',
                                'name': ModelUtil.getShortName((arg as { type: string}).type),
                                'namespace': ModelUtil.getNamespace((arg as { type: string}).type)
                            }
                        };
                    }
                    throw new Error(`Unsupported argument type: ${typeof arg}`);
                });
            }
            decorators.push(decorator);
        });
    }

    if (decorators.length === 0) {
        return undefined;
    }

    return decorators;
}

/**
 * Converts a value type string and relationship flag into a Concerto MapValueTypeUnion.
 * @param {string} value - The value type string.
 * @returns {MapValueTypeUnion} The Concerto map value type.
 */
function mapValueType(value: MapValue): MapValueTypeUnion {
    const valueTypeMap: Record<string, string> = {
        String: 'concerto.metamodel@1.0.0.StringMapValueType',
        Integer: 'concerto.metamodel@1.0.0.IntegerMapValueType',
        Boolean: 'concerto.metamodel@1.0.0.BooleanMapValueType',
        Double: 'concerto.metamodel@1.0.0.DoubleMapValueType',
        Long: 'concerto.metamodel@1.0.0.LongMapValueType',
        DateTime: 'concerto.metamodel@1.0.0.DateTimeMapValueType',
    };

    const valueClass = value.isRelationship
        ? 'concerto.metamodel@1.0.0.RelationshipMapValueType'
        : (valueTypeMap[value.type] || 'concerto.metamodel@1.0.0.ObjectMapValueType');


    const result: MapValueTypeUnion = { $class: valueClass };

    if (['concerto.metamodel@1.0.0.RelationshipMapValueType', 'concerto.metamodel@1.0.0.ObjectMapValueType'].includes(valueClass)) {
        const typeName = ModelUtil.getShortName(value.type);
        const namespace = ModelUtil.getNamespace(value.type);

        (result as IObjectMapValueType).type = {
            '$class': 'concerto.metamodel@1.0.0.TypeIdentifier',
            name: typeName,
            namespace
        };
    }

    const decorators = decoratorsFromVocabularyAndMetadata(value.vocabulary, value.metadata);
    if (decorators !== undefined) {
        result.decorators = decorators;
    }

    return result;
}

/**
 * Converts a key type string into a Concerto map key type object.
 * @param {string} key - The key type.
 * @returns {object} The Concerto map key type.
 */
function mapKeyType(key: MapValue): MapKeyTypeUnion {
    const keyTypeMap: Record<string, string> = {
        String: 'concerto.metamodel@1.0.0.StringMapKeyType',
        DateTime: 'concerto.metamodel@1.0.0.DateTimeMapKeyType',
    };
    const result: IMapKeyType = {
        $class: keyTypeMap[key.type]
    };
    if (!keyTypeMap[key.type]){
        const typeName = ModelUtil.getShortName(key.type);
        const namespace = ModelUtil.getNamespace(key.type);

        result.$class = 'concerto.metamodel@1.0.0.ObjectMapKeyType';
        (result as IObjectMapKeyType).type = {
            '$class': 'concerto.metamodel@1.0.0.TypeIdentifier',
            'name': typeName,
            namespace,
        };
    }

    const decorators = decoratorsFromVocabularyAndMetadata(key.vocabulary, key.metadata);
    if (decorators !== undefined) {
        result.decorators = decorators;
    }

    return result;
}

/**
 * Converts enum values from Concertino to Concerto metamodel format.
 * @param {Record<string, EnumValue>} values - The enum values.
 * @returns {any[]} The array of Concerto enum properties.
 */
function transformEnumValues(values: Record<string, EnumValue>): any[] {
    return Object.entries(values).map(([name, value]) => {
        const result: IEnumProperty = {
            $class: 'concerto.metamodel@1.0.0.EnumProperty',
            name,
        };

        const decorators = decoratorsFromVocabularyAndMetadata(value.vocabulary, value.metadata);
        if (decorators !== undefined) {
            result.decorators = decorators;
        }
        return result;
    });


}

/**
 * Converts properties from Concertino to Concerto metamodel format.
 * @param {Record<string, Property>} properties - The properties object.
 * @returns {{ properties: any[], identifier?: string }} The properties array and optional identifier.
 */
function transformProperties(properties: Record<string, Property>): { properties: any[], identifier?: string } {
    let identifier = undefined;
    return {
        properties: Object.entries(properties)
            .filter(([, property]) => {
                // denormalize inherited properties
                return property.inheritedFrom === undefined;
            })
            .map(([name, property]) => {

                const propertyTypeMap: Record<string, string> = {
                    String: 'concerto.metamodel@1.0.0.StringProperty',
                    Integer: 'concerto.metamodel@1.0.0.IntegerProperty',
                    Boolean: 'concerto.metamodel@1.0.0.BooleanProperty',
                    Double: 'concerto.metamodel@1.0.0.DoubleProperty',
                    Long: 'concerto.metamodel@1.0.0.LongProperty',
                    DateTime: 'concerto.metamodel@1.0.0.DateTimeProperty',
                };

                const isScalarDeclarationType = property.scalarType && !Object.keys(propertyTypeMap).includes(property.scalarType);

                let propertyClass = 'concerto.metamodel@1.0.0.ObjectProperty';
                if (propertyTypeMap[property.type]) {
                    propertyClass = propertyTypeMap[property.type];
                }
                if (property.isRelationship){
                    propertyClass = 'concerto.metamodel@1.0.0.RelationshipProperty';
                }
                if (isScalarDeclarationType){
                    propertyClass = 'concerto.metamodel@1.0.0.ObjectProperty';
                }

                let validator: IStringRegexValidator | IDoubleDomainValidator | IIntegerDomainValidator | ILongDomainValidator | undefined;

                const result: PropertyUnion = {
                    $class: propertyClass,
                    name,
                    isArray: property.isArray || false,
                    isOptional: property.isOptional || false,
                };

                if (!isScalarDeclarationType) {
                    if (property.regex) {
                        const regexValidator: IStringRegexValidator = {
                            $class: 'concerto.metamodel@1.0.0.StringRegexValidator',
                            pattern: property.regex,
                            flags: ''
                        };

                        // Check if it's already in the form /pattern/flags
                        const match = property.regex.match(/^\/(.*)\/([gimuy]*)$/);
                        if (match) {
                            regexValidator.pattern = match[1];
                            regexValidator.flags = match[2];
                        }
                        validator = regexValidator;
                    }

                    if (property.range) {
                        validator = { $class: `concerto.metamodel@1.0.0.${property.type.replace('Scalar', '')}DomainValidator` };
                        if (property.range[0] !== undefined && property.range[0] !== null) {
                            validator.lower = property.range[0];
                        }
                        if (property.range[1] !== undefined && property.range[1] !== null) {
                            validator.upper = property.range[1];
                        }
                    }

                    let lengthValidator: IStringLengthValidator | undefined;
                    if (property.length) {
                        lengthValidator = { $class: 'concerto.metamodel@1.0.0.StringLengthValidator' };
                        if (property.length[0] !== undefined && property.length[0] !== null) {
                            lengthValidator.minLength = property.length[0];
                        }
                        if (property.length[1] !== undefined && property.length[1] !== null) {
                            lengthValidator.maxLength = property.length[1];
                        }
                    }

                    if (validator !== undefined) {
                        (result as IStringProperty | IIntegerProperty | ILongProperty | IDoubleProperty).validator = validator;
                    }

                    if (lengthValidator !== undefined) {
                        (result as IStringProperty).lengthValidator = lengthValidator;
                    }

                    if (property.default !== undefined) {
                        (result as IStringProperty | IIntegerProperty | ILongProperty | IDoubleProperty | IBooleanProperty).defaultValue = property.default;
                    }
                }

                const decorators = decoratorsFromVocabularyAndMetadata(property.vocabulary, property.metadata);
                if (decorators !== undefined) {
                    result.decorators = decorators;
                }

                if (['concerto.metamodel@1.0.0.RelationshipProperty', 'concerto.metamodel@1.0.0.ObjectProperty'].includes(propertyClass)) {
                    const namespace = ModelUtil.getNamespace(property.scalarType ? property.scalarType : property.type);
                    const typeName = ModelUtil.getShortName(property.scalarType ? property.scalarType :property.type);
                    (result as IObjectProperty).type = {
                        '$class': 'concerto.metamodel@1.0.0.TypeIdentifier',
                        'name': typeName,
                        'namespace': namespace
                    };
                }

                if (property.isIdentifier) {
                    identifier = name;
                }

                return result;
            })
            .filter(({ name }) => !['$identifier', '$timestamp'].includes(name)), identifier
    };
}

/**
 * Converts a Concertino MapDeclaration to Concerto metamodel format.
 * @param {string} name - The map name.
 * @param {MapDeclaration} declaration - The map declaration.
 * @returns {IMapDeclaration} The Concerto map declaration.
 */
function transformMap(name: string, declaration: MapDeclaration): any {
    const result: IMapDeclaration = {
        $class: 'concerto.metamodel@1.0.0.MapDeclaration',
        name,
        key: mapKeyType(declaration.key),
        value: mapValueType(declaration.value),
    };

    const decorators = decoratorsFromVocabularyAndMetadata(declaration.vocabulary, declaration.metadata);
    if (decorators !== undefined) {
        result.decorators = decorators;
    }

    return result;
}

/**
 * Converts a Concertino ScalarDeclaration to Concerto metamodel format.
 * @param {string} namespace - The namespace.
 * @param {string} name - The scalar name.
 * @param {ScalarDeclaration} declaration - The scalar declaration.
 * @returns {ScalarDeclarationUnion & { namespace: string }} The Concerto scalar declaration.
 */
function transformScalar(namespace: string, name: string, declaration: ScalarDeclaration):  ScalarDeclarationUnion & { namespace : string} {
    const scalarTypeMap: Record<string, string> = {
        StringScalar: 'concerto.metamodel@1.0.0.StringScalar',
        IntegerScalar: 'concerto.metamodel@1.0.0.IntegerScalar',
        BooleanScalar: 'concerto.metamodel@1.0.0.BooleanScalar',
        DoubleScalar: 'concerto.metamodel@1.0.0.DoubleScalar',
        LongScalar: 'concerto.metamodel@1.0.0.LongScalar',
        DateTimeScalar: 'concerto.metamodel@1.0.0.DateTimeScalar',
    };

    // TODO fix this bug in concerto-types, for missing namespace prop
    const result: ScalarDeclarationUnion & { namespace : string} = {
        $class: scalarTypeMap[declaration.type],
        name,
        namespace,
        ...extractScalarValidators(declaration),
    };

    if (declaration.default !== undefined) {
        (result as IStringScalar | IIntegerScalar | ILongScalar | IDoubleScalar | IBooleanScalar).defaultValue = declaration.default;
    }
    // TODO remove following line
    // NOTE: Match strange behaviour in Concerto where missing default values for DateTime scalars default to null
    if (result.$class === 'concerto.metamodel@1.0.0.DateTimeScalar' && declaration.default === undefined) {
        // (result as IDateTimeScalar).defaultValue = null;
    }

    const decorators = decoratorsFromVocabularyAndMetadata(declaration.vocabulary, declaration.metadata);
    if (decorators !== undefined) {
        result.decorators = decorators;
    }

    return result;
}

/**
 * Converts a Concertino EnumDeclaration to Concerto metamodel format.
 * @param {string} name - The enum name.
 * @param {EnumDeclaration} declaration - The enum declaration.
 * @returns {IEnumDeclaration} The Concerto enum declaration.
 */
function transformEnum(name: string, declaration: EnumDeclaration): any {
    const result: IEnumDeclaration = {
        $class: 'concerto.metamodel@1.0.0.EnumDeclaration',
        name,
        properties: transformEnumValues(declaration.values),
    };

    const decorators = decoratorsFromVocabularyAndMetadata(declaration.vocabulary, declaration.metadata);
    if (decorators !== undefined) {
        result.decorators = decorators;
    }

    return result;
}

/**
 * Converts a Concertino ConceptDeclaration to Concerto metamodel format.
 * @param {string} name - The concept name.
 * @param {ConceptDeclaration} declaration - The concept declaration.
 * @returns {IConceptDeclaration} The Concerto concept declaration.
 */
function transformConcept(name: string, declaration: ConceptDeclaration): IConceptDeclaration {
    const { properties, identifier } = transformProperties(declaration.properties ?? {});
    const result: IConceptDeclaration = {
        $class: `concerto.metamodel@1.0.0.${declaration.prototype || 'ConceptDeclaration'}`,
        name,
        isAbstract: declaration.isAbstract || false,
        properties,
    };

    const decorators = decoratorsFromVocabularyAndMetadata(declaration.vocabulary, declaration.metadata);
    if (decorators !== undefined) {
        result.decorators = decorators;
    }

    if (declaration.extends) {
        const namespace = ModelUtil.getNamespace(declaration.extends[0]);
        const typeName = ModelUtil.getShortName(declaration.extends[0]);
        result.superType = {
            '$class': 'concerto.metamodel@1.0.0.TypeIdentifier',
            'name': typeName,
            'namespace': namespace
        };
    }

    if (identifier) {
        if (identifier === '$identifier') {
            result.identified = {
                $class: 'concerto.metamodel@1.0.0.Identified'
            };
        } else {
            result.identified = {
                $class: 'concerto.metamodel@1.0.0.IdentifiedBy',
                name: identifier,
            } as IIdentifiedBy;
        }
    }

    return result;
}

/**
 * Converts a list of Concertino declarations to Concerto metamodel format.
 * @param {string} namespace - The namespace.
 * @param {[string, Declaration][]} declarations - The list of declarations.
 * @returns {any[]} The array of Concerto declarations.
 */
function transformDeclarations(namespace: string, declarations: [string, Declaration][]): any[] {
    return declarations.map(([name, declaration]) => {
        switch (declaration.type) {
        case 'ConceptDeclaration':
            return transformConcept(name, declaration as ConceptDeclaration);
        case 'EnumDeclaration':
            return transformEnum(name, declaration as EnumDeclaration);
        case 'StringScalar':
        case 'IntegerScalar':
        case 'BooleanScalar':
        case 'DoubleScalar':
        case 'LongScalar':
        case 'DateTimeScalar':
            return transformScalar(namespace, name, declaration as ScalarDeclaration);
        case 'MapDeclaration':
            return transformMap(name, declaration as MapDeclaration);
        }
    });
}

/**
 * Groups declarations by their namespace.
 * @param {Concertion} concertino - The Concertino object.
 * @returns {Record<string, [string, Declaration][]>} A map of namespaces to their declarations.
 */
function groupDeclarationsByNamespace(concertino: Concertino): Record<string, [string, Declaration][]> {
    const namespaces: Record<string, [string, Declaration][]> = {};
    Object.entries(concertino.declarations).forEach(([fullyQualifiedName, declaration]) => {
        const namespace = ModelUtil.getNamespace(fullyQualifiedName);
        if (!namespaces[namespace]) {
            namespaces[namespace] = [];
        }
        namespaces[namespace].push([fullyQualifiedName.split('.').pop() || '', declaration]);
    });

    // Create entries for models without any declarations too
    Object.entries(concertino.metadata.models).forEach(([namespace])=> {
        if (!namespaces[namespace]){
            namespaces[namespace] = [];
        }
    });
    return namespaces;
}

/**
 * Converts a Concertino JSON object back into a valid Concerto metamodel instance.
 * @param {Concertino} concertino - The Concertino JSON object.
 * @returns {IModels} A valid Concerto metamodel instance in JSON format.
 */
function convertToMetamodel(concertino: Concertino): IModels {
    const metamodel: IModels = {
        $class: 'concerto.metamodel@1.0.0.Models',
        models: [],
    };

    // Group declarations by namespace
    const namespaces = groupDeclarationsByNamespace(concertino);

    Object.entries(namespaces).forEach(([namespace, declarations]) => {
        const model: IModel = {
            $class: 'concerto.metamodel@1.0.0.Model',
            namespace,
        };

        const ctoDeclarations = transformDeclarations(namespace, declarations);
        if (ctoDeclarations.length > 0){
            model.declarations = ctoDeclarations;
        }

        if(concertino.metadata.models[namespace]?.imports) {
            model.imports = concertino.metadata.models[namespace]?.imports;
        }

        if(concertino.metadata.models[namespace]?.decorators) {
            model.decorators = concertino.metadata.models[namespace]?.decorators;
        }

        if(concertino.metadata.models[namespace]?.concertoVersion) {
            model.concertoVersion = concertino.metadata.models[namespace].concertoVersion;
        }

        if (concertino.metadata.models[namespace]?.sourceUri) {
            model.sourceUri = concertino.metadata.models[namespace].sourceUri;
        }

        metamodel.models.push(model);
    });

    return metamodel;
}

export { convertToMetamodel };


