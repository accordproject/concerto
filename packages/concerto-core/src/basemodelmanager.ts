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

import { DefaultFileLoader, FileDownloader, ModelWriter } from '@accordproject/concerto-util';
import type { WritableModelFile } from '@accordproject/concerto-util';
import { MetaModelUtil, MetaModelNamespace } from '@accordproject/concerto-metamodel';
import type { IModel, IModels } from '@accordproject/concerto-metamodel';

import Factory from './factory';
import ModelFile from './introspect/modelfile';
import ModelUtil from './modelutil';
import Serializer from './serializer';
import rootModelModule, { getRootModel as fixedGetRootModel } from './rootmodelhelper';
import decoratorModelModule, { getDecoratorModel as fixedGetDecoratorModel } from './decoratormodelhelper';
import type { ModelFileSource, ModelManagerOptions, ValidateInstanceOptions, ValidationResult } from './types';
import type Resource from './model/resource';
import type { AstNode } from './introspect/decorated';
type ModelFileInstance = InstanceType<typeof ModelFile>;
type ModelFileInput = string | ModelFileInstance;

function getFileNameFromIdentifier(fileIdentifier) {
    const normalizedIdentifier = fileIdentifier.replace(/[\\/]+$/, '');
    return normalizedIdentifier.split(/[\\/]/).pop() || fileIdentifier;
}

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type Declaration from './introspect/declaration';
import type AssetDeclaration from './introspect/assetdeclaration';
import type ClassDeclaration from './introspect/classdeclaration';
import type MapDeclaration from './introspect/mapdeclaration';
import type ConceptDeclaration from './introspect/conceptdeclaration';
import type DecoratorFactory from './introspect/decoratorfactory';
import type EnumDeclaration from './introspect/enumdeclaration';
import type EventDeclaration from './introspect/eventdeclaration';
import type ParticipantDeclaration from './introspect/participantdeclaration';
import type TransactionDeclaration from './introspect/transactiondeclaration';
/* eslint-enable no-unused-vars */

import debugLib from 'debug';
const debug = debugLib('concerto:BaseModelManager');
import { rust, engineHandles, engineValidateInstance, engineViews } from './engineloader';
import { optionalString } from './engineutil';
import type { EngineHandle, EngineState } from './engine/bindings';

/**
 * A new manager's engine state: model version 0, nothing cached.
 * @return {EngineState} the record
 * @private
 */
function newEngineState(): EngineState {
    return {
        version: 0,
        readMemo: undefined,
        namespaces: undefined,
        serializerCache: undefined,
        propertySlots: undefined,
    };
}

/**
 * The read memo, started afresh when the model version has moved.
 * @param {object} state - the manager's engine state
 * @return {object} its current memo
 * @private
 */
function managerReadMemo(state: EngineState): NonNullable<EngineState['readMemo']> {
    let memo = state.readMemo;
    if (memo === undefined || memo.version !== state.version) {
        memo = state.readMemo = {
            version: state.version,
            typeNames: new Map(),
            resolvedTypes: new Map(),
            fileTypeNames: new Map(),
            fileFullyQualifiedTypeNames: new Map(),
        };
    }
    return memo;
}

/**
 * The cached namespace list, if any and not mid-batch.
 * @param {object} manager - the BaseModelManager
 * @return {string[]|undefined} its list
 * @private
 */
function namespaceListOf(manager: { _engine: EngineState; _mirrorPending: boolean }): string[] | undefined {
    return manager._mirrorPending ? undefined : manager._engine.namespaces;
}

/**
 * Appends a new namespace to the cached list (dropped mid-batch).
 * @param {object} manager - the BaseModelManager
 * @param {string} namespace - the namespace added
 * @private
 */
function noteNamespaceAdded(manager: { _engine: EngineState; _mirrorPending: boolean }, namespace: string): void {
    const list = namespaceListOf(manager);
    if (list) {
        list.push(namespace);
    } else {
        manager._engine.namespaces = undefined;
    }
}

/**
 * Removes a deleted namespace from the cached list.
 * @param {object} manager - the BaseModelManager
 * @param {string} namespace - the namespace (key) removed
 * @private
 */
function noteNamespaceRemoved(manager: { _engine: EngineState; _mirrorPending: boolean }, namespace: string): void {
    const list = namespaceListOf(manager);
    const at = list?.indexOf(namespace) ?? -1;
    if (at < 0) {
        manager._engine.namespaces = undefined;
    } else {
        list!.splice(at, 1);
    }
}

// How to create a modelfile from the external content
const defaultProcessFile = (name: string | null, data: unknown): ModelFileSource => {
    return {
        ast: data, // AST is input
        definitions: null, // No CTO file
        fileName: name ?? 'UNKNOWN',
    };
};

// default decorator validation configuration
const DEFAULT_DECORATOR_VALIDATION = {
    missingDecorator: undefined, // 'error' | 'warn' (see Logger.levels)...,
    invalidDecorator: undefined, // 'error' | 'warn' ...
};

/**
 * Internal namespaces: excluded by default by getModelFiles, ignored by fromAst.
 * @private
 * @internal
 */
export const EXCLUDE_NS: readonly string[] = ['concerto@1.0.0', 'concerto', 'concerto.decorator@1.0.0'];

// BC-28: the `regExp` option is ignored, with one warning per process.
let regExpOptionWarned = false;

/**
 * Warns, once per process, that the `regExp` option is ignored.
 * @private
 */
function warnRegExpOptionIgnored() {
    if (regExpOptionWarned) {
        return;
    }
    regExpOptionWarned = true;
    /* istanbul ignore else: process.emitWarning is Node's */
    if (typeof process !== 'undefined' && typeof process.emitWarning === 'function') {
        process.emitWarning(
            'The ModelManager regExp option is ignored: regular expressions are evaluated by the Concerto engine (ECMAScript syntax and semantics)',
            { type: 'Warning', code: 'concerto-regexp-option' }
        );
    }
}

// The system namespaces a new rustHandle loads itself.
const RUST_PRELOADED_NS = ['concerto.decorator@1.0.0', 'concerto@1.0.0'];

/**
 * Makes `metamodelModelFile` build on first read (BC-55: an invalid
 * metamodel AST throws there, not in the constructor).
 * @param {BaseModelManager} manager the manager
 * @private
 */
