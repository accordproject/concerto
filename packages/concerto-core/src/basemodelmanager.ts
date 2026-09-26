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
import MetamodelException from './metamodelexception';
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

// CONCERTO_ENGINE=rust: the Rust engine, or null in ts mode (src/engine/index.ts).
// See classdeclaration.ts's own copy of this comment for the bundler/webpack
// reasoning this loader relies on.
declare const __webpack_require__: unknown;
declare const __non_webpack_require__: NodeRequire;
/* istanbul ignore next */
const loadEngine = (specifier: string) =>
    typeof __webpack_require__ === 'function' ? __non_webpack_require__(specifier) : module.require(specifier);
/* istanbul ignore next */
const rust: { [binding: string]: (...args: any[]) => never } | null =
    typeof process !== 'undefined' && process.env?.CONCERTO_ENGINE === 'rust' ? loadEngine('./engine').rust : null;

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
     * rust mode only (P4-08): a live concerto-wasm ModelManagerHandle,
     * mirroring every addModelFile/updateModelFile/deleteModelFile call
     * this manager makes for a namespace `_rustMirrorEligible` allows (the
     * decorator/root system models and the transient metamodel validation
     * file are excluded, since rustHandle's own constructor already loads
     * the first two, and the third is never meant to be permanent). Null
     * in ts mode, and null here in rust mode until the constructor creates
     * it.
     * @internal
     */
     rustHandle: { [binding: string]: (...args: any[]) => any } | null;
    /**
     * rust mode only (P4-08): set once a `_mirrorToRust` write has failed
     * (see `_mirrorToRust`/`_rustMirrorTrustworthy`), so a stale mirror
     * read never answers from `rustHandle` again until `clearModelFiles`
     * starts it over.
     * @internal
     */
     _rustMirrorStale: boolean;
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
        this.rustHandle = null;
        this._rustMirrorStale = false;
        this.decoratorValidation = options?.decoratorValidation ? options?.decoratorValidation : DEFAULT_DECORATOR_VALIDATION;
        /* istanbul ignore if */
        if (rust) {
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
        }
        this.addDecoratorModel();
        this.addRootModel();

        // Cache a copy of the Metamodel ModelFile for use when validating the structure of ModelFiles later.
        this.metamodelModelFile = new ModelFile(this, MetaModelUtil.metaModelAst as AstNode, undefined, MetaModelNamespace);

        if(options?.addMetamodel) {
            this.addModelFile(this.metamodelModelFile);
            // P4-08 (accordproject/concerto-rust#67): `_rustMirrorEligible`
            // excludes `MetaModelNamespace` on the assumption that
            // rustHandle's own constructor already preloads it the way it
            // preloads the decorator/root system models (`EXCLUDE_NS`) --
            // it does not (concerto-wasm's `ModelManagerHandle::new`/
            // `ModelManager::new` load only `concerto@1.0.0` and
            // `concerto.decorator@1.0.0`). Since `ModelFile.validate()` now
            // delegates fully to Rust (maintainer decision, 2026-09-26), a
            // model that imports from `concerto.metamodel@1.0.0` (e.g.
            // `DecoratorManager`'s own `DCS_MODEL`, via a manager built with
            // `addMetamodel: true`) needs rustHandle's own manager to
            // resolve that namespace too, not just `this.modelFiles`.
            // Mirror it explicitly here, guarded against the case where
            // `validateAst`'s own leak-tracking (above) already registered
            // it in rustHandle.
            /* istanbul ignore next */
            if (rust && this.rustHandle && this.rustHandle.modelFileId(MetaModelNamespace) === undefined) {
                this._mirrorToRust(() => this.rustHandle!.addModelWithDefinitions(
                    JSON.stringify(this.metamodelModelFile.getAst()),
                    this.metamodelModelFile.getDefinitions() ?? undefined,
                    this.metamodelModelFile.getName() ?? undefined,
                    false,
                ));
            }
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
     * Whether a namespace should be mirrored into `rustHandle` (P4-08):
     * every namespace but the decorator/root system models -- already
     * mirrored by `rustHandle`'s own constructor -- and the transient
     * metamodel file `validateAst` registers and removes around its own
     * deserialisation check.
     * @param {string} namespace - the namespace being added, updated or removed
     * @return {boolean} true if `namespace` should be mirrored
     * @private
     * @internal
     */
    /* istanbul ignore next */
    _rustMirrorEligible(namespace) {
        return !EXCLUDE_NS.includes(namespace) && namespace !== MetaModelNamespace;
    }

    /**
     * Runs a rustHandle mirror write, swallowing any error it throws
     * (P4-08; PORTING.md's context-trait fallback for the W tests this
     * group's ledger names): a stub `ModelFile` a white-box test builds
     * with `sinon.createStubInstance` answers `getAst()`/`getDefinitions()`
     * with whatever that test configured, often not a real AST, so mirroring
     * it can fail even though the TS-side write above already succeeded and
     * must not be undone by this best-effort cache sync. `resolveType`,
     * `derivesFrom`, `isAssignableTo` and `getNamespaces` fall back to their
     * TS body themselves when a stale or partial mirror makes rustHandle
     * unusable for a given call.
     *
     * A swallowed failure permanently marks `_rustMirrorStale` (review on
     * P4-08, accordproject/concerto-rust#67): the write that failed may have
     * been an *update* to a namespace rustHandle already had, so the
     * `getNamespaces().length` parity check in `_rustMirrorTrustworthy`
     * alone cannot see it -- that check's count would still match, and
     * every later read would then silently answer from that namespace's old
     * content instead of falling back to TS. Only `clearModelFiles` (a fresh
     * `rustHandle`) clears the flag.
     * @param {Function} fn - the mirror write to run
     * @private
     * @internal
     */
    /* istanbul ignore next */
    _mirrorToRust(fn) {
        try {
            fn();
        } catch (e) {
            this._rustMirrorStale = true;
            debug('_mirrorToRust', 'rustHandle mirror failed, continuing on the TS-only state', e);
        }
    }

    /**
     * Whether `rustHandle`'s mirror is complete enough to answer a read
     * (P4-08): `_rustMirrorStale` catches a swallowed write failure of any
     * kind (add, update or delete -- see `_mirrorToRust`), and a
     * content-based parity check against `this.modelFiles`, the source of
     * truth `_mirrorToRust` can never make stale, is kept as a
     * belt-and-braces check for any divergence that reaches rustHandle by a
     * path other than `_mirrorToRust` (none exists today, but a read that
     * trusts rustHandle without it could silently answer from an incomplete
     * or differently-shaped model -- wrong, not merely absent, for
     * `isAssignableTo`/`derivesFrom`'s boolean results in particular, which
     * do not otherwise surface a mismatch as a thrown error the caller
     * would catch and fall back from). Comparing the namespace *sets*,
     * not just their sizes, matters for exactly the case a white-box test
     * creates by assigning `this.modelFiles` directly (bypassing
     * `addModelFile`/`_mirrorToRust` entirely): a `rustHandle` that mirrors
     * only the two system models could otherwise coincidentally match the
     * count of a manager whose `modelFiles` was hand-populated with two
     * unrelated stub namespaces, and a length-only check would wrongly
     * call that trustworthy.
     * @return {boolean} true if rustHandle mirrors exactly the namespaces TS has
     * @private
     * @internal
     */
    /* istanbul ignore next */
    _rustMirrorTrustworthy() {
        if (!this.rustHandle || this._rustMirrorStale) {
            return false;
        }
        try {
            const rustNamespaces: string[] = this.rustHandle.getNamespaces();
            const tsNamespaces = Object.keys(this.modelFiles);
            if (rustNamespaces.length !== tsNamespaces.length) {
                return false;
            }
            const rustNamespaceSet = new Set(rustNamespaces);
            return tsNamespaces.every((ns) => rustNamespaceSet.has(ns));
        } catch (e) {
            return false;
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
            this.modelFiles[modelFile.getNamespace()] = modelFile;
            /* istanbul ignore next */
            if (rust && this.rustHandle && this._rustMirrorEligible(modelFile.getNamespace())) {
                this._mirrorToRust(() => this.rustHandle!.addModelWithDefinitions(
                    JSON.stringify(modelFile.getAst()),
                    modelFile.getDefinitions() ?? undefined,
                    modelFile.getName() ?? undefined,
                    false,
                ));
            }
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
        // P4-08 step 2 (accordproject/concerto-rust#67): delegates to
        // rustHandle.validateAst (P4-08b, concerto-wasm), which runs the
        // same version check plus structural (metamodel) check as the TS
        // body below, over the AST alone -- it needs no registered model
        // file, so a stale or partially mirrored rustHandle (a W test's
        // stub ModelFile never reached it: see _mirrorToRust) is not a
        // reason to distrust it here the way a read over `this.modelFiles`
        // would be; only `rust` (engine mode) gates delegation. A thrown
        // error already arrives as the mapped `MetamodelException` (or
        // other TS exception class, src/engine/errors.ts) via the host
        // error factory, so it propagates unchanged -- this never falls
        // back to the TS body on a genuine validation failure, only when
        // rustHandle itself is unavailable.
        /* istanbul ignore next */
        if (rust && this.rustHandle) {
            const alreadyHasMetamodel = !!this.getModelFile(MetaModelNamespace);
            try {
                this.rustHandle.validateAst(
                    JSON.stringify(modelFile.getAst()),
                    modelFile.getName() ?? undefined,
                );
            } catch (err) {
                // rustHandle's own validate_ast (concerto-core
                // ModelManager::validate_ast) only leaks its copy of the
                // metamodel when the *structural* check
                // (`deserialize_ast`) fails after the version check already
                // passed -- a version-mismatch failure returns before the
                // metamodel is ever inserted, so rustHandle never registers
                // it, matching the TS body below (its own version check,
                // lines above, throws before `alreadyHasMetamodel` is even
                // read). Mirroring the leak unconditionally on every error
                // (an earlier pass's bug, review comment on P4-08,
                // accordproject/concerto-rust#67) would register the
                // metamodel in `this.modelFiles` on a version mismatch that
                // rustHandle itself never registered, permanently failing
                // `_rustMirrorTrustworthy()`'s parity check afterwards.
                // Ask rustHandle for the ground truth instead of
                // re-deriving TS's own control flow: mirror into
                // `this.modelFiles` only when rustHandle's own handle
                // now actually holds `MetaModelNamespace`.
                // MetaModelNamespace is excluded from _rustMirrorEligible,
                // so this only ever writes this.modelFiles, never
                // rustHandle (which already holds its own copy in the case
                // that reaches it).
                if (!alreadyHasMetamodel && this.rustHandle.modelFileId(MetaModelNamespace) !== undefined) {
                    this.addModelFile(this.metamodelModelFile, undefined, MetaModelNamespace, true);
                }
                throw err;
            }
            return;
        }
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
        } catch (err: unknown) {
            const error = err as Error;
            throw new MetamodelException(error.message);
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
        } else {
            let existing = this.modelFiles[modelFile.getNamespace()];
            if (!existing) {
                throw new Error(`Model file for namespace ${modelFile.getNamespace()} not found`);
            }
            if (!modelFile.getVersion()) {
                throw new Error(`Cannot update with an unversioned namespace: ${modelFile.getNamespace()}`);
            }
            if (!disableValidation) {
                modelFile.validate();
            }
        }
        this.modelFiles[modelFile.getNamespace()] = modelFile;
        /* istanbul ignore next */
        if (rust && this.rustHandle && this._rustMirrorEligible(modelFile.getNamespace())) {
            // TS has already validated (or was asked not to) above; the
            // mirror call only needs to keep rustHandle's state in sync, so
            // it never re-validates itself.
            this._mirrorToRust(() => this.rustHandle!.updateModelFile(
                JSON.stringify(modelFile.getAst()),
                modelFile.getDefinitions() ?? undefined,
                modelFile.getName() ?? undefined,
                false,
            ));
        }
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
            /* istanbul ignore next */
            if (rust && this.rustHandle && this._rustMirrorEligible(namespace)) {
                this._mirrorToRust(() => this.rustHandle!.deleteModelFile(namespace));
            }
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
            /* istanbul ignore next */
            if (rust && this.rustHandle) {
                newModelFiles.forEach((m) => {
                    if (this._rustMirrorEligible(m.getNamespace())) {
                        mirroredNamespaces.add(m.getNamespace());
                        this._mirrorToRust(() => this.rustHandle!.addModelWithDefinitions(
                            JSON.stringify(m.getAst()),
                            m.getDefinitions() ?? undefined,
                            m.getName() ?? undefined,
                            false,
                        ));
                    }
                });
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
            // Undo any rustHandle mirroring this batch made, best-effort
            // (P4-08): matches `_mirrorToRust`'s own "the mirror is never
            // allowed to break the TS invariant" contract -- a
            // partially-mirrored or now-invalid batch must not leave
            // rustHandle out of sync with `this.modelFiles`, which the lines
            // above already rolled back. Only namespaces this batch actually
            // attempted to mirror (`mirroredNamespaces`) are deleted here: the
            // failure that landed us in this catch can happen before the
            // mirror loop above ever runs (a duplicate namespace via
            // `_throwAlreadyExists`, an unversioned namespace, or a parse
            // error on a later file in the batch), in which case
            // `newModelFiles` can contain namespaces that were never mirrored
            // at all. Calling `deleteModelFile` on those throws (rustHandle
            // never heard of them), which used to set `_rustMirrorStale =
            // true` even though rustHandle and `this.modelFiles` were still
            // in agreement, permanently forcing `ModelFile.validate()` back
            // onto the TS body for the rest of the manager's life.
            /* istanbul ignore next */
            if (rust && this.rustHandle) {
                newModelFiles.forEach((m) => {
                    if (!mirroredNamespaces.has(m.getNamespace())) {
                        return;
                    }
                    try {
                        this.rustHandle!.deleteModelFile(m.getNamespace());
                    } catch (e) {
                        this._rustMirrorStale = true;
                    }
                });
            }
            throw err;
        } finally {
            debug(NAME, newModelFiles);
        }
    }

    /**
     * Validates all models files in this model manager
     */
    validateModelFiles() {
        // P4-08 (accordproject/concerto-rust#67, maintainer decision
        // 2026-09-26): this call site is unchanged -- each file's own
        // `validate()` (introspect/modelfile.ts) now delegates fully to Rust
        // for a real `ModelFile` in rust mode, since `rustHandle` is told
        // about `ModelManagerOptions` (`decoratorValidation`,
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

            const externalModelFiles: ModelFileInstance[] = [];
            externalModels.forEach((file) => {
                const mf = new ModelFile(this, file.ast as AstNode, file.definitions, file.fileName);
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
        if (rust && this._rustMirrorTrustworthy()) {
            // A stale or partially mirrored rustHandle (a W test's stub
            // ModelFile never reached it: see _mirrorToRust) falls back to
            // the TS body below, which reads this.modelFiles directly and
            // so is never stale.
            try {
                return this.rustHandle!.resolveType(context, type);
            } catch (e) {
                debug('resolveType', 'rustHandle.resolveType failed, falling back to the TS body', e);
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
        /* istanbul ignore next */
        if (rust && this.rustHandle) {
            // Every mirrored model file is gone; rustHandle has no bulk
            // clear, so start it over the same way `new BaseModelManager()`
            // does. addDecoratorModel/addRootModel below re-populate TS's
            // this.modelFiles, and _rustMirrorEligible skips mirroring them
            // since the fresh handle's own constructor already has them.
            this.rustHandle = new (rust.ModelManagerHandle as unknown as { new(): { [binding: string]: (...args: any[]) => any } })();
        }
        this._rustMirrorStale = false;
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
    getModelFileByFileName(fileName) {
        /* istanbul ignore next */
        if (rust && this._rustMirrorTrustworthy()) {
            try {
                const namespace = this.rustHandle!.modelManagerGetModelFileByFileName(fileName);
                return namespace === undefined ? undefined : this.modelFiles[namespace];
            } catch (e) {
                debug('getModelFileByFileName', 'rustHandle.modelManagerGetModelFileByFileName failed, falling back to the TS body', e);
            }
        }
        return this.getModelFiles().filter(mf => mf.getName() === fileName)[0];
    }

    /**
     * Get the namespaces registered with the ModelManager.
     * @return {string[]} namespaces - the namespaces that have been registered.
     */
    getNamespaces(): string[] {
        const namespaces = Object.keys(this.modelFiles);
        /* istanbul ignore next */
        if (rust && this._rustMirrorTrustworthy()) {
            try {
                return this.rustHandle!.getNamespaces();
            } catch (e) {
                debug('getNamespaces', 'rustHandle.getNamespaces failed, falling back to the TS body', e);
            }
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
        /* istanbul ignore next */
        if (rust && this._rustMirrorTrustworthy()) {
            try {
                return this.rustHandle!.derivesFrom(fqt1, fqt2);
            } catch (e) {
                debug('derivesFrom', 'rustHandle.derivesFrom failed, falling back to the TS body', e);
            }
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
        /* istanbul ignore next */
        if (rust && this._rustMirrorTrustworthy()) {
            return this.rustHandle!.isAssignableTo(fqn, baseFqn);
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
