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
 * Returns true if the metamodel is a MapDeclaration
 * @param {object} mm - the metamodel
 * @return {boolean} the string for that model
 */
function isMap(mm) {
    return  mm.$class === `${MetaModelNamespace}.MapDeclaration`;
}

/**
 * Returns true if the metamodel is a ScalarDeclaration
 * @param {object} mm - the metamodel
 * @return {boolean} the string for that model
 */
function isScalar(mm) {
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
        if (mm.lengthValidator) {
            const minLength = mm.lengthValidator.minLength ? mm.lengthValidator.minLength : '';
            const maxLength = mm.lengthValidator.maxLength ? mm.lengthValidator.maxLength : '';
            validatorString += ` length=[${minLength},${maxLength}]`;
        }
        break;
    case `${MetaModelNamespace}.ObjectProperty`:
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
 * Create a property string from a metamodel property
 * @param {object} prop - the property in scope
 * @return {string} the CML string representation of the property
 */
function propertyFromMetaModel(prop) {
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
 * Create a map type string from a metamodel map
 * @param {object} entry - the map entry in scope
 * @return {string} the CML string representation of the property
 */
function mapFromMetaModel(entry) {
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
 * Create a declaration string from a metamodel
 * @param {object} mm - the metamodel
 * @return {string} the string for that declaration
 */
function declFromMetaModel(mm) {
    let result = '';

    if (mm.decorators) {
        result += decoratorsFromMetaModel(mm.decorators, '');
    }

    if (isScalar(mm)) {
        result += `scalar ${mm.name} extends`;
        result += typeFromMetaModel(mm);
        result += modifiersFromMetaModel(mm);
    } else if (isMap(mm)) {
        const entries = [mm.key, mm.value];
        result += `map ${mm.name} {`;
        entries.forEach(entry => {
            result += `\n  ${mapFromMetaModel(entry)}`;
        });
        result += '\n}';
    }
    else {
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
