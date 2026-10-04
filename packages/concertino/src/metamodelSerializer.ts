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
import * as ModelUtil from './names';
import {
    IConcertino,
    IConcertinoDeclaration,
    IConcertinoProperty,
    IConcertinoEnumDeclaration,
    IConcertinoConceptDeclaration,
    IConcertinoMapDeclaration,
    IConcertinoScalarDeclaration,
    IMapValue as MapValue,
    IConcertinoStringScalarDeclaration,
    IConcertinoIntegerScalarDeclaration,
    IConcertinoStringProperty,
    IConcertinoIntegerProperty,
    IConcertinoEnumValue,
    MetadataMap,
    IVocabulary,
    IStringDecoratorValue,
} from './spec/concertino.metamodel@5.1.0';
import {
    IBooleanProperty,
    IBooleanScalar,
    ICollectionSizeValidator,
    IConceptDeclaration,
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
} from '@accordproject/concerto-metamodel';

/**
 * The local names a model gives to imported types, keyed by the fully
 * qualified name of the declared type: `import b@1.0.0.{Foo as Bar}` maps
 * `b@1.0.0.Foo` to `Bar`.
 */
type Aliases = Map<string, string>;

const NO_ALIASES: Aliases = new Map();

/**
 * Reads the aliased types of a model's imports.
 * @param {any[]} [imports] - The model's imports.
 * @returns {Aliases} The aliases.
 */
function aliasesOf(imports?: any[]): Aliases {
    const aliases: Aliases = new Map();
    (imports || []).forEach((imp) => {
        (imp.aliasedTypes || []).forEach((aliased: { name: string; aliasedName: string }) => {
            aliases.set(`${imp.namespace}.${aliased.name}`, aliased.aliasedName);
        });
    });
    return aliases;
}

/**
 * Builds the TypeIdentifier for a fully qualified type name, as the resolved
 * metamodel writes it. A type the model imports under an alias gets the
 * local name, with the declared name as `resolvedName`, when the two differ.
 * A name without a namespace (a primitive type in a decorator type
 * reference) gets no namespace.
 * @param {string} fqn - The fully qualified type name.
 * @param {Aliases} aliases - The model's import aliases.
 * @returns {any} The TypeIdentifier.
 */
function typeIdentifier(fqn: string, aliases: Aliases): any {
    const namespace = ModelUtil.getNamespace(fqn);
    const name = ModelUtil.getShortName(fqn);
    const result: any = {
        '$class': 'concerto.metamodel@1.0.0.TypeIdentifier',
        name,
    };
    if (namespace !== '') {
        result.namespace = namespace;
    }
    const alias = aliases.get(fqn);
    // `import a@1.0.0.{Foo as Foo}` resolves without a resolvedName.
    if (alias !== undefined && alias !== name) {
        result.name = alias;
        result.resolvedName = name;
    }
    return result;
}

/**
 * Extracts scalar validators (regex, range, length) from a ScalarDeclaration.
 * @param {IConcertinoScalarDeclaration} declaration - The scalar declaration to extract validators from.
 * @returns {{ lengthValidator?: IStringLengthValidator; validator?: IDoubleDomainValidator | IIntegerDomainValidator | ILongDomainValidator | IStringRegexValidator }}
 */
