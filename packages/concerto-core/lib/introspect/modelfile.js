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

const packageJson = require('../../package.json');
const semver = require('semver');
const AssetDeclaration = require('./assetdeclaration');
const EnumDeclaration = require('./enumdeclaration');
const ClassDeclaration = require('./classdeclaration');
const ConceptDeclaration = require('./conceptdeclaration');
const ScalarDeclaration = require('./scalardeclaration');
const ParticipantDeclaration = require('./participantdeclaration');
const TransactionDeclaration = require('./transactiondeclaration');
const EventDeclaration = require('./eventdeclaration');
const IllegalModelException = require('./illegalmodelexception');
const MapDeclaration = require('./mapdeclaration');
const ModelUtil = require('../modelutil');
const Globalize = require('../globalize');
const Decorated = require('./decorated');
const { Warning, ErrorCodes } = require('@accordproject/concerto-util');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const ClassDeclaration = require('./classdeclaration');
    const ModelManager = require('../modelmanager');
    const Declaration = require('./declaration');
}
/* eslint-enable no-unused-vars */

/**
 * Class representing a Model File. A Model File contains a single namespace
 * and a set of model elements: assets, transactions etc.
 *
 * @class
 * @memberof module:concerto-core
 */
class ModelFile extends Decorated {
    /**
     * Create a ModelFile. This should only be called by framework code.
     * Use the ModelManager to manage ModelFiles.
     * @param {ModelManager} modelManager - the ModelManager that manages this
     * ModelFile
     * @param {object} ast - The abstract syntax tree of the model as a JSON object.
     * @param {string} [definitions] - The optional CTO model as a string.
     * @param {string} [fileName] - The optional filename for this modelfile
     * @throws {IllegalModelException}
     */
    constructor(modelManager, ast, definitions, fileName) {
        super(ast);
        this.modelManager = modelManager;
        this.external = false;
        this.declarations = [];
        this.localTypes = null;
        this.imports = [];
        this.importShortNames = new Map();
        this.importWildcardNamespaces = [];
        this.importUriMap = {};
        this.fileName = 'UNKNOWN';
        this.concertoVersion = null;
        this.version = null;

        if(!ast || typeof ast !== 'object') {
            throw new Error('ModelFile expects a Concerto model AST as input.');
        }

        this.ast = ast;

        if(definitions && typeof definitions !== 'string') {
            throw new Error('ModelFile expects an (optional) Concerto model definition as a string.');
        }
        this.definitions = definitions;

        if(fileName && typeof fileName !== 'string') {
            throw new Error('ModelFile expects an (optional) filename as a string.');
        }
        this.fileName = fileName;

        if(fileName) {
            this.external = fileName.startsWith('@');
        }

        // Set up the decorators.
        this.process();
        // Populate from the AST
        this.fromAst(this.ast);
        // Check version compatibility
        this.isCompatibleVersion();

        // Now build local types from Declarations
        this.localTypes = new Map();
        for(let index in this.declarations) {
            let classDeclaration = this.declarations[index];
            let localType = this.getNamespace() + '.' + classDeclaration.getName();
            this.localTypes.set(localType, this.declarations[index]);
        }
    }

    /**
     * Returns the ModelFile that defines this class.
     *
     * @protected
     * @return {ModelFile} the owning ModelFile
     */
    getModelFile() {
        return this;
    }

    /**
     * Returns true
     * @returns {boolean} true
     */
    isModelFile() {
        return true;
    }

    /**
     * Returns the semantic version
     * @returns {string} the semantic version or null if the namespace for the model file is
     * unversioned
     */
    getVersion() {
        return this.version;
    }

    /**
     * Returns true if the ModelFile is a system namespace
     * @returns {Boolean} true if this is a system model file
     */
    isSystemModelFile() {
        return this.namespace.startsWith('concerto@') || this.namespace === 'concerto';
    }

    /**
     * Returns true if this ModelFile was downloaded from an external URI.
     * @return {boolean} true iff this ModelFile was downloaded from an external URI
     */
    isExternal() {
        return this.external;
    }

