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
 * The metamodel itself, as an AST.
 * @type unknown
 */
const metaModelAst = require('./metamodel.json');

/**
 * The namespace for the metamodel
 */
const MetaModelNamespace = 'concerto.metamodel@1.0.0';
/**
 * The metamodel itself, as a CTO string
 */
const metaModelCto = `namespace ${MetaModelNamespace}

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
  o String sourceUri optional
  o String concertoVersion optional
  o Import[] imports optional
  o Declaration[] declarations optional
}

concept Models {
  o Model[] models
}
`;

/**
 * Find the model for a given namespace
 * @param {*} priorModels - known models
 * @param {string} namespace - the namespace
 * @return {*} the model
 */
function findNamespace(priorModels, namespace) {
    return priorModels.models.find((thisModel) => thisModel.namespace === namespace);
}

/**
 * Find a declaration for a given name in a model
 * @param {*} thisModel - the model
 * @param {string} name - the declaration name
 * @return {*} the declaration
 */
function findDeclaration(thisModel, name) {
    return thisModel.declarations.find((thisDecl) => thisDecl.name === name);
}

/**
 * Create a name resolution table
 * @param {*} priorModels - known models
 * @param {object} metaModel - the metamodel (JSON)
 * @return {object} mapping from a name to its namespace
 */
function createNameTable(priorModels, metaModel) {
    const concertoNs = 'concerto@1.0.0';
    const table = {
        'Concept': concertoNs,
        'Asset': concertoNs,
        'Participant': concertoNs,
        'Transaction ': concertoNs,
        'Event': concertoNs,
    };

    // First list the imported names in order (overriding as we go along)
    const imports = metaModel.imports;
    imports.forEach((imp) => {
        const namespace = imp.namespace;
        const modelFile = findNamespace(priorModels, namespace);
        if (imp.$class === `${MetaModelNamespace}.ImportType`) {
            if (!findDeclaration(modelFile, imp.name)) {
                throw new Error(`Declaration ${imp.name} in namespace ${namespace} not found`);
            }
            table[imp.name] = namespace;
        } else {
            const decls = modelFile.declarations;
            decls.forEach((decl) => {
                table[decl.name] = namespace;
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
function resolveName(name, table) {
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
function resolveTypeNames(metaModel, table) {
    switch (metaModel.$class) {
    case `${MetaModelNamespace}.Model`: {
        if (metaModel.declarations) {
            metaModel.declarations.forEach((decl) => {
                resolveTypeNames(decl, table);
            });
        }
    }
        break;
    case `${MetaModelNamespace}.AssetDeclaration`:
    case `${MetaModelNamespace}.ConceptDeclaration`:
    case `${MetaModelNamespace}.EventDeclaration`:
    case `${MetaModelNamespace}.TransactionDeclaration`:
    case `${MetaModelNamespace}.ParticipantDeclaration`: {
        if (metaModel.superType) {
            const name = metaModel.superType.name;
            metaModel.superType.namespace = resolveName(name, table);
        }
        metaModel.properties.forEach((property) => {
            resolveTypeNames(property, table);
        });
        if (metaModel.decorators) {
            metaModel.decorators.forEach((decorator) => {
                resolveTypeNames(decorator, table);
            });
        }
    }
        break;
    case `${MetaModelNamespace}.EnumDeclaration`: {
        if (metaModel.decorators) {
            metaModel.decorators.forEach((decorator) => {
                resolveTypeNames(decorator, table);
            });
        }
    }
        break;
    case `${MetaModelNamespace}.EnumProperty`:
    case `${MetaModelNamespace}.ObjectProperty`:
    case `${MetaModelNamespace}.RelationshipProperty`: {
        const name = metaModel.type.name;
        metaModel.type.namespace = resolveName(name, table);
        if (metaModel.decorators) {
            metaModel.decorators.forEach((decorator) => {
                resolveTypeNames(decorator, table);
            });
        }
    }
        break;
    case `${MetaModelNamespace}.Decorator`: {
        if (metaModel.arguments) {
            metaModel.arguments.forEach((argument) => {
                resolveTypeNames(argument, table);
            });
        }
    }
        break;
    case `${MetaModelNamespace}.DecoratorTypeReference`: {
        const name = metaModel.type.name;
        metaModel.type.namespace = resolveName(name, table);
    }
        break;
    }
    return metaModel;
}

/**
 * Resolve the namespace for names in the metamodel
 * @param {*} priorModels - known models
 * @param {object} metaModel - the MetaModel
 * @return {object} the resolved metamodel
 */
function resolveLocalNames(priorModels, metaModel) {
    const result = JSON.parse(JSON.stringify(metaModel));
    const nameTable = createNameTable(priorModels, metaModel);
    // This adds the fully qualified names to the same object
    resolveTypeNames(result, nameTable);
    return result;
}

/**
 * Resolve the namespace for names in the metamodel
 * @param {*} allModels - known models
 * @return {object} the resolved metamodel
 */
function resolveLocalNamesForAll(allModels) {
    const result = {
        $class: `${MetaModelNamespace}.Models`,
        models: [],
    };
    allModels.models.forEach((metaModel) => {
        const resolved = resolveLocalNames(allModels, metaModel);
        result.models.push(resolved);
    });
    return result;
}

/**
 * Return the fully qualified name for an import
 * @param {object} imp - the import
 * @return {string[]} - the fully qualified names for that import
 * @private
 */
function importFullyQualifiedNames(imp) {
    const result = [];

    switch (imp.$class) {
    case `${MetaModelNamespace}.ImportAll`:
        result.push(`${imp.namespace}.*`);
        break;
    case `${MetaModelNamespace}.ImportType`:
        result.push(`${imp.namespace}.${imp.name}`);
        break;
    case `${MetaModelNamespace}.ImportTypes`: {
        imp.types.forEach(type => {
            result.push(`${imp.namespace}.${type}`);
        });
    }
        break;
    default:
        throw new Error(`Unrecognized imports ${imp.$class}`);
    }
    return result;
}

/**
 * Returns an object that maps from the import declarations to the URIs specified
 * @param {*} ast - the model ast
 * @return {Object} keys are import declarations, values are URIs
 * @private
 */
function getExternalImports(ast) {
    const uriMap = {};
    if (ast.imports) {
        ast.imports.forEach((imp) => {
            const fqns = importFullyQualifiedNames(imp);
            if (imp.uri) {
                uriMap[fqns[0]] = imp.uri;
            }
        });
    }
    return uriMap;
}

module.exports = {
    metaModelAst,
    metaModelCto,
    resolveLocalNames,
    resolveLocalNamesForAll,
    importFullyQualifiedNames,
    getExternalImports,
};