function extractScalarValidators(declaration: IConcertinoScalarDeclaration) {
    const result: {
    lengthValidator?: IStringLengthValidator;
    validator?: IDoubleDomainValidator | IIntegerDomainValidator | ILongDomainValidator | IStringRegexValidator;
  } = {};
    const stringDeclaration = declaration as IConcertinoStringScalarDeclaration;
    if ('regex' in declaration && stringDeclaration.regex) {
        const regexValidator: IStringRegexValidator = {
            $class: 'concerto.metamodel@1.0.0.StringRegexValidator',
            pattern: stringDeclaration.regex,
            flags: ''
        };

        // Check if it's already in the form /pattern/flags
        const match = stringDeclaration.regex.match(/^\/(.*)\/([gimuy]*)$/);
        if (match) {
            regexValidator.pattern = match[1];
            regexValidator.flags = match[2];
        }
        result.validator = regexValidator;
    }

    const integerDeclaration = declaration as IConcertinoIntegerScalarDeclaration;
    if ('range' in integerDeclaration && integerDeclaration.range) {
        result.validator = { $class: `concerto.metamodel@1.0.0.${declaration.type.replace('Scalar', '')}DomainValidator` };
        if (integerDeclaration.range[0] !== undefined && integerDeclaration.range[0] !== null) {
            (result.validator as IDoubleDomainValidator | IIntegerDomainValidator | ILongDomainValidator).lower = integerDeclaration.range[0];
        }
        if (integerDeclaration.range[1] !== undefined && integerDeclaration.range[1] !== null) {
            (result.validator as IDoubleDomainValidator | IIntegerDomainValidator | ILongDomainValidator).upper = integerDeclaration.range[1];
        }
    }

    if ('length' in stringDeclaration && stringDeclaration.length) {
        result.lengthValidator = { $class: 'concerto.metamodel@1.0.0.StringLengthValidator' };
        if (stringDeclaration.length[0] !== undefined && stringDeclaration.length[0] !== null) {
            result.lengthValidator.minLength = stringDeclaration.length[0];
        }
        if (stringDeclaration.length[1] !== undefined && stringDeclaration.length[1] !== null) {
            result.lengthValidator.maxLength = stringDeclaration.length[1];
        }
    }

    return result;
}

/**
 * The vocabulary, metadata and decorator order of a decorated Concertino element.
 */
interface Decorated {
    vocabulary?: IVocabulary;
    metadata?: MetadataMap;
    decoratorOrder?: string[];
}

/**
 * Converts a metadata entry into a Concerto decorator.
 * @param {string} name - The decorator name.
 * @param {unknown[] | null} decoratorValues - The arguments, or null for a decorator without an argument list.
 * @param {Aliases} aliases - The model's import aliases.
 * @returns {IDecorator} The decorator.
 */
function decoratorFromMetadata(name: string, decoratorValues: unknown[] | null | undefined, aliases: Aliases): IDecorator {
    const decorator : IDecorator = {
        $class: 'concerto.metamodel@1.0.0.Decorator',
        name,
    };
    if (decoratorValues) {
        decorator.arguments = (decoratorValues || []).map((arg) => {
            const stringArg = arg as IStringDecoratorValue;
            if (typeof stringArg === 'string') {
                return { $class: 'concerto.metamodel@1.0.0.DecoratorString', value: arg };
            } else if (typeof stringArg === 'number') {
                return { $class: 'concerto.metamodel@1.0.0.DecoratorNumber', value: arg };
            } else if (typeof stringArg === 'boolean') {
                return { $class: 'concerto.metamodel@1.0.0.DecoratorBoolean', value: arg };
            } else if (typeof arg === 'object' && arg !== null && 'type' in arg) {
                return {
                    '$class': 'concerto.metamodel@1.0.0.DecoratorTypeReference',
                    'isArray': (arg as { isArray?: boolean}).isArray || false,
                    'type': typeIdentifier((arg as { type: string}).type, aliases)
                };
            }
            throw new Error(`Unsupported argument type: ${typeof arg}`);
        }) as IDecorator['arguments'];
    }
    return decorator;
}

/**
 * Converts vocabulary and metadata into Concerto decorators: the vocabulary
 * label, the additional terms, then the metadata entries, or in
 * `decoratorOrder` when the element has one (since 5.1.0). A name in
 * `decoratorOrder` takes the vocabulary term of that name first, then the
 * metadata entry; a decorator `decoratorOrder` does not name comes last.
 * @param {Decorated} element - The decorated element.
 * @param {Aliases} [aliases] - The model's import aliases.
 * @returns {any[] | undefined} The decorators array or undefined if none.
 */
