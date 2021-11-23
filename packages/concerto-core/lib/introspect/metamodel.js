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

const parser = require('./parser');
const ModelManager = require('../modelmanager');
const Factory = require('../factory');
const Serializer = require('../serializer');

/**
 * Class to work with the Concerto metamodel
 */
class MetaModel {

    /**
     * The metamodel itself, as a CTO string
     */
    static metaModelCto = `namespace concerto.metamodel

concept Position {
  o Integer line
  o Integer column
  o Integer offset
}

concept Range {
  o Position start
  o Position end
  o String source optional
}

concept TypeIdentifier {
  o String name
  o String namespace optional
}

abstract concept DecoratorLiteral {
  o Range location optional
}

concept DecoratorString extends DecoratorLiteral {
  o String value
}

concept DecoratorNumber extends DecoratorLiteral {
  o Double value
}

concept DecoratorBoolean extends DecoratorLiteral {
  o Boolean value
}

concept DecoratorTypeReference extends DecoratorLiteral {
  o TypeIdentifier type
  o Boolean isArray default=false
}

concept Decorator {
  o String name
  o DecoratorLiteral[] arguments optional
  o Range location optional
}

concept Identified {
}

concept IdentifiedBy extends Identified {
  o String name
}

abstract concept Declaration {
  o String name regex=/^(?!null|true|false)(\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4})(?:\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4}|\\p{Mn}|\\p{Mc}|\\p{Nd}|\\p{Pc}|\\u200C|\\u200D)*$/u
  o Decorator[] decorators optional
  o Range location optional
}

concept EnumDeclaration extends Declaration {
  o EnumProperty[] properties
}

concept EnumProperty {
  o String name regex=/^(?!null|true|false)(\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4})(?:\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4}|\\p{Mn}|\\p{Mc}|\\p{Nd}|\\p{Pc}|\\u200C|\\u200D)*$/u
  o Decorator[] decorators optional
  o Range location optional
}

concept ConceptDeclaration extends Declaration {
  o Boolean isAbstract default=false
  o Identified identified optional
  o TypeIdentifier superType optional
  o Property[] properties
}

concept AssetDeclaration extends ConceptDeclaration {
}

concept ParticipantDeclaration extends ConceptDeclaration {
}

concept TransactionDeclaration extends ConceptDeclaration {
}

concept EventDeclaration extends ConceptDeclaration {
}

abstract concept Property {
  o String name regex=/^(?!null|true|false)(\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4})(?:\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4}|\\p{Mn}|\\p{Mc}|\\p{Nd}|\\p{Pc}|\\u200C|\\u200D)*$/u
  o Boolean isArray default=false
  o Boolean isOptional default=false
  o Decorator[] decorators optional
  o Range location optional
}

concept RelationshipProperty extends Property {
  o TypeIdentifier type
}

concept ObjectProperty extends Property {
  o String defaultValue optional
  o TypeIdentifier type
}

concept BooleanProperty extends Property {
  o Boolean defaultValue optional
}

concept DateTimeProperty extends Property {
}

concept StringProperty extends Property {
  o String defaultValue optional
  o StringRegexValidator validator optional
}

concept StringRegexValidator {
  o String pattern
  o String flags
}

concept DoubleProperty extends Property {
  o Double defaultValue optional
  o DoubleDomainValidator validator optional
}

concept DoubleDomainValidator {
  o Double lower optional
  o Double upper optional
}

concept IntegerProperty extends Property {
  o Integer defaultValue optional
  o IntegerDomainValidator validator optional
}

concept IntegerDomainValidator {
  o Integer lower optional
  o Integer upper optional
}

concept LongProperty extends Property {
  o Long defaultValue optional
  o LongDomainValidator validator optional
}

concept LongDomainValidator {
  o Long lower optional
  o Long upper optional
}

abstract concept Import {
  o String namespace
  o String uri optional
}

concept ImportAll extends Import {
}

concept ImportType extends Import {
  o String name
}

concept Model {
  o String namespace
  o String concertoVersion optional
  o Import[] imports optional
  o Declaration[] declarations optional
}

concept Models {
  o Model[] models
}
`;

    /**
     * Create a metamodel manager (for validation against the metamodel)
     * @return {*} the metamodel manager
     */
    static createMetaModelManager() {
        const metaModelManager = new ModelManager();
        metaModelManager.addModelFile(MetaModel.metaModelCto, 'concerto.metamodel');
        return metaModelManager;
    }

    /**
     * Validate against the metamodel
     * @param {object} input - the metamodel in JSON
     * @return {object} the validated metamodel in JSON
     */
    static validateMetaModel(input) {
        const metaModelManager = MetaModel.createMetaModelManager();
        const factory = new Factory(metaModelManager);
        const serializer = new Serializer(factory, metaModelManager);
        // First validate the metaModel
        const object = serializer.fromJSON(input);
        return serializer.toJSON(object);
    }

