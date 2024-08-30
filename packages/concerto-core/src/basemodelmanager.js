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

const fsPath = require('path');

const { DefaultFileLoader, FileDownloader, ModelWriter } = require('@accordproject/concerto-util');
const { MetaModelUtil, MetaModelNamespace } = require('@accordproject/concerto-metamodel');

const Factory = require('./factory');
const Globalize = require('./globalize');
const IllegalModelException = require('./introspect/illegalmodelexception');
const ModelFile = require('./introspect/modelfile');
const ModelUtil = require('./modelutil');
const Serializer = require('./serializer');
const TypeNotFoundException = require('./typenotfoundexception');
const { getRootModel } = require('./rootmodel');
const MetamodelException = require('./metamodelexception');

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
/* istanbul ignore next */
if (global === undefined) {
    const Declaration = require('./introspect/declaration');
    const AssetDeclaration = require('./introspect/assetdeclaration');
    const ClassDeclaration = require('./introspect/classdeclaration');
    const MapDeclaration = require('./introspect/mapdeclaration');
    const ConceptDeclaration = require('./introspect/conceptdeclaration');
    const DecoratorFactory = require('./introspect/decoratorfactory');
    const EnumDeclaration = require('./introspect/enumdeclaration');
    const EventDeclaration = require('./introspect/eventdeclaration');
    const ParticipantDeclaration = require('./introspect/participantdeclaration');
    const TransactionDeclaration = require('./introspect/transactiondeclaration');
}
/* eslint-enable no-unused-vars */

const debug = require('debug')('concerto:BaseModelManager');

// How to create a modelfile from the external content
const defaultProcessFile = (name, data) => {
    return {
        ast: data, // AST is input
        definitions: null, // No CTO file
        fileName: name,
    };
};

/**
 * Manages the Concerto model files.
 *
 * The structure of {@link Resource}s (Assets, Transactions, Participants) is modelled
 * in a set of Concerto files. The contents of these files are managed
 * by the {@link ModelManager}. Each Concerto file has a single namespace and contains
 * a set of asset, transaction and participant type definitions.
 *
 * Concerto applications load their Concerto files and then call the {@link ModelManager#addModelFile addModelFile}
 * method to register the Concerto file(s) with the ModelManager.
 *
 * Use the {@link Concerto} class to validate instances.
 *
 * @memberof module:concerto-core
 */
class BaseModelManager {
    /**
     * Create the ModelManager.
     * @constructor
     * @param {object} [options] - ModelManager options, also passed to Serializer
     * @param {Object} [options.regExp] - An alternative regular expression engine.
     * @param {boolean} [options.metamodelValidation] - When true, modelfiles will be validated
     * @param {boolean} [options.addMetamodel] - When true, the Concerto metamodel is added to the model manager
     * @param {boolean} [options.enableMapType] - When true, the Concerto Map Type feature is enabled
     * @param {*} [processFile] - how to obtain a concerto AST from an input to the model manager
     */
    constructor(options, processFile) {
        this.processFile = processFile ? processFile : defaultProcessFile;
        this.modelFiles = {};
        this.factory = new Factory(this);
        this.serializer = new Serializer(this.factory, this, options);
        this.decoratorFactories = [];
        this.options = options;
        this.addRootModel();

        // TODO Remove on release of MapType
        // Supports both env var and property based flag
        this.enableMapType = !!options?.enableMapType;
        this.importAliasing = process?.env?.IMPORT_ALIASING === 'true' || !!options?.importAliasing;
        // Cache a copy of the Metamodel ModelFile for use when validating the structure of ModelFiles later.
        this.metamodelModelFile = new ModelFile(this, MetaModelUtil.metaModelAst, undefined, MetaModelNamespace);

        if(options?.addMetamodel) {
            this.addModelFile(this.metamodelModelFile);
        }
    }

    /**
     * Returns true
     * @returns {boolean} true
     */
    isModelManager() {
        return true;
    }