    /**
     * Returns the URI for an import, or null if the namespace was not associated with a URI.
     * @param {string} namespace - the namespace for the import
     * @return {string} the URI or null if the namespace was not associated with a URI.
     * @private
     */
    getImportURI(namespace) {
        const result = this.importUriMap[namespace];
        if(result) {
            return result;
        }
        else {
            return null;
        }
    }

    /**
     * Returns an object that maps from the import declarations to the URIs specified
     * @return {Object} keys are import declarations, values are URIs
     * @private
     */
    getExternalImports() {
        return this.importUriMap;
    }

    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     */
    accept(visitor,parameters) {
        return visitor.visit(this, parameters);
    }

    /**
     * Returns the ModelManager associated with this ModelFile
     *
     * @return {ModelManager} The ModelManager for this ModelFile
     */
    getModelManager() {
        return this.modelManager;
    }

    /**
     * Returns the types that have been imported into this ModelFile.
     *
     * @return {string[]} The array of fully-qualified names for types imported by
     * this ModelFile
     */
    getImports() {
        let result = [];
        this.imports.forEach( imp => {
            result = result.concat(ModelUtil.importFullyQualifiedNames(imp));
        });
        return result;
    }

    /**
     * Validates the ModelFile.
     *
     * @throws {IllegalModelException} if the model is invalid
     * @protected
     */
    validate() {
        super.validate();
        // A dictionary of imports to versions to track unique namespaces
        const importsMap = new Map();

        // Validate all of the imports to check that they reference
        // namespaces or types that actually exist.
        // const seenImportNamespace = new Set();
        this.getImports().forEach((importFqn) => {
            const importNamespace = ModelUtil.getNamespace(importFqn);
            const importShortName = ModelUtil.getShortName(importFqn);
            const modelFile = this.getModelManager().getModelFile(importNamespace);
            const { name, version: importVersion } = ModelUtil.parseNamespace(importNamespace);

            if (!modelFile) {
                let formatter = Globalize.messageFormatter('modelmanager-gettype-noregisteredns');
                throw new IllegalModelException(formatter({
                    type: importFqn
                }), this);
            }

            const existingNamespaceVersion = importsMap.get(name);
            // undefined means we haven't seen this namespace before,
            // null means we have seen it before but it didn't have a version
            const unseenNamespace = existingNamespaceVersion === undefined;
            // if (seenImportNamespace.has(importNamespace)) {
            //     throw new IllegalModelException(
            //         'Import namespace is already defined',
            //         this
            //     );
            // }
            // seenImportNamespace.add(importNamespace);
            // This check is needed because we automatically add both versioned and unversioned versions of
            // the root namespace for backwards compatibillity unless we're running in strict mode
            const isGlobalModel = name === 'concerto';

            const differentVersionsOfSameNamespace = !unseenNamespace && existingNamespaceVersion !== importVersion;
            if (!isGlobalModel && differentVersionsOfSameNamespace){
                let formatter = Globalize.messageFormatter('modelmanager-gettype-duplicatensimport');
                throw new IllegalModelException(formatter({
                    namespace: importNamespace,
                    version1: existingNamespaceVersion,
                    version2: importVersion
                }), this);
            }
            importsMap.set(name, importVersion);

            if (importFqn.endsWith('*')) {
                // This is a wildcard import, org.acme.*
                // Doesn't matter if 0 or 100 types in the namespace.
                return;
            }
            if (!modelFile.isLocalType(importShortName)) {
                let formatter = Globalize.messageFormatter('modelmanager-gettype-notypeinns');
                throw new IllegalModelException(formatter({
                    type: importShortName,
                    namespace: importNamespace
                }), this);
            }
        });
        // Check that no locally declared type conflicts with imported type names
        // Validate all of the types in this model file.
        // Check if names of the declarations are unique.
        const uniqueNames = new Set();
        this.declarations.forEach(
            d => {
                const fqn = d.getFullyQualifiedName();
                if (!uniqueNames.has(fqn)) {
                    uniqueNames.add(fqn);
                } else {
                    throw new IllegalModelException(
                        `Duplicate class name ${fqn}`
                    );
                }
            }
        );
        // Run validations on class declarations
        for(let n=0; n < this.declarations.length; n++) {
            let classDeclaration = this.declarations[n];
            classDeclaration.validate();
        }
    }

