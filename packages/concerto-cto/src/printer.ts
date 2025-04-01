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
import {
    IDeclaration,
    IDecorator,
    IDecoratorLiteral,
    IDecoratorString,
    IDecoratorTypeReference,
    IMapDeclaration,
    IModel,
    IProperty,
    IImport,
    IImportTypes,
    IConceptDeclaration,
    IIdentifiedBy,
    IImportType,
    IDecoratorBoolean,
    IDecoratorNumber
} from '@accordproject/concerto-types';

/**
 * Returns true if the metamodel is a MapDeclaration
 * @param {object} mm - the metamodel
 * @return {boolean} the string for that model
 */
function isMap(mm: IDeclaration): boolean {
    return mm.$class === `${MetaModelNamespace}.MapDeclaration`;
}

/**
 * Returns true if the metamodel is a ScalarDeclaration
 * @param {object} mm - the metamodel
 * @return {boolean} the string for that model
 */
function isScalar(mm: IDeclaration): boolean {
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
function decoratorArgFromMetaModel(mm: IDecoratorLiteral): string {
    let result = '';
    switch (mm.$class) {
        case `${MetaModelNamespace}.DecoratorTypeReference`:
            const typeRef = mm as IDecoratorTypeReference;
            result += `${typeRef.type.name}${!!typeRef.isArray ? '[]' : ''}`;
            break;
        case `${MetaModelNamespace}.DecoratorString`:
            const strRef = mm as IDecoratorString;
            result += `"${strRef.value}"`;
            break;
        default:
            result += `${(mm as (IDecoratorNumber | IDecoratorBoolean)).value}`;
            break;
    }
    return result;
}

/**
 * Create decorator string from a metamodel
 * @param {object} mm - the metamodel
 * @return {string} the string for the decorator
 */
function decoratorFromMetaModel(mm: IDecorator): string {
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
function decoratorsFromMetaModel(mm: IDecorator[], prefix: string): string {
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
function typeFromMetaModel(mm: any): string {
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
function modifiersFromMetaModel(mm: any): string {
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
                defaultString += ` default="${mm.defaultValue}"`;
            }
            break;
        case `${MetaModelNamespace}.DoubleProperty`:
        case `${MetaModelNamespace}.DoubleScalar`:
            if (mm.defaultValue !== undefined) {
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
        case `${MetaModelNamespace}.LongProperty`:
        case `${MetaModelNamespace}.LongScalar`:
            if (mm.defaultValue !== undefined) {
                defaultString += ` default=${mm.defaultValue.toString()}`;
            }
            if (mm.validator) {
                const lowerString = mm.validator.lower !== undefined ? mm.validator.lower : '';
                const upperString = mm.validator.upper !== undefined ? mm.validator.upper : '';
                validatorString += ` range=[${lowerString},${upperString}]`;
            }
            break;
        case `${MetaModelNamespace}.StringProperty`:
        case `${MetaModelNamespace}.StringScalar`:
            if (mm.defaultValue) {
                defaultString += ` default="${mm.defaultValue}"`;
            }
            if (mm.validator) {
                validatorString += ` regex=/${mm.validator.pattern}/${mm.validator.flags || ''}`;
            }
            if (mm.lengthValidator) {
                const minLength = mm.lengthValidator.minLength !== undefined ? mm.lengthValidator.minLength : '';
                const maxLength = mm.lengthValidator.maxLength !== undefined ? mm.lengthValidator.maxLength : '';
                validatorString += ` length=[${minLength},${maxLength}]`;
            }
            break;
        case `${MetaModelNamespace}.ObjectProperty`:
            if (mm.defaultValue) {
                defaultString += ` default="${mm.defaultValue}"`;
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
function propertyFromMetaModel(prop: IProperty): string {
    let result = '';

    if (prop.decorators) {
        result += decoratorsFromMetaModel(prop.decorators, '  ');
    }

    if (prop.$class === `${MetaModelNamespace}.RelationshipProperty`) {
        result += '-->';
    } else {
        result += 'o';
    }
    result += typeFromMetaModel(prop);
    if (prop.isArray) {
        result += '[]';
    }
    result += ` ${prop.name}`;
    result += modifiersFromMetaModel(prop);
    if (prop.isOptional) {
        result += ' optional';
    }
    return result;
}

/**
 * Create map type string from a metamodel map
 *
 * @param {object} entry - the map metamodel object
 * @return {string} the string for the map
 */
function mapFromMetaModel(entry: any): string {
    let result = '';
    if (entry.decorators) {
        result += decoratorsFromMetaModel(entry.decorators, '  ');
    }
    if (entry.$class === `${MetaModelNamespace}.RelationshipMapValueType`) {
        result += '-->';
    } else {
        result += 'o';
    }
    result += typeFromMetaModel(entry);
    return result;
}

/**
 * Create declaration string from a metamodel
 *
 * @param {object} mm - the declaration metamodel object
 * @return {string} the string for the declaration
 */
function declFromMetaModel(mm: IDeclaration): string {
    let result = '';

    if (mm.decorators) {
        result += decoratorsFromMetaModel(mm.decorators, '');
    }

    if (isScalar(mm)) {
        result += `scalar ${mm.name} extends`;
        result += typeFromMetaModel(mm);
        result += modifiersFromMetaModel(mm);
    } else if (isMap(mm)) {
        result += `map ${mm.name} {`;
        const mapDecl = mm as IMapDeclaration;
        result += `\n  ${mapFromMetaModel(mapDecl.key)}`;
        result += `\n  ${mapFromMetaModel(mapDecl.value)}`;
        result += '\n}';
    } else {
        const conceptDecl = mm as IConceptDeclaration;
        if (conceptDecl.isAbstract) {
            result += 'abstract ';
        }
        switch (mm.$class) {
            case `${MetaModelNamespace}.AssetDeclaration`:
                result += `asset ${mm.name} `;
                break;
            case `${MetaModelNamespace}.ConceptDeclaration`:
                result += `concept ${mm.name} `;
                break;
            case `${MetaModelNamespace}.EventDeclaration`:
                result += `event ${mm.name} `;
                break;
            case `${MetaModelNamespace}.ParticipantDeclaration`:
                result += `participant ${mm.name} `;
                break;
            case `${MetaModelNamespace}.TransactionDeclaration`:
                result += `transaction ${mm.name} `;
                break;
            case `${MetaModelNamespace}.EnumDeclaration`:
                result += `enum ${mm.name} `;
                break;
        }

        // Handle identified
        if (conceptDecl.identified) {
            if (conceptDecl.identified.$class === `${MetaModelNamespace}.IdentifiedBy`) {
                const identifiedBy = conceptDecl.identified as IIdentifiedBy;
                result += `identified by ${identifiedBy.name} `;
            } else {
                result += 'identified ';
            }
        }

        // Handle supertype
        if (conceptDecl.superType) {
            if (conceptDecl.superType.name === mm.name) {
                throw new Error(`The declaration "${mm.name}" cannot extend itself.`);
            }
            result += `extends ${conceptDecl.superType.name} `;
        }

        result += '{';

        // Handle properties
        conceptDecl.properties.forEach((property: IProperty) => {
            result += `\n  ${propertyFromMetaModel(property)}`;
        });
        result += '\n}';
    }

    return result;
}

/**
 * Converts a metamodel instance to a CTO string
 *
 * @param {*} metaModel - the metamodel instance
 * @return {string} the CTO model as a string
 */
function toCTO(metaModel: IModel): string {
    let result = '';

    // version
    if (metaModel.concertoVersion) {
        result += `concerto version "${metaModel.concertoVersion}"\n\n`;
    }

    // decorators
    if (metaModel.decorators && metaModel.decorators.length > 0) {
        result += decoratorsFromMetaModel(metaModel.decorators, '');
    }

    // namespace
    result += `namespace ${metaModel.namespace}`;

    // imports
    if (metaModel.imports && metaModel.imports.length > 0) {
        result += '\n';
        metaModel.imports.forEach((imp: IImport) => {
            switch (imp.$class) {
                case `${MetaModelNamespace}.ImportType`:
                case `${MetaModelNamespace}.ImportTypeFrom`: {
                    const typedImport = imp as IImportType;
                    result += `\nimport ${imp.namespace}.${typedImport.name}`;
                    break;
                }
                case `${MetaModelNamespace}.ImportAll`:
                case `${MetaModelNamespace}.ImportAllFrom`:
                    result += `\nimport ${imp.namespace}.*`;
                    break;
                case `${MetaModelNamespace}.ImportTypes`: {
                    const typesImport = imp as IImportTypes;
                    const aliasedTypes = typesImport.aliasedTypes
                        ? new Map(
                            typesImport.aliasedTypes.map((aliasedType: any) => [
                                aliasedType.name,
                                aliasedType.aliasedName,
                            ])
                        )
                        : new Map();
                    const commaSeparatedTypesString = typesImport.types
                        .map((type: string) =>
                            aliasedTypes.has(type)
                                ? `${type} as ${aliasedTypes.get(type)}`
                                : type
                        )
                        .join(',');
                    result += `\nimport ${imp.namespace}.{${commaSeparatedTypesString}}`;
                    break;
                }
                default:
                    throw new Error('Unrecognized import');
            }
            if (imp.uri) {
                result += ` from ${imp.uri}`;
            }
        });
    }

    // declarations
    if (metaModel.declarations && metaModel.declarations.length > 0) {
        metaModel.declarations.forEach((decl: IDeclaration) => {
            result += `\n\n${declFromMetaModel(decl)}`;
        });
    }

    return result;
}

export = {
    toCTO,
};