    /**
     * Adds root types
     * @private
     */
    addRootModel() {
        // create the versioned concerto namespace
        const {rootModelAst, rootModelCto, rootModelFile} = getRootModel();
        const m = new ModelFile(this, rootModelAst, rootModelCto, rootModelFile);

        // add the versioned concerto namespace
        this.addModelFile(m, rootModelCto, rootModelFile, true);
    }

    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     */
    accept(visitor, parameters) {
        return visitor.visit(this, parameters);
    }

    /**
     * Validates a Concerto file (as a string) to the ModelManager.
     * Concerto files have a single namespace.
     *
     * Note that if there are dependencies between multiple files the files
     * must be added in dependency order, or the addModelFiles method can be
     * used to add a set of files irrespective of dependencies.
     * @param {string|ModelFile} modelFile - The Concerto file as a string
     * @param {string} [fileName] - a file name to associate with the model file
     * @throws {IllegalModelException}
     */
    validateModelFile(modelFile, fileName) {
        if (typeof modelFile === 'string') {
            const { ast } = this.processFile(fileName, modelFile);
            let m = new ModelFile(this, ast, modelFile, fileName);
            m.validate();
        } else {
            modelFile.validate();
        }
    }

    /**
     * Throws an error with details about the existing namespace.
     * @param {ModelFile} modelFile The model file that is trying to declare an existing namespace
     * @private
     */
    _throwAlreadyExists(modelFile) {
        const existingModelFileName = this.modelFiles[modelFile.getNamespace()].getName();
        const postfix = existingModelFileName ? ` in file ${existingModelFileName}` : '';
        const prefix = modelFile.getName() ? ` specified in file ${modelFile.getName()}` : '';
        let errMsg = `Namespace ${modelFile.getNamespace()}${prefix} is already declared${postfix}`;
        throw new Error(errMsg);
    }

    /**
     * Adds a Concerto file (as an AST) to the ModelManager.
     * Concerto files have a single namespace. If a Concerto file with the
     * same namespace has already been added to the ModelManager then it
     * will be replaced.
     * Note that if there are dependencies between multiple files the files
     * must be added in dependency order, or the addModelFiles method can be
     * used to add a set of files irrespective of dependencies.
     * @param {ModelFile} modelFile - Model as a ModelFile object
     * @param {string} [cto] - an optional cto string
     * @param {string} [fileName] - an optional file name to associate with the model file
     * @param {boolean} [disableValidation] - If true then the model files are not validated
     * @throws {IllegalModelException}
     * @return {Object} The newly added model file (internal).
     */
    addModelFile(modelFile, cto, fileName, disableValidation) {
        const NAME = 'addModelFile';
        debug(NAME, 'addModelFile', modelFile, fileName);

        if(!modelFile.getVersion()) {
            throw new Error(`Cannot add an unversioned namespace: ${modelFile.getNamespace()}`);
        }

        if (!this.modelFiles[modelFile.getNamespace()]) {
            if (!disableValidation) {
                // Structural validation against the Metamodel
                if(this.options?.metamodelValidation){
                    this.validateAst(modelFile);
                }

                // Semantic validation of the model file
                modelFile.validate();
            }
            this.modelFiles[modelFile.getNamespace()] = modelFile;
        } else {
            this._throwAlreadyExists(modelFile);
        }

        return modelFile;
    }