function decoratorsOf(element: Decorated, aliases: Aliases = NO_ALIASES): any[] | undefined {
    const { vocabulary, metadata, decoratorOrder } = element;
    // Each source of decorators, by name, in the order a 5.0.0 reader writes them.
    const fromVocabulary: [string, any][] = [];
    if (vocabulary?.label === null) {
        fromVocabulary.push(['Term', {
            $class: 'concerto.metamodel@1.0.0.Decorator',
            name: 'Term',
            arguments: [],
        }]);
    } else if (vocabulary?.label !== undefined) {
        fromVocabulary.push(['Term', {
            $class: 'concerto.metamodel@1.0.0.Decorator',
            name: 'Term',
            arguments: [{ $class: 'concerto.metamodel@1.0.0.DecoratorString', value: vocabulary.label }],
        }]);
    }
    if (vocabulary?.additionalTerms) {
        Object.entries(vocabulary.additionalTerms).forEach(([key, value]) => {
            fromVocabulary.push([`Term_${key}`, {
                $class: 'concerto.metamodel@1.0.0.Decorator',
                name: `Term_${key}`,
                arguments: [{ $class: 'concerto.metamodel@1.0.0.DecoratorString', value }],
            }]);
        });
    }
    const fromMetadata: [string, any][] = Object.entries(metadata ?? {})
        .map(([name, values]) => [name, decoratorFromMetadata(name, values as unknown[] | null, aliases)]);

    let decorators: any[];
    if (Array.isArray(decoratorOrder)) {
        const pending = [...fromVocabulary, ...fromMetadata];
        decorators = [];
        decoratorOrder.forEach((name) => {
            const i = pending.findIndex(([n]) => n === name);
            if (i >= 0) {
                decorators.push(pending[i][1]);
                pending.splice(i, 1);
            }
        });
        pending.forEach(([, decorator]) => decorators.push(decorator));
    } else {
        decorators = [...fromVocabulary, ...fromMetadata].map(([, decorator]) => decorator);
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
function mapValueType(value: MapValue, aliases: Aliases): MapValueTypeUnion {
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
        (result as IObjectMapValueType).type = typeIdentifier(value.type, aliases);
    }

    const decorators = decoratorsOf(value, aliases);
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
function mapKeyType(key: MapValue, aliases: Aliases): MapKeyTypeUnion {
    const keyTypeMap: Record<string, string> = {
        String: 'concerto.metamodel@1.0.0.StringMapKeyType',
        DateTime: 'concerto.metamodel@1.0.0.DateTimeMapKeyType',
    };
    const result: IMapKeyType = {
        $class: keyTypeMap[key.type]
    };
    if (!keyTypeMap[key.type]){
        result.$class = 'concerto.metamodel@1.0.0.ObjectMapKeyType';
        (result as IObjectMapKeyType).type = typeIdentifier(key.type, aliases);
    }

    const decorators = decoratorsOf(key, aliases);
    if (decorators !== undefined) {
        result.decorators = decorators;
    }

    return result;
}

/**
 * Converts enum values from Concertino to Concerto metamodel format.
 * @param {Record<string, IConcertinoEnumValue>} values - The enum values.
 * @returns {any[]} The array of Concerto enum properties.
 */
function transformEnumValues(values: Record<string, IConcertinoEnumValue>, aliases: Aliases): any[] {
    return Object.entries(values).map(([name, value]) => {
        const result: IEnumProperty = {
            $class: 'concerto.metamodel@1.0.0.EnumProperty',
            name,
        };

        const decorators = decoratorsOf(value, aliases);
        if (decorators !== undefined) {
            result.decorators = decorators;
        }
        return result;
    });


}

/**
 * Converts properties from Concertino to Concerto metamodel format.
 * @param {Record<string, IConcertinoProperty>} properties - The properties object.
 * @returns {{ properties: any[], identifier?: string }} The properties array and optional identifier.
 */
function transformProperties(properties: Record<string, IConcertinoProperty>, aliases: Aliases): { properties: any[], identifier?: string } {
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

                    const stringProperty = property as IConcertinoStringProperty;
                    if (stringProperty.regex) {
                        const regexValidator: IStringRegexValidator = {
                            $class: 'concerto.metamodel@1.0.0.StringRegexValidator',
                            pattern: stringProperty.regex,
                            flags: ''
                        };

                        // Check if it's already in the form /pattern/flags
                        const match = stringProperty.regex.match(/^\/(.*)\/([gimuy]*)$/);
                        if (match) {
                            regexValidator.pattern = match[1];
                            regexValidator.flags = match[2];
                        }
                        validator = regexValidator;
                    }

                    const integerProperty = property as IConcertinoIntegerProperty;
                    if (integerProperty.range) {
                        validator = { $class: `concerto.metamodel@1.0.0.${property.type.replace('Scalar', '')}DomainValidator` };
                        if (integerProperty.range[0] !== undefined && integerProperty.range[0] !== null) {
                            validator.lower = integerProperty.range[0];
                        }
                        if (integerProperty.range[1] !== undefined && integerProperty.range[1] !== null) {
                            validator.upper = integerProperty.range[1];
                        }
                    }

                    let lengthValidator: IStringLengthValidator | undefined;
                    if (stringProperty.length) {
                        lengthValidator = { $class: 'concerto.metamodel@1.0.0.StringLengthValidator' };
                        if (stringProperty.length[0] !== undefined && stringProperty.length[0] !== null) {
                            lengthValidator.minLength = stringProperty.length[0];
                        }
                        if (stringProperty.length[1] !== undefined && stringProperty.length[1] !== null) {
                            lengthValidator.maxLength = stringProperty.length[1];
                        }
                    }

                    if (validator !== undefined) {
                        (result as IStringProperty | IIntegerProperty | ILongProperty | IDoubleProperty).validator = validator;
                    }

                    if (lengthValidator !== undefined) {
                        (result as IStringProperty).lengthValidator = lengthValidator;
                    }

                    if (property.size) {
                        const sizeValidator: ICollectionSizeValidator = { $class: 'concerto.metamodel@1.0.0.CollectionSizeValidator' };
                        if (property.size[0] !== undefined && property.size[0] !== null) {
                            sizeValidator.minSize = property.size[0];
                        }
                        if (property.size[1] !== undefined && property.size[1] !== null) {
                            sizeValidator.maxSize = property.size[1];
                        }
                        (result as any).sizeValidator = sizeValidator;
                    }

                    if (stringProperty.default !== undefined) {
                        (result as IStringProperty | IIntegerProperty | ILongProperty | IDoubleProperty | IBooleanProperty).defaultValue = stringProperty.default;
                    }
                }

                const decorators = decoratorsOf(property, aliases);
                if (decorators !== undefined) {
                    result.decorators = decorators;
                }

                if (['concerto.metamodel@1.0.0.RelationshipProperty', 'concerto.metamodel@1.0.0.ObjectProperty'].includes(propertyClass)) {
                    (result as IObjectProperty).type = typeIdentifier(property.scalarType ? property.scalarType : property.type, aliases);
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
 * @param {IConcertinoMapDeclaration} declaration - The map declaration.
 * @returns {IMapDeclaration} The Concerto map declaration.
 */
function transformMap(name: string, declaration: IConcertinoMapDeclaration, aliases: Aliases): any {
    const result: IMapDeclaration = {
        $class: 'concerto.metamodel@1.0.0.MapDeclaration',
        name,
        key: mapKeyType(declaration.key, aliases),
        value: mapValueType(declaration.value, aliases),
    };

    const decorators = decoratorsOf(declaration, aliases);
    if (decorators !== undefined) {
        result.decorators = decorators;
    }

    return result;
}

/**
 * Converts a Concertino ScalarDeclaration to Concerto metamodel format.
 * @param {string} namespace - The namespace.
 * @param {string} name - The scalar name.
 * @param {IConcertinoScalarDeclaration} declaration - The scalar declaration.
 * @returns {ScalarDeclarationUnion & { namespace: string }} The Concerto scalar declaration.
 */
function transformScalar(namespace: string, name: string, declaration: IConcertinoScalarDeclaration, aliases: Aliases):  ScalarDeclarationUnion & { namespace : string} {
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

    const stringDeclaration = declaration as IConcertinoStringScalarDeclaration;

    if (stringDeclaration.default !== undefined) {
        (result as IStringScalar | IIntegerScalar | ILongScalar | IDoubleScalar | IBooleanScalar).defaultValue = stringDeclaration.default;
    }

    const decorators = decoratorsOf(declaration, aliases);
    if (decorators !== undefined) {
        result.decorators = decorators;
    }

    return result;
}

/**
 * Converts a Concertino EnumDeclaration to Concerto metamodel format.
 * @param {string} name - The enum name.
 * @param {IConcertinoEnumDeclaration} declaration - The enum declaration.
 * @returns {IEnumDeclaration} The Concerto enum declaration.
 */
function transformEnum(name: string, declaration: IConcertinoEnumDeclaration, aliases: Aliases): any {
    const result: IEnumDeclaration = {
        $class: 'concerto.metamodel@1.0.0.EnumDeclaration',
        name,
        properties: transformEnumValues(declaration.values, aliases),
    };

    const decorators = decoratorsOf(declaration, aliases);
    if (decorators !== undefined) {
        result.decorators = decorators;
    }

    return result;
}

/**
 * Converts a Concertino ConceptDeclaration to Concerto metamodel format.
 * @param {string} name - The concept name.
 * @param {IConcertinoConceptDeclaration} declaration - The concept declaration.
 * @returns {IConceptDeclaration} The Concerto concept declaration.
 */
function transformConcept(name: string, declaration: IConcertinoConceptDeclaration, aliases: Aliases): IConceptDeclaration {
    const { properties, identifier } = transformProperties(declaration.properties ?? {}, aliases);
    const result: IConceptDeclaration = {
        $class: `concerto.metamodel@1.0.0.${declaration.prototype || 'ConceptDeclaration'}`,
        name,
        isAbstract: declaration.isAbstract || false,
        properties,
    };

    const decorators = decoratorsOf(declaration, aliases);
    if (decorators !== undefined) {
        result.decorators = decorators;
    }

    if (declaration.extends) {
        result.superType = typeIdentifier(declaration.extends[0], aliases);
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
 * @param {[string, IConcertinoDeclaration][]} declarations - The list of declarations.
 * @param {Aliases} [aliases] - The model's import aliases.
 * @returns {any[]} The array of Concerto declarations.
 */
function transformDeclarations(namespace: string, declarations: [string, IConcertinoDeclaration][], aliases: Aliases = NO_ALIASES): any[] {
    return declarations.map(([name, declaration]) => {
        switch (declaration.type) {
        case 'ConceptDeclaration':
            return transformConcept(name, declaration as IConcertinoConceptDeclaration, aliases);
        case 'EnumDeclaration':
            return transformEnum(name, declaration as IConcertinoEnumDeclaration, aliases);
        case 'StringScalar':
        case 'IntegerScalar':
        case 'BooleanScalar':
        case 'DoubleScalar':
        case 'LongScalar':
        case 'DateTimeScalar':
            return transformScalar(namespace, name, declaration as IConcertinoScalarDeclaration, aliases);
        case 'MapDeclaration':
            return transformMap(name, declaration as IConcertinoMapDeclaration, aliases);
        }
    });
}

/**
 * Groups declarations by their namespace.
 * @param {Concertion} concertino - The Concertino object.
 * @returns {Record<string, [string, IConcertinoDeclaration][]>} A map of namespaces to their declarations.
 */
function groupDeclarationsByNamespace(concertino: IConcertino): Record<string, [string, IConcertinoDeclaration][]> {
    const namespaces: Record<string, [string, IConcertinoDeclaration][]> = {};
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
function convertToMetamodel(concertino: IConcertino): IModels {
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

        const ctoDeclarations = transformDeclarations(namespace, declarations, aliasesOf(concertino.metadata.models[namespace]?.imports));
        if (ctoDeclarations.length > 0){
            model.declarations = ctoDeclarations;
        }

        if(concertino.metadata.models[namespace]?.imports) {
            model.imports = concertino.metadata.models[namespace]?.imports.map(imp => ({
                ...imp,
                $class: imp.$class || 'concerto.metamodel@1.0.0.Import'
            }));
        }

        if(concertino.metadata.models[namespace]?.decorators) {
            model.decorators = concertino.metadata.models[namespace]?.decorators?.map(d => ({
                ...d,
                $class: d.$class || 'concerto.metamodel@1.0.0.Decorator' // TODO Fix
            })) as IDecorator[];
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