    /**
     * Create a name resolution table
     * @param {*} modelManager - the model manager
     * @param {object} metaModel - the metamodel (JSON)
     * @return {object} mapping from a name to its namespace
     */
    static createNameTable(modelManager, metaModel) {
        const table = {
            'Concept': 'concerto',
            'Asset': 'concerto',
            'Participant': 'concerto',
            'Transaction ': 'concerto',
            'Event': 'concerto',
        };

        // First list the imported names in order (overriding as we go along)
        const imports = metaModel.imports;
        imports.forEach((imp) => {
            const namespace = imp.namespace;
            const modelFile = modelManager.getModelFile(namespace);
            if (imp.$class === 'concerto.metamodel.ImportType') {
                if (!modelFile.getLocalType(imp.name)) {
                    throw new Error(`Declaration ${imp.name} in namespace ${namespace} not found`);
                }
                table[imp.name] = namespace;
            } else {
                const decls = modelFile.getAllDeclarations();
                decls.forEach((decl) => {
                    table[decl.getName()] = namespace;
                });
            }
        });

        // Then add the names local to this metaModel (overriding as we go along)
        if (metaModel.declarations) {
            metaModel.declarations.forEach((decl) => {
                table[decl.name] = metaModel.namespace;
            });
        }

        return table;
    }

    /**
     * Resolve a name using the name table
     * @param {string} name - the name of the type to resolve
     * @param {object} table - the name table
     * @return {string} the namespace for that name
     */
    static resolveName(name, table) {
        if (!table[name]) {
            throw new Error(`Name ${name} not found`);
        }
        return table[name];
    }

    /**
     * Name resolution for metamodel
     * @param {object} metaModel - the metamodel (JSON)
     * @param {object} table - the name table
     * @return {object} the metamodel with fully qualified names
     */
    static resolveTypeNames(metaModel, table) {
        switch (metaModel.$class) {
        case 'concerto.metamodel.Model': {
            if (metaModel.declarations) {
                metaModel.declarations.forEach((decl) => {
                    MetaModel.resolveTypeNames(decl, table);
                });
            }
        }
            break;
        case 'concerto.metamodel.AssetDeclaration':
        case 'concerto.metamodel.ConceptDeclaration':
        case 'concerto.metamodel.EventDeclaration':
        case 'concerto.metamodel.TransactionDeclaration':
        case 'concerto.metamodel.ParticipantDeclaration': {
            if (metaModel.superType) {
                const name = metaModel.superType.name;
                metaModel.superType.namespace = MetaModel.resolveName(name, table);
            }
            metaModel.properties.forEach((property) => {
                MetaModel.resolveTypeNames(property, table);
            });
            if (metaModel.decorators) {
                metaModel.decorators.forEach((decorator) => {
                    MetaModel.resolveTypeNames(decorator, table);
                });
            }
        }
            break;
        case 'concerto.metamodel.EnumDeclaration': {
            if (metaModel.decorators) {
                metaModel.decorators.forEach((decorator) => {
                    MetaModel.resolveTypeNames(decorator, table);
                });
            }
        }
            break;
        case 'concerto.metamodel.EnumProperty':
        case 'concerto.metamodel.ObjectProperty':
        case 'concerto.metamodel.RelationshipProperty': {
            const name = metaModel.type.name;
            metaModel.type.namespace = MetaModel.resolveName(name, table);
            if (metaModel.decorators) {
                metaModel.decorators.forEach((decorator) => {
                    MetaModel.resolveTypeNames(decorator, table);
                });
            }
        }
            break;
        case 'concerto.metamodel.Decorator': {
            if (metaModel.arguments) {
                metaModel.arguments.forEach((argument) => {
                    MetaModel.resolveTypeNames(argument, table);
                });
            }
        }
            break;
        case 'concerto.metamodel.DecoratorTypeReference': {
            const name = metaModel.type.name;
            metaModel.type.namespace = MetaModel.resolveName(name, table);
        }
            break;
        }
        return metaModel;
    }

    /**
     * Resolve the namespace for names in the metamodel
     * @param {object} modelManager - the ModelManager
     * @param {object} metaModel - the MetaModel
     * @return {object} the resolved metamodel
     */
    static resolveMetaModel(modelManager, metaModel) {
        const result = JSON.parse(JSON.stringify(metaModel));
        const nameTable = MetaModel.createNameTable(modelManager, metaModel);
        // This adds the fully qualified names to the same object
        MetaModel.resolveTypeNames(result, nameTable);
        return result;
    }