    /**
     * Check that a modelFile is valid with respect to the metamodel.
     *
     * @param {ModelFile} modelFile - Model as a ModelFile object
     * @throws {MetamodelException} - throws if the ModelFile is invalid
     * @private
     */
    validateAst(modelFile) {
        const { version: modelFileVersion } = ModelUtil.parseNamespace(ModelUtil.getNamespace(modelFile.getAst().$class));
        const { version: metamodelVersion } = ModelUtil.parseNamespace(MetaModelNamespace);

        if (modelFileVersion !== metamodelVersion){
            throw new MetamodelException(`Model file version ${modelFileVersion} does not match metamodel version ${metamodelVersion}`);
        }

        const alreadyHasMetamodel = !!this.getModelFile(MetaModelNamespace);
        if (!alreadyHasMetamodel) {
            this.addModelFile(this.metamodelModelFile, undefined, MetaModelNamespace, true);
        }

        try {
            // Use deserialization to validate the AST
            this.getSerializer().fromJSON(modelFile.getAst());
        } catch (err) {
            throw new MetamodelException(err.message);
        }

        if (!alreadyHasMetamodel) {
            this.deleteModelFile(MetaModelNamespace);
        }
    }

    /**
     * Adds a model to the ModelManager.
     * Concerto files have a single namespace. If a Concerto file with the
     * same namespace has already been added to the ModelManager then it
     * will be replaced.
     * Note that if there are dependencies between multiple files the files
     * must be added in dependency order, or the addModel method can be
     * used to add a set of files irrespective of dependencies.
     * @param {*} modelInput - Model (as a string or object)
     * @param {string} [cto] - an optional cto string
     * @param {string} [fileName] - an optional file name to associate with the model file
     * @param {boolean} [disableValidation] - If true then the model files are not validated
     * @throws {IllegalModelException}
     * @return {ModelFile} The newly added model file (internal).
     */
    addModel(modelInput, cto, fileName, disableValidation) {
        const NAME = 'addModel';
        debug(NAME, 'addModel', modelInput, fileName);

        const { ast, definitions } = this.processFile(fileName, modelInput);
        const finalCto = cto || definitions;
        const m = new ModelFile(this, ast, finalCto, fileName);

        this.addModelFile(m, finalCto, fileName, disableValidation);

        return m;
    }

    /**
     * Updates a Concerto file (as a string) on the ModelManager.
     * Concerto files have a single namespace. If a Concerto file with the
     * same namespace has already been added to the ModelManager then it
     * will be replaced.
     * @param {string|ModelFile} modelFile - Model as a string or object
     * @param {string} [fileName] - a file name to associate with the model file
     * @param {boolean} [disableValidation] - If true then the model files are not validated
     * @throws {IllegalModelException}
     * @returns {Object} The newly added model file (internal).
     */
    updateModelFile(modelFile, fileName, disableValidation) {
        const NAME = 'updateModelFile';
        debug(NAME, 'updateModelFile', modelFile, fileName);
        if (typeof modelFile === 'string') {
            const { ast } = this.processFile(fileName, modelFile);
            let m = new ModelFile(this, ast, modelFile, fileName);
            return this.updateModelFile(m,fileName,disableValidation);
        } else {
            let existing = this.modelFiles[modelFile.getNamespace()];
            if (!existing) {
                throw new Error(`Model file for namespace ${modelFile.getNamespace()} not found`);
            }
            if (!disableValidation) {
                modelFile.validate();
            }
        }
        this.modelFiles[modelFile.getNamespace()] = modelFile;
        return modelFile;
    }

    /**
     * Remove the Concerto file for a given namespace
     * @param {string} namespace - The namespace of the model file to delete.
     */
    deleteModelFile(namespace) {
        if (!this.modelFiles[namespace]) {
            throw new Error('Model file does not exist');
        } else {
            delete this.modelFiles[namespace];
        }
    }