    /**
     * Check that the type is valid.
     * @param {string} context - error reporting context
     * @param {string} type - a short type name
     * @param {Object} [fileLocation] - location details of the error within the model file.
     * @param {String} fileLocation.start.line - start line of the error location.
     * @param {String} fileLocation.start.column - start column of the error location.
     * @param {String} fileLocation.end.line - end line of the error location.
     * @param {String} fileLocation.end.column - end column of the error location.
     * @throws {IllegalModelException} - if the type is not defined
     * @private
     */
    resolveType(context, type, fileLocation) {
        // is the type a primitive?
        if(!ModelUtil.isPrimitiveType(type)) {
            // is it an imported type?
            if(!this.isImportedType(type)) {
                // is the type declared locally?
                if(!this.isLocalType(type)) {
                    let formatter = Globalize('en').messageFormatter('modelfile-resolvetype-undecltype');
                    throw new IllegalModelException(formatter({
                        'type': type,
                        'context': context,
                    }), this, fileLocation);
                }
            }
            else {
                // check whether type is defined in another file
                this.getModelManager().resolveType(context,this.resolveImport(type));
            }
        }
    }

    /**
     * Returns true if the type is defined in this namespace.
     * @param {string} type - the short name of the type
     * @return {boolean} - true if the type is defined in this ModelFile
     * @private
     */
    isLocalType(type) {
        let result = (type && this.getLocalType(type) !== null);
        return result;
    }

    /**
     * Returns true if the type is imported from another namespace
     * @param {string} type - the short name of the type
     * @return {boolean} - true if the type is imported from another namespace
     * @private
     */
    isImportedType(type) {
        if (this.importShortNames.has(type)) {
            return true;
        } else {
            for(let index in this.importWildcardNamespaces) {
                let wildcardNamespace = this.importWildcardNamespaces[index];
                const modelFile = this.getModelManager().getModelFile(wildcardNamespace);
                if (modelFile && modelFile.isLocalType(type)) {
                    return true;
                }
            }
            return false;
        }
    }

    /**
     * Returns the FQN for a type that is imported from another namespace
     * @param {string} type - the short name of the type
     * @return {string} - the FQN of the resolved import
     * @throws {Error} - if the type is not imported
     * @private
     */
    resolveImport(type) {
        if (this.importShortNames.has(type)) {
            return this.importShortNames.get(type);
        } else {
            for(let index in this.importWildcardNamespaces) {
                let wildcardNamespace = this.importWildcardNamespaces[index];
                const modelFile = this.getModelManager().getModelFile(wildcardNamespace);
                if (modelFile && modelFile.isLocalType(type)) {
                    return wildcardNamespace + '.' + type;
                }
            }
        }

        let formatter = Globalize('en').messageFormatter('modelfile-resolveimport-failfindimp');

        throw new IllegalModelException(formatter({
            'type': type,
            'imports': JSON.stringify(this.imports),
            'namespace': this.getNamespace()
        }),this);
    }

    /**
     * Returns the actual imported name from another namespace
     * @param {string} type - the short name of the type
     * @returns {string} - the actual imported name. If not aliased then returns the same string
     */
    getImportedType(type) {
        let fqn = this.resolveImport(type);
        return fqn.split('.').pop();
    }

    /**
     * Returns true if the type is defined in the model file
     * @param {string} type the name of the type
     * @return {boolean} true if the type (asset or transaction) is defined
     */
    isDefined(type) {
        return ModelUtil.isPrimitiveType(type) || this.getLocalType(type) !== null;
    }

