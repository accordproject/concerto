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
const metaModelCto = require('./metamodel.js');

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
    (metaModel.imports || []).forEach((imp) => {
        const namespace = imp.namespace;
        const modelFile = findNamespace(priorModels, namespace);
        if (imp.$class === `${MetaModelNamespace}.ImportType`) {
            if (!findDeclaration(modelFile, imp.name)) {
                throw new Error(`Declaration ${imp.name} in namespace ${namespace} not found`);
            }
            table[imp.name] = namespace;
        } else if (imp.$class === `${MetaModelNamespace}.ImportTypes`) {
            for (const type of imp.types) {
                if (!findDeclaration(modelFile, type)) {
                    throw new Error(`Declaration ${type} in namespace ${namespace} not found`);
                }
                table[type] = namespace;
            }
        } else {
            (modelFile.declarations || []).forEach((decl) => {
                table[decl.name] = namespace;
            });
        }
    });

    // Then add the names local to this metaModel (overriding as we go along)
    (metaModel.declarations || []).forEach((decl) => {
        table[decl.name] = metaModel.namespace;
    });

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
        (metaModel.declarations || []).forEach((decl) => {
            resolveTypeNames(decl, table);
        });
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
        (metaModel.properties || []).forEach((property) => {
            resolveTypeNames(property, table);
        });
        (metaModel.decorators || []).forEach((decorator) => {
            resolveTypeNames(decorator, table);
        });
    }
        break;
    case `${MetaModelNamespace}.EnumDeclaration`: {
        (metaModel.decorators || []).forEach((decorator) => {
            resolveTypeNames(decorator, table);
        });
    }
        break;
    case `${MetaModelNamespace}.EnumProperty`:
    case `${MetaModelNamespace}.ObjectProperty`:
    case `${MetaModelNamespace}.RelationshipProperty`: {
        const name = metaModel.type.name;
        metaModel.type.namespace = resolveName(name, table);
        (metaModel.decorators || []).forEach((decorator) => {
            resolveTypeNames(decorator, table);
        });
    }
        break;
    case `${MetaModelNamespace}.Decorator`: {
        (metaModel.arguments || []).forEach((argument) => {
            resolveTypeNames(argument, table);
        });
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