    /**
     * Add a set of Concerto files to the model manager.
     * @param {string[]|ModelFile[]} modelFiles - An array of models as strings or ModelFile objects.
     * @param {string[]} [fileNames] - A array of file names to associate with the model files
     * @param {boolean} [disableValidation] - If true then the model files are not validated
     * @returns {Object[]} The newly added model files (internal).
     */
    addModelFiles(modelFiles, fileNames, disableValidation) {
        const NAME = 'addModelFiles';
        debug(NAME, 'addModelFiles', modelFiles, fileNames);
        const originalModelFiles = {};
        Object.assign(originalModelFiles, this.modelFiles);
        let newModelFiles = [];

        try {
            // create the model files
            for (let n = 0; n < modelFiles.length; n++) {
                const modelFile = modelFiles[n];
                let fileName = null;

                if (fileNames) {
                    fileName = fileNames[n];
                }

                let m;
                if (typeof modelFile === 'string') {
                    const { ast } = this.processFile(fileName, modelFile);
                    m = new ModelFile(this, ast, modelFile, fileName);
                } else {
                    m = modelFile;
                }
                if (!this.modelFiles[m.getNamespace()]) {
                    this.modelFiles[m.getNamespace()] = m;
                    newModelFiles.push(m);
                } else {
                    this._throwAlreadyExists(m);
                }
            }

            // re-validate all the model files
            if (!disableValidation) {
                this.validateModelFiles();
            }

            // return the model files.
            return newModelFiles;
        } catch (err) {
            this.modelFiles = {};
            Object.assign(this.modelFiles, originalModelFiles);
            throw err;
        } finally {
            debug(NAME, newModelFiles);
        }
    }

    /**
     * Validates all models files in this model manager
     */
    validateModelFiles() {
        for (let ns in this.modelFiles) {
            this.modelFiles[ns].validate();
        }
    }

    /**
     * Downloads all ModelFiles that are external dependencies and adds or
     * updates them in this ModelManager.
     * @param {Object} [options] - Options object passed to ModelFileLoaders
     * @param {FileDownloader} [fileDownloader] - an optional FileDownloader
     * @throws {IllegalModelException} if the models fail validation
     * @return {Promise} a promise when the download and update operation is completed.
     */
    async updateExternalModels(options, fileDownloader) {
        const NAME = 'updateExternalModels';
        debug(NAME, 'updateExternalModels', options);

        if(!fileDownloader) {
            fileDownloader = new FileDownloader(new DefaultFileLoader(this.processFile), (file) => MetaModelUtil.getExternalImports(file.ast));
        }

        const originalModelFiles = {};
        Object.assign(originalModelFiles, this.modelFiles);

        try {
            const externalModels = await fileDownloader.downloadExternalDependencies(this.getModelFiles(), options);

            const externalModelFiles = [];
            externalModels.forEach((file) => {
                const mf = new ModelFile(this, file.ast, file.definitions, file.fileName);
                const existing = this.modelFiles[mf.getNamespace()];

                if (existing) {
                    externalModelFiles.push(this.updateModelFile(mf, mf.getName(), true)); // disable validation
                } else {
                    externalModelFiles.push(this.addModelFile(mf, null, mf.getName(), true)); // disable validation
                }
            });

            // now everything is applied, we need to revalidate all models
            this.validateModelFiles();
            return externalModelFiles;
        } catch (err) {
            // Restore original files
            this.modelFiles = {};
            Object.assign(this.modelFiles, originalModelFiles);
            throw err;
        }
    }

    /**
     * Write all models in this model manager to the specified path in the file system
     *
     * @param {string} path to a local directory
     * @param {Object} [options] - Options object
     * @param {boolean} options.includeExternalModels -
     *  If true, external models are written to the file system. Defaults to true
     */
    writeModelsToFileSystem(path, options = {}) {
        ModelWriter.writeModelsToFileSystem(this.getModelFiles(), path, options);
    }

    /**
     * Get the array of model file instances
     * @param {Boolean} [includeConcertoNamespace] - whether to include the concerto namespace
     * (default to false)
     * @return {ModelFile[]} The ModelFiles registered
     * @private
     */
    getModelFiles(includeConcertoNamespace) {
        let keys = Object.keys(this.modelFiles);
        let result = [];

        for (let n = 0; n < keys.length; n++) {
            const ns = keys[n];
            if(includeConcertoNamespace || (ns !== 'concerto@1.0.0' && ns !== 'concerto')) {
                result.push(this.modelFiles[ns]);
            }
        }

        return result;
    }

