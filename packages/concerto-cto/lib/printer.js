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

const { MetaModelNamespace } = require('@accordproject/concerto-metamodel');

/**
 * Create decorator argument string from a metamodel
 * @param {object} mm - the metamodel
 * @return {string} the string for the decorator argument
 */
function decoratorArgFromMetaModel(mm) {
    let result = '';
    switch (mm.$class) {
    case `${MetaModelNamespace}.DecoratorTypeReference`:
        result += `${mm.type.name}${mm.isArray ? '[]' : ''}`;
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
function decoratorFromMetaModel(mm) {
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
function decoratorsFromMetaModel(mm, prefix) {
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
function typeFromMetaModel(mm){
    let result = '';
    switch (mm.$class) {
    case `${MetaModelNamespace}.EnumProperty`:
        break;
    case `${MetaModelNamespace}.BooleanScalar`:
    case `${MetaModelNamespace}.BooleanProperty`:
        result += ' Boolean';
        break;
    case `${MetaModelNamespace}.DateTimeProperty`:
    case `${MetaModelNamespace}.DateTimeScalar`:
        result += ' DateTime';
        break;
    case `${MetaModelNamespace}.DoubleProperty`:
    case `${MetaModelNamespace}.DoubleScalar`:
        result += ' Double';
        break;
    case `${MetaModelNamespace}.IntegerProperty`:
    case `${MetaModelNamespace}.IntegerScalar`:
        result += ' Integer';
        break;
    case `${MetaModelNamespace}.LongProperty`:
    case `${MetaModelNamespace}.LongScalar`:
        result += ' Long';
        break;
    case `${MetaModelNamespace}.StringProperty`:
    case `${MetaModelNamespace}.StringScalar`:
        result += ' String';
        break;
    case `${MetaModelNamespace}.ObjectProperty`:
        result += ` ${mm.type.name}`;
        break;
    case `${MetaModelNamespace}.RelationshipProperty`:
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
function modifiersFromMetaModel(mm){
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
            const lowerString = mm.validator.lower ? mm.validator.lower : '';
            const upperString = mm.validator.upper ? mm.validator.upper : '';
            validatorString += ` range=[${lowerString},${upperString}]`;
        }
        break;
    case `${MetaModelNamespace}.IntegerProperty`:
    case `${MetaModelNamespace}.IntegerScalar`:
        if (mm.defaultValue) {
            defaultString += ` default=${mm.defaultValue.toString()}`;
        }
        if (mm.validator) {
            const lowerString = mm.validator.lower ? mm.validator.lower : '';
            const upperString = mm.validator.upper ? mm.validator.upper : '';
            validatorString += ` range=[${lowerString},${upperString}]`;
        }
        break;
    case `${MetaModelNamespace}.LongProperty`:
    case `${MetaModelNamespace}.LongScalar`:
        if (mm.defaultValue) {
            defaultString += ` default=${mm.defaultValue.toString()}`;
        }
        if (mm.validator) {
            const lowerString = mm.validator.lower ? mm.validator.lower : '';
            const upperString = mm.validator.upper ? mm.validator.upper : '';
            validatorString += ` range=[${lowerString},${upperString}]`;
        }
        break;
    case `${MetaModelNamespace}.StringProperty`:
    case `${MetaModelNamespace}.StringScalar`:
        if (mm.defaultValue) {
            defaultString += ` default="${mm.defaultValue}"`;
        }
        if (mm.validator) {
            validatorString += ` regex=/${mm.validator.pattern}/${mm.validator.flags}`;
        }
        break;
    case `${MetaModelNamespace}.ObjectProperty`:
        if (mm.defaultValue) {
            defaultString += ` default="${mm.defaultValue}"`;
        }
        break;
    case `${MetaModelNamespace}.MapProperty`:
        if (mm.defaultValue) {
            defaultString += ` default="${mm.defaultValue}"`;
        }
        break;
    }
    result += defaultString;
    result += validatorString;
    return result;
}

/**
 * Create a property string from a metamodel
 * @param {object} prop - the property in scope
 * @return {string} the CML string representation of the property
 */
function propertyFromMetaModel(prop) {
    let result = '';

    if (prop.decorators) {
        result += decoratorsFromMetaModel(prop.decorators, '  ');
    }
    if (prop.$class === `${MetaModelNamespace}.RelationshipProperty` || prop.isRelationship) {
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
 * Create a declaration string from a metamodel
 * @param {object} mm - the metamodel
 * @return {string} the string for that declaration
 */
function declFromMetaModel(mm) {
    let result = '';

    const booleanScalar$class = `${MetaModelNamespace}.BooleanScalar`;
    const integerScalar$class = `${MetaModelNamespace}.IntegerScalar`;
    const longScalar$class = `${MetaModelNamespace}.LongScalar`;
    const doubleScalar$class = `${MetaModelNamespace}.DoubleScalar`;
    const stringScalar$class = `${MetaModelNamespace}.StringScalar`;
    const dateTimeScalar$class = `${MetaModelNamespace}.DateTimeScalar`;
    const scalar$classes = [
        booleanScalar$class,
        integerScalar$class,
        longScalar$class,
        doubleScalar$class,
        stringScalar$class,
        dateTimeScalar$class,
    ];
    const isScalar = scalar$classes.includes(mm.$class);

    if (mm.decorators) {
        result += decoratorsFromMetaModel(mm.decorators, '');
    }

    if (isScalar) {
        result += `scalar ${mm.name} extends`;

        result += typeFromMetaModel(mm);
        result += modifiersFromMetaModel(mm);
    } else {
        if (mm.isAbstract) {
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
        case `${MetaModelNamespace}.MapDeclaration`:
            result += `map ${mm.name} `;
            break;
        }
        if (mm.identified) {
            if (mm.identified.$class === `${MetaModelNamespace}.IdentifiedBy`) {
                result += `identified by ${mm.identified.name} `;
            } else {
                result += 'identified ';
            }
        }
        if (mm.superType) {
            result += `extends ${mm.superType.name} `;
        }
        result += '{';
        mm.properties.forEach((property) => {
            result += `\n  ${propertyFromMetaModel(property)}`;
        });
        result += '\n}';
    }

    return result;
}

/**
 * Create a model string from a metamodel
 * @param {object} metaModel - the metamodel
 * @return {string} the string for that model
 */
function toCTO(metaModel) {
    let result = '';
    if (metaModel.concertoVersion) {
        result += `concerto version "${metaModel.concertoVersion}"`;
        result += '\n';
        result += '\n';
    }
    if (metaModel.decorators && metaModel.decorators.length > 0) {
        result += decoratorsFromMetaModel(metaModel.decorators, '');
    }
    result += `namespace ${metaModel.namespace}`;
    if (metaModel.imports && metaModel.imports.length > 0) {
        result += '\n';
        metaModel.imports.forEach((imp) => {
            switch(imp.$class) {
            case `${MetaModelNamespace}.ImportType`:
            case `${MetaModelNamespace}.ImportTypeFrom`:
                result += `\nimport ${imp.namespace}.${imp.name}`;
                break;
            case `${MetaModelNamespace}.ImportAll`:
            case `${MetaModelNamespace}.ImportAllFrom`:
                result += `\nimport ${imp.namespace}.*`;
                break;
            case `${MetaModelNamespace}.ImportTypes`:
                result += `\nimport ${imp.namespace}.{${imp.types.join(',')}}`;
                break;
            default:
                throw new Error('Unrecognized import');
            }
            if (imp.uri) {
                result += ` from ${imp.uri}`;
            }
        });
    }
    if (metaModel.declarations && metaModel.declarations.length > 0) {
        metaModel.declarations.forEach((decl) => {
            result += `\n\n${declFromMetaModel(decl)}`;
        });
    }
    return result;
}

module.exports = { toCTO };
