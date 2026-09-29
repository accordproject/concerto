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
import Globalize from './globalize';
import IllegalModelException from './introspect/illegalmodelexception';
import ModelFile from './introspect/modelfile';
import ModelUtil from './modelutil';
import Serializer from './serializer';
import TypeNotFoundException from './typenotfoundexception';
import rootModelModule from './rootmodelhelper';
import decoratorModelModule from './decoratormodelhelper';
import type { ModelFileSource, ModelManagerOptions } from './types';
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

// The Rust engine (src/engine/index.ts) is the only path (P5-02: the
// CONCERTO_ENGINE=ts|rust flag from P4-02 is gone). See classdeclaration.ts's
// own copy of this comment for the bundler/webpack reasoning this loader
// relies on.
import { createRequire } from 'module';
declare const __webpack_require__: unknown;
declare const __non_webpack_require__: NodeRequire;
/* istanbul ignore next */
const loadEngine = (specifier: string) =>
    typeof __webpack_require__ === 'function' ? __non_webpack_require__(specifier) : typeof module !== 'undefined' && typeof module.require === 'function' ? module.require(specifier) : typeof (globalThis as any).module?.require === 'function' ? (globalThis as any).module.require(specifier) : createRequire(__filename)(specifier);
/* istanbul ignore next */
const rust: { [binding: string]: (...args: any[]) => never } = loadEngine('./engine').rust;
// P5-10a: engine/views, required once on first use.
let engineViewsModule: any;
/* istanbul ignore next */
const engineViews = () => engineViewsModule ?? (engineViewsModule = loadEngine('./engine/views'));

/**
 * What has been read from one rustHandle (P5-06), valid while its `epoch()`
 * is unchanged: every binding that can change a handle bumps its epoch
 * (concerto-wasm `ModelManagerHandle::epoch`), so a read taken at one epoch
 * is still the handle's answer at that epoch.
 */
interface RustHandleReads {
    epoch: number;
    namespaces: Set<string>;
    namespaceCount: number;
    modelFileIds: Map<string, number | undefined>;
}

/* istanbul ignore next */
const rustHandleReadCache = new WeakMap<object, RustHandleReads>();

/**
 * The reads cached for a rustHandle, refreshed when its epoch has moved.
 * @param {object} handle - the rustHandle
 * @return {RustHandleReads} its current reads
 * @private
 */
/* istanbul ignore next */
function rustHandleReads(handle: { [binding: string]: (...args: any[]) => any }): RustHandleReads {
    const epoch = handle.epoch();
    let reads = rustHandleReadCache.get(handle);
    if (!reads || reads.epoch !== epoch) {
        const namespaces: string[] = handle.getNamespaces();
        reads = { epoch, namespaces: new Set(namespaces), namespaceCount: namespaces.length, modelFileIds: new Map() };
        rustHandleReadCache.set(handle, reads);
    }
    return reads;
}

/**
 * The engine's answers to `getNamespaces`, `getType` and `resolveType` for
 * one BaseModelManager (P5-29, accordproject/concerto-rust#334), valid while
 * the model epoch P5-14 introduced (`modelGeneration`, moved by every
 * `addModelFile`, `updateModelFile`, `deleteModelFile`, `addModelFiles` and
 * `updateExternalModels`) is unchanged and the manager still holds the same
 * `modelFiles` map and rustHandle (`clearModelFiles` and the roll-back of a
 * failed `addModelFiles` or `updateExternalModels` replace one or both).
 * Only an answer the engine gave while rustHandle mirrored `modelFiles`
 * (`_rustHandleMatchesModelFiles`) is kept, so a manager holding stub model
 * files keeps its current path; a call that throws keeps nothing.
 */
interface ManagerReadMemo {
    generation: number;
    modelFiles: object;
    handle: object;
    /** `rustHandle.getNamespaces()`. Never handed out: callers get a copy. */
    namespaces?: string[];
    /** `rustHandle.getTypeName(name)`, by name. */
    typeNames: Map<string, string>;
    /** `rustHandle.resolveType(context, type)`, by type (the context only words an error). */
    resolvedTypes: Map<string, string>;
}

/* istanbul ignore next */
const managerReadMemos = new WeakMap<object, ManagerReadMemo>();