    /**
     * Export metamodel from a model file
     * @param {object} modelFile - the ModelFile
     * @param {boolean} [validate] - whether to perform validation
     * @return {object} the metamodel for this model
     */
    static modelFileToMetaModel(modelFile, validate) {
        // Last, validate the JSON metaModel
        return validate ? MetaModel.validateMetaModel(modelFile.ast) : modelFile.ast;
    }

    /**
     * Export metamodel from a model manager
     * @param {object} modelManager - the ModelManager
     * @param {boolean} [resolve] - whether to resolve names
     * @param {boolean} [validate] - whether to perform validation
     * @return {object} the metamodel for this model manager
     */
    static modelManagerToMetaModel(modelManager, resolve, validate) {
        const result = {
            $class: 'concerto.metamodel.Models',
            models: [],
        };
        modelManager.getModelFiles().forEach((modelFile) => {
            let metaModel = modelFile.ast;
            if (resolve) {
                metaModel = MetaModel.resolveMetaModel(modelManager, metaModel);
            }
            result.models.push(metaModel);
        });
        return result;
    }

    /**
     * Create decorator argument string from a metamodel
     * @param {object} mm - the metamodel
     * @return {string} the string for the decorator argument
     */
    static decoratorArgFromMetaModel(mm) {
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
    static decoratorFromMetaModel(mm) {
        let result = '';
        result += `@${mm.name}`;
        if (mm.arguments) {
            result += '(';
            result += mm.arguments.map(MetaModel.decoratorArgFromMetaModel).join(',');
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
    static decoratorsFromMetaModel(mm, prefix) {
        let result = '';
        result += mm.map(MetaModel.decoratorFromMetaModel).join(`\n${prefix}`);
        result += `\n${prefix}`;
        return result;
    }

    /**
     * Create a property string from a metamodel
     * @param {object} mm - the metamodel
     * @return {string} the string for that property
     */
    static propertyFromMetaModel(mm) {
        let result = '';
        let defaultString = '';
        let validatorString = '';

        if (mm.decorators) {
            result += MetaModel.decoratorsFromMetaModel(mm.decorators, '  ');
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
    static declFromMetaModel(mm) {
        let result = '';
        if (mm.decorators) {
            result += MetaModel.decoratorsFromMetaModel(mm.decorators, '');
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
            result += `\n  ${MetaModel.propertyFromMetaModel(property)}`;
        });
        result += '\n}';
        return result;
    }

    /**
     * Create a model string from a metamodel
     * @param {object} metaModel - the metamodel
     * @param {boolean} [validate] - whether to perform validation
     * @return {string} the string for that model
     */
    static ctoFromMetaModel(metaModel, validate = true) {
        // First, validate the JSON metaModel
        const mm = validate ? MetaModel.validateMetaModel(metaModel) : metaModel;

        let result = '';
        result += `namespace ${mm.namespace}`;
        if (mm.imports && mm.imports.length > 0) {
            result += '\n';
            mm.imports.forEach((imp) => {
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
        if (mm.declarations && mm.declarations.length > 0) {
            mm.declarations.forEach((decl) => {
                result += `\n\n${MetaModel.declFromMetaModel(decl)}`;
            });
        }
        return result;
    }

    /**
     * Import metamodel to a model manager
     * @param {object} metaModel - the metamodel
     * @param {boolean} [validate] - whether to perform validation
     * @return {object} the metamodel for this model manager
     */
    static modelManagerFromMetaModel(metaModel, validate) {
        // First, validate the JSON metaModel
        const mm = validate ? MetaModel.validateMetaModel(metaModel) : metaModel;

        const modelManager = new ModelManager();

        mm.models.forEach((mm) => {
            const cto = MetaModel.ctoFromMetaModel(mm, false); // No need to re-validate
            modelManager.addModelFile(cto, null, false);
        });

        modelManager.validateModelFiles();
        return modelManager;
    }

    /**
     * Export metamodel from a model string
     * @param {string} model - the string for the model
     * @param {boolean} [validate] - whether to perform validation
     * @return {object} the metamodel for this model
     */
    static ctoToMetaModel(model, validate) {
        return parser.parse(model);
    }

    /**
     * Export metamodel from a model string and resolve names
     * @param {*} modelManager - the model manager
     * @param {string} model - the string for the model
     * @param {boolean} [validate] - whether to perform validation
     * @return {object} the metamodel for this model
     */
    static ctoToMetaModelAndResolve(modelManager, model, validate) {
        const metaModel = parser.parse(model);
        const result = MetaModel.resolveMetaModel(modelManager, metaModel);
        return result;
    }
}

module.exports = MetaModel;