    /**
     * Returns the FQN of the type or null if the type could not be resolved.
     * For primitive types the type name is returned.
     * @param {string} type - a FQN or short type name
     * @return {string | ClassDeclaration} the class declaration for the type or null.
     * @private
     */
    getType(type) {
        // is the type a primitive?
        if(!ModelUtil.isPrimitiveType(type)) {
            // is it an imported type?
            if(!this.isImportedType(type)) {
                // is the type declared locally?
                if(!this.isLocalType(type)) {
                    return null;
                }
                else {
                    return this.getLocalType(type);
                }
            }
            else {
                // check whether type is defined in another file
                const fqn = this.resolveImport(type);
                const modelFile = this.getModelManager().getModelFile(ModelUtil.getNamespace(fqn));
                if (!modelFile) {
                    return null;
                } else {
                    return modelFile.getLocalType(fqn);
                }
            }
        }
        else {
            // for primitive types we just return the name
            return type;
        }
    }

    /**
     * Returns the FQN of the type or null if the type could not be resolved.
     * For primitive types the short type name is returned.
     * @param {string} type - a FQN or short type name
     * @return {string} the FQN type name or null
     * @private
     */
    getFullyQualifiedTypeName(type) {
        // is the type a primitive?
        if(!ModelUtil.isPrimitiveType(type)) {
            // is it an imported type?
            if(!this.isImportedType(type)) {
                // is the type declared locally?
                if(!this.isLocalType(type)) {
                    return null;
                }
                else {
                    return this.getLocalType(type).getFullyQualifiedName();
                }
            }
            else {
                return this.resolveImport(type);
            }
        }
        else {
            // for primitive types we just return the name
            return type;
        }
    }

    /**
     * Returns the type with the specified name or null
     * @param {string} type the short OR FQN name of the type
     * @return {ClassDeclaration} the ClassDeclaration, or null if the type does not exist
     */
    getLocalType(type) {
        if(!this.localTypes) {
            throw new Error('Internal error: local types are not yet initialized. Do not try to resolve types inside `process`.');
        }

        if(!type.startsWith(this.getNamespace())) {
            type = this.getNamespace() + '.' + type;
        }

        if (this.localTypes.has(type)) {
            return this.localTypes.get(type);
        } else {
            return null;
        }
    }

    /**
     * Get the AssetDeclarations defined in this ModelFile or null
     * @param {string} name the name of the type
     * @return {AssetDeclaration} the AssetDeclaration with the given short name
     */
    getAssetDeclaration(name) {
        let classDeclaration = this.getLocalType(name);
        if(classDeclaration && classDeclaration.isAsset()) {
            return classDeclaration;
        }

        return null;
    }

    /**
     * Get the TransactionDeclaration defined in this ModelFile or null
     * @param {string} name the name of the type
     * @return {TransactionDeclaration} the TransactionDeclaration with the given short name
     */
    getTransactionDeclaration(name) {
        let classDeclaration = this.getLocalType(name);
        if(classDeclaration && classDeclaration.isTransaction()) {
            return classDeclaration;
        }

        return null;
    }

    /**
     * Get the EventDeclaration defined in this ModelFile or null
     * @param {string} name the name of the type
     * @return {EventDeclaration} the EventDeclaration with the given short name
     */
    getEventDeclaration(name) {
        let classDeclaration = this.getLocalType(name);
        if(classDeclaration && classDeclaration.isEvent()) {
            return classDeclaration;
        }

        return null;
    }

    /**
     * Get the ParticipantDeclaration defined in this ModelFile or null
     * @param {string} name the name of the type
     * @return {ParticipantDeclaration} the ParticipantDeclaration with the given short name
     */
    getParticipantDeclaration(name) {
        let classDeclaration = this.getLocalType(name);
        if(classDeclaration && classDeclaration.isParticipant()) {
            return classDeclaration;
        }

        return null;
    }


    /**
     * Get the Namespace for this model file.
     * @return {string} The Namespace for this model file
     */
    getNamespace() {
        return this.namespace;
    }

    /**
     * Get the filename for this model file. Note that this may be null.
     * @return {string} The filename for this model file
     */
    getName() {
        return this.fileName;
    }

    /**
     * Get the AssetDeclarations defined in this ModelFile
     * @return {AssetDeclaration[]} the AssetDeclarations defined in the model file
     */
    getAssetDeclarations() {
        return this.getDeclarations(AssetDeclaration);
    }