    /**
     * Gets all the Concerto models
     * @param {Object} [options] - Options object
     * @param {boolean} options.includeExternalModels -
     *  If true, external models are written to the file system. Defaults to true
     * @return {Array<{name:string, content:string}>} the name and content of each CTO file
     */
    getModels(options) {
        const modelFiles = this.getModelFiles();
        let models = [];
        const opts = Object.assign({
            includeExternalModels: true,
        }, options);

        modelFiles.forEach(function (file) {
            if (file.isExternal() && !opts.includeExternalModels) {
                return;
            }
            let fileName;
            if (file.fileName === 'UNKNOWN' || file.fileName === null || !file.fileName) {
                fileName = file.namespace + '.cto';
            } else {
                let fileIdentifier = file.fileName;
                fileName = fsPath.basename(fileIdentifier);
            }
            models.push({ 'name' : fileName, 'content' : file.definitions });
        });
        return models;
    }

    /**
     * Check that the type is valid and returns the FQN of the type.
     * @param {string} context - error reporting context
     * @param {string} type - fully qualified type name
     * @return {string} - the resolved type name (fully qualified)
     * @throws {IllegalModelException} - if the type is not defined
     * @private
     */
    resolveType(context, type) {
        // is the type a primitive?
        if (ModelUtil.isPrimitiveType(type)) {
            return type;
        }

        let ns = ModelUtil.getNamespace(type);
        let modelFile = this.getModelFile(ns);
        if (!modelFile) {
            let formatter = Globalize.messageFormatter('modelmanager-resolvetype-nonsfortype');
            throw new IllegalModelException(formatter({
                type: type,
                context: context
            }));
        }

        if (modelFile.isLocalType(type)) {
            return type;
        }

        let formatter = Globalize.messageFormatter('modelmanager-resolvetype-notypeinnsforcontext');
        throw new IllegalModelException(formatter({
            context: context,
            type: type,
            namespace: modelFile.getNamespace()
        }));
    }

    /**
     * Remove all registered Concerto files
     */
    clearModelFiles() {
        this.modelFiles = {};
        this.addRootModel();
    }

    /**
     * Get the ModelFile associated with a namespace
     *
     * @param {string} namespace - the namespace containing the ModelFile
     * @return {ModelFile} registered ModelFile for the namespace or null
     */
    getModelFile(namespace) {
        return this.modelFiles[namespace];
    }

    /**
     * Get the ModelFile associated with a file name
     *
     * @param {string} fileName - the fileName associated with the ModelFile
     * @return {ModelFile} registered ModelFile for the namespace or null
     * @private
     */
    getModelFileByFileName(fileName) {
        return this.getModelFiles().filter(mf => mf.getName() === fileName)[0];
    }

    /**
     * Get the namespaces registered with the ModelManager.
     * @return {string[]} namespaces - the namespaces that have been registered.
     */
    getNamespaces() {
        return Object.keys(this.modelFiles);
    }

    /**
     * Look up a type in all registered namespaces.
     *
     * @param {string} qualifiedName - fully qualified type name.
     * @return {ClassDeclaration} - the class declaration for the specified type.
     * @throws {TypeNotFoundException} - if the type cannot be found or is a primitive type.
     */
    getType(qualifiedName) {

        const namespace = ModelUtil.getNamespace(qualifiedName);

        const modelFile = this.getModelFile(namespace);
        if (!modelFile) {
            const formatter = Globalize.messageFormatter('modelmanager-gettype-noregisteredns');
            throw new TypeNotFoundException(qualifiedName, formatter({
                type: qualifiedName
            }));
        }

        const classDecl = modelFile.getType(qualifiedName);
        if (!classDecl) {
            const formatter = Globalize.messageFormatter('modelmanager-gettype-notypeinns');
            throw new TypeNotFoundException(qualifiedName, formatter({
                type: ModelUtil.getShortName(qualifiedName),
                namespace: namespace
            }));
        }

        return classDecl;
    }

