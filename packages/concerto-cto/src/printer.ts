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

import { MetaModelNamespace } from '@accordproject/concerto-metamodel';

interface DecoratorArgument {
    $class: string;
    type?: { name: string };
    isArray?: boolean;
    value?: any;
}

interface Decorator {
    $class: string;
    name: string;
    arguments?: DecoratorArgument[];
}

interface MetaModelWithType {
    $class: string;
    type: {
        name: string;
    };
}

interface MetaModelWithValidator {
    $class: string;
    defaultValue?: any;
    validator?: {
        lower?: number;
        upper?: number;
    };
}

interface Property {
    $class: string;
    name: string;
    isArray?: boolean;
    isOptional?: boolean;
    decorators?: Decorator[];
}

interface MapEntry {
    $class: string;
    key: any;
    value: any;
    decorators?: Decorator[];
}

interface Declaration {
    $class: string;
    name?: string;
    isAbstract?: boolean;
    superType?: { name: string };
    properties?: Property[];
    decorators?: Decorator[];
    values?: any[];
    range?: { lower: number; upper: number };
    keyType?: any;
    valueType?: any;
}

interface MetaModel {
    $class: string;
    namespace: string;
    imports?: Array<{ namespace: string; uri?: string }>;
    declarations?: Declaration[];
}

/**
 * Returns true if the metamodel is a MapDeclaration
 * @param {object} mm - the metamodel
 * @return {boolean} the string for that model
 */
function isMap(mm: any): boolean {
    return mm.$class === `${MetaModelNamespace}.MapDeclaration`;
}

/**
 * Returns true if the metamodel is a ScalarDeclaration
 * @param {object} mm - the metamodel
 * @return {boolean} the string for that model
 */
function isScalar(mm: any): boolean {
    return [
        `${MetaModelNamespace}.BooleanScalar`,
        `${MetaModelNamespace}.IntegerScalar`,
        `${MetaModelNamespace}.LongScalar`,
        `${MetaModelNamespace}.DoubleScalar`,
        `${MetaModelNamespace}.StringScalar`,
        `${MetaModelNamespace}.DateTimeScalar`,
    ].includes(mm.$class);
}

/**
 * Create decorator argument string from a metamodel
 * @param {object} mm - the metamodel
 * @return {string} the string for the decorator argument
 */
function decoratorArgFromMetaModel(mm: DecoratorArgument): string {
    let result = '';
    switch (mm.$class) {
    case `${MetaModelNamespace}.DecoratorTypeReference`:
        result += `${mm.type?.name}${mm.isArray ? '[]' : ''}`;
        break;
    case `${MetaModelNamespace}.DecoratorString`:
        result += `"${mm.value}"`;
        break;
    default:
        result += `${mm.value}`;
        break;
    }
    return result;
}

/**
 * Create decorator string from a metamodel
 * @param {object} mm - the metamodel
 * @return {string} the string for the decorator
 */
function decoratorFromMetaModel(mm: Decorator): string {
    let result = '';
    result += `@${mm.name}`;
    if (mm.arguments) {
        result += '(';
        result += mm.arguments.map(decoratorArgFromMetaModel).join(',');
        result += ')';
    }
    return result;
}

/**
 * Create decorators string from a metamodel
 * @param {object} mm - the metamodel
 * @param {string} prefix - indentation
 * @return {string} the string for the decorators
 */
function decoratorsFromMetaModel(mm: Decorator[], prefix: string): string {
    let result = '';
    result += mm.map(decoratorFromMetaModel).join(`\n${prefix}`);
    result += `\n${prefix}`;
    return result;
}

/**
 * Create type string from a metamodel
 *
 * @param {object} mm - the metamodel
 * @return {string} the string for the type
 */
function typeFromMetaModel(mm: MetaModelWithType): string {
    let result = '';
    switch (mm.$class) {
    case `${MetaModelNamespace}.EnumProperty`:
        break;
    case `${MetaModelNamespace}.BooleanScalar`:
    case `${MetaModelNamespace}.BooleanProperty`:
    case `${MetaModelNamespace}.BooleanMapValueType`:
        result += ' Boolean';
        break;
    case `${MetaModelNamespace}.DateTimeProperty`:
    case `${MetaModelNamespace}.DateTimeScalar`:
    case `${MetaModelNamespace}.DateTimeMapKeyType`:
    case `${MetaModelNamespace}.DateTimeMapValueType`:
        result += ' DateTime';
        break;
    case `${MetaModelNamespace}.DoubleProperty`:
    case `${MetaModelNamespace}.DoubleScalar`:
    case `${MetaModelNamespace}.DoubleMapValueType`:
        result += ' Double';
        break;
    case `${MetaModelNamespace}.IntegerProperty`:
    case `${MetaModelNamespace}.IntegerScalar`:
    case `${MetaModelNamespace}.IntegerMapValueType`:
        result += ' Integer';
        break;
    case `${MetaModelNamespace}.LongProperty`:
    case `${MetaModelNamespace}.LongScalar`:
    case `${MetaModelNamespace}.LongMapValueType`:
        result += ' Long';
        break;
    case `${MetaModelNamespace}.StringProperty`:
    case `${MetaModelNamespace}.StringScalar`:
    case `${MetaModelNamespace}.StringMapKeyType`:
    case `${MetaModelNamespace}.StringMapValueType`:
        result += ' String';
        break;
    case `${MetaModelNamespace}.ObjectProperty`:
    case `${MetaModelNamespace}.ObjectMapKeyType`:
    case `${MetaModelNamespace}.ObjectMapValueType`:
        result += ` ${mm.type.name}`;
        break;
    case `${MetaModelNamespace}.RelationshipProperty`:
    case `${MetaModelNamespace}.RelationshipMapValueType`:
        result += ` ${mm.type.name}`;
        break;
    }
    return result;
}