function installLazyMetamodelCopy(manager: BaseModelManager): void {
    const define = (value: ModelFileInstance) => {
        Object.defineProperty(manager, 'metamodelModelFile', { value, writable: true, enumerable: true, configurable: true });
    };
    Object.defineProperty(manager, 'metamodelModelFile', {
        configurable: true,
        enumerable: true,
        get() {
            let copy: ModelFileInstance;
            const factories = manager.decoratorFactories;
            manager.decoratorFactories = [];
            manager._buildingMetamodelCopy = true;
            try {
                copy = new ModelFile(manager, MetaModelUtil.metaModelAst as AstNode, undefined, MetaModelNamespace) as ModelFileInstance;
            } finally {
                manager._buildingMetamodelCopy = false;
                manager.decoratorFactories = factories;
            }
            define(copy);
            return copy;
        },
        set(value) {
            define(value);
        },
    });
}

/**
 * Makes `modelFile` the plain value of `modelFiles[namespace]`, in place of
 * a fork's lazy view accessor.
 * @param {object} modelFiles a manager's `modelFiles`
 * @param {string} namespace the namespace
 * @param {ModelFile} modelFile its model file
 * @private
 */
function ownModelFile(modelFiles: Record<string, ModelFileInstance>, namespace: string, modelFile: ModelFileInstance): void {
    Object.defineProperty(modelFiles, namespace, { value: modelFile, writable: true, enumerable: true, configurable: true });
}

/**
 * A type name for a `&str` binding; a non-string throws as TS did.
 * @param {*} name the type name argument
 * @return {string} the name as a string
 * @private
 */