    /**
     * Get the AssetDeclarations defined in this model manager
     * @return {AssetDeclaration[]} the AssetDeclarations defined in the model manager
     */
    getAssetDeclarations() {
        return this.getModelFiles().reduce((prev, cur) => {
            return prev.concat(cur.getAssetDeclarations());
        }, []);
    }

    /**
     * Get the TransactionDeclarations defined in this model manager
     * @return {TransactionDeclaration[]} the TransactionDeclarations defined in the model manager
     */
    getTransactionDeclarations() {
        return this.getModelFiles().reduce((prev, cur) => {
            return prev.concat(cur.getTransactionDeclarations());
        }, []);
    }

    /**
     * Get the EventDeclarations defined in this model manager
     * @return {EventDeclaration[]} the EventDeclaration defined in the model manager
     */
    getEventDeclarations() {
        return this.getModelFiles().reduce((prev, cur) => {
            return prev.concat(cur.getEventDeclarations());
        }, []);
    }

    /**
     * Get the ParticipantDeclarations defined in this model manager
     * @return {ParticipantDeclaration[]} the ParticipantDeclaration defined in the model manager
     */
    getParticipantDeclarations() {
        return this.getModelFiles().reduce((prev, cur) => {
            return prev.concat(cur.getParticipantDeclarations());
        }, []);
    }

    /**
     * Get the MapDeclarations defined in this model manager
     * @return {MapDeclaration[]} the MapDeclaration defined in the model manager
     */
    getMapDeclarations() {
        return this.getModelFiles().reduce((prev, cur) => {
            return prev.concat(cur.getMapDeclarations());
        }, []);
    }

    /**
     * Get the EnumDeclarations defined in this model manager
     * @return {EnumDeclaration[]} the EnumDeclaration defined in the model manager
     */
    getEnumDeclarations() {
        return this.getModelFiles().reduce((prev, cur) => {
            return prev.concat(cur.getEnumDeclarations());
        }, []);
    }

    /**
     * Get the Concepts defined in this model manager
     * @return {ConceptDeclaration[]} the ConceptDeclaration defined in the model manager
     */
    getConceptDeclarations() {
        return this.getModelFiles().reduce((prev, cur) => {
            return prev.concat(cur.getConceptDeclarations());
        }, []);
    }

    /**
     * Get a factory for creating new instances of types defined in this model manager.
     * @return {Factory} A factory for creating new instances of types defined in this model manager.
     */
    getFactory() {
        return this.factory;
    }

    /**
     * Get a serializer for serializing instances of types defined in this model manager.
     * @return {Serializer} A serializer for serializing instances of types defined in this model manager.
     */
    getSerializer() {
        return this.serializer;
    }

    /**
     * Get the decorator factories for this model manager.
     * @return {DecoratorFactory[]} The decorator factories for this model manager.
     */
    getDecoratorFactories() {
        return this.decoratorFactories;
    }

    /**
     * Add a decorator factory to this model manager.
     * @param {DecoratorFactory} factory The decorator factory to add to this model manager.
     */
    addDecoratorFactory(factory) {
        this.decoratorFactories.push(factory);
    }

    /**
     * Checks if this fully qualified type name is derived from another.
     * @param {string} fqt1 The fully qualified type name to check.
     * @param {string} fqt2 The fully qualified type name it is may be derived from.
     * @returns {boolean} True if this instance is an instance of the specified fully
     * qualified type name, false otherwise.
     */
    derivesFrom(fqt1, fqt2) {
        // Check to see if this is an exact instance of the specified type.
        let typeDeclaration = this.getType(fqt1);
        while (typeDeclaration) {
            if (typeDeclaration.getFullyQualifiedName() === fqt2) {
                return true;
            }
            typeDeclaration = typeDeclaration.getSuperTypeDeclaration();
        }
        return false;
    }