/**
 * Create modifiers string from a metamodel
 *
 * @param {object} mm - the metamodel
 * @return {string} the string for the modifiers
 */
function modifiersFromMetaModel(mm: MetaModelWithValidator): string {
    let result = '';
    let defaultString = '';
    let validatorString = '';

    switch (mm.$class) {
    case `${MetaModelNamespace}.EnumProperty`:
        break;
    case `${MetaModelNamespace}.BooleanProperty`:
    case `${MetaModelNamespace}.BooleanScalar`:
        if (mm.defaultValue === true || mm.defaultValue === false) {
            if (mm.defaultValue) {
                defaultString += ' default=true';
            } else {
                defaultString += ' default=false';
            }
        }
        break;
    case `${MetaModelNamespace}.DateTimeProperty`:
    case `${MetaModelNamespace}.DateTimeScalar`:
        if (mm.defaultValue) {
            result += ` default="${mm.defaultValue}"`;
        }
        break;
    case `${MetaModelNamespace}.DoubleProperty`:
    case `${MetaModelNamespace}.DoubleScalar`:
        if (mm.defaultValue) {
            const doubleString = mm.defaultValue.toFixed(Math.max(1, (mm.defaultValue.toString().split('.')[1] || []).length));

            defaultString += ` default=${doubleString}`;
        }
        if (mm.validator) {
            const lowerString = mm.validator.lower !== undefined ? mm.validator.lower : '';
            const upperString = mm.validator.upper !== undefined ? mm.validator.upper : '';
            validatorString += ` range=[${lowerString},${upperString}]`;
        }
        break;
    case `${MetaModelNamespace}.IntegerProperty`:
    case `${MetaModelNamespace}.IntegerScalar`:
        if (mm.defaultValue !== undefined) {
            defaultString += ` default=${mm.defaultValue.toString()}`;
        }
        if (mm.validator) {
            const lowerString = mm.validator.lower !== undefined ? mm.validator.lower : '';
            const upperString = mm.validator.upper !== undefined ? mm.validator.upper : '';
            validatorString += ` range=[${lowerString},${upperString}]`;
        }
        break;
    }
    
    return result + defaultString + validatorString;
}

/**
 * Create property string from a metamodel
 *
 * @param {object} prop - the property metamodel object
 * @return {string} the string for the property
 */
function propertyFromMetaModel(prop: Property): string {
    let result = '';
    if (prop.decorators) {
        result += decoratorsFromMetaModel(prop.decorators, '    ');
    }
    result += '    o';
    switch (prop.$class) {
    case `${MetaModelNamespace}.EnumProperty`:
        result += ` ${prop.name}`;
        break;
    default:
        result += typeFromMetaModel(prop as any as MetaModelWithType);
        result += ` ${prop.name}`;
        if (prop.isArray) {
            result += '[]';
        }
    }

    let modifiers = modifiersFromMetaModel(prop as any as MetaModelWithValidator);
    if (prop.isOptional) {
        if (modifiers) {
            modifiers += ' optional';
        } else {
            modifiers = ' optional';
        }
    }
    if (modifiers) {
        result += modifiers;
    }
    return result;
}

/**
 * Create map string from a metamodel
 *
 * @param {object} entry - the map metamodel object
 * @return {string} the string for the map
 */
function mapFromMetaModel(entry: MapEntry): string {
    let result = '';
    if (entry.decorators) {
        result += decoratorsFromMetaModel(entry.decorators, '    ');
    }
    result += '    o Map{';
    switch (entry.key.$class) {
    case `${MetaModelNamespace}.StringMapKeyType`:
        result += 'String';
        break;
    case `${MetaModelNamespace}.DateTimeMapKeyType`:
        result += 'DateTime';
        break;
    case `${MetaModelNamespace}.ObjectMapKeyType`:
        result += entry.key.type.name;
        break;
    }
    result += ',';
    result += typeFromMetaModel(entry.value as any as MetaModelWithType).trim();
    result += '}';
    return result;
}