function typeNameArgument(name: unknown): string {
    if (typeof name === 'string') {
        return name;
    }
    ModelUtil.getNamespace(name);
    return String(name);
}

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
    /** The model files by namespace; read-only (BC-48). @internal */
     modelFiles: Record<string, ModelFileInstance>;
     processFile: (fileName: string | null, modelInput: string | unknown) => ModelFileSource;
     factory: Factory;
     serializer: Serializer;
     decoratorFactories: DecoratorFactory[];
     options: ModelManagerOptions | undefined;
     decoratorValidation: NonNullable<ModelManagerOptions['decoratorValidation']>;
     metamodelModelFile!: ModelFileInstance;
    /** The engine handle mirroring `modelFiles`. @internal */
     rustHandle: EngineHandle;
    /** True while `metamodelModelFile` is built: that copy is never mirrored. @internal */
     _buildingMetamodelCopy?: boolean;
    /** True while `addModelFiles` has `modelFiles` ahead of `rustHandle`. @internal */
     _mirrorPending: boolean;
    /** Engine file handles by namespace; cleared when the arena is rebuilt. @internal */
     _modelFileIds: Map<string, number>;
    /** Preloaded system namespaces not yet in `modelFiles`. @internal */
     _rustPreloaded: Set<string>;
    /** The model version, which keys every cached answer, and the caches. @internal */
     _engine: EngineState;
    /**
     * Create the ModelManager.
     * @constructor
     * @param {object} [options] - ModelManager options, also passed to Serializer
     * @param {Object} [options.regExp] - Deprecated and ignored, with a warning: regular expressions are evaluated by the Concerto engine.
     * @param {boolean} [options.metamodelValidation] - Unless false, every ModelFile built for this
     * manager has its AST checked against the Concerto metamodel when it is constructed (at model
     * load: fromAst, addModel, addCTOModel, addModelFiles, updateModelFile), and a malformed AST is an
     * IllegalModelException (BC-19, on by default). When true, addModelFile also runs
     * validateAst on each new file. false is an escape hatch for trusted input only: the
     * shape check is skipped, and code downstream of the load may assume a well-formed AST. A
     * malformed AST still throws an error when it is loaded, never a WASM trap or a process crash,
     * unless the loader can read it all the same (a node's $class naming the wrong type, say); the
     * error's class and message are unspecified.
     * @param {boolean} [options.addMetamodel] - When true, the Concerto metamodel is added to the model manager
    * @param {boolean} [options.dangerouslyAllowReservedSystemTypeNamesInUserModels] - Transitional escape hatch; when true, declarations may use reserved system type names
     * @param {object} [options.decoratorValidation] - the decorator validation configuration
     * @param {string} [options.decoratorValidation.missingDecorator] - the validation log level for missingDecorator decorators: off, warning, error
     * @param {string} [options.decoratorValidation.invalidDecorator] - the validation log level for invalidDecorator decorators: off, warning, error
     * @param {*} [processFile] - how to obtain a concerto AST from an input to the model manager
    */
    constructor(options?: ModelManagerOptions, processFile?: (fileName: string | null, modelInput: string | unknown) => ModelFileSource) {
        // BC-47: a ModelFile may be built only for a constructed manager.
        ModelFile._registerManager(this);
        this._engine = newEngineState();
        this.processFile = processFile ? processFile : defaultProcessFile;
        this.modelFiles = {};
        this.factory = new Factory(this);
        this.serializer = new Serializer(this.factory, this, options);
        this.decoratorFactories = [];
        this.options = options;
        if (options?.regExp) {
            warnRegExpOptionIgnored();
        }
        this.decoratorValidation = options?.decoratorValidation ? options?.decoratorValidation : DEFAULT_DECORATOR_VALIDATION;
        this._mirrorPending = false;
        this._modelFileIds = new Map();
        this._rustPreloaded = new Set(RUST_PRELOADED_NS);
        this.rustHandle = this._newRustHandle();
        this._engine.namespaces = [];
        this.addDecoratorModel();
        this.addRootModel();

        // A copy of the Metamodel ModelFile, built on first read.
        this._buildingMetamodelCopy = false;
        installLazyMetamodelCopy(this);

        if(options?.addMetamodel) {
            // Registered, so built as any added file is (staged, unlike the
            // lazy copy): the add validates and writes it in one engine call.
            const copy = new ModelFile(this, MetaModelUtil.metaModelAst as AstNode, undefined, MetaModelNamespace) as ModelFileInstance;
            this.metamodelModelFile = copy;
            this.addModelFile(copy);
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
        const getRootModel = rootModelModule.getRootModel || rootModelModule;

        if (typeof getRootModel !== 'function') {
            throw new Error(`Failed to load getRootModel. Got: ${typeof getRootModel}. Module keys: ${Object.keys(rootModelModule)}`);
        }

        const {rootModelAst, rootModelCto, rootModelFile} = getRootModel();
        engineViews().markSystemModelAst(rootModelAst);
        if (getRootModel === fixedGetRootModel && this._adoptPreloadedModel(rootModelAst, rootModelCto, rootModelFile)) {
            return;
        }
        const m = new ModelFile(this, rootModelAst, rootModelCto, rootModelFile);

        this.addModelFile(m, rootModelCto, rootModelFile, true);
    }

    /**
     * Checks if the import aliasing feature is enabled.
     * @returns {boolean} true
     */
    isAliasedTypeEnabled() {
        return true;
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
    validateModelFile(modelFile, fileName?) {
        if (typeof modelFile === 'string') {
            const { ast } = this.processFile(fileName, modelFile);
            let m = new ModelFile(this, ast as AstNode, modelFile, fileName);
            m.validate();
        } else {
            modelFile.validate();
        }
    }

    /**
     * Adds decorator types
     * @private
     */
    addDecoratorModel() {
        const getDecoratorModel = decoratorModelModule.getDecoratorModel || decoratorModelModule;

        if (typeof getDecoratorModel !== 'function') {
             throw new Error(`Failed to load getDecoratorModel. Got: ${typeof getDecoratorModel}`);
        }
        const {decoratorModelAst, decoratorModelCto, decoratorModelFile} = getDecoratorModel();

        engineViews().markSystemModelAst(decoratorModelAst);
        if (getDecoratorModel === fixedGetDecoratorModel &&
            this._adoptPreloadedModel(decoratorModelAst, decoratorModelCto, decoratorModelFile)) {
            return;
        }
        const m = new ModelFile(this, decoratorModelAst, decoratorModelCto, decoratorModelFile);

        this.addModelFile(m, decoratorModelCto, decoratorModelFile, true);
    }

    /**
     * Registers a system model as a view of rustHandle's preloaded copy.
     * False when not preloaded or `addModelFile` is overridden.
     * @param {object} ast the fixed system model's AST
     * @param {string} cto the model's CTO text
     * @param {string} fileName the model's file name
     * @return {boolean} true if the model was registered
     * @private
     * @internal
     */
    _adoptPreloadedModel(ast: AstNode, cto: string, fileName: string): boolean {
        const namespace = ast.namespace as string;
        if (!this._rustPreloaded.has(namespace) || this.addModelFile !== BaseModelManager.prototype.addModelFile) {
            return false;
        }
        const m = ModelFile._systemView(this, ast, cto, fileName) as ModelFileInstance | undefined;
        /* istanbul ignore if: the engine answers for the fixed system models' text */
        if (m === undefined) {
            return false;
        }
        this.modelFiles[namespace] = m;
        this._rustPreloaded.delete(namespace);
        noteNamespaceAdded(this, namespace);
        this._engine.version++;
        return true;
    }

    /**
     * Whether a namespace needs writing to `rustHandle`.
     * @param {string} namespace - the namespace being added, updated or removed
     * @return {boolean} true if `namespace` needs writing to `rustHandle`
     * @private
     * @internal
     */
    _needsRustWrite(namespace) {
        if (this._rustPreloaded.has(namespace)) {
            return false;
        }
        return !(namespace === MetaModelNamespace && this._buildingMetamodelCopy);
    }

    /**
     * BC-46: a `TypeError` unless the ModelFile constructor built `modelFile`.
     * @param {*} modelFile - the argument
     * @param {string} method - the method it was passed to
     * @private
     * @internal
     */
    _checkModelFile(modelFile: unknown, method: string) {
        if (!ModelFile._isConstructed(modelFile)) {
            throw new TypeError(`${method} expects a ModelFile built by the ModelFile constructor`);
        }
    }

    /**
     * Writes an added model file to rustHandle and caches its handle.
     * @param {ModelFile} modelFile - the model file being added
     * @return {boolean} true if the namespace was written to rustHandle
     * @private
     * @internal
     */
    _rustMirrorAdd(modelFile) {
        const namespace = modelFile.getNamespace();
        if (!this._needsRustWrite(namespace)) {
            engineViews().dropStaged(modelFile, this.rustHandle);
            this._rustPreloaded.delete(namespace);
            return false;
        }
        let id = engineViews().commitStaged(modelFile, this.rustHandle);
        if (id === undefined) {
            id = this.rustHandle.addModelWithDefinitions(
                JSON.stringify(modelFile.getAst()),
                optionalString(modelFile.getDefinitions()),
                optionalString(modelFile.getName()),
                false,
            );
        }
        this._modelFileIds.set(namespace, id as number);
        return true;
    }

    /**
     * `_rustMirrorAdd` for each file, in one engine call when all are staged.
     * @param {ModelFile[]} modelFiles - the model files being added
     * @param {Set<string>} mirrored - the namespaces written, filled in
     * @private
     * @internal
     */
    _rustMirrorAddAll(modelFiles: ModelFileInstance[], mirrored: Set<string>) {
        const handle = this.rustHandle;
        if (modelFiles.every((m) => this._needsRustWrite(m.getNamespace()))) {
            const ids = engineViews().commitStagedAll(modelFiles, handle);
            if (ids !== undefined) {
                modelFiles.forEach((m, i) => {
                    this._modelFileIds.set(m.getNamespace(), ids[i]);
                    mirrored.add(m.getNamespace());
                });
                return;
            }
        }
        modelFiles.forEach((m) => {
            if (this._rustMirrorAdd(m)) {
                mirrored.add(m.getNamespace());
            }
        });
    }

    /**
     * `addModelFile(m, null, null, true)` per file, in one engine call if possible.
     * @param {ModelFile[]} modelFiles - the model files being added
     * @private
     * @internal
     */
    _addStagedModelFiles(modelFiles: ModelFileInstance[]) {
        const ids = engineViews().commitStagedAll(modelFiles, this.rustHandle);
        if (ids === undefined) {
            modelFiles.forEach((m) => this.addModelFile(m, null, null, true));
            return;
        }
        modelFiles.forEach((m, i) => this._registerAdded(m, ids![i]));
    }

    /**
     * Registers a file already written to rustHandle.
     * @param {ModelFile} modelFile - the model file added
     * @param {number} id - its rustHandle handle
     * @private
     * @internal
     */
    _registerAdded(modelFile: ModelFileInstance, id: number) {
        const namespace = modelFile.getNamespace();
        this._modelFileIds.set(namespace, id);
        this.modelFiles[namespace] = modelFile;
        noteNamespaceAdded(this, namespace);
        this._engine.version++;
    }

    /**
     * Validates and writes a staged file in one engine call, else false.
     * @param {ModelFile} modelFile - the model file being added
     * @param {boolean} [metamodel] - whether to run the metamodel check too
     * @return {boolean} true if the file was validated and written
     * @private
     * @internal
     */
    _rustValidateAndMirrorAdd(modelFile, metamodel?: boolean) {
        const namespace = modelFile.getNamespace();
        if (modelFile.validate !== ModelFile.prototype.validate || !this._needsRustWrite(namespace)) {
            return false;
        }
        let id;
        if (metamodel) {
            const alreadyHasMetamodel = !!this.getModelFile(MetaModelNamespace);
            try {
                id = engineViews().validateAndCommitStaged(modelFile, this.rustHandle, true);
            } catch (err) {
                this._mirrorMetamodelLeak(alreadyHasMetamodel);
                throw err;
            }
        } else {
            id = engineViews().validateAndCommitStaged(modelFile, this.rustHandle);
        }
        if (id === undefined) {
            return false;
        }
        this._modelFileIds.set(namespace, id);
        return true;
    }

    /**
     * Writes a replacing model file to rustHandle.
     * @param {ModelFile} modelFile - the model file replacing the registered one
     * @private
     * @internal
     */
    _rustMirrorUpdate(modelFile) {
        const namespace = modelFile.getNamespace();
        const staged = engineViews().updateStaged(modelFile, this.rustHandle);
        if (staged !== undefined) {
            this._modelFileIds.clear();
            this._modelFileIds.set(namespace, staged);
            return;
        }
        engineViews().dropStaged(modelFile, this.rustHandle);
        const id = this.rustHandle.updateModelFile(
            JSON.stringify(modelFile.getAst()),
            optionalString(modelFile.getDefinitions()),
            optionalString(modelFile.getName()),
            false,
        );
        this._modelFileIds.clear();
        this._modelFileIds.set(namespace, id);
    }

    /**
     * Whether `rustHandle` mirrors `modelFiles`: true except mid-batch.
     * @return {boolean} true if rustHandle mirrors the namespaces TS has
     * @private
     * @internal
     */
    _rustHandleMatchesModelFiles() {
        return !this._mirrorPending;
    }

    /**
     * `rustHandle.modelFileGetTypeName`, memoised until the next model change.
     * @param {string} namespace - the model file's namespace
     * @param {number} id - its rustHandle model file handle
     * @param {string} type - the type name, as `ModelFile.getType` takes it
     * @return {string|undefined} the engine's answer
     * @private
     * @internal
     */
    _modelFileTypeName(namespace: string, id: number, type: string): string | undefined {
        const memo = managerReadMemo(this._engine);
        let byType = memo.fileTypeNames.get(namespace);
        if (byType === undefined) {
            byType = new Map();
            memo.fileTypeNames.set(namespace, byType);
        }
        if (byType.has(type)) {
            return byType.get(type);
        }
        const name: string | undefined = this.rustHandle.modelFileGetTypeName(id, type);
        if (memo.version === this._engine.version) {
            byType.set(type, name);
        }
        return name;
    }

    /**
     * `rustHandle.modelFileGetFullyQualifiedTypeName`, memoised until the next
     * model change: the answer depends only on the file's imports and
     * declarations.
     * @param {string} namespace - the model file's namespace
     * @param {number} id - its rustHandle model file handle
     * @param {string} type - the type name, as `ModelFile.getFullyQualifiedTypeName` takes it
     * @return {string|undefined} the engine's answer
     * @private
     * @internal
     */
    _modelFileFullyQualifiedTypeName(namespace: string, id: number, type: string): string | undefined {
        const memo = managerReadMemo(this._engine);
        let byType = memo.fileFullyQualifiedTypeNames.get(namespace);
        if (byType === undefined) {
            byType = new Map();
            memo.fileFullyQualifiedTypeNames.set(namespace, byType);
        }
        if (byType.has(type)) {
            return byType.get(type);
        }
        const name: string | undefined = this.rustHandle.modelFileGetFullyQualifiedTypeName(id, type);
        if (memo.version === this._engine.version) {
            byType.set(type, name);
        }
        return name;
    }

    /**
     * The engine handle of the model file for `namespace`, cached.
     * @param {string} namespace - the namespace to look up
     * @return {number|undefined} its model file handle, or undefined
     * @private
     * @internal
     */
    _rustModelFileId(namespace: string): number | undefined {
        let id = this._modelFileIds.get(namespace);
        if (id === undefined) {
            id = this.rustHandle.modelFileId(namespace);
            if (id !== undefined) {
                this._modelFileIds.set(namespace, id);
            }
        }
        return id;
    }

    /**
     * Throws an error with details about the existing namespace.
     * @param {ModelFile} modelFile The model file that is trying to declare an existing namespace
     * @private
     */
    _throwAlreadyExists(modelFile) {
        const namespace = modelFile.getNamespace();
        const fileName = modelFile.getName();
        if (!this._mirrorPending && typeof namespace === 'string' &&
            (typeof fileName === 'string' || fileName === undefined || fileName === null)) {
            this.rustHandle.throwAlreadyExists(namespace, fileName ?? undefined);
        }
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
        addModelFile(modelFile: ModelFileInstance, cto?: string | null, fileName?: string | null, disableValidation?: boolean) {
            const NAME = 'addModelFile';
        debug(NAME, 'addModelFile', modelFile, fileName);
        this._checkModelFile(modelFile, 'addModelFile');

        if(!modelFile.getVersion()) {
            throw new Error(`Cannot add an unversioned namespace: ${modelFile.getNamespace()}`);
        }

        if (!this.modelFiles[modelFile.getNamespace()]) {
            // Mirrored first, so an error leaves both unchanged.
            let mirrored = false;
            if (!disableValidation) {
                const metamodel = !!this.options?.metamodelValidation;
                mirrored = this._rustValidateAndMirrorAdd(modelFile, metamodel);
                if (!mirrored) {
                    if (metamodel) {
                        this.validateAst(modelFile);
                    }
                    modelFile.validate();
                }
            }
            if (!mirrored) {
                this._rustMirrorAdd(modelFile);
            }
            this.modelFiles[modelFile.getNamespace()] = modelFile;
            noteNamespaceAdded(this, modelFile.getNamespace());
            this._engine.version++;
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
        // Checks the AST alone, so a malformed AST is a MetamodelException.
        const alreadyHasMetamodel = !!this.getModelFile(MetaModelNamespace);
        try {
            if (!engineViews().validateAstStaged(modelFile, this.rustHandle)) {
                this.rustHandle.validateAstValue(JSON.stringify(modelFile.getAst()));
            }
        } catch (err) {
            this._mirrorMetamodelLeak(alreadyHasMetamodel);
            throw err;
        }
    }

    /**
     * After a failed metamodel check, mirrors the engine's metamodel registration.
     * @param {boolean} alreadyHasMetamodel - whether the manager held the
     * metamodel before the check
     * @private
     * @internal
     */
    _mirrorMetamodelLeak(alreadyHasMetamodel: boolean) {
        if (!alreadyHasMetamodel && this.rustHandle.modelFileId(MetaModelNamespace) !== undefined) {
            this.modelFiles[MetaModelNamespace] = this.metamodelModelFile;
            noteNamespaceAdded(this, MetaModelNamespace);
            this._engine.version++;
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
    addModel(modelInput, cto?, fileName?, disableValidation?) {
        const NAME = 'addModel';
        debug(NAME, 'addModel', modelInput, fileName);

        const { ast, definitions } = this.processFile(fileName, modelInput);
        const finalCto = cto || definitions;
        const m = new ModelFile(this, ast as AstNode, finalCto, fileName);

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
    updateModelFile(modelFile, fileName?, disableValidation?) {
        const NAME = 'updateModelFile';
        debug(NAME, 'updateModelFile', modelFile, fileName);
        if (typeof modelFile === 'string') {
            const { ast } = this.processFile(fileName, modelFile);
            let m = new ModelFile(this, ast as AstNode, modelFile, fileName);
            return this.updateModelFile(m,fileName,disableValidation);
        }
        this._checkModelFile(modelFile, 'updateModelFile');
        const existing = this.modelFiles[modelFile.getNamespace()];
        if (!existing) {
            throw new Error(`Model file for namespace ${modelFile.getNamespace()} not found`);
        }
        if (!modelFile.getVersion()) {
            throw new Error(`Cannot update with an unversioned namespace: ${modelFile.getNamespace()}`);
        }
        // A staged file is validated and written in one engine call.
        const namespace = modelFile.getNamespace();
        if (!disableValidation && modelFile.validate === ModelFile.prototype.validate) {
            const id = engineViews().validateAndUpdateStaged(modelFile, this.rustHandle);
            if (id !== undefined) {
                this._modelFileIds.clear();
                this._modelFileIds.set(namespace, id);
                this.modelFiles[namespace] = modelFile;
                this._engine.version++;
                return modelFile;
            }
        }
        if (!disableValidation) {
            modelFile.validate();
        }
        // Mirrored first, so a mirror error leaves both unchanged.
        this._rustMirrorUpdate(modelFile);
        this.modelFiles[modelFile.getNamespace()] = modelFile;
        this._engine.version++;
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
            // Mirrored first. A non-string is sent as its string form.
            this.rustHandle.deleteModelFile(typeof namespace === 'string' ? namespace : String(namespace));
            this._modelFileIds.clear();
            delete this.modelFiles[namespace];
            noteNamespaceRemoved(this, String(namespace));
            this._engine.version++;
        }
    }

    /**
     * Add a set of Concerto files to the model manager.
     * @param {string[]|ModelFile[]} modelFiles - An array of models as strings or ModelFile objects.
     * @param {string[]} [fileNames] - A array of file names to associate with the model files
     * @param {boolean} [disableValidation] - If true then the model files are not validated
     * @returns {Object[]} The newly added model files (internal).
     */
    addModelFiles(modelFiles: ModelFileInput[], fileNames?: string[] | null, disableValidation?: boolean) {
        const NAME = 'addModelFiles';
        debug(NAME, 'addModelFiles', modelFiles, fileNames);
        const originalModelFiles = {};
        Object.assign(originalModelFiles, this.modelFiles);
        let newModelFiles: ModelFileInstance[] = [];
        const mirroredNamespaces = new Set<string>();
        const namespaces = namespaceListOf(this);

        try {
            this._mirrorPending = true;
            // create the model files
            for (let n = 0; n < modelFiles.length; n++) {
                const modelFile = modelFiles[n];
                let fileName: string | null = null;

                if (fileNames) {
                    fileName = fileNames[n];
                }

                let m: ModelFileInstance;
                if (typeof modelFile === 'string') {
                    const { ast } = this.processFile(fileName, modelFile);
                    m = new ModelFile(this, ast as AstNode, modelFile, fileName);
                } else {
                    this._checkModelFile(modelFile, 'addModelFiles');
                    m = modelFile;
                }
                if (!m.getVersion()) {
                    throw new Error(`Cannot add an unversioned namespace: ${m.getNamespace()}`);
                }
                if (!this.modelFiles[m.getNamespace()]) {
                    this.modelFiles[m.getNamespace()] = m;
                    this._engine.version++;
                    newModelFiles.push(m);
                } else {
                    this._throwAlreadyExists(m);
                }
            }

            // Mirror all before validating: files may import one another.
            this._rustMirrorAddAll(newModelFiles, mirroredNamespaces);
            this._mirrorPending = false;

            // re-validate all the model files
            if (!disableValidation) {
                this.validateModelFiles();
            }

            if (namespaces && namespaceListOf(this) === namespaces) {
                newModelFiles.forEach((m) => namespaces.push(m.getNamespace()));
            }

            // return the model files.
            return newModelFiles;
        } catch (err) {
            this.modelFiles = {};
            Object.assign(this.modelFiles, originalModelFiles);
            this._engine.version++;
            // Undo only this batch's mirror writes.
            newModelFiles.forEach((m) => {
                if (!mirroredNamespaces.has(m.getNamespace())) {
                    return;
                }
                this.rustHandle.deleteModelFile(m.getNamespace());
                this._modelFileIds.clear();
            });
            this._engine.namespaces = namespaces;
            throw err;
        } finally {
            this._mirrorPending = false;
            debug(NAME, newModelFiles);
        }
    }

    /**
     * Validates all models files in this model manager
     */
    validateModelFiles() {
        this.rustHandle.validateModelFiles(this.modelFiles);
    }

    /**
     * Downloads all ModelFiles that are external dependencies and adds or
     * updates them in this ModelManager.
     * @param {Object} [options] - Options object passed to ModelFileLoaders
     * @param {FileDownloader} [fileDownloader] - an optional FileDownloader
     * @throws {IllegalModelException} if the models fail validation
     * @return {Promise} a promise when the download and update operation is completed.
     */
    async updateExternalModels(options?: RequestInit, fileDownloader?: { downloadExternalDependencies(files: ModelFileInstance[], options?: RequestInit): Promise<ModelFileSource[]> }) {
        const NAME = 'updateExternalModels';
        debug(NAME, 'updateExternalModels', options);

        const downloader = fileDownloader ?? new FileDownloader<ModelFileSource, ModelFileInstance>(
            new DefaultFileLoader(this.processFile),
            (file) => MetaModelUtil.getExternalImports(file.ast) as Record<string, string>
        );

        const originalModelFiles = {};
        Object.assign(originalModelFiles, this.modelFiles);

        try {
            const externalModels = await downloader.downloadExternalDependencies(this.getModelFiles(), options);

            // Every view is built first, so a rejected file changes nothing.
            const views: ModelFileInstance[] = externalModels.map((file) =>
                new ModelFile(this, file.ast as AstNode, file.definitions, file.fileName));

            // One engine call that changes nothing on failure.
            try {
                const next: Record<string, ModelFileInstance> = Object.assign({}, this.modelFiles);
                views.forEach((mf) => {
                    next[mf.getNamespace()] = mf;
                });
                if (!engineViews().updateExternalStaged(views, this.rustHandle, next)) {
                    const sources = views.map((mf) => ({
                        ast: mf.getAst(),
                        definitions: optionalString(mf.getDefinitions()),
                        fileName: optionalString(mf.getName()),
                    }));
                    this.rustHandle.updateExternalModels(JSON.stringify(sources), next);
                }
            } finally {
                views.forEach((mf) => engineViews().dropStaged(mf, this.rustHandle));
                this._modelFileIds.clear();
            }
            views.forEach((mf) => {
                const isNew = !Object.prototype.hasOwnProperty.call(this.modelFiles, mf.getNamespace());
                this.modelFiles[mf.getNamespace()] = mf;
                if (isNew) {
                    noteNamespaceAdded(this, mf.getNamespace());
                }
            });
            this._engine.version++;
            return views;
        } catch (err) {
            // Restore original files
            this.modelFiles = {};
            Object.assign(this.modelFiles, originalModelFiles);
            this._engine.namespaces = undefined;
            this._engine.version++;
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
        // A ModelFile is only writable if it knows its own file name and carries its CTO
        // source: one built from an AST alone has neither. Narrowing here rather than casting
        // keeps WritableModelFile an honest statement of what the writer needs, and turns what
        // was a TypeError from deep inside fs into an error that names the offending model.
        const writableModelFiles = this.getModelFiles().map((modelFile): WritableModelFile => {
            const fileName = modelFile.getName();
            const definitions = modelFile.getDefinitions();
            if (!fileName || definitions === null || definitions === undefined) {
                throw new Error(`Cannot write model file for namespace '${modelFile.getNamespace()}' to the file system: it has no ${!fileName ? 'file name' : 'definitions'}.`);
            }
            return { fileName, definitions, external: modelFile.isExternal() };
        });
        ModelWriter.writeModelsToFileSystem(writableModelFiles, path, options);
    }

    /**
     * Returns the status of the decorator validation options
     * @returns {object} returns an object that indicates the log levels for defined and undefined decorators
     */
    getDecoratorValidation() {
        return this.decoratorValidation;
    }

    /**
     * Get the array of model file instances
     * @param {Boolean} [includeConcertoNamespace] - whether to include the concerto namespace
     * (default to false)
     * @return {ModelFile[]} The ModelFiles registered
     * @private
     */
    getModelFiles(includeConcertoNamespace?: boolean): ModelFileInstance[] {
        let keys = Object.keys(this.modelFiles);
        let result: ModelFileInstance[] = [];

        for (let n = 0; n < keys.length; n++) {
            const ns = keys[n];
            if(includeConcertoNamespace || (!EXCLUDE_NS.includes(ns))) {
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
    getModels(options?: { includeExternalModels?: boolean }) {
        const modelFiles = this.getModelFiles();
        let models: Array<{ name: string; content: string | null | undefined }> = [];
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
                fileName = getFileNameFromIdentifier(fileIdentifier);
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
    resolveType(context, type): any {
        const typeName = typeNameArgument(type);
        const memo = managerReadMemo(this._engine);
        const resolved = memo.resolvedTypes.get(typeName);
        if (resolved !== undefined) {
            return resolved;
        }
        const result: string = this.rustHandle.resolveType(typeof context === 'string' ? context : String(context), typeName);
        if (memo.version === this._engine.version) {
            memo.resolvedTypes.set(typeName, result);
        }
        return result;
    }

    /**
     * A new engine handle with this manager's validation options.
     * @return {object} the handle
     * @private
     * @internal
     */
    _newRustHandle(): EngineHandle {
        const handle = new rust.ModelManagerHandle();
        if (this.options?.dangerouslyAllowReservedSystemTypeNamesInUserModels) {
            handle.setDangerouslyAllowReservedSystemTypeNamesInUserModels(true);
        }
        const validation = this.decoratorValidation;
        if (typeof validation !== 'object' || validation === null ||
            validation.missingDecorator || validation.invalidDecorator) {
            handle.setDecoratorValidation(validation);
        }
        return handle;
    }

    /**
     * Remove all registered Concerto files
     */
    clearModelFiles() {
        this.modelFiles = {};
        const replaced = this.rustHandle;
        this.rustHandle = this._newRustHandle();
        this._modelFileIds = new Map();
        this._rustPreloaded = new Set(RUST_PRELOADED_NS);
        // Safe: the handle is this manager's alone; staged files keep snapshots.
        engineHandles().releaseHandle(replaced);
        this._engine.namespaces = [];
        this._engine.version++;
        this.addDecoratorModel();
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
    getModelFileByFileName(fileName): ModelFile {
        // A string is matched against the names TS holds, as TS 5.0.0 does;
        // only undefined crosses (null would match an unnamed file).
        if (fileName === undefined) {
            const namespace = this.rustHandle.modelManagerGetModelFileByFileName(fileName);
            return namespace === undefined ? undefined as unknown as ModelFile : this.modelFiles[namespace];
        }
        return this.getModelFiles().filter(mf => mf.getName() === fileName)[0];
    }

    /**
     * Get the namespaces registered with the ModelManager.
     * @return {string[]} namespaces - the namespaces that have been registered.
     */
    getNamespaces(): string[] {
        const list = namespaceListOf(this);
        if (list) {
            return list.slice();
        }
        const result: string[] = this.rustHandle.getNamespaces();
        if (!this._mirrorPending) {
            this._engine.namespaces = result.slice();
        }
        return result;
    }

    /**
     * Look up a type in all registered namespaces.
     *
     * @param {string} qualifiedName - fully qualified type name.
     * @return {ClassDeclaration} - the class declaration for the specified type.
     * @throws {TypeNotFoundException} - if the type cannot be found or is a primitive type.
     */
    getType(qualifiedName): any {
        const name = typeNameArgument(qualifiedName);
        const memo = managerReadMemo(this._engine);
        let fqn = memo.typeNames.get(name);
        if (fqn === undefined) {
            fqn = this.rustHandle.getTypeName(name) as string;
            if (memo.version === this._engine.version) {
                memo.typeNames.set(name, fqn);
            }
        }
        return this.modelFiles[fqn.substring(0, fqn.lastIndexOf('.'))].getLocalType(fqn);
    }

    /**
     * Get the AssetDeclarations defined in this model manager
     * @return {AssetDeclaration[]} the AssetDeclarations defined in the model manager
     */
    getAssetDeclarations(): AssetDeclaration[] {
        return this.getModelFiles().reduce((prev, cur) => {
            return prev.concat(cur.getAssetDeclarations());
        }, [] as AssetDeclaration[]);
    }

    /**
     * Get the TransactionDeclarations defined in this model manager
     * @return {TransactionDeclaration[]} the TransactionDeclarations defined in the model manager
     */
    getTransactionDeclarations(): TransactionDeclaration[] {
        return this.getModelFiles().reduce((prev, cur) => {
            return prev.concat(cur.getTransactionDeclarations());
        }, [] as TransactionDeclaration[]);
    }

    /**
     * Get the EventDeclarations defined in this model manager
     * @return {EventDeclaration[]} the EventDeclaration defined in the model manager
     */
    getEventDeclarations(): EventDeclaration[] {
        return this.getModelFiles().reduce((prev, cur) => {
            return prev.concat(cur.getEventDeclarations());
        }, [] as EventDeclaration[]);
    }

    /**
     * Get the ParticipantDeclarations defined in this model manager
     * @return {ParticipantDeclaration[]} the ParticipantDeclaration defined in the model manager
     */
    getParticipantDeclarations(): ParticipantDeclaration[] {
        return this.getModelFiles().reduce((prev, cur) => {
            return prev.concat(cur.getParticipantDeclarations());
        }, [] as ParticipantDeclaration[]);
    }

    /**
     * Get the MapDeclarations defined in this model manager
     * @return {MapDeclaration[]} the MapDeclaration defined in the model manager
     */
    getMapDeclarations(): MapDeclaration[] {
        return this.getModelFiles().reduce((prev, cur) => {
            return prev.concat(cur.getMapDeclarations());
        }, [] as MapDeclaration[]);
    }

    /**
     * Get the EnumDeclarations defined in this model manager
     * @return {EnumDeclaration[]} the EnumDeclaration defined in the model manager
     */
    getEnumDeclarations(): EnumDeclaration[] {
        return this.getModelFiles().reduce((prev, cur) => {
            return prev.concat(cur.getEnumDeclarations());
        }, [] as EnumDeclaration[]);
    }

    /**
     * Get the Concepts defined in this model manager
     * @return {ConceptDeclaration[]} the ConceptDeclaration defined in the model manager
     */
    getConceptDeclarations(): ConceptDeclaration[] {
        return this.getModelFiles().reduce((prev, cur) => {
            return prev.concat(cur.getConceptDeclarations());
        }, [] as ConceptDeclaration[]);
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
     * Validates an instance against the models in this model manager, as
     * its own `$class` (accordproject/concerto#1239), without building a
     * Resource: the instance is valid exactly when
     * {@link Serializer#fromJSON} (with the same options) would accept it.
     * @param {object|string} json the instance, as a JSON object or its JSON text
     * @param {ValidateInstanceOptions} [options] the options
     * @return {ValidationResult} `{ valid: true, resource, warnings }`, the
     * resource being built when first read (or `null` with `hydrate: false`),
     * or `{ valid: false, resource: null, errors, warnings }`, the first
     * error being the one {@link BaseModelManager#validateInstanceOrThrow}
     * throws
     */
    validateInstance(json: object | string, options?: ValidateInstanceOptions): ValidationResult<Resource> {
        return engineValidateInstance().validateInstance(this, json, options);
    }

    /**
     * Validates an instance as {@link BaseModelManager#validateInstance}
     * does, and returns it as a Resource (accordproject/concerto#1239).
     * @param {object|string} json the instance, as a JSON object or its JSON text
     * @param {ValidateInstanceOptions} [options] the options
     * @return {Resource|null} the resource, or `null` with `hydrate: false`
     * @throws {ValidationException|TypeNotFoundException|Error} what
     * {@link Serializer#fromJSON} throws for the instance, with its
     * diagnostics as `details`
     */
    validateInstanceOrThrow(json: object | string, options?: ValidateInstanceOptions): Resource | null {
        return engineValidateInstance().validateInstanceOrThrow(this, json, options);
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
    derivesFrom(fqt1, fqt2): boolean {
        // A non-string `fqt2` names no type, so '' is walked.
        return this.rustHandle.derivesFrom(typeNameArgument(fqt1), typeof fqt2 === 'string' ? fqt2 : '');
    }

    /**
     * Concrete (non-abstract) declarations assignable to baseFqn: the base itself
     * (when concrete) plus all subclasses. Empty array if baseFqn is not in the model.
     * @param {string} baseFqn The fully qualified type name
     * @returns {ClassDeclaration[]} An array of concrete ClassDeclaration that are assignable to baseFqn
     */
    getAssignableConcreteTypes(baseFqn: string): any[] {
        let typeDeclaration;
        try {
            typeDeclaration = this.getType(baseFqn);
        } catch (e) {
            return []; // Empty array if baseFqn is not in the model
        }

        const assignable = typeDeclaration.getAssignableClassDeclarations();
        return assignable.filter(decl => !decl.isAbstract());
    }

    /**
     * True when fqn is, or extends, baseFqn (restricted to concrete types).
     * @param {string} fqn The candidate fully qualified type name
     * @param {string} baseFqn The fully qualified type name it may be derived from
     * @returns {boolean} True if fqn is assignable to baseFqn
     */
    isAssignableTo(fqn: string, baseFqn: string): boolean {
        // As TS, false for a non-string `fqn`; '' for a non-string `baseFqn`.
        if (typeof fqn !== 'string') {
            return false;
        }
        return this.rustHandle.isAssignableTo(fqn, typeof baseFqn === 'string' ? baseFqn : '');
    }

    /**
     * Resolve the namespace for names in the metamodel
     * @param {object} metaModel - the MetaModel
     * @return {object} the resolved metamodel
     */
    resolveMetaModel(metaModel: IModel): IModel {
        const priorModels = this.getAst(false, true);
        return MetaModelUtil.resolveLocalNames(priorModels, metaModel) as IModel;
    }

    /**
     * Populates the model manager from a models metamodel AST
     * @param {*} ast the metamodel
     * @param {object} [options] - options for the from ast method
     * @param {object} [options.disableValidation] - option to disable metamodel validation and just fetch the models, to be used only if the metamodel is already validated
     */
    fromAst(ast: IModels, options?: { disableValidation?: boolean }) {
        this.clearModelFiles();
        // Runs commit in one engine call, so a throw leaves what TS had added.
        const batching = this.addModelFile === BaseModelManager.prototype.addModelFile;
        let run: ModelFileInstance[] = [];
        const runNamespaces = new Set<string>();
        const commitRun = () => {
            if (run.length > 0) {
                const files = run;
                run = [];
                runNamespaces.clear();
                this._addStagedModelFiles(files);
            }
        };
        try {
            ast.models.forEach( (model: IModel) => {
                if(!EXCLUDE_NS.includes(model.namespace)) { // excludes the internal namespaces, already added
                    const modelFile = new ModelFile( this, model ) as ModelFileInstance;
                    const namespace = modelFile.getNamespace();
                    if (batching && modelFile.getVersion() && !this.modelFiles[namespace] &&
                        !runNamespaces.has(namespace) && this._needsRustWrite(namespace)) {
                        run.push(modelFile);
                        runNamespaces.add(namespace);
                    } else {
                        commitRun();
                        this.addModelFile( modelFile, null, null, true );
                    }
                }
            });
        } finally {
            commitRun();
        }
        if (!options?.disableValidation) {
            this.validateModelFiles();
        }
    }

    /**
     * Get the full ast (metamodel instances) for a modelmanager
     * @param {boolean} [resolve] - whether to resolve names
     * @param {boolean} [includeConcertoNamespaces] - whether to include the concerto namespaces
     * @returns {*} the metamodel
     */
    getAst(resolve?, includeConcertoNamespaces?): IModels {
        const result: IModels = {
            $class: `${MetaModelNamespace}.Models`,
            models: [] as IModel[],
        };
        const modelFiles = this.getModelFiles(includeConcertoNamespaces);
        // With BaseModelManager's own `resolveMetaModel`, `getAst` and
        // `getModelFiles`, the prior models it reads are the same for every
        // file, so they are read once, not once per file.
        const proto = BaseModelManager.prototype;
        const priorModels = resolve && this.resolveMetaModel === proto.resolveMetaModel &&
            this.getAst === proto.getAst && this.getModelFiles === proto.getModelFiles
            ? this.getAst(false, true)
            : undefined;
        modelFiles.forEach((thisModelFile) => {
            let metaModel = thisModelFile.getAst();
            if (resolve) {
                metaModel = priorModels !== undefined
                    ? MetaModelUtil.resolveLocalNames(priorModels, metaModel) as IModel
                    : this.resolveMetaModel(metaModel);
            }
            result.models.push(metaModel);
        });
        return result;
    }


    /**
     * Returns a new ModelManager over the same model files as this one,
     * with the same options and decorator factories, without loading or
     * validating any model file again. Unlike a `filter` that keeps every
     * declaration, every model file is kept, including one with no
     * declarations, and no predicate is called.
     *
     * The fork is independent of this manager from then on: model files
     * added to, updated in or deleted from either one never reach the
     * other. A server can therefore keep one base manager of its common
     * models and fork it per request, each request adding its own models to
     * its own fork. The engine shares the base's model files with every
     * fork instead of copying them, and a fork starts with the base's warmed
     * per-type caches. A fork's ModelFile views are its own; their
     * declarations are built on first use. Memory is released by the
     * garbage collector when a fork is no longer referenced.
     * @returns {BaseModelManager} the fork, of this manager's own class
     */
    fork(): this {
        if (this._mirrorPending) {
            throw new Error('A ModelManager cannot be forked while model files are being added to it');
        }
        const fork = Object.create(Object.getPrototypeOf(this)) as this;
        ModelFile._registerManager(fork);
        fork.processFile = this.processFile;
        fork.modelFiles = {};
        fork.factory = new Factory(fork);
        fork.options = this.options === undefined ? undefined : { ...this.options };
        fork.serializer = new Serializer(fork.factory, fork, fork.options);
        fork.serializer.defaultOptions = Object.assign({}, this.serializer.defaultOptions);
        fork.decoratorFactories = this.decoratorFactories.slice();
        fork.decoratorValidation = this.decoratorValidation;
        fork._mirrorPending = false;
        fork._engine = newEngineState();
        fork._modelFileIds = new Map(this._modelFileIds);
        fork._rustPreloaded = new Set(this._rustPreloaded);
        fork.rustHandle = this.rustHandle.fork();
        fork._buildingMetamodelCopy = false;
        installLazyMetamodelCopy(fork);
        const handle = fork.rustHandle;
        // Each view is built on its first read (BC-48: `modelFiles` is
        // internal), as a fork typically reads few of them, and as it would
        // have been built here: with the fork's decorator factories of now.
        const factories = fork.decoratorFactories.slice();
        for (const namespace of Object.keys(this.modelFiles)) {
            const source = this.modelFiles[namespace];
            const definitions = source.getDefinitions();
            Object.defineProperty(fork.modelFiles, namespace, {
                configurable: true,
                enumerable: true,
                get(this: Record<string, ModelFileInstance>) {
                    const current = fork.decoratorFactories;
                    fork.decoratorFactories = factories;
                    let view: ModelFileInstance;
                    try {
                        view = ModelFile._sharedView(fork, source, definitions, undefined, handle) as ModelFileInstance;
                    } finally {
                        fork.decoratorFactories = current;
                    }
                    ownModelFile(this, namespace, view);
                    return view;
                },
                // Every writer reads the namespace first, which replaces this accessor.
                /* istanbul ignore next */
                set(this: Record<string, ModelFileInstance>, value: ModelFileInstance) {
                    ownModelFile(this, namespace, value);
                },
            });
        }
        // A registered metamodel copy stays the fork's registered view.
        const copy = Object.getOwnPropertyDescriptor(this, 'metamodelModelFile');
        if (copy !== undefined && 'value' in copy && this.modelFiles[MetaModelNamespace] === copy.value) {
            fork.metamodelModelFile = fork.modelFiles[MetaModelNamespace];
        }
        const namespaces = namespaceListOf(this);
        fork._engine.namespaces = namespaces?.slice();
        return fork;
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
     * The model files the new ModelManager holds from its constructor (the
     * decorator and root models, and the metamodel under `addMetamodel`)
     * are kept whole: the predicate is not called on their declarations
     * (an import of one is always kept), and this manager's copies are not
     * added again (BC-53; v5.0.0 re-added the decorator model and threw).
     *
     * @param {FilterFunction} predicate - the filter function over a Declaration object
     * @param {Object} [options] - options for the filter method
     * @param {boolean} [options.disableValidation] — If true then the model files are not validated
     * @returns {BaseModelManager} - the filtered ModelManager
     */
    filter(predicate, options?){
        const modelManager = new BaseModelManager({...this.options}, this.processFile);
        const filteredModels: ModelFileInstance[] = [];
        // BC-53: the new manager's own system declarations are always kept.
        const keep = (declaration) =>
            modelManager.modelFiles[declaration.getNamespace()] !== undefined || predicate(declaration);

        for (const modelFile of Object.values(this.modelFiles) as ModelFileInstance[]) {
            // BC-53: skip every file the new manager already holds.
            if (modelFile.isSystemModelFile() || modelManager.modelFiles[modelFile.getNamespace()] !== undefined) {
                continue;
            }
            const filtered = modelFile.filter(keep, modelManager);
            if (filtered) {
                filteredModels.push(filtered);
            }
        }

        modelManager.addModelFiles(filteredModels, undefined, options?.disableValidation);
        return modelManager;
    }
}

export { BaseModelManager };
export default BaseModelManager;
