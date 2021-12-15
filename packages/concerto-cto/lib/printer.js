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

/**
 * Create decorator argument string from a metamodel
 * @param {object} mm - the metamodel
 * @return {string} the string for the decorator argument
 */
function decoratorArgFromMetaModel(mm) {
    let result = '';
    switch (mm.$class) {
    case 'concerto.metamodel.DecoratorTypeReference':
        result += `${mm.type.name}${mm.isArray ? '[]' : ''}`;
        break;
    case 'concerto.metamodel.DecoratorString':
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
 * Create a property string from a metamodel
 * @param {object} mm - the metamodel
 * @return {string} the string for that property
 */
function propertyFromMetaModel(mm) {
    let result = '';
    let defaultString = '';
    let validatorString = '';

    if (mm.decorators) {
        result += decoratorsFromMetaModel(mm.decorators, '  ');
    }
    if (mm.$class === 'concerto.metamodel.RelationshipProperty') {
        result += '-->';
    } else {
        result += 'o';
    }

    switch (mm.$class) {
    case 'concerto.metamodel.EnumProperty':
        break;
    case 'concerto.metamodel.BooleanProperty':
        result += ' Boolean';
        if (mm.defaultValue === true || mm.defaultValue === false) {
            if (mm.defaultValue) {
                defaultString += ' default=true';
            } else {
                defaultString += ' default=false';
            }
        }
        break;
    case 'concerto.metamodel.DateTimeProperty':
        result += ' DateTime';
        break;
    case 'concerto.metamodel.DoubleProperty':
        result += ' Double';
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
    case 'concerto.metamodel.IntegerProperty':
        result += ' Integer';
        if (mm.defaultValue) {
            defaultString += ` default=${mm.defaultValue.toString()}`;
        }
        if (mm.validator) {
            const lowerString = mm.validator.lower ? mm.validator.lower : '';
            const upperString = mm.validator.upper ? mm.validator.upper : '';
            validatorString += ` range=[${lowerString},${upperString}]`;
        }
        break;
    case 'concerto.metamodel.LongProperty':
        result += ' Long';
        if (mm.defaultValue) {
            defaultString += ` default=${mm.defaultValue.toString()}`;
        }
        if (mm.validator) {
            const lowerString = mm.validator.lower ? mm.validator.lower : '';
            const upperString = mm.validator.upper ? mm.validator.upper : '';
            validatorString += ` range=[${lowerString},${upperString}]`;
        }
        break;
    case 'concerto.metamodel.StringProperty':
        result += ' String';
        if (mm.defaultValue) {
            defaultString += ` default="${mm.defaultValue}"`;
        }
        if (mm.validator) {
            validatorString += ` regex=/${mm.validator.pattern}/${mm.validator.flags}`;
        }
        break;
    case 'concerto.metamodel.ObjectProperty':
        result += ` ${mm.type.name}`;
        if (mm.defaultValue) {
            defaultString += ` default="${mm.defaultValue}"`;
        }
        break;
    case 'concerto.metamodel.RelationshipProperty':
        result += ` ${mm.type.name}`;
        break;
    }
    if (mm.isArray) {
        result += '[]';
    }
    result += ` ${mm.name}`;
    if (mm.isOptional) {
        result += ' optional';
    }
    result += defaultString;
    result += validatorString;
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

    if (mm.isAbstract) {
        result += 'abstract ';
    }
    switch (mm.$class) {
    case 'concerto.metamodel.AssetDeclaration':
        result += `asset ${mm.name} `;
        break;
    case 'concerto.metamodel.ConceptDeclaration':
        result += `concept ${mm.name} `;
        break;
    case 'concerto.metamodel.EventDeclaration':
        result += `event ${mm.name} `;
        break;
    case 'concerto.metamodel.ParticipantDeclaration':
        result += `participant ${mm.name} `;
        break;
    case 'concerto.metamodel.TransactionDeclaration':
        result += `transaction ${mm.name} `;
        break;
    case 'concerto.metamodel.EnumDeclaration':
        result += `enum ${mm.name} `;
        break;
    }
    if (mm.superType) {
        result += `extends ${mm.superType.name} `;
    }
    // XXX Needs to be fixed to support `identified`
    if (mm.identified) {
        if (mm.identified.$class === 'concerto.metamodel.IdentifiedBy') {
            result += `identified by ${mm.identified.name} `;
        } else {
            result += 'identified ';
        }
    }
    result += '{';
    mm.properties.forEach((property) => {
        result += `\n  ${propertyFromMetaModel(property)}`;
    });
    result += '\n}';
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
    result += `namespace ${metaModel.namespace}`;
    if (metaModel.imports && metaModel.imports.length > 0) {
        result += '\n';
        metaModel.imports.forEach((imp) => {
            let name = '*';
            if (imp.$class === 'concerto.metamodel.ImportType') {
                name = imp.name;
            }
            result += `\nimport ${imp.namespace}.${name}`;
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