/**
 * Create declaration string from a metamodel
 *
 * @param {object} mm - the declaration metamodel object
 * @return {string} the string for the declaration
 */
function declFromMetaModel(mm: Declaration): string {
    let result = '';
    const metaModel = mm as any;

    if (mm.decorators) {
        result += decoratorsFromMetaModel(mm.decorators, '');
    }
    
    if (isScalar(metaModel)) {
        result += 'scalar';
        result += typeFromMetaModel(metaModel);
        result += ` ${mm.name}`;
        result += modifiersFromMetaModel(metaModel);
        result += '\n';
    } else if (isMap(metaModel)) {
        result += 'map';
        result += ` ${mm.name} {`;
        result += '\n';
        const mapEntry = {
            $class: '',
            key: mm.keyType,
            value: mm.valueType,
            decorators: undefined
        };
        result += mapFromMetaModel(mapEntry);
        result += '\n';
        result += '}\n';
    } else {
        switch (mm.$class) {
        case `${MetaModelNamespace}.ConceptDeclaration`:
            if (mm.isAbstract) {
                result += 'abstract ';
            }
            result += 'concept';
            result += ` ${mm.name}`;
            if (mm.superType) {
                result += ` extends ${mm.superType.name}`;
            }
            result += ' {\n';
            if (mm.properties) {
                result += mm.properties.map(propertyFromMetaModel).join('\n');
            }
            if (mm.properties && mm.properties.length > 0) {
                result += '\n';
            }
            result += '}\n';
            break;
        case `${MetaModelNamespace}.AssetDeclaration`:
            if (mm.isAbstract) {
                result += 'abstract ';
            }
            result += 'asset';
            result += ` ${mm.name}`;
            if (mm.superType) {
                result += ` extends ${mm.superType.name}`;
            }
            result += ' {\n';
            if (mm.properties) {
                result += mm.properties.map(propertyFromMetaModel).join('\n');
            }
            if (mm.properties && mm.properties.length > 0) {
                result += '\n';
            }
            result += '}\n';
            break;
        case `${MetaModelNamespace}.ParticipantDeclaration`:
            if (mm.isAbstract) {
                result += 'abstract ';
            }
            result += 'participant';
            result += ` ${mm.name}`;
            if (mm.superType) {
                result += ` extends ${mm.superType.name}`;
            }
            result += ' {\n';
            if (mm.properties) {
                result += mm.properties.map(propertyFromMetaModel).join('\n');
            }
            if (mm.properties && mm.properties.length > 0) {
                result += '\n';
            }
            result += '}\n';
            break;
        case `${MetaModelNamespace}.TransactionDeclaration`:
            if (mm.isAbstract) {
                result += 'abstract ';
            }
            result += 'transaction';
            result += ` ${mm.name}`;
            if (mm.superType) {
                result += ` extends ${mm.superType.name}`;
            }
            result += ' {\n';
            if (mm.properties) {
                result += mm.properties.map(propertyFromMetaModel).join('\n');
            }
            if (mm.properties && mm.properties.length > 0) {
                result += '\n';
            }
            result += '}\n';
            break;
        case `${MetaModelNamespace}.EventDeclaration`:
            if (mm.isAbstract) {
                result += 'abstract ';
            }
            result += 'event';
            result += ` ${mm.name}`;
            if (mm.superType) {
                result += ` extends ${mm.superType.name}`;
            }
            result += ' {\n';
            if (mm.properties) {
                result += mm.properties.map(propertyFromMetaModel).join('\n');
            }
            if (mm.properties && mm.properties.length > 0) {
                result += '\n';
            }
            result += '}\n';
            break;
        case `${MetaModelNamespace}.EnumDeclaration`:
            result += 'enum';
            result += ` ${mm.name} {\n`;
            if (mm.values) {
                result += mm.values.map(value => `    o ${value}`).join('\n');
            }
            if (mm.values && mm.values.length > 0) {
                result += '\n';
            }
            result += '}\n';
            break;
        }
    }
    return result;
}

/**
 * Converts a metamodel instance to a CTO string
 *
 * @param {*} metaModel - the metamodel instance
 * @return {string} the CTO model as a string
 */
function toCTO(metaModel: MetaModel): string {
    let result = '';

    // namespace
    result += `namespace ${metaModel.namespace}\n`;

    // imports
    if (metaModel.imports) {
        metaModel.imports.forEach(element => {
            if (element.uri) {
                result += `import ${element.namespace} from ${element.uri}\n`;
            } else {
                result += `import ${element.namespace}\n`;
            }
        });
        if (metaModel.imports.length > 0) {
            result += '\n';
        }
    }

    // declarations
    if (metaModel.declarations) {
        metaModel.declarations.forEach(decl => {
            result += declFromMetaModel(decl);
            result += '\n';
        });
    }

    // trim end
    result = result.replace(/\n*$/, '\n');
    return result;
}

export = {
    toCTO,
}; 