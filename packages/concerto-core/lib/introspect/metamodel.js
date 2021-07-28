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

const metaModelCto = `/*
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

namespace concerto.metamodel

/**
 * The metadmodel for Concerto files
 */
abstract concept DecoratorLiteral {
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

concept TypeIdentifier {
  @FormEditor("selectOptions", "types")
  o String name default="Concept"
  @FormEditor( "hide", true)
  o String fullyQualifiedName optional
}

concept DecoratorIdentifier extends DecoratorLiteral {
  o TypeIdentifier identifier
  o Boolean isArray default=false
}

concept Decorator {
  o String name
  o DecoratorLiteral[] arguments optional
}

concept Identified {
}

concept IdentifiedBy extends Identified {
  o String name
}

@FormEditor("defaultSubclass","concerto.metamodel.ClassDeclaration")
abstract concept Declaration {
  // TODO use regex /^(?!null|true|false)(\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4})(?:\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4}|\\p{Mn}|\\p{Mc}|\\p{Nd}|\\p{Pc}|\\u200C|\\u200D)*/u
  @FormEditor("title", "Name")
  o String name default="ClassName" // regex=/^(?!null|true|false)(\\w|\\d|\\$|_|\\\\u[0-9A-Fa-f]{4})(?:\\w|\\d|\\$|_|\\\\u[0-9A-Fa-f]{4}|\\S|\\u200C|\\u200D)*$/
}

concept EnumDeclaration extends Declaration {
  o EnumFieldDeclaration[] fields
}

concept EnumFieldDeclaration {
  // TODO Allow regex modifiers e.g. //ui
  // regex /^(?!null|true|false)(\\p{Lu}|\\p{Ll}|\\p{Lt}|\\pLm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4})(?:\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4}|\\p{Mn}|\\p{Mc}|\\p{Nd}|\\p{Pc}|\\u200C|\\u200D)*/u
  // This regex is an approximation of what the parser accepts without using unicode character classes
  o String name default="fieldName" // regex=/^(?!null|true|false)(\\w|\\d|\\$|_|\\\\u[0-9A-Fa-f]{4})(?:\\w|\\d|\\$|_|\\\\u[0-9A-Fa-f]{4}|\\S|\\u200C|\\u200D)*$/
  @FormEditor("hide", true)
  o Decorator[] decorators optional
}

@FormEditor("defaultSubclass","concerto.metamodel.ConceptDeclaration")
abstract concept ClassDeclaration extends Declaration {
  @FormEditor("hide", true)
  o Decorator[] decorators optional
  o Boolean isAbstract default=false
  o Identified identified optional
  @FormEditor("title", "Super Type")
  o TypeIdentifier superType optional
  o FieldDeclaration[] fields
}

concept AssetDeclaration extends ClassDeclaration {
}

concept ParticipantDeclaration extends ClassDeclaration {
}

concept TransactionDeclaration extends ClassDeclaration {
}

concept EventDeclaration extends ClassDeclaration {
}

concept ConceptDeclaration extends ClassDeclaration {
}

@FormEditor("defaultSubclass","concerto.metamodel.StringFieldDeclaration")
abstract concept FieldDeclaration {
  // TODO Allow regex modifiers e.g. //ui
  // regex /^(?!null|true|false)(\\p{Lu}|\\p{Ll}|\\p{Lt}|\\pLm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4})(?:\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4}|\\p{Mn}|\\p{Mc}|\\p{Nd}|\\p{Pc}|\\u200C|\\u200D)*/u
  // This regex is an approximation of what the parser accepts without using unicode character classes
  o String name default="fieldName" // regex=/^(?!null|true|false)(\\w|\\d|\\$|_|\\\\u[0-9A-Fa-f]{4})(?:\\w|\\d|\\$|_|\\\\u[0-9A-Fa-f]{4}|\\S|\\u200C|\\u200D)*$/
  @FormEditor("title", "Is Array?")
  o Boolean isArray default=false
  @FormEditor("title", "Is Optional?")
  o Boolean isOptional default=false
  @FormEditor("hide", true)
  o Decorator[] decorators optional
}

concept RelationshipDeclaration extends FieldDeclaration {
  @FormEditor("title", "Type Name", "selectOptions", "types")
  o TypeIdentifier type
}

concept ObjectFieldDeclaration extends FieldDeclaration {
  @FormEditor("hide", true)
  o String defaultValue optional
  @FormEditor("title", "Type Name", "selectOptions", "types")
  o TypeIdentifier type
}

concept BooleanFieldDeclaration extends FieldDeclaration {
  @FormEditor("hide", true)
  o Boolean defaultValue optional
}

concept DateTimeFieldDeclaration extends FieldDeclaration {
}

concept StringFieldDeclaration extends FieldDeclaration {
  @FormEditor("hide", true)
  o String defaultValue optional
  @FormEditor("hide", true)
  o StringRegexValidator validator optional
}

concept StringRegexValidator {
  o String regex
}

concept DoubleFieldDeclaration extends FieldDeclaration {
  o Double defaultValue optional
  o DoubleDomainValidator validator optional
}

concept DoubleDomainValidator {
  o Double lower optional
  o Double upper optional
}

concept IntegerFieldDeclaration extends FieldDeclaration {
  @FormEditor("hide", true)
  o Integer defaultValue optional
  @FormEditor("hide", true)
  o IntegerDomainValidator validator optional
}

concept IntegerDomainValidator {
  o Integer lower optional
  o Integer upper optional
}

concept LongFieldDeclaration extends FieldDeclaration {
  @FormEditor("hide", true)
  o Long defaultValue optional
  @FormEditor("hide", true)
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

concept ModelFile {
  o String namespace default="my.namespace"
  @FormEditor("hide", true)
  o Import[] imports optional
  @FormEditor("title", "Enums")
  o EnumDeclaration[] enumDeclarations optional
  @FormEditor("title", "Classes")
  o ClassDeclaration[] classDeclarations optional
}
`;