    /**
     * Get the TransactionDeclarations defined in this ModelFile
     * @return {TransactionDeclaration[]} the TransactionDeclarations defined in the model file
     */
    getTransactionDeclarations() {
        return this.getDeclarations(TransactionDeclaration);
    }

    /**
     * Get the EventDeclarations defined in this ModelFile
     * @return {EventDeclaration[]} the EventDeclarations defined in the model file
     */
    getEventDeclarations() {
        return this.getDeclarations(EventDeclaration);
    }

    /**
     * Get the ParticipantDeclarations defined in this ModelFile
     * @return {ParticipantDeclaration[]} the ParticipantDeclaration defined in the model file
     */
    getParticipantDeclarations() {
        return this.getDeclarations(ParticipantDeclaration);
    }

    /**
     * Get the ClassDeclarations defined in this ModelFile
     * @return {ClassDeclaration[]} the ClassDeclarations defined in the model file
     */
    getClassDeclarations() {
        return this.getDeclarations(ClassDeclaration);
    }

    /**
     * Get the ConceptDeclarations defined in this ModelFile
     * @return {ConceptDeclaration[]} the ParticipantDeclaration defined in the model file
     */
    getConceptDeclarations() {
        return this.getDeclarations(ConceptDeclaration);
    }

    /**
     * Get the EnumDeclarations defined in this ModelFile
     * @return {EnumDeclaration[]} the EnumDeclaration defined in the model file
     */
    getEnumDeclarations() {
        return this.getDeclarations(EnumDeclaration);
    }

    /**
     * Get the MapDeclarations defined in this ModelFile
     * @return {MapDeclaration[]} the MapDeclarations defined in the model file
     */
    getMapDeclarations() {
        return this.getDeclarations(MapDeclaration);
    }

    /**
     * Get the ScalarDeclaration defined in this ModelFile
     * @return {ScalarDeclaration[]} the ScalarDeclaration defined in the model file
     */
    getScalarDeclarations() {
        return this.getDeclarations(ScalarDeclaration);
    }

    /**
     * Get the instances of a given type in this ModelFile
     * @param {Function} type - the type of the declaration
     * @return {Object[]} the ClassDeclaration defined in the model file
     */
    getDeclarations(type) {
        let result = [];
        for(let n=0; n < this.declarations.length; n++) {
            let declaration = this.declarations[n];
            if(declaration instanceof type) {
                result.push(declaration);
            }
        }

        return result;
    }

    /**
     * Get all declarations in this ModelFile
     * @return {ClassDeclaration[]} the ClassDeclarations defined in the model file
     */
    getAllDeclarations() {
        return this.declarations;
    }

    /**
     * Get the definitions for this model.
     * @return {string} The definitions for this model.
     */
    getDefinitions() {
        return this.definitions;
    }

    /**
     * Get the ast for this model.
     * @return {object} The definitions for this model.
     */
    getAst() {
        return this.ast;
    }

    /**
     * Get the expected concerto version
     * @return {string} The semver range for compatible concerto versions
     */
    getConcertoVersion() {
        return this.concertoVersion;
    }

    /**
     * Check whether this modelfile is compatible with the concerto version
     */
    isCompatibleVersion() {
        if (this.ast.concertoVersion) {
            if (semver.satisfies(packageJson.version, this.ast.concertoVersion, { includePrerelease: true })) {
                this.concertoVersion = this.ast.concertoVersion;
            } else {
                throw new Error(`ModelFile expects Concerto version ${this.ast.concertoVersion} but this is ${packageJson.version}`);
            }
        }
    }

    /**
     * Verifies that an import is versioned if the strict
     * option has been set on the Model Manager
     * @param {*} imp - the import to validate
     */
    enforceImportVersioning(imp) {
        if(this.getModelManager().isStrict()) {
            const nsInfo = ModelUtil.parseNamespace(imp.namespace);
            if(!nsInfo.version) {
                throw new Error(`Cannot use an unversioned import ${imp.namespace} when 'strict' option on Model Manager is set.`);
            }
        }
    }