/**
 * Whether `memo` is still `manager`'s (see `ManagerReadMemo`).
 * @param {object} manager - the BaseModelManager
 * @param {object} memo - its memo
 * @return {boolean} true if it may be used
 * @private
 */
/* istanbul ignore next */
function managerReadMemoValid(manager: { modelFiles: object; rustHandle: object }, memo: ManagerReadMemo): boolean {
    return memo.generation === engineViews().modelGeneration() && memo.modelFiles === manager.modelFiles &&
        memo.handle === manager.rustHandle;
}

/**
 * `manager`'s memo, started afresh when the model epoch, its `modelFiles`
 * map or its rustHandle has changed.
 * @param {object} manager - the BaseModelManager
 * @return {ManagerReadMemo} its current memo
 * @private
 */
/* istanbul ignore next */
function managerReadMemo(manager: { modelFiles: object; rustHandle: object }): ManagerReadMemo {
    let memo = managerReadMemos.get(manager);
    if (!memo || !managerReadMemoValid(manager, memo)) {
        memo = {
            generation: engineViews().modelGeneration(),
            modelFiles: manager.modelFiles,
            handle: manager.rustHandle,
            typeNames: new Map(),
            resolvedTypes: new Map(),
        };
        managerReadMemos.set(manager, memo);
    }
    return memo;
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
     modelFiles: Record<string, ModelFileInstance>;
     processFile: (fileName: string | null, modelInput: string | unknown) => ModelFileSource;
     factory: Factory;
     serializer: Serializer;
     decoratorFactories: DecoratorFactory[];
     options: ModelManagerOptions | undefined;
     decoratorValidation: NonNullable<ModelManagerOptions['decoratorValidation']>;
     metamodelModelFile: ModelFileInstance;
    /**
     * (P4-08): a live concerto-wasm ModelManagerHandle, mirroring every
     * addModelFile/updateModelFile/deleteModelFile call this manager makes
     * for a namespace `needsRustMirror` allows (the decorator/root system
     * models and the transient metamodel validation file are excluded,
     * since rustHandle's own constructor already loads the first two, and
     * the third is never meant to be permanent). Always set by the end of
     * the constructor.
     * @internal
     */
     rustHandle: { [binding: string]: (...args: any[]) => any };
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
     * Create the ModelManager.
     * @constructor
     * @param {object} [options] - ModelManager options, also passed to Serializer
     * @param {Object} [options.regExp] - An alternative regular expression engine.
     * @param {boolean} [options.metamodelValidation] - When true, modelfiles will be validated
     * @param {boolean} [options.addMetamodel] - When true, the Concerto metamodel is added to the model manager
    * @param {boolean} [options.dangerouslyAllowReservedSystemTypeNamesInUserModels] - Transitional escape hatch; when true, declarations may use reserved system type names
     * @param {object} [options.decoratorValidation] - the decorator validation configuration
     * @param {string} [options.decoratorValidation.missingDecorator] - the validation log level for missingDecorator decorators: off, warning, error
     * @param {string} [options.decoratorValidation.invalidDecorator] - the validation log level for invalidDecorator decorators: off, warning, error
     * @param {*} [processFile] - how to obtain a concerto AST from an input to the model manager
    */
    constructor(options?: ModelManagerOptions, processFile?: (fileName: string | null, modelInput: string | unknown) => ModelFileSource) {
        this.processFile = processFile ? processFile : defaultProcessFile;
        this.modelFiles = {};
        this.factory = new Factory(this);
        this.serializer = new Serializer(this.factory, this, options);
        this.decoratorFactories = [];
        this.options = options;
        this.decoratorValidation = options?.decoratorValidation ? options?.decoratorValidation : DEFAULT_DECORATOR_VALIDATION;
        this.rustHandle = new (rust.ModelManagerHandle as unknown as { new(): { [binding: string]: (...args: any[]) => any } })();
        // P4-08 (accordproject/concerto-rust#67, maintainer decision
        // 2026-09-26): propagate both TS validation options rustHandle's
        // own validation was previously blind to (P4-08e/#189 added the
        // decorator-validation binding; the reserved-system-type-names
        // one already existed) *before* addDecoratorModel/addRootModel
        // below mirror anything into it, so `ModelFile.validate()`'s
        // Rust delegation (introspect/modelfile.ts) and rustHandle's own
        // add/validate paths see the same options TS's own validate()
        // body reads from `this.options`/`this.decoratorValidation`.
        this.rustHandle.setDangerouslyAllowReservedSystemTypeNamesInUserModels(
            !!options?.dangerouslyAllowReservedSystemTypeNamesInUserModels
        );
        this.rustHandle.setDecoratorValidation(this.decoratorValidation);
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

        const m = new ModelFile(this, decoratorModelAst, decoratorModelCto, decoratorModelFile);

        this.addModelFile(m, decoratorModelCto, decoratorModelFile, true);
    }

    /**
     * Whether a namespace needs to be written into `rustHandle`: every
     * namespace but the decorator/root system models, which `rustHandle`'s
     * own constructor already loads. The metamodel namespace is written
     * like any other (P5-31, accordproject/concerto-rust#341), so a manager
     * a user adds the metamodel to (`newMetaModelManager`, or
     * `addModelFile` of a metamodel ModelFile) keeps rustHandle in parity
     * and answers its reads from Rust. The only metamodel copy that is
     * never written is `validateAst`'s own (`metamodelModelFile`): it is
     * not staged while the constructor builds it (`_buildingMetamodelCopy`),
     * and `validateAst` registers it in `this.modelFiles` only when
     * rustHandle already holds its own copy.
     * @param {string} namespace - the namespace being added, updated or removed
     * @return {boolean} true if `namespace` needs writing to `rustHandle`
     * @private
     * @internal
     */
    /* istanbul ignore next */
    _needsRustWrite(namespace) {
        if (EXCLUDE_NS.includes(namespace)) {
            return false;
        }
        return !(namespace === MetaModelNamespace && this._buildingMetamodelCopy);
    }

    /**
     * Whether a model file is mirrored into `rustHandle`: every model file
     * built by the ModelFile constructor, and so through the engine path
     * (engine/views.ts `isEngineBuilt`). A stub `ModelFile` the constructor
     * never ran for (a white-box test's `sinon.createStubInstance(ModelFile)`, whose
     * `getAst()`/`getDefinitions()` answer whatever that test configured) is
     * the one exception: it is never written to `rustHandle`, so its
     * namespace is missing there and `_rustHandleMatchesModelFiles` sends
     * reads to the TS body. That is the only case the TS body still serves.
     * Every mirror write for an engine-built file runs unguarded: its error
     * propagates with its exception class (accordproject/concerto-rust#262).
     * @param {ModelFile} modelFile - the model file
     * @return {boolean} true if `modelFile` is mirrored into rustHandle
     * @private
     * @internal
     */
    /* istanbul ignore next */
    _isMirrored(modelFile) {
        return engineViews().isEngineBuilt(modelFile);
    }

    /**
     * The rustHandle write for a model file being added: registers the file
     * Rust already loaded when the `ModelFile` was constructed (P5-10a lazy
     * views, engine/views.ts `commitStaged`), or else sends its AST, as
     * before. A namespace `_needsRustWrite` excludes is never written; its
     * stage, if any, is dropped. A stub `ModelFile` is not
     * written at all (`_isMirrored`). Any error the write throws propagates.
     * @param {ModelFile} modelFile - the model file being added
     * @return {boolean} true if the namespace was written to rustHandle
     * @private
     * @internal
     */
    /* istanbul ignore next */
    _rustMirrorAdd(modelFile) {
        if (!this._isMirrored(modelFile)) {
            return false;
        }
        if (!this._needsRustWrite(modelFile.getNamespace())) {
            engineViews().dropStaged(modelFile, this.rustHandle);
            return false;
        }
        if (!engineViews().commitStaged(modelFile, this.rustHandle)) {
            // `ModelFile`'s constructor only rejects a *truthy* non-string
            // `definitions`/`fileName`: `0`, `false` and `NaN` are stored
            // as-is and reach here raw. Only a genuine string is forwarded
            // to the wasm `Option<String>` params, matching v5.0.0 (which
            // makes no wasm call at all) (accordproject/concerto-rust#294
            // follow-up).
            const definitions = modelFile.getDefinitions();
            const fileName = modelFile.getName();
            this.rustHandle.addModelWithDefinitions(
                JSON.stringify(modelFile.getAst()),
                typeof definitions === 'string' ? definitions : undefined,
                typeof fileName === 'string' ? fileName : undefined,
                false,
            );
        }
        return true;
    }

    /**
     * The rustHandle write for a model file replacing `existing`: an update
     * when both are mirrored, an add when only the new one is, and a delete
     * when only `existing` is, so that rustHandle never keeps answering for
     * a namespace whose TS file is now a stub (`_isMirrored`). Any error the
     * write throws propagates.
     * @param {ModelFile} existing - the model file being replaced
     * @param {ModelFile} modelFile - the model file replacing it
     * @private
     * @internal
     */
    /* istanbul ignore next */
    _rustMirrorUpdate(existing, modelFile) {
        const namespace = modelFile.getNamespace();
        const wasMirrored = this._isMirrored(existing) && this._needsRustWrite(namespace);
        if (!this._isMirrored(modelFile)) {
            // `updateModelFile`'s public API accepts any object with a
            // `getNamespace()` (not only a real `ModelFile`), so `namespace`
            // is not guaranteed to be a string here the way it is for an
            // engine-built file. `rustHandle.deleteModelFile` takes a WASM
            // `&str`: guard it the same way the public `deleteModelFile`
            // does (accordproject/concerto-rust#294 follow-up).
            if (wasMirrored && typeof namespace === 'string') {
                this.rustHandle.deleteModelFile(namespace);
            }
            return;
        }
        // P5-10a: an update always sends the AST (updateModelFile), so a
        // lazily built file's stage is dropped rather than committed.
        engineViews().dropStaged(modelFile, this.rustHandle);
        if (!this._needsRustWrite(namespace)) {
            return;
        }
        if (!wasMirrored) {
            // Same falsy-non-string forward as `_rustMirrorAdd`: only a
            // genuine string reaches the wasm `Option<String>` params
            // (accordproject/concerto-rust#294 follow-up).
            const addDefinitions = modelFile.getDefinitions();
            const addFileName = modelFile.getName();
            this.rustHandle.addModelWithDefinitions(
                JSON.stringify(modelFile.getAst()),
                typeof addDefinitions === 'string' ? addDefinitions : undefined,
                typeof addFileName === 'string' ? addFileName : undefined,
                false,
            );
            return;
        }
        // TS has already validated (or was asked not to); the mirror call
        // only needs to keep rustHandle's state in sync, so it never
        // re-validates itself.
        const updateDefinitions = modelFile.getDefinitions();
        const updateFileName = modelFile.getName();
        this.rustHandle.updateModelFile(
            JSON.stringify(modelFile.getAst()),
            typeof updateDefinitions === 'string' ? updateDefinitions : undefined,
            typeof updateFileName === 'string' ? updateFileName : undefined,
            false,
        );
    }

    /**
     * Whether `rustHandle`'s mirror currently matches `this.modelFiles`
     * closely enough to answer a read: a content-based parity check
     * against `this.modelFiles`, computed fresh on every call. It is false
     * exactly when `this.modelFiles` holds a stub `ModelFile`
     * that was never mirrored (`_isMirrored`), or was assigned directly. A read that trusted rustHandle without this could
     * silently answer from an incomplete or differently-shaped model --
     * wrong, not merely absent, for `isAssignableTo`/`derivesFrom`'s boolean
     * results in particular, which do not otherwise surface a mismatch as a
     * thrown error the caller would catch and fall back from. Comparing the
     * namespace *sets*, not just their sizes, matters for exactly the case a
     * white-box test creates by assigning `this.modelFiles` directly
     * (bypassing `addModelFile` and the mirror entirely): a `rustHandle`
     * that mirrors only the two system models could otherwise coincidentally
     * match the count of a manager whose `modelFiles` was hand-populated
     * with two unrelated stub namespaces, and a length-only check would
     * wrongly call that trustworthy.
     * @return {boolean} true if rustHandle mirrors exactly the namespaces TS has
     * @private
     * @internal
     */
    /* istanbul ignore next */
    _rustHandleMatchesModelFiles() {
        // P5-06: rustHandle's namespaces are read across the boundary only
        // when its epoch has moved since the last read (`rustHandleReads`);
        // the comparison against this.modelFiles, which can change without
        // rustHandle knowing, still runs on every call. An error reading
        // rustHandle propagates (accordproject/concerto-rust#262).
        const reads = rustHandleReads(this.rustHandle);
        const tsNamespaces = Object.keys(this.modelFiles);
        if (reads.namespaceCount !== tsNamespaces.length) {
            return false;
        }
        return tsNamespaces.every((ns) => reads.namespaces.has(ns));
    }

    /**
     * `rustHandle.modelFileId(namespace)`, memoised for as long as
     * rustHandle's epoch is unchanged (P5-06; see `rustHandleReads`).
     * @param {string} namespace - the namespace to look up
     * @return {number|undefined} its model file handle, or undefined
     * @private
     * @internal
     */
    /* istanbul ignore next */
    _rustModelFileId(namespace: string): number | undefined {
        const reads = rustHandleReads(this.rustHandle);
        if (reads.modelFileIds.has(namespace)) {
            return reads.modelFileIds.get(namespace);
        }
        const id = this.rustHandle.modelFileId(namespace);
        reads.modelFileIds.set(namespace, id);
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
        if (typeof namespace === 'string' && (typeof fileName === 'string' || fileName === undefined || fileName === null) &&
            this._rustHandleMatchesModelFiles()) {
            // P5-11 (accordproject/concerto-rust#287): the plain Error is
            // raised by Rust (concerto-wasm `throwAlreadyExists`), naming the
            // file rustHandle holds under the namespace, which mirrors
            // this.modelFiles. A rustHandle that does not mirror
            // this.modelFiles (a W test's stub ModelFile, or a batch of
            // addModelFiles not yet mirrored) and arguments the binding
            // cannot take keep the TS body below.
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

        if(!modelFile.getVersion()) {
            throw new Error(`Cannot add an unversioned namespace: ${modelFile.getNamespace()}`);
        }

        if (!this.modelFiles[modelFile.getNamespace()]) {
            if (!disableValidation) {
                // Structural validation against the Metamodel
                if(this.options?.metamodelValidation){
                    this.validateAst(modelFile);
                }

                // Semantic validation of the model file.
                //
                // P4-08 steps 3-4 (accordproject/concerto-rust#67) tried
                // replacing this call site's `modelFile.validate()` with a
                // direct `rustHandle.addModelWithDefinitions(..., validate:
                // true)`/`modelFileValidateDetached` call, and reverted both
                // times: `rustHandle`'s validation didn't yet know about
                // `ModelManagerOptions` (`decoratorValidation`,
                // `dangerouslyAllowReservedSystemTypeNamesInUserModels`), and
                // bypassing this call site entirely also skipped a
                // `sinon.createStubInstance(ModelFile)` collaborator's
                // stubbed `validate` outright, failing the several
                // `test/modelmanager.js` cases that assert
                // `sinon.assert.calledOnce(mf1.validate)`.
                //
                // Maintainer decision (2026-09-26), once P4-08e (#189) added
                // the missing `setDecoratorValidation` binding (the reserved-
                // system-type-names one already existed): keep calling
                // `modelFile.validate()` here unchanged -- a stub's spy still
                // sees exactly one call, since sinon replaces `validate`
                // wholesale for such an object -- and instead delegate fully
                // to Rust *inside* `ModelFile.prototype.validate()` itself
                // (introspect/modelfile.ts), which only a real instance ever
                // runs. `BaseModelManager`'s constructor now propagates both
                // options to `rustHandle` before this call can be reached.
                modelFile.validate();
            }
            // Mirrored first, so a mirror error leaves both unchanged.
            this._rustMirrorAdd(modelFile);
            this.modelFiles[modelFile.getNamespace()] = modelFile;
            // P5-14: a model change drops the cached property lookups.
            engineViews().invalidatePropertyLookups();
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
            this.rustHandle.validateAstValue(JSON.stringify(modelFile.getAst()));
        } catch (err) {
            // rustHandle's own validate_ast (concerto-core
            // ModelManager::validate_ast) only leaks its copy of the
            // metamodel when the *structural* check (`deserialize_ast`)
            // fails after the version check already passed -- a
            // version-mismatch failure returns before the metamodel is ever
            // inserted, so rustHandle never registers it. Mirroring the leak
            // unconditionally on every error would register the metamodel in
            // `this.modelFiles` on a version mismatch that rustHandle itself
            // never registered, permanently diverging from
            // `_rustHandleMatchesModelFiles()`'s parity check afterwards.
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
                engineViews().invalidatePropertyLookups();
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
        this._rustMirrorUpdate(existing, modelFile);
        this.modelFiles[modelFile.getNamespace()] = modelFile;
        engineViews().invalidatePropertyLookups();
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
            // Mirrored first, so a mirror error leaves both unchanged. A
            // stub file was never mirrored (`_isMirrored`). `this.modelFiles[namespace]`
            // above coerces `namespace` to a string key (matching v5.0.0,
            // which deletes cleanly for a non-string whose string form is a
            // loaded namespace), but `rustHandle.deleteModelFile` takes a
            // WASM `&str`: a non-string reaching it traps the engine
            // (accordproject/concerto-rust#294 follow-up). Only a genuine
            // string is sent to Rust; the TS-side delete below still runs
            // for any type, as v5.0.0 does.
            /* istanbul ignore next */
            if (typeof namespace === 'string' && this._needsRustWrite(namespace) && this._isMirrored(this.modelFiles[namespace])) {
                this.rustHandle.deleteModelFile(namespace);
            }
            delete this.modelFiles[namespace];
            engineViews().invalidatePropertyLookups();
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

        try {
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
                    m = modelFile;
                }
                if (!m.getVersion()) {
                    throw new Error(`Cannot add an unversioned namespace: ${m.getNamespace()}`);
                }
                if (!this.modelFiles[m.getNamespace()]) {
                    this.modelFiles[m.getNamespace()] = m;
                    engineViews().invalidatePropertyLookups();
                    newModelFiles.push(m);
                } else {
                    this._throwAlreadyExists(m);
                }
            }

            // Mirror the newly added files into rustHandle (P4-08,
            // accordproject/concerto-rust#67) *before* validating: unlike
            // addModelFile, addModelFile is never called here (this method
            // adds every file to this.modelFiles directly, in whatever order
            // the caller gave, precisely so cross-file dependency order does
            // not matter -- see the method doc), so without this, rustHandle
            // never learned about any namespace added through addModelFiles
            // at all. Since `ModelFile.validate()` (introspect/modelfile.ts)
            // now delegates fully to Rust (maintainer decision, 2026-09-26)
            // and a file in this batch may import from *another* file in the
            // very same batch, every one of them must already be visible to
            // rustHandle's own manager before validateModelFiles() below
            // validates any of them, the same way this.modelFiles is already
            // fully populated above first. `addModelWithDefinitions`'s own
            // `validate` flag stays false: this is a structural mirror write
            // only, and TS's own validateModelFiles() below is still what
            // decides pass/fail.
            newModelFiles.forEach((m) => {
                if (this._rustMirrorAdd(m)) {
                    mirroredNamespaces.add(m.getNamespace());
                }
            });

            // re-validate all the model files
            if (!disableValidation) {
                this.validateModelFiles();
            }

            // return the model files.
            return newModelFiles;
        } catch (err) {
            this.modelFiles = {};
            Object.assign(this.modelFiles, originalModelFiles);
            // Undo any rustHandle mirroring this batch made: a
            // partially-mirrored or now-invalid batch must not leave
            // rustHandle out of sync with `this.modelFiles`, which the lines
            // above already rolled back. Only namespaces this batch actually
            // attempted to mirror (`mirroredNamespaces`) are deleted here: the
            // failure that landed us in this catch can happen before the
            // mirror loop above ever runs (a duplicate namespace via
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
            });
            throw err;
        } finally {
            debug(NAME, newModelFiles);
        }
    }

    /**
     * Validates all models files in this model manager
     */
    validateModelFiles() {
        /* istanbul ignore next */
        if (this._rustHandleMatchesModelFiles()) {
            // P5-11 (accordproject/concerto-rust#287): every model file is
            // validated in one Rust call (concerto-wasm `validateModelFiles`)
            // rather than one `modelFile.validate()` crossing per file; the
            // first error found is thrown naming the ModelFile of this
            // manager it was found in, as that file's own validate() does.
            this.rustHandle.validateModelFiles(this.modelFiles);
            return;
        }
        // P4-08 (accordproject/concerto-rust#67, maintainer decision
        // 2026-09-26): a rustHandle that does not mirror this.modelFiles (a
        // W test's stub ModelFile, whose stubbed `validate` spy must see its
        // call) validates each file through its own `validate()`, which
        // delegates fully to Rust for a real `ModelFile`, since `rustHandle`
        // is told about `ModelManagerOptions` (`decoratorValidation`,
        // `dangerouslyAllowReservedSystemTypeNamesInUserModels`) by
        // `BaseModelManager`'s constructor.
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

            /* istanbul ignore next */
            if (this._rustHandleMatchesModelFiles() &&
                views.every((mf) => this._isMirrored(mf) && this._needsRustWrite(mf.getNamespace()))) {
                // P5-11 (accordproject/concerto-rust#287): rustHandle adds
                // each file (or replaces the file under its namespace) and
                // validates every model file, in one call that leaves it
                // unchanged when it fails (concerto-wasm
                // `updateExternalModels`). Only then do the views replace
                // this.modelFiles' entries, so a failure leaves both
                // unchanged. A rustHandle that does not mirror
                // this.modelFiles (a W test's stub ModelFile) and a
                // namespace rustHandle is never written for
                // (`_needsRustWrite`) keep the TS body below.
                try {
                    const next: Record<string, ModelFileInstance> = Object.assign({}, this.modelFiles);
                    views.forEach((mf) => {
                        next[mf.getNamespace()] = mf;
                    });
                    // Only a genuine string crosses for `definitions` and
                    // `fileName` (accordproject/concerto-rust#294 follow-up),
                    // as for every other mirror write.
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
                } finally {
                    // rustHandle loaded each file from `sources`, not from
                    // the stage its constructor made.
                    views.forEach((mf) => engineViews().dropStaged(mf, this.rustHandle));
                }
                views.forEach((mf) => {
                    this.modelFiles[mf.getNamespace()] = mf;
                });
                engineViews().invalidatePropertyLookups();
                return views;
            }

            // Each file is added or replaces the file under its namespace
            // without validation, and every file is then validated. Each
            // add or update writes rustHandle too, so a failure undoes
            // those writes, newest first, before this.modelFiles is
            // restored below: an added file is deleted from rustHandle
            // again, and a replaced one is replaced by the file it replaced
            // (`_rustMirrorUpdate`). An error the undo raises propagates
            // (accordproject/concerto-rust#262).
            const externalModelFiles: ModelFileInstance[] = [];
            const applied: [ModelFileInstance, ModelFileInstance | undefined][] = [];
            try {
                views.forEach((mf) => {
                    const existing = this.modelFiles[mf.getNamespace()];

                    if (existing) {
                        externalModelFiles.push(this.updateModelFile(mf, mf.getName(), true)); // disable validation
                    } else {
                        externalModelFiles.push(this.addModelFile(mf, null, mf.getName(), true)); // disable validation
                    }
                    applied.push([mf, existing]);
                });

                // now everything is applied, we need to revalidate all models
                this.validateModelFiles();
                return externalModelFiles;
            } catch (err) {
                applied.reverse().forEach(([mf, existing]) => {
                    const namespace = mf.getNamespace();
                    if (existing) {
                        this._rustMirrorUpdate(mf, existing);
                    } else if (this._isMirrored(mf) && this._needsRustWrite(namespace)) {
                        this.rustHandle.deleteModelFile(namespace);
                    }
                });
                throw err;
            }
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
    resolveType(context, type) {
        /* istanbul ignore next */
        if (typeof context === 'string' && typeof type === 'string') {
            // P5-29: a type the engine resolved since the last model change
            // is answered from the memo (`ManagerReadMemo`), without
            // crossing into the engine.
            const memo = managerReadMemo(this);
            const resolved = memo.resolvedTypes.get(type);
            if (resolved !== undefined) {
                return resolved;
            }
            if (this._rustHandleMatchesModelFiles()) {
                // The mirror holds exactly TS's namespaces, so the engine's
                // answer is final, including any error it throws
                // (accordproject/concerto-rust#262). Only a rustHandle that
                // does not match this.modelFiles (a W test's stub ModelFile
                // never reached it: see _isMirrored) takes the TS body below,
                // as do non-string arguments, which the binding's `&str`
                // parameters cannot take (a JS non-string traps the engine).
                const result: string = this.rustHandle.resolveType(context, type);
                if (managerReadMemoValid(this, memo)) {
                    memo.resolvedTypes.set(type, result);
                }
                return result;
            }
        }
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
        // Every mirrored model file is gone; rustHandle has no bulk clear,
        // so start it over the same way `new BaseModelManager()` does.
        // addDecoratorModel/addRootModel below re-populate TS's
        // this.modelFiles, and _needsRustWrite skips mirroring them since
        // the fresh handle's own constructor already has them.
        /* istanbul ignore next */
        this.rustHandle = new (rust.ModelManagerHandle as unknown as { new(): { [binding: string]: (...args: any[]) => any } })();
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
        if ((typeof fileName === 'string' || fileName === undefined) && this._rustHandleMatchesModelFiles()) {
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
        // P5-29: the engine's list is kept until the next model change
        // (`ManagerReadMemo`); each call gets its own copy, so changing the
        // returned array reaches neither the memo nor the engine.
        /* istanbul ignore next */
        const memo = managerReadMemo(this);
        /* istanbul ignore next */
        if (memo.namespaces) {
            return memo.namespaces.slice();
        }
        const namespaces = Object.keys(this.modelFiles);
        /* istanbul ignore next */
        if (this._rustHandleMatchesModelFiles()) {
            const result: string[] = this.rustHandle.getNamespaces();
            if (managerReadMemoValid(this, memo)) {
                memo.namespaces = result.slice();
            }
            return result;
        }
        return namespaces;
    }

    /**
     * Look up a type in all registered namespaces.
     *
     * @param {string} qualifiedName - fully qualified type name.
     * @return {ClassDeclaration} - the class declaration for the specified type.
     * @throws {TypeNotFoundException} - if the type cannot be found or is a primitive type.
     */
    getType(qualifiedName) {
        /* istanbul ignore next */
        if (typeof qualifiedName === 'string') {
            // P5-29: the fully-qualified name the engine answered since the
            // last model change is kept (`ManagerReadMemo`); it is still
            // mapped to its view below on every call.
            const memo = managerReadMemo(this);
            let fqn = memo.typeNames.get(qualifiedName);
            if (fqn === undefined && this._rustHandleMatchesModelFiles()) {
                // P5-11 (accordproject/concerto-rust#287): resolved in Rust
                // (concerto-wasm `getTypeName`), which throws the
                // TypeNotFoundException TS throws. Rust answers with the
                // declaration's fully-qualified name, mapped here to its view
                // in the model file of its namespace. A rustHandle that does
                // not mirror this.modelFiles (a W test's stub ModelFile) and a
                // non-string name, which the binding's `&str` parameter cannot
                // take, keep the TS body below.
                fqn = this.rustHandle.getTypeName(qualifiedName) as string;
                if (managerReadMemoValid(this, memo)) {
                    memo.typeNames.set(qualifiedName, fqn);
                }
            }
            if (fqn !== undefined) {
                return this.modelFiles[fqn.substring(0, fqn.lastIndexOf('.'))].getLocalType(fqn);
            }
        }

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
        // Non-string arguments take the TS body: the binding's `&str`
        // parameters cannot take them (a JS non-string traps the engine).
        /* istanbul ignore next */
        if (typeof fqt1 === 'string' && typeof fqt2 === 'string' && this._rustHandleMatchesModelFiles()) {
            return this.rustHandle.derivesFrom(fqt1, fqt2);
        }
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
        // Non-string arguments take the TS body: the binding's `&str`
        // parameters cannot take them (a JS non-string traps the engine;
        // accordproject/concerto-rust#294, follow-up to #262).
        /* istanbul ignore next */
        if (typeof fqn === 'string' && typeof baseFqn === 'string' && this._rustHandleMatchesModelFiles()) {
            return this.rustHandle.isAssignableTo(fqn, baseFqn);
        }
        let typeDeclaration;
        try {
            typeDeclaration = this.getType(fqn);
        } catch (e) {
            return false;
        }

        if (typeDeclaration.isAbstract()) {
            return false;
        }

        return this.derivesFrom(fqn, baseFqn);
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
     * @param {Object} [options] - options for the filter method
     * @param {boolean} [options.disableValidation] — If true then the model files are not validated
     * @returns {BaseModelManager} - the filtered ModelManager
     */
    filter(predicate, options?){
        const modelManager = new BaseModelManager({...this.options}, this.processFile);
        const filteredModels: ModelFileInstance[] = [];

        for (const modelFile of Object.values(this.modelFiles) as ModelFileInstance[]) {
            if (modelFile.isSystemModelFile()) {
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
