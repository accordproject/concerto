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
import rootModelModule from './rootmodelhelper';
import decoratorModelModule from './decoratormodelhelper';
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
import type { EngineHandle, EngineState } from './engine/bindings';

/**
 * P5-100 (M1, accordproject/concerto-rust#454): a new manager's engine
 * state record (`BaseModelManager._engine`; its shape is `EngineState` in
 * src/engine/bindings.d.ts). It replaces the module-level WeakMaps that
 * used to hold the same state by manager, here and in src/engine/.
 * @return {EngineState} the record, with model version 0 and nothing cached
 * @private
 */
function newEngineState(): EngineState {
    return {
        version: 0,
        readMemo: undefined,
        namespaces: undefined,
        dcsResidents: undefined,
        serializerCache: undefined,
    };
}

/**
 * `manager`'s read memo (`EngineState.readMemo`), started afresh when its
 * model version has moved since it was made.
 * @param {object} state - the manager's engine state
 * @return {object} its current memo
 * @private
 */
/* istanbul ignore next */
function managerReadMemo(state: EngineState): NonNullable<EngineState['readMemo']> {
    let memo = state.readMemo;
    if (memo === undefined || memo.version !== state.version) {
        memo = state.readMemo = {
            version: state.version,
            typeNames: new Map(),
            resolvedTypes: new Map(),
        };
    }
    return memo;
}

/**
 * `manager`'s namespace list (`EngineState.namespaces`), or undefined when
 * it has none, or while a batch is being added (`_mirrorPending`, when
 * `modelFiles` is ahead of rustHandle).
 * @param {object} manager - the BaseModelManager
 * @return {string[]|undefined} its list
 * @private
 */
/* istanbul ignore next */
function namespaceListOf(manager: { _engine: EngineState; _mirrorPending: boolean }): string[] | undefined {
    return manager._mirrorPending ? undefined : manager._engine.namespaces;
}

/**
 * Appends `namespace`, just registered as a new key of `manager`'s
 * `modelFiles`, to its namespace list, if it has one. A change made while a
 * batch is being added (`_mirrorPending`) drops the list instead.
 * @param {object} manager - the BaseModelManager
 * @param {string} namespace - the namespace added
 * @private
 */
/* istanbul ignore next */
function noteNamespaceAdded(manager: { _engine: EngineState; _mirrorPending: boolean }, namespace: string): void {
    const list = namespaceListOf(manager);
    if (list) {
        list.push(namespace);
    } else {
        manager._engine.namespaces = undefined;
    }
}

/**
 * Removes `namespace`, just deleted from `manager`'s `modelFiles`, from its
 * namespace list, if it has one (and drops the list if `namespace` is
 * missing from it, or while a batch is being added).
 * @param {object} manager - the BaseModelManager
 * @param {string} namespace - the namespace (key) removed
 * @private
 */
/* istanbul ignore next */
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

// these namespaces are internal and excluded by default by getModelFiles
// and ignored by fromAst
const EXCLUDE_NS = ['concerto@1.0.0', 'concerto', 'concerto.decorator@1.0.0'];

// P5-52 (BC-28, R1; accordproject/concerto-rust#373): the `regExp` option
// (an alternative regular expression engine, such as XRegExp) is no longer
// supported. Every `regex=` is compiled and evaluated by the Concerto
// engine, which cannot call a JS constructor. The option is ignored, with
// one warning per process, rather than rejected.
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

// The system namespaces a new rustHandle loads itself (concerto-wasm
// `ModelManagerHandle::new`), as `addDecoratorModel` and `addRootModel` then
// register them in `modelFiles`.
const RUST_PRELOADED_NS = ['concerto.decorator@1.0.0', 'concerto@1.0.0'];