    /**
     * Populate from an AST
     * @param {object} ast - the AST obtained from the parser
     * @private
     */
    fromAst(ast) {
        const nsInfo = ModelUtil.parseNamespace(ast.namespace);

        const namespaceParts = nsInfo.name.split('.');
        namespaceParts.forEach(part => {
            if (!ModelUtil.isValidIdentifier(part)){
                throw new IllegalModelException(`Invalid namespace part '${part}'`, this.modelFile, this.ast.location);
            }
        });

        this.namespace = ast.namespace;
        this.version = nsInfo.version;

        // Make sure to clone imports since we will add built-in imports
        const imports = ast.imports ? ast.imports.concat([]) : [];

        if(!this.isSystemModelFile()) {
            imports.push(
                {
                    $class: `${MetaModelNamespace}.ImportTypes`,
                    namespace: 'concerto@1.0.0',
                    types: ['Concept', 'Asset', 'Transaction', 'Participant', 'Event']
                }
            );
        }

        this.imports = imports;
        this.imports.forEach((imp) => {
            this.enforceImportVersioning(imp);
            switch(imp.$class) {
            case `${MetaModelNamespace}.ImportAll`:
                if (this.getModelManager().isStrict()){
                    throw new Error('Wilcard Imports are not permitted in strict mode.');
                }
                Warning.printDeprecationWarning(
                    'Wilcard Imports are deprecated in this version of Concerto and will be removed in a future version.',
                    ErrorCodes.DEPRECATION_WARNING,
                    ErrorCodes.CONCERTO_DEPRECATION_002,
                    'Please refer to https://concerto.accordproject.org/deprecation/002'
                );
                this.importWildcardNamespaces.push(imp.namespace);
                break;
            case `${MetaModelNamespace}.ImportTypes`:
                if (this.getModelManager().isAliasedTypeEnabled()) {
                    const aliasedTypes = new Map();
                    if (imp.aliasedTypes) {
                        imp.aliasedTypes.forEach(({ name, aliasedName }) => {
                            if(ModelUtil.isPrimitiveType(aliasedName)){
                                throw new Error('Types cannot be aliased to primitive type');
                            }
                            aliasedTypes.set(name, aliasedName);
                        });
                    }
                    // Local-name(aliased or non-aliased) is mapped to the Fully qualified type name
                    imp.types.forEach((type) =>
                        aliasedTypes.has(type)
                            ? this.importShortNames.set(
                                aliasedTypes.get(type),
                                `${imp.namespace}.${type}`
                            )
                            : this.importShortNames.set(
                                type,
                                `${imp.namespace}.${type}`
                            )
                    );
                    // Check that no locally declared type conflicts with imported type names
                    this.declarations.forEach(declaration => {
                        const localDeclarationName = declaration.getName(); 
                        let conflict=false;
                        imp.types.forEach((type) => {
                            const importedName = aliasedTypes.get(type) || type;
                            if (importedName === localDeclarationName) {
                                conflict=true;
                                throw new IllegalModelException(
                                    `already defined in an imported model`,
                                    this
                                );
                            }
                        });
                    });
                } else {
                    if (imp.aliasedTypes) {
                        throw new Error('Aliasing disabled, set importAliasing to true');
                    }
                    imp.types.forEach((type) => {
                        this.importShortNames.set(type,`${imp.namespace}.${type}`);
                    });
                }
                break;
            default:
                this.importShortNames.set(imp.name, ModelUtil.importFullyQualifiedNames(imp)[0]);
                this.declarations.forEach(declaration => {
                    const localDeclarationName = declaration.getName(); 
                    let conflict=false;
                    if (imp.name === localDeclarationName) {
                        throw new IllegalModelException(
                            `already defined in an imported model`,
                            this
                        );
                    }
                });
            }
            if(imp.uri) {
                this.importUriMap[ModelUtil.importFullyQualifiedNames(imp)[0]] = imp.uri;
            }
        });

        // declarations is an optional field
        if (!ast.declarations) {
            return;
        }

        for(let n=0; n < ast.declarations.length; n++) {
            // Make sure to clone since we may add super type
            let thing = Object.assign({}, ast.declarations[n]);

            if(thing.$class === `${MetaModelNamespace}.AssetDeclaration`) {
                // Default super type for asset
                if (!thing.superType) {
                    thing.superType = {
                        $class: `${MetaModelNamespace}.TypeIdentified`,
                        name: 'Asset',
                    };
                }
                this.declarations.push( new AssetDeclaration(this, thing) );
            }
            else if(thing.$class === `${MetaModelNamespace}.TransactionDeclaration`) {
                // Default super type for transaction
                if (!thing.superType) {
                    thing.superType = {
                        $class: `${MetaModelNamespace}.TypeIdentified`,
                        name: 'Transaction',
                    };
                }
                this.declarations.push( new TransactionDeclaration(this, thing) );
            }
            else if(thing.$class === `${MetaModelNamespace}.EventDeclaration`) {
                // Default super type for event
                if (!thing.superType) {
                    thing.superType = {
                        $class: `${MetaModelNamespace}.TypeIdentified`,
                        name: 'Event',
                    };
                }
                this.declarations.push( new EventDeclaration(this, thing) );
            }
            else if(thing.$class === `${MetaModelNamespace}.ParticipantDeclaration`) {
                // Default super type for participant
                if (!thing.superType) {
                    thing.superType = {
                        $class: `${MetaModelNamespace}.TypeIdentified`,
                        name: 'Participant',
                    };
                }
                this.declarations.push( new ParticipantDeclaration(this, thing) );
            }
            else if(thing.$class === `${MetaModelNamespace}.EnumDeclaration`) {
                this.declarations.push( new EnumDeclaration(this, thing) );
            }
            else if(thing.$class === `${MetaModelNamespace}.MapDeclaration`) {
                this.declarations.push( new MapDeclaration(this, thing) );
            }
            else if(thing.$class === `${MetaModelNamespace}.ConceptDeclaration`) {
                this.declarations.push( new ConceptDeclaration(this, thing) );
            }
            else if([
                `${MetaModelNamespace}.BooleanScalar`,
                `${MetaModelNamespace}.IntegerScalar`,
                `${MetaModelNamespace}.LongScalar`,
                `${MetaModelNamespace}.DoubleScalar`,
                `${MetaModelNamespace}.StringScalar`,
                `${MetaModelNamespace}.DateTimeScalar`,
            ].includes(thing.$class)) {
                this.declarations.push( new ScalarDeclaration(this, thing) );
            }
            else {
                let formatter = Globalize('en').messageFormatter('modelfile-constructor-unrecmodelelem');

                throw new IllegalModelException(formatter({
                    'type': thing.$class,
                }),this);
            }
        }
    }

    /**
     * A function type definition for use as an argument to the filter function
     * @callback FilterFunction
     * @param {Declaration} declaration
     * @returns {boolean} true, if the declaration satisfies the filter function
     */

    /**
     * Returns a new ModelFile with only the types for which the
     * filter function returns true.
     *
     * Will return null if the filtered ModelFile doesn't contain any declarations.
     *
     * @param {FilterFunction} predicate - the filter function over a Declaration object
     * @param {ModelManager} modelManager - the target ModelManager for the filtered ModelFile
     * @param {string[]} removedDeclarations - an array that will be populated with the FQN of removed declarations
     * @returns {ModelFile?} - the filtered ModelFile
     * @private
     */
    filter(predicate, modelManager, removedDeclarations){
        let declarations = []; // ast for all included declarations
        this.declarations?.forEach( declaration => {
            const included = predicate(declaration);
            if(!included) {
                removedDeclarations.push(declaration.getFullyQualifiedName());
            }
            else {
                declarations.push(declaration.ast);
            }
        } );

        const ast = {
            ...this.ast,
            declarations: declarations,
        };
        if (ast.declarations?.length > 0){
            return new ModelFile(modelManager, ast, undefined, this.fileName);
        }
        return null;
    }
}

module.exports = ModelFile;
