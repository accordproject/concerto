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

@FormEditor("defaultSubclass","concerto.metamodel.ConceptDeclaration")
abstract concept ClassDeclaration {
  @FormEditor("hide", true)
  o Decorator[] decorators optional
  o Boolean isAbstract default=false
  // TODO use regex /^(?!null|true|false)(\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4})(?:\\p{Lu}|\\p{Ll}|\\p{Lt}|\\p{Lm}|\\p{Lo}|\\p{Nl}|\\$|_|\\\\u[0-9A-Fa-f]{4}|\\p{Mn}|\\p{Mc}|\\p{Nd}|\\p{Pc}|\\u200C|\\u200D)*/u
  @FormEditor("title", "Name")
  o String name default="ClassName" // regex=/^(?!null|true|false)(\\w|\\d|\\$|_|\\\\u[0-9A-Fa-f]{4})(?:\\w|\\d|\\$|_|\\\\u[0-9A-Fa-f]{4}|\\S|\\u200C|\\u200D)*$/
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

concept EnumDeclaration extends ClassDeclaration {
}

concept StringDefault {
  o String value
}

concept BooleanDefault {
  o Boolean value
}

concept IntegerDefault {
  o Integer value
}

concept LongDefault {
  o Long value
}

concept DoubleDefault {
  o Double value
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

concept ObjectFieldDeclaration extends FieldDeclaration {
  @FormEditor("hide", true)
  o StringDefault defaultValue optional
  @FormEditor("title", "Type Name", "selectOptions", "types")
  o TypeIdentifier type
}

concept EnumFieldDeclaration extends FieldDeclaration {
}

concept BooleanFieldDeclaration extends FieldDeclaration {
  @FormEditor("hide", true)
  o BooleanDefault defaultValue optional
}

concept DateTimeFieldDeclaration extends FieldDeclaration {
}

concept StringFieldDeclaration extends FieldDeclaration {
  @FormEditor("hide", true)
  o StringDefault defaultValue optional
  @FormEditor("hide", true)
  o StringRegexValidator validator optional
}

concept StringRegexValidator {
  o String regex
}

concept DoubleDomainValidator {
  o Double lower optional
  o Double upper optional
}

concept IntegerDomainValidator {
  o Integer lower optional
  o Integer upper optional
}

concept LongDomainValidator {
  o Long lower optional
  o Long upper optional
}

concept DoubleFieldDeclaration extends FieldDeclaration {
  o DoubleDefault defaultValue optional
  o DoubleDomainValidator validator optional
}

concept IntegerFieldDeclaration extends FieldDeclaration {
  @FormEditor("hide", true)
  o IntegerDefault defaultValue optional
  @FormEditor("hide", true)
  o IntegerDomainValidator validator optional
}

concept LongFieldDeclaration extends FieldDeclaration {
  @FormEditor("hide", true)
  o LongDefault defaultValue optional
  @FormEditor("hide", true)
  o LongDomainValidator validator optional
}

concept RelationshipDeclaration extends FieldDeclaration {
  @FormEditor("title", "Type Name", "selectOptions", "types")
  o TypeIdentifier type
}

abstract concept Import {
  o String namespace
  o String uri optional
}

concept ImportAll extends Import {
}

concept ImportType extends Import {
  o TypeIdentifier identifier
}

concept ModelFile {
  o String namespace default="my.namespace"
  @FormEditor("hide", true)
  o Import[] imports optional
  @FormEditor("title", "Classes")
  o ClassDeclaration[] declarations optional
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
 * Create metamodel for a field
 * @param {object} ast - the AST for the field
 * @return {object} the metamodel for this field
 */
function fieldToMetaModel(ast) {
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
        break;
    case 'Long':
        field.$class = 'concerto.metamodel.LongFieldDeclaration';
        break;
    case 'Double':
        field.$class = 'concerto.metamodel.DoubleFieldDeclaration';
        break;
    case 'Boolean':
        field.$class = 'concerto.metamodel.BooleanFieldDeclaration';
        break;
    case 'DateTime':
        field.$class = 'concerto.metamodel.DateTimeFieldDeclaration';
        break;
    case 'String':
        field.$class = 'concerto.metamodel.StringFieldDeclaration';
        break;
    default:
        field.$class = 'concerto.metamodel.ObjectFieldDeclaration';
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
 * Create metamodel for an enum field
 * @param {object} ast - the AST for the enum field
 * @return {object} the metamodel for this enum field
 */
function enumPropertyToMetaModel(ast) {
    let property = {
        $class: 'concerto.metamodel.EnumFieldDeclaration',
    };

    // Field name
    property.name = ast.id.name;
    // Is it an array?
    property.isArray = false;
    // Is it an optional?
    property.isOptional = false;

    return property;
}

/**
 * Create metamodel for a class declaration
 * @param {object} ast - the AST for the declaration
 * @return {object} the metamodel for this declaration
 */
function declToMetaModel(ast) {
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
    } else if (ast.type === 'EnumDeclaration') {
        decl.$class = 'concerto.metamodel.EnumDeclaration';
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
        } else if (thing.type === 'EnumPropertyDeclaration') {
            decl.fields.push(enumPropertyToMetaModel(thing));
        }
    }

    return decl;
}

/**
 * Export metamodel from an AST
 * @param {object} ast - the AST for the model
 * @return {object} the metamodel for this model
 */
function modelToMetaModel(ast) {
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
                ns.identifier = {
                    $class: 'concerto.metamodel.TypeIdentifier',
                    name
                };
            }
            if(imp.uri) {
                ns.uri = imp.uri;
            }
            metamodel.imports.push(ns);
        });
    }

    if (ast.body.length > 0) {
        metamodel.declarations = [];
    }
    for(let n=0; n < ast.body.length; n++ ) {
        const thing = ast.body[n];
        const decl = declToMetaModel(thing);
        metamodel.declarations.push(decl);
    }

    // Last, validate the JSON metaModel
    const mm = validateMetaModel(metamodel);

    return mm;
}