/**
 * Create a metamodel manager (for validation against the metamodel)
 * @return {*} the metamodel manager
 */
function createMetaModelManager() {
    const metaModelManager = new ModelManager();
    metaModelManager.addModelFile(metaModelCto, 'concerto.metamodel');
    return metaModelManager;
}

/**
 * Validate against the metamodel
 * @param {object} input - the metamodel in JSON
 * @return {object} the validated metamodel in JSON
 */
function validateMetaModel(input) {
    const metaModelManager = createMetaModelManager();
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
 * @return {object} mapping from local to fully qualified names
 */
function createNameTable(modelManager, metaModel) {
    const table = {};

    // First list the imported names in order (overriding as we go along)
    const imports = metaModel.imports;
    imports.forEach((imp) => {
        const namespace = imp.namespace;
        const modelFile = modelManager.getModelFile(namespace);
        if (imp.$class === 'concerto.metamodel.ImportType') {
            if (!modelFile.getLocalType(imp.name)) {
                throw new Error(`Declaration ${imp.identifier.name} in namespace ${namespace} not found`);
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
    metaModel.enumDeclarations.forEach((decl) => {
        table[decl.name] = metaModel.namespace;
    });
    metaModel.classDeclarations.forEach((decl) => {
        table[decl.name] = metaModel.namespace;
    });

    return table;
}

/**
 * Resolve a name using the name table
 * @param {string} name - the name of the type to resolve
 * @param {object} table - the name table
 * @return {string} the fully qualified name
 */
function resolveName(name, table) {
    if (!table[name]) {
        throw new Error(`Name ${name} not found`);
    }
    const namespace = table[name];
    return `${namespace}.${name}`;
}

/**
 * Name resolution for metamodel
 * @param {object} metaModel - the metamodel (JSON)
 * @param {object} table - the name table
 * @return {object} the metamodel with fully qualified names
 */
function resolveTypeNames(metaModel, table) {
    switch (metaModel.$class) {
    case 'concerto.metamodel.ModelFile': {
        metaModel.enumDeclarations.forEach((decl) => {
            resolveTypeNames(decl, table);
        });
        metaModel.classDeclarations.forEach((decl) => {
            resolveTypeNames(decl, table);
        });
    }
        break;
    case 'concerto.metamodel.AssetDeclaration':
    case 'concerto.metamodel.ConceptDeclaration':
    case 'concerto.metamodel.EventDeclaration':
    case 'concerto.metamodel.TransactionDeclaration':
    case 'concerto.metamodel.ParticipantDeclaration': {
        if (metaModel.superType) {
            const name = metaModel.superType.name;
            metaModel.superType.fullyQualifiedName = resolveName(name, table);
        }
        metaModel.fields.forEach((field) => {
            resolveTypeNames(field, table);
        });
    }
        break;
    case 'concerto.metamodel.ObjectFieldDeclaration':
    case 'concerto.metamodel.RelationshipDeclaration': {
        const name = metaModel.type.name;
        metaModel.type.fullyQualifiedName = resolveName(name, table);
    }
        break;
    }
    return metaModel;
}

/**
 * Create metamodel for an enum field
 * @param {object} ast - the AST for the field
 * @return {object} the metamodel for this field
 */
function enumFieldToMetaModel(ast) {
    // console.log(`FIELD ${JSON.stringify(ast)}`);
    const field = {};

    field.$class = 'concerto.metamodel.EnumFieldDeclaration';

    // Field name
    field.name = ast.id.name;

    return field;
}

/**
 * Create metamodel for a class field
 * @param {object} ast - the AST for the field
 * @return {object} the metamodel for this field
 */
function fieldToMetaModel(ast) {
    // console.log(`FIELD ${JSON.stringify(ast)}`);
    const field = {};

    // Field name
    field.name = ast.id.name;
    // Is it an array?
    if (ast.array) {
        field.isArray = true;
    } else {
        field.isArray = false;
    }
    // Is it an optional?
    if (ast.optional) {
        field.isOptional = true;
    } else {
        field.isOptional = false;
    }
    // XXX Can it be missing?
    const type = ast.propertyType.name;
    switch (type) {
    case 'Integer':
        field.$class = 'concerto.metamodel.IntegerFieldDeclaration';
        if (ast.default) {
            field.defaultValue = parseInt(ast.default);
        }
        break;
    case 'Long':
        field.$class = 'concerto.metamodel.LongFieldDeclaration';
        if (ast.default) {
            field.defaultValue = parseInt(ast.default);
        }
        break;
    case 'Double':
        field.$class = 'concerto.metamodel.DoubleFieldDeclaration';
        if (ast.default) {
            field.defaultValue = parseFloat(ast.default);
        }
        break;
    case 'Boolean':
        field.$class = 'concerto.metamodel.BooleanFieldDeclaration';
        if (ast.default) {
            if (ast.default === 'true') {
                field.defaultValue = true;
            } else {
                field.defaultValue = false;
            }
        }
        break;
    case 'DateTime':
        field.$class = 'concerto.metamodel.DateTimeFieldDeclaration';
        break;
    case 'String':
        field.$class = 'concerto.metamodel.StringFieldDeclaration';
        if (ast.default) {
            field.defaultValue = ast.default;
        }
        break;
    default:
        field.$class = 'concerto.metamodel.ObjectFieldDeclaration';
        if (ast.default) {
            field.defaultValue = ast.default;
        }
        field.type = {
            $class: 'concerto.metamodel.TypeIdentifier',
            name: type
        };
        break;
    }

    return field;
}

/**
 * Create metamodel for a relationship
 * @param {object} ast - the AST for the relationtion
 * @return {object} the metamodel for this relationship
 */
function relationshipToMetaModel(ast) {
    let relationship = {
        $class: 'concerto.metamodel.RelationshipDeclaration',
        type: {
            $class: 'concerto.metamodel.TypeIdentifier',
            name: ast.propertyType.name
        },
    };

    // Field name
    relationship.name = ast.id.name;
    // Is it an array?
    if (ast.array) {
        relationship.isArray = true;
    } else {
        relationship.isArray = false;
    }
    // Is it an optional?
    if (ast.optional) {
        relationship.isOptional = true;
    } else {
        relationship.isOptional = false;
    }

    return relationship;
}

/**
 * Create metamodel for an enum declaration
 * @param {object} ast - the AST for the enum declaration
 * @return {object} the metamodel for this enum declaration
 */
function enumDeclToMetaModel(ast) {
    let decl = {};

    decl.$class = 'concerto.metamodel.EnumDeclaration';

    // The enum name
    decl.name = ast.id.name;

    // Enum fields
    decl.fields = [];
    for (let n = 0; n < ast.body.declarations.length; n++) {
        let thing = ast.body.declarations[n];

        decl.fields.push(enumFieldToMetaModel(thing));
    }

    return decl;
}

/**
 * Create metamodel for a class declaration
 * @param {object} ast - the AST for the class declaration
 * @return {object} the metamodel for this class declaration
 */
function classDeclToMetaModel(ast) {
    let decl = {};

    if(ast.type === 'AssetDeclaration') {
        decl.$class = 'concerto.metamodel.AssetDeclaration';
    } else if (ast.type === 'ConceptDeclaration') {
        decl.$class = 'concerto.metamodel.ConceptDeclaration';
    } else if (ast.type === 'EventDeclaration') {
        decl.$class = 'concerto.metamodel.EventDeclaration';
    } else if (ast.type === 'ParticipantDeclaration') {
        decl.$class = 'concerto.metamodel.ParticipantDeclaration';
    } else if (ast.type === 'TransactionDeclaration') {
        decl.$class = 'concerto.metamodel.TransactionDeclaration';
    }

    // The class name
    decl.name = ast.id.name;

    // Is the class abstract?
    if (ast.abstract) {
        decl.isAbstract = true;
    } else {
        decl.isAbstract = false;
    }

    // Super type
    if (ast.classExtension) {
        const cname = ast.classExtension.class.name;
        if (cname !== 'Asset' &&
            cname !== 'Concept' &&
            cname !== 'Event' &&
            cname !== 'Participant' &&
            cname !== 'Transaction') {
            decl.superType = {
                $class: 'concerto.metamodel.TypeIdentifier',
                name: ast.classExtension.class.name
            };
        }
    }

    // Is the class idenfitied by a field
    if (ast.idField) {
        if (ast.idField.name === '$identifier') {
            decl.identified = {
                $class: 'concerto.metamodel.Identified'
            };
        } else {
            decl.identified = {
                $class: 'concerto.metamodel.IdentifiedBy',
                name: ast.idField.name
            };
        }
    }

    // Class fields
    decl.fields = [];
    for (let n = 0; n < ast.body.declarations.length; n++) {
        let thing = ast.body.declarations[n];

        if (thing.type === 'FieldDeclaration') {
            decl.fields.push(fieldToMetaModel(thing));
        } else if (thing.type === 'RelationshipDeclaration') {
            decl.fields.push(relationshipToMetaModel(thing));
        }
    }

    return decl;
}

/**
 * Create metamodel for a declaration
 * @param {object} ast - the AST for the declaration
 * @return {object} the metamodel for this declaration
 */
function declToMetaModel(ast) {
    if(ast.type === 'EnumDeclaration') {
        return enumDeclToMetaModel(ast);
    }
    return classDeclToMetaModel(ast);
}

/**
 * Export metamodel from an AST
 * @param {object} ast - the AST for the model
 * @param {boolean} [validate] - whether to perform validation
 * @return {object} the metamodel for this model
 */
function modelToMetaModel(ast, validate = true) {
    const metamodel = {
        $class: 'concerto.metamodel.ModelFile'
    };
    metamodel.namespace = ast.namespace;

    if(ast.imports) {
        metamodel.imports = [];
        ast.imports.forEach((imp) => {
            const split = imp.namespace.split('.');
            const name = split.pop();
            const namespace = split.join('.');
            if (namespace === 'concerto') {
                return;
            }
            const ns = { namespace };
            if (name === '*') {
                ns.$class = 'concerto.metamodel.ImportAll';
            } else {
                ns.$class = 'concerto.metamodel.ImportType';
                ns.name = name;
            }
            if(imp.uri) {
                ns.uri = imp.uri;
            }
            metamodel.imports.push(ns);
        });
    }

    if (ast.body.length > 0) {
        metamodel.enumDeclarations = [];
        metamodel.classDeclarations = [];
    }
    for(let n=0; n < ast.body.length; n++ ) {
        const thing = ast.body[n];
        const decl = declToMetaModel(thing);
        if (decl.$class === 'concerto.metamodel.EnumDeclaration') {
            metamodel.enumDeclarations.push(decl);
        } else {
            metamodel.classDeclarations.push(decl);
        }
    }

    // Last, validate the JSON metaModel
    const mm = validate ? validateMetaModel(metamodel) : metamodel;

    return mm;
}

/**
 * Export metamodel from a model file
 * @param {object} modelFile - the AST for the model
 * @param {boolean} [validate] - whether to perform validation
 * @return {object} the metamodel for this model
 */
function modelFileToMetaModel(modelFile, validate) {
    return modelToMetaModel(modelFile.ast, validate);
}

/**
 * Create a field string from a metamodel
 * @param {object} mm - the metamodel
 * @return {string} the string for that field
 */
function fieldFromMetaModel(mm) {
    let result = '';
    let defaultString = '';
    if (mm.$class === 'concerto.metamodel.RelationshipDeclaration') {
        result += '-->';
    } else {
        result += 'o';
    }
    switch (mm.$class) {
    case 'concerto.metamodel.EnumFieldDeclaration':
        break;
    case 'concerto.metamodel.BooleanFieldDeclaration':
        result += ' Boolean';
        if (mm.defaultValue === true || mm.defaultValue === false) {
            if (mm.defaultValue) {
                defaultString += ' default=true';
            } else {
                defaultString += ' default=false';
            }
        }
        break;
    case 'concerto.metamodel.DateTimeFieldDeclaration':
        result += ' DateTime';
        break;
    case 'concerto.metamodel.DoubleFieldDeclaration':
        result += ' Double';
        if (mm.defaultValue) {
            const doubleString = mm.defaultValue.toFixed(Math.max(1, (mm.defaultValue.toString().split('.')[1] || []).length));

            defaultString += ` default=${doubleString}`;
        }
        break;
    case 'concerto.metamodel.IntegerFieldDeclaration':
        result += ' Integer';
        if (mm.defaultValue) {
            defaultString += ` default=${mm.defaultValue.toString()}`;
        }
        break;
    case 'concerto.metamodel.LongFieldDeclaration':
        result += ' Long';
        if (mm.defaultValue) {
            defaultString += ` default=${mm.defaultValue.toString()}`;
        }
        break;
    case 'concerto.metamodel.StringFieldDeclaration':
        result += ' String';
        if (mm.defaultValue) {
            defaultString += ` default="${mm.defaultValue}"`;
        }
        break;
    case 'concerto.metamodel.ObjectFieldDeclaration':
        result += ` ${mm.type.name}`;
        if (mm.defaultValue) {
            defaultString += ` default="${mm.defaultValue}"`;
        }
        break;
    case 'concerto.metamodel.RelationshipDeclaration':
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
    return result;
}

/**
 * Create a declaration string from a metamodel
 * @param {object} mm - the metamodel
 * @return {string} the string for that declaration
 */
function declFromMetaModel(mm) {
    let result = '';
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
    mm.fields.forEach((field) => {
        result += `\n  ${fieldFromMetaModel(field)}`;
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
function ctoFromMetaModel(metaModel, validate = true) {
    // First, validate the JSON metaModel
    const mm = validate ? validateMetaModel(metaModel) : metaModel;

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
    if (mm.enumDeclarations && mm.enumDeclarations.length > 0) {
        mm.enumDeclarations.forEach((decl) => {
            result += `\n\n${declFromMetaModel(decl)}`;
        });
    }
    if (mm.classDeclarations && mm.classDeclarations.length > 0) {
        mm.classDeclarations.forEach((decl) => {
            result += `\n\n${declFromMetaModel(decl)}`;
        });
    }
    return result;
}

/**
 * Export metamodel from a model string
 * @param {string} model - the string for the model
 * @param {boolean} [validate] - whether to perform validation
 * @return {object} the metamodel for this model
 */
function ctoToMetaModel(model, validate) {
    const ast = parser.parse(model);
    return modelToMetaModel(ast);
}

/**
 * Export metamodel from a model string and resolve names
 * @param {*} modelManager - the model manager
 * @param {string} model - the string for the model
 * @param {boolean} [validate] - whether to perform validation
 * @return {object} the metamodel for this model
 */
function ctoToMetaModelAndResolve(modelManager, model, validate) {
    const ast = parser.parse(model);
    const metaModel = modelToMetaModel(ast);
    const nameTable = createNameTable(modelManager, metaModel);
    // This adds the fully qualified names to the same object
    resolveTypeNames(metaModel, nameTable);
    return metaModel;
}

module.exports = {
    metaModelCto,
    modelFileToMetaModel,
    ctoToMetaModel,
    ctoToMetaModelAndResolve,
    ctoFromMetaModel,
};