    /**
     * Resolve the namespace for names in the metamodel
     * @param {object} metaModel - the MetaModel
     * @return {object} the resolved metamodel
     */
    resolveMetaModel(metaModel) {
        const priorModels = this.getAst();
        return MetaModelUtil.resolveLocalNames(priorModels, metaModel);
    }

    /**
     * Populates the model manager from a models metamodel AST
     * @param {*} ast the metamodel
     */
    fromAst(ast) {
        this.clearModelFiles();
        ast.models.forEach( model => {
            const modelFile = new ModelFile( this, model );
            this.addModelFile( modelFile, null, null, true );
        });
        this.validateModelFiles();
    }

    /**
     * Get the full ast (metamodel instances) for a modelmanager
     * @param {boolean} [resolve] - whether to resolve names
     * @returns {*} the metamodel
     */
    getAst(resolve) {
        const result = {
            $class: `${MetaModelNamespace}.Models`,
            models: [],
        };
        const modelFiles = this.getModelFiles();
        modelFiles.forEach((thisModelFile) => {
            let metaModel = thisModelFile.getAst();
            if (resolve) {
                metaModel = this.resolveMetaModel(metaModel);
            }
            result.models.push(metaModel);
        });
        return result;
    }


    /**
     * A function type definition for use as an argument to the filter function
     * @callback FilterFunction
     * @param {Declaration} declaration
     * @returns {boolean} true, if the declaration satisfies the filter function
     */

    /**
     * Returns a new ModelManager with only the types for which the
     * filter function returns true.
     *
     * ModelFiles with no declarations after filtering will be removed.
     *
     * @param {FilterFunction} predicate - the filter function over a Declaration object
     * @returns {BaseModelManager} - the filtered ModelManager
     */
    filter(predicate){
        const modelManager = new BaseModelManager({...this.options}, this.processFile);
        const removedFqns = []; // the list of FQN of types that have been removed

        // remove the types from model files, populating removedFqns
        let filteredModels = Object.values(this.modelFiles)
            .map((modelFile) => modelFile.filter(predicate, modelManager, removedFqns))
            .filter(Boolean);

        // remove concerto model files - as these are automatically added
        // when we recreate the model manager below
        filteredModels = filteredModels.filter(mf => !mf.isSystemModelFile());

        // now update filteredModels to remove any imports of removed types
        const modelsWithValidImports = filteredModels.map( modelFile => {
            const ast = modelFile.getAst();
            let modified = false;
            removedFqns.forEach( removedFqn => {
                const ns = ModelUtil.getNamespace(removedFqn);
                const isSystemImport = ns.startsWith('concerto@') || ns === 'concerto';
                if(!isSystemImport && modelFile.getImports().includes(removedFqn)) {
                    const removeName = ModelUtil.getShortName(removedFqn);
                    const removeNamespace = ModelUtil.getNamespace(removedFqn);
                    ast.imports = ast.imports.filter(imp => {
                        const remove = ModelUtil.getShortName(imp.$class) === 'ImportType' &&
                            imp.name === removeName &&
                            imp.namespace === removeNamespace;
                        if(remove) {
                            modified = true;
                        }
                        return !remove;
                    });
                    ast.imports.forEach( imp => {
                        if(imp.namespace === removeNamespace) {
                            if(ModelUtil.getShortName(imp.$class) === 'ImportTypes') {
                                imp.types = imp.types.filter((type) => {
                                    const remove = (type === removeName);
                                    if(remove) {
                                        modified = true;
                                    }
                                    return !remove;
                                });
                            }
                        }
                    });
                }
            });
            if(modified) {
                return new ModelFile(this, ast, undefined, modelFile.fileName);
            }
            else {
                return modelFile;
            }
        });
        modelManager.addModelFiles(modelsWithValidImports);
        return modelManager;
    }
}

module.exports = BaseModelManager;