/**
 * A type name argument for an engine read, whose binding takes a `&str` (a
 * JS non-string traps the engine). P5-34 (#330 §2(b)): a non-string gets
 * the error the TS body threw first for it, from the same
 * `ModelUtil.getNamespace` call: an `Error` for null or undefined (v5.0.0's
 * `FQN is invalid.`), and a `TypeError` otherwise. Should that call ever
 * accept a non-string, its string form is sent.
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
    /**
     * The registered model files, by namespace. Internal and read-only
     * (P5-34, BC-48): every change goes through this manager's own methods,
     * which keep `rustHandle` mirroring it. Use `getModelFile`,
     * `getModelFiles` and `getNamespaces` to read it.
     * @internal
     */
     modelFiles: Record<string, ModelFileInstance>;
     processFile: (fileName: string | null, modelInput: string | unknown) => ModelFileSource;
     factory: Factory;
     serializer: Serializer;
     decoratorFactories: DecoratorFactory[];
     options: ModelManagerOptions | undefined;
     decoratorValidation: NonNullable<ModelManagerOptions['decoratorValidation']>;
     metamodelModelFile: ModelFileInstance;
    /**
     * (P4-08): a live concerto-wasm ModelManagerHandle, mirroring
     * `modelFiles`: every addModelFile/updateModelFile/deleteModelFile call
     * this manager makes is written to it, except the registration of the
     * decorator/root system models, which its own constructor already loads
     * (`_needsRustWrite`). Always set by the end of the constructor.
     * @internal
     */
     rustHandle: EngineHandle;
    /**
     * (P5-31, accordproject/concerto-rust#341): true only while the
     * constructor builds `metamodelModelFile`, the cached copy of the
     * metamodel `validateAst` registers when rustHandle keeps its own copy
     * after a failed check. `_needsRustWrite` answers false for the
     * metamodel namespace while it is set, so engine/views.ts
     * `stageModelFile` keeps no engine stage for that copy in every new
     * manager. Every other metamodel file, a user's included, is mirrored.
     * @internal
     */
     _buildingMetamodelCopy?: boolean;
    /**
     * (P5-34, accordproject/concerto-rust#344): true only while one of this
     * manager's own mutators has written `modelFiles` ahead of `rustHandle`:
     * the batch `addModelFiles` adds before it mirrors them. Reads never
     * compare the two maps; this flag is the whole mirror check
     * (`_rustHandleMatchesModelFiles`).
     * @internal
     */
     _mirrorPending: boolean;
    /**
     * (P5-34): the rustHandle model file handle of each namespace, cached
     * when the file is committed (or on first read), for `ModelFile`'s
     * reads (`_rustModelFileId`). Cleared whenever the engine rebuilds its
     * model file arena (an update or a delete) or rustHandle is replaced.
     * @internal
     */
     _modelFileIds: Map<string, number>;
    /**
     * (P5-34): the system namespaces the current rustHandle loaded itself
     * (`RUST_PRELOADED_NS`) that `modelFiles` does not hold yet. Registering
     * one writes nothing to rustHandle; every other add, update and delete,
     * a system namespace's included, is mirrored.
     * @internal
     */
     _rustPreloaded: Set<string>;
    /**
     * (P5-100, accordproject/concerto-rust#454): this manager's engine
     * state: its model version, moved by every change of `modelFiles` or
     * `rustHandle` and the key of every cached answer, and those cached
     * answers (`EngineState` in src/engine/bindings.d.ts).
     * @internal
     */
     _engine: EngineState;
    /**
     * Create the ModelManager.
     * @constructor
     * @param {object} [options] - ModelManager options, also passed to Serializer
     * @param {Object} [options.regExp] - Deprecated and ignored, with a warning: regular expressions are evaluated by the Concerto engine.
     * @param {boolean} [options.metamodelValidation] - Unless false, every ModelFile built for this
     * manager has its AST checked against the Concerto metamodel when it is constructed (at model
     * load: fromAst, addModel, addCTOModel, addModelFiles, updateModelFile), and a malformed AST is an
     * IllegalModelException (BC-19, on by default since R1). When true, addModelFile also runs
     * validateAst on each new file, as before. false is an escape hatch for trusted input only: the
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
        // P5-35 (BC-47): a ModelFile may be built only for a manager whose
        // constructor ran; registered before this constructor builds any.
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
        // P5-75: the namespace list starts empty with the map; the system
        // models below are appended as they are registered.
        this._engine.namespaces = [];
        this.addDecoratorModel();
        this.addRootModel();

        // Cache a copy of the Metamodel ModelFile for use when validating the structure of ModelFiles later.
        this._buildingMetamodelCopy = true;
        try {
            this.metamodelModelFile = new ModelFile(this, MetaModelUtil.metaModelAst as AstNode, undefined, MetaModelNamespace);
        } finally {
            this._buildingMetamodelCopy = false;
        }

        if(options?.addMetamodel) {
            // Mirrored into rustHandle by `addModelFile` like any other
            // namespace (P5-31, accordproject/concerto-rust#341):
            // rustHandle's own constructor loads only `concerto@1.0.0` and
            // `concerto.decorator@1.0.0`.
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
        const getRootModel = rootModelModule.getRootModel || rootModelModule;

        if (typeof getRootModel !== 'function') {
            throw new Error(`Failed to load getRootModel. Got: ${typeof getRootModel}. Module keys: ${Object.keys(rootModelModule)}`);
        }

        const {rootModelAst, rootModelCto, rootModelFile} = getRootModel();
        // P5-73: the engine's precomputed verdict applies to this AST while
        // it is exactly the fixed root model (engine/views.ts `systemModelAsts`).
        engineViews().markSystemModelAst(rootModelAst);
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

        // P5-73: the engine's precomputed verdict applies to this AST while
        // it is exactly the fixed decorator model (engine/views.ts
        // `systemModelAsts`).
        engineViews().markSystemModelAst(decoratorModelAst);
        const m = new ModelFile(this, decoratorModelAst, decoratorModelCto, decoratorModelFile);

        this.addModelFile(m, decoratorModelCto, decoratorModelFile, true);
    }

    /**
     * Whether a namespace needs to be written into `rustHandle`: every
     * namespace but a system model the current `rustHandle` loaded itself
     * and `modelFiles` does not hold yet (`_rustPreloaded`: the decorator
     * and root models `addDecoratorModel`/`addRootModel` register). The
     * metamodel namespace is written like any other (P5-31,
     * accordproject/concerto-rust#341), so a manager a user adds the
     * metamodel to (`newMetaModelManager`, or `addModelFile` of a metamodel
     * ModelFile) keeps rustHandle in parity and answers its reads from Rust.
     * The only metamodel copy that is never written is `validateAst`'s own
     * (`metamodelModelFile`): it is not staged while the constructor builds
     * it (`_buildingMetamodelCopy`), and `validateAst` registers it in
     * `this.modelFiles` only when rustHandle already holds its own copy.
     * @param {string} namespace - the namespace being added, updated or removed
     * @return {boolean} true if `namespace` needs writing to `rustHandle`
     * @private
     * @internal
     */
    /* istanbul ignore next */
    _needsRustWrite(namespace) {
        if (this._rustPreloaded.has(namespace)) {
            return false;
        }
        return !(namespace === MetaModelNamespace && this._buildingMetamodelCopy);
    }

    /**
     * Throws the BC-46 `TypeError` (P5-34, accordproject/concerto-rust#344)
     * unless `modelFile` is a ModelFile the ModelFile constructor built:
     * only such a file was loaded by the engine, so only it can be mirrored
     * into `rustHandle`. A duck-typed object, `Object.create(ModelFile
     * .prototype)` or a sinon stub instance is rejected. v5.0.0 threw a
     * `TypeError` for almost every such value too (calling a method it
     * lacks), and accepted a duck-typed object.
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
     * The rustHandle write for a model file being added: registers the file
     * Rust already loaded when the `ModelFile` was constructed (P5-10a lazy
     * views, engine/views.ts `commitStaged`), or else sends its AST, as
     * before, and caches the file's rustHandle handle (`_modelFileIds`). A
     * namespace `_needsRustWrite` excludes is not written (rustHandle loaded
     * it itself); its stage, if any, is dropped. Any error the write throws
     * propagates.
     * @param {ModelFile} modelFile - the model file being added
     * @return {boolean} true if the namespace was written to rustHandle
     * @private
     * @internal
     */
    /* istanbul ignore next */
    _rustMirrorAdd(modelFile) {
        const namespace = modelFile.getNamespace();
        if (!this._needsRustWrite(namespace)) {
            engineViews().dropStaged(modelFile, this.rustHandle);
            this._rustPreloaded.delete(namespace);
            return false;
        }
        let id = engineViews().commitStaged(modelFile, this.rustHandle);
        if (id === undefined) {
            // `ModelFile`'s constructor only rejects a *truthy* non-string
            // `definitions`/`fileName`: `0`, `false` and `NaN` are stored
            // as-is and reach here raw. Only a genuine string is forwarded
            // to the wasm `Option<String>` params, matching v5.0.0 (which
            // makes no wasm call at all) (accordproject/concerto-rust#294
            // follow-up).
            const definitions = modelFile.getDefinitions();
            const fileName = modelFile.getName();
            id = this.rustHandle.addModelWithDefinitions(
                JSON.stringify(modelFile.getAst()),
                typeof definitions === 'string' ? definitions : undefined,
                typeof fileName === 'string' ? fileName : undefined,
                false,
            );
        }
        this._modelFileIds.set(namespace, id as number);
        return true;
    }

    /**
     * P5-34 (I-5): `addModelFile`'s validation and rustHandle write in one
     * engine call, for a file staged in `rustHandle` whose `validate` is
     * `ModelFile`'s own (engine/views.ts `validateAndCommitStaged`); caches
     * the file's rustHandle handle. Returns false, having changed nothing,
     * for any other file: the caller then calls `modelFile.validate()` and
     * `_rustMirrorAdd`, as before. A validation error propagates as
     * `modelFile.validate()` throws it.
     * @param {ModelFile} modelFile - the model file being added
     * @return {boolean} true if the file was validated and written
     * @private
     * @internal
     */
    /* istanbul ignore next */
    _rustValidateAndMirrorAdd(modelFile) {
        const namespace = modelFile.getNamespace();
        if (modelFile.validate !== ModelFile.prototype.validate || !this._needsRustWrite(namespace)) {
            return false;
        }
        const id = engineViews().validateAndCommitStaged(modelFile, this.rustHandle);
        if (id === undefined) {
            return false;
        }
        this._modelFileIds.set(namespace, id);
        return true;
    }

    /**
     * The rustHandle write for a model file replacing the one registered
     * for its namespace: rustHandle holds every registered namespace
     * (P5-34), so it is always an update, which rebuilds the engine's model
     * file arena, so every cached handle is dropped (`_modelFileIds`). Any
     * error the write throws propagates.
     * @param {ModelFile} modelFile - the model file replacing the registered one
     * @private
     * @internal
     */
    /* istanbul ignore next */
    _rustMirrorUpdate(modelFile) {
        const namespace = modelFile.getNamespace();
        // P5-100 (E-6): the file Rust loaded when the ModelFile was
        // constructed replaces the registered one (engine/views.ts
        // `updateStaged`); only a file with no usable stage sends its AST.
        const staged = engineViews().updateStaged(modelFile, this.rustHandle);
        if (staged !== undefined) {
            this._modelFileIds.clear();
            this._modelFileIds.set(namespace, staged);
            return;
        }
        engineViews().dropStaged(modelFile, this.rustHandle);
        // TS has already validated (or was asked not to); the mirror call
        // only needs to keep rustHandle's state in sync, so it never
        // re-validates itself. Same falsy-non-string forward as
        // `_rustMirrorAdd`: only a genuine string reaches the wasm
        // `Option<String>` params (accordproject/concerto-rust#294
        // follow-up).
        const updateDefinitions = modelFile.getDefinitions();
        const updateFileName = modelFile.getName();
        const id = this.rustHandle.updateModelFile(
            JSON.stringify(modelFile.getAst()),
            typeof updateDefinitions === 'string' ? updateDefinitions : undefined,
            typeof updateFileName === 'string' ? updateFileName : undefined,
            false,
        );
        this._modelFileIds.clear();
        this._modelFileIds.set(namespace, id);
    }

    /**
     * Whether `rustHandle` currently mirrors `this.modelFiles`: true except
     * while one of this manager's own mutators has written `modelFiles`
     * ahead of it (`_mirrorPending`, P5-34). `modelFiles` is internal and
     * read-only (BC-48), and only ModelFiles the ModelFile constructor built
     * are accepted (BC-46), so every mutator keeps the two in step; this is
     * a flag read, not a comparison of the two maps.
     * @return {boolean} true if rustHandle mirrors the namespaces TS has
     * @private
     * @internal
     */
    _rustHandleMatchesModelFiles() {
        return !this._mirrorPending;
    }

    /**
     * The rustHandle handle of the model file for `namespace`: the one
     * cached when the file was committed (P5-34), or else
     * `rustHandle.modelFileId(namespace)`, then cached until the engine
     * rebuilds its arena (`_modelFileIds`).
     * @param {string} namespace - the namespace to look up
     * @return {number|undefined} its model file handle, or undefined
     * @private
     * @internal
     */
    /* istanbul ignore next */
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
        /* istanbul ignore next */
        if (!this._mirrorPending && typeof namespace === 'string' &&
            (typeof fileName === 'string' || fileName === undefined || fileName === null)) {
            // P5-11 (accordproject/concerto-rust#287): the plain Error is
            // raised by Rust (concerto-wasm `throwAlreadyExists`), naming the
            // file rustHandle holds under the namespace, which mirrors
            // this.modelFiles. A batch of addModelFiles not yet mirrored
            // (`_mirrorPending`) and a file name the binding cannot take
            // keep the TS message below.
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
            // Mirrored before `modelFiles` changes, so an error leaves both
            // unchanged.
            let mirrored = false;
            if (!disableValidation) {
                // Structural validation against the Metamodel
                if(this.options?.metamodelValidation){
                    this.validateAst(modelFile);
                }

                // Semantic validation of the model file. P4-08 delegated
                // `ModelFile.validate()` fully to Rust (maintainer decision
                // 2026-09-26). P5-34 (I-5): a staged file is validated and
                // written to rustHandle in one engine call; any other file
                // is validated by its own `validate()`, then written.
                mirrored = this._rustValidateAndMirrorAdd(modelFile);
                if (!mirrored) {
                    modelFile.validate();
                }
            }
            if (!mirrored) {
                this._rustMirrorAdd(modelFile);
            }
            this.modelFiles[modelFile.getNamespace()] = modelFile;
            // P5-75: a new key, appended to the namespace list.
            noteNamespaceAdded(this, modelFile.getNamespace());
            // P5-14, P5-100: a model change moves the model version, which
            // every cached answer of this manager's is keyed on.
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
        // Delegates to rustHandle.validateAstValue (P4-08b, P5-13;
        // concerto-wasm), which runs the same version check plus structural
        // (metamodel) check over the AST alone -- it needs no registered
        // model file, so it never needs `this.modelFiles`/`rustHandle`
        // parity the way a read over `this.modelFiles` would, and it builds
        // no engine-side ModelFile either (the check never reads one, and
        // its constructor would reject a malformed AST with an
        // IllegalModelException before the check could throw TS's
        // MetamodelException). A thrown error already arrives as the mapped
        // `MetamodelException` (or other TS exception class,
        // src/engine/errors.ts) via the host error factory, so it
        // propagates unchanged.
        const alreadyHasMetamodel = !!this.getModelFile(MetaModelNamespace);
        try {
            // P5-100 (E-6): over the copy Rust staged when the ModelFile was
            // constructed, when it has one, rather than the AST sent again.
            if (!engineViews().validateAstStaged(modelFile, this.rustHandle)) {
                this.rustHandle.validateAstValue(JSON.stringify(modelFile.getAst()));
            }
        } catch (err) {
            // rustHandle's own validate_ast (concerto-core
            // ModelManager::validate_ast) only leaks its copy of the
            // metamodel when the *structural* check (`deserialize_ast`)
            // fails after the version check already passed -- a
            // version-mismatch failure returns before the metamodel is ever
            // inserted, so rustHandle never registers it. Mirroring the leak
            // unconditionally on every error would register the metamodel in
            // `this.modelFiles` on a version mismatch that rustHandle itself
            // never registered, and the two would no longer mirror each
            // other.
            // Ask rustHandle for the ground truth instead of re-deriving
            // TS's own control flow: mirror into `this.modelFiles` only when
            // rustHandle's own handle now actually holds `MetaModelNamespace`.
            // rustHandle already holds its own copy in the case that
            // reaches it, so this writes only this.modelFiles, not
            // rustHandle (P5-31, accordproject/concerto-rust#341): it is the
            // one metamodel copy that is not mirrored through
            // `_rustMirrorAdd`. `metamodelModelFile` was never staged
            // (`_buildingMetamodelCopy`), so there is no stage to drop.
            if (!alreadyHasMetamodel && this.rustHandle.modelFileId(MetaModelNamespace) !== undefined) {
                this.modelFiles[MetaModelNamespace] = this.metamodelModelFile;
                noteNamespaceAdded(this, MetaModelNamespace);
                this._engine.version++;
            }
            throw err;
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
            // Mirrored first, so a mirror error leaves both unchanged.
            // rustHandle holds every registered namespace (P5-34), the
            // system models included. `this.modelFiles[namespace]` above
            // coerces `namespace` to a string key (matching v5.0.0, which
            // deletes cleanly for a non-string whose string form is a loaded
            // namespace), but `rustHandle.deleteModelFile` takes a WASM
            // `&str`: a non-string reaching it traps the engine
            // (accordproject/concerto-rust#294 follow-up), so its string form
            // is sent. The delete rebuilds the engine's model file arena, so
            // every cached handle is dropped.
            this.rustHandle.deleteModelFile(typeof namespace === 'string' ? namespace : String(namespace));
            this._modelFileIds.clear();
            delete this.modelFiles[namespace];
            // P5-75: the key TS deletes is `namespace`'s string form.
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
        // P5-75: the namespace list before the batch, appended to once the
        // batch has succeeded, or kept for the restored map if it fails.
        const namespaces = namespaceListOf(this);

        try {
            // Every file is added to `modelFiles` before any is mirrored
            // (below): until then, rustHandle is behind (`_mirrorPending`).
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

            // Mirror the newly added files into rustHandle (P4-08,
            // accordproject/concerto-rust#67) *before* validating: this
            // method adds every file to this.modelFiles directly, in
            // whatever order the caller gave, precisely so cross-file
            // dependency order does not matter (see the method doc), and a
            // file in this batch may import from *another* file in the very
            // same batch, so every one of them must already be visible to
            // rustHandle before validateModelFiles() below validates any of
            // them. Each write is a structural mirror write only (no
            // validation); validateModelFiles() decides pass/fail.
            newModelFiles.forEach((m) => {
                if (this._rustMirrorAdd(m)) {
                    mirroredNamespaces.add(m.getNamespace());
                }
            });
            this._mirrorPending = false;

            // re-validate all the model files
            if (!disableValidation) {
                this.validateModelFiles();
            }

            // P5-75: the batch's namespaces, in the order `modelFiles` took
            // them.
            /* istanbul ignore next */
            if (namespaces && namespaceListOf(this) === namespaces) {
                newModelFiles.forEach((m) => namespaces.push(m.getNamespace()));
            }

            // return the model files.
            return newModelFiles;
        } catch (err) {
            this.modelFiles = {};
            Object.assign(this.modelFiles, originalModelFiles);
            this._engine.version++;
            // Undo any rustHandle mirroring this batch made: a
            // partially-mirrored or now-invalid batch must not leave
            // rustHandle out of sync with `this.modelFiles`, which the lines
            // above already rolled back. Only namespaces this batch actually
            // mirrored (`mirroredNamespaces`) are deleted here: the failure
            // that landed us in this catch can happen before the mirror loop
            // above ever runs (a duplicate namespace via
            // `_throwAlreadyExists`, an unversioned namespace, or a parse
            // error on a later file in the batch), in which case
            // `newModelFiles` can contain namespaces that were never mirrored
            // at all, and calling `deleteModelFile` on those would throw
            // (rustHandle never heard of them). A delete of a namespace this
            // batch did mirror propagates its error
            // (accordproject/concerto-rust#262).
            /* istanbul ignore next */
            newModelFiles.forEach((m) => {
                if (!mirroredNamespaces.has(m.getNamespace())) {
                    return;
                }
                this.rustHandle.deleteModelFile(m.getNamespace());
                this._modelFileIds.clear();
            });
            // P5-75: both are back as they were before the batch (a failed
            // delete above propagates first, dropping the list), so the
            // list from before the batch holds for the restored map.
            /* istanbul ignore next */
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
        // P5-11 (accordproject/concerto-rust#287): every model file is
        // validated in one Rust call (concerto-wasm `validateModelFiles`)
        // rather than one `modelFile.validate()` crossing per file; the
        // first error found is thrown naming the ModelFile of this manager
        // it was found in, as that file's own validate() does. rustHandle
        // mirrors every model file (P5-34).
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

            // P5-11 (accordproject/concerto-rust#287): every downloaded
            // file's view is built first, so a file the ModelFile
            // constructor rejects fails the update before anything changed.
            const views: ModelFileInstance[] = externalModels.map((file) =>
                new ModelFile(this, file.ast as AstNode, file.definitions, file.fileName));

            // P5-11 (accordproject/concerto-rust#287): rustHandle adds each
            // file (or replaces the file under its namespace) and validates
            // every model file, in one call that leaves it unchanged when it
            // fails (concerto-wasm `updateExternalModels`). Only then do the
            // views replace this.modelFiles' entries, so a failure leaves
            // both unchanged. P5-34: rustHandle mirrors every model file, so
            // this is the only path.
            try {
                const next: Record<string, ModelFileInstance> = Object.assign({}, this.modelFiles);
                views.forEach((mf) => {
                    next[mf.getNamespace()] = mf;
                });
                // P5-100 (E-6): from the files Rust loaded when each view was
                // constructed (engine/views.ts `updateExternalStaged`);
                // otherwise every AST is sent. Only a genuine string crosses
                // for `definitions` and `fileName`
                // (accordproject/concerto-rust#294 follow-up), as for every
                // other mirror write.
                if (!engineViews().updateExternalStaged(views, this.rustHandle, next)) {
                    const sources = views.map((mf) => {
                        const definitions = mf.getDefinitions();
                        const fileName = mf.getName();
                        return {
                            ast: mf.getAst(),
                            definitions: typeof definitions === 'string' ? definitions : undefined,
                            fileName: typeof fileName === 'string' ? fileName : undefined,
                        };
                    });
                    this.rustHandle.updateExternalModels(JSON.stringify(sources), next);
                }
            } finally {
                // A stage the update did not consume is dropped; an update
                // rebuilds rustHandle's model file arena.
                views.forEach((mf) => engineViews().dropStaged(mf, this.rustHandle));
                this._modelFileIds.clear();
            }
            views.forEach((mf) => {
                // P5-75: a namespace new to `modelFiles` is appended to the
                // namespace list; a replaced one keeps its place.
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
            // P5-75, P5-100: the map was replaced, so the namespace list is
            // dropped (the next getNamespaces asks the engine) and the model
            // version moves.
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
        // P5-34 (#330 §2(b)): the engine answers every call. A non-string
        // `type` throws the error v5.0.0 threw (`typeNameArgument`); a
        // non-string `context` only words the error, so its string form is
        // sent, as v5.0.0's message formatter used it.
        const typeName = typeNameArgument(type);
        // P5-29: a type the engine resolved since the last model change is
        // answered from the memo (`EngineState.readMemo`), without crossing into
        // the engine.
        /* istanbul ignore next */
        const memo = managerReadMemo(this._engine);
        const resolved = memo.resolvedTypes.get(typeName);
        /* istanbul ignore next */
        if (resolved !== undefined) {
            return resolved;
        }
        // The engine's answer is final, including any error it throws
        // (accordproject/concerto-rust#262).
        const result: string = this.rustHandle.resolveType(typeof context === 'string' ? context : String(context), typeName);
        /* istanbul ignore next */
        if (memo.version === this._engine.version) {
            memo.resolvedTypes.set(typeName, result);
        }
        return result;
    }

    /**
     * A new concerto-wasm ModelManagerHandle, told this manager's validation
     * options. P4-08 (accordproject/concerto-rust#67, maintainer decision
     * 2026-09-26): both TS validation options rustHandle's own validation
     * was previously blind to (P4-08e/#189 added the decorator-validation
     * binding; the reserved-system-type-names one already existed) are set
     * *before* addDecoratorModel/addRootModel mirror anything into it, so
     * `ModelFile.validate()`'s Rust delegation (introspect/modelfile.ts) and
     * rustHandle's own add/validate paths see the same options TS's own
     * validate() body reads from `this.options`/`this.decoratorValidation`.
     * The constructor and `clearModelFiles` both build rustHandle here
     * (P5-54, accordproject/concerto-rust#375).
     * @return {object} the handle
     * @private
     * @internal
     */
    _newRustHandle(): EngineHandle {
        const handle = new rust.ModelManagerHandle();
        handle.setDangerouslyAllowReservedSystemTypeNamesInUserModels(
            !!this.options?.dangerouslyAllowReservedSystemTypeNamesInUserModels
        );
        handle.setDecoratorValidation(this.decoratorValidation);
        return handle;
    }

    /**
     * Remove all registered Concerto files
     */
    clearModelFiles() {
        this.modelFiles = {};
        // Every mirrored model file is gone; rustHandle has no bulk clear,
        // so start it over the same way `new BaseModelManager()` does.
        // addDecoratorModel/addRootModel below re-populate TS's
        // this.modelFiles, and _needsRustWrite skips mirroring them since
        // the fresh handle's own constructor already has them.
        // P5-54 (accordproject/concerto-rust#375): the fresh handle gets
        // this manager's validation options too (`_newRustHandle`), or
        // `fromAst` (which clears first) and the DecoratorManager paths
        // validate with the defaults, ignoring `decoratorValidation`.
        const replaced = this.rustHandle;
        this.rustHandle = this._newRustHandle();
        this._modelFileIds = new Map();
        this._rustPreloaded = new Set(RUST_PRELOADED_NS);
        // P5-97 (accordproject/concerto-rust#448): the replaced handle is
        // this manager's alone (a fork has a handle of its own), and nothing
        // calls it again: its engine memory is released now, not when the
        // garbage collector gets to its finalizer. Internal only: there is
        // no public release API.
        engineHandles().releaseHandle(replaced);
        // P5-75: a new, empty namespace list for the new map, appended to
        // as the system models are registered again. P5-100: a new map and
        // handle are a model change.
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
        // Only a string or undefined crosses the boundary: the binding's
        // `Option<String>` turns a JS null into None (which would match an
        // unnamed file, where TS's `=== null` does not), and a number or
        // object traps the engine. Any other argument takes the TS body.
        /* istanbul ignore next */
        if (typeof fileName === 'string' || fileName === undefined) {
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
        // P5-75: answered from this manager's namespace list, which every
        // model change updates in place (`NamespaceList`), so only a
        // manager without one asks the engine, and then keeps its answer.
        // Each call gets its own copy, so changing the returned array
        // reaches neither the list nor the engine.
        /* istanbul ignore next */
        const list = namespaceListOf(this);
        /* istanbul ignore next */
        if (list) {
            return list.slice();
        }
        const result: string[] = this.rustHandle.getNamespaces();
        /* istanbul ignore next */
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
        // P5-34 (#330 §2(b)): a non-string name throws the error v5.0.0
        // threw (`typeNameArgument`).
        const name = typeNameArgument(qualifiedName);
        // P5-29: the fully-qualified name the engine answered since the
        // last model change is kept (`EngineState.readMemo`); it is still mapped
        // to its view below on every call.
        /* istanbul ignore next */
        const memo = managerReadMemo(this._engine);
        let fqn = memo.typeNames.get(name);
        /* istanbul ignore next */
        if (fqn === undefined) {
            // P5-11 (accordproject/concerto-rust#287): resolved in Rust
            // (concerto-wasm `getTypeName`), which throws the
            // TypeNotFoundException TS throws. Rust answers with the
            // declaration's fully-qualified name, mapped here to its view
            // in the model file of its namespace.
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
        // P5-34 (#330 §2(b)): the binding's `&str` parameters cannot take a
        // non-string (a JS non-string traps the engine). A non-string
        // `fqt1` throws what `getType` throws for it; a non-string `fqt2`
        // is no type's name, so the answer is false once `fqt1` is found.
        if (typeof fqt2 !== 'string') {
            this.getType(fqt1);
            return false;
        }
        return this.rustHandle.derivesFrom(typeNameArgument(fqt1), fqt2);
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
        // P5-34 (#330 §2(b)): the binding's `&str` parameters cannot take a
        // non-string (a JS non-string traps the engine;
        // accordproject/concerto-rust#294, follow-up to #262). v5.0.0
        // answered false for any non-string argument.
        if (typeof fqn !== 'string' || typeof baseFqn !== 'string') {
            return false;
        }
        return this.rustHandle.isAssignableTo(fqn, baseFqn);
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
        ast.models.forEach( (model: IModel) => {
            if(!EXCLUDE_NS.includes(model.namespace)) { // excludes the internal namespaces, already added
                const modelFile = new ModelFile( this, model );
                this.addModelFile( modelFile, null, null, true );
            }
        });
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
     * Returns a new ModelManager over the same model files as this one,
     * with the same options and decorator factories, without loading or
     * validating any model file again (P5-97,
     * accordproject/concerto-rust#448). Unlike a `filter` that keeps every
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
        // The batch `addModelFiles` is the only time `modelFiles` is ahead
        // of rustHandle, and it never calls out.
        /* istanbul ignore if */
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
        fork.decoratorFactories = this.decoratorFactories.slice();
        fork.decoratorValidation = this.decoratorValidation;
        fork._mirrorPending = false;
        // P5-100: the fork's own engine state, nothing cached yet.
        fork._engine = newEngineState();
        // The fork's engine handles are this manager's (`ModelManager::fork`).
        fork._modelFileIds = new Map(this._modelFileIds);
        fork._rustPreloaded = new Set(this._rustPreloaded);
        fork.rustHandle = this.rustHandle.fork();
        fork._buildingMetamodelCopy = false;
        // `validateAst`'s cached metamodel copy, as a view of this manager's,
        // built on first use (it is read only when a metamodel check fails).
        const base = this;
        Object.defineProperty(fork, 'metamodelModelFile', {
            configurable: true,
            enumerable: true,
            get() {
                const view = ModelFile._sharedView(fork, base.metamodelModelFile, base.metamodelModelFile.getDefinitions());
                Object.defineProperty(fork, 'metamodelModelFile', { value: view, writable: true, enumerable: true, configurable: true });
                return view;
            },
            set(value) {
                Object.defineProperty(fork, 'metamodelModelFile', { value, writable: true, enumerable: true, configurable: true });
            },
        });
        const handle = fork.rustHandle;
        for (const namespace of Object.keys(this.modelFiles)) {
            const source = this.modelFiles[namespace];
            fork.modelFiles[namespace] = ModelFile._sharedView(fork, source, source.getDefinitions(), undefined, handle) as ModelFileInstance;
        }
        // A metamodel copy this manager registered (`addMetamodel`) is the
        // same object as its view in the fork.
        if (this.modelFiles[MetaModelNamespace] === this.metamodelModelFile) {
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
     * are kept whole: the predicate is not called on their declarations,
     * and this manager's copies are not added again (BC-53, P5-108,
     * accordproject/concerto-rust#466; v5.0.0 re-added the decorator
     * model and threw).
     *
     * @param {FilterFunction} predicate - the filter function over a Declaration object
     * @param {Object} [options] - options for the filter method
     * @param {boolean} [options.disableValidation] — If true then the model files are not validated
     * @returns {BaseModelManager} - the filtered ModelManager
     */
    filter(predicate, options?){
        const modelManager = new BaseModelManager({...this.options}, this.processFile);
        const filteredModels: ModelFileInstance[] = [];

        for (const modelFile of Object.values(this.modelFiles) as ModelFileInstance[]) {
            // BC-53: skip every file the new manager's constructor already
            // added, not only the system root model.
            if (modelFile.isSystemModelFile() || modelManager.modelFiles[modelFile.getNamespace()] !== undefined) {
                continue;
            }
            const filtered = modelFile.filter(predicate, modelManager);
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