/**
 * Export metamodel from a model file
 * @param {object} modelFile - the AST for the model
 * @return {object} the metamodel for this model
 */
function modelFileToMetaModel(modelFile) {
    return modelToMetaModel(modelFile.ast);
}

/**
 * Create a field string from a metamodel
 * @param {object} mm - the metamodel
 * @return {string} the string for that field
 */
function fieldFromMetaModel(mm) {
    let result = '';
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
        break;
    case 'concerto.metamodel.DateTimeFieldDeclaration':
        result += ' DateTime';
        break;
    case 'concerto.metamodel.DoubleFieldDeclaration':
        result += ' Double';
        break;
    case 'concerto.metamodel.IntegerFieldDeclaration':
        result += ' Integer';
        break;
    case 'concerto.metamodel.LongFieldDeclaration':
        result += ' Long';
        break;
    case 'concerto.metamodel.StringFieldDeclaration':
        result += ' String';
        break;
    case 'concerto.metamodel.ObjectFieldDeclaration':
        result += ` ${mm.type.name}`;
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
 * @return {string} the string for that model
 */
function ctoFromMetaModel(metaModel) {
    // First, validate the JSON metaModel
    const mm = validateMetaModel(metaModel);

    let result = '';
    result += `namespace ${mm.namespace}`;
    if (mm.imports && mm.imports.length > 0) {
        result += '\n';
        mm.imports.forEach((imp) => {
            let name = '*';
            if (imp.$class === 'concerto.metamodel.ImportType') {
                name = imp.identifier.name;
            }
            result += `\nimport ${imp.namespace}.${name}`;
            if (imp.uri) {
                result += ` from ${imp.uri}`;
            }
        });
    }
    if (mm.declarations && mm.declarations.length > 0) {
        mm.declarations.forEach((decl) => {
            result += `\n\n${declFromMetaModel(decl)}`;
        });
    }
    return result;
}

/**
 * Export metamodel from a model string
 * @param {object} model - the string for the model
 * @return {object} the metamodel for this model
 */
function ctoToMetaModel(model) {
    const ast = parser.parse(model);
    return modelToMetaModel(ast);
}

module.exports = {
    metaModelCto,
    modelFileToMetaModel,
    ctoToMetaModel,
    ctoFromMetaModel,
};
