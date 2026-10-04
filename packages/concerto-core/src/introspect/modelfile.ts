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

import { MetaModelNamespace } from '@accordproject/concerto-metamodel';

import AssetDeclaration from './assetdeclaration';
import EnumDeclaration from './enumdeclaration';
import ClassDeclaration from './classdeclaration';
import ConceptDeclaration from './conceptdeclaration';
import ScalarDeclaration from './scalardeclaration';
import ParticipantDeclaration from './participantdeclaration';
import TransactionDeclaration from './transactiondeclaration';
import EventDeclaration from './eventdeclaration';
import IllegalModelException from './illegalmodelexception';
import MapDeclaration from './mapdeclaration';
import ModelUtil from '../modelutil';
import Globalize from '../globalize';
import Decorated from './decorated';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type BaseModelManager from '../basemodelmanager';
import type Declaration from './declaration';
import type { AstNode } from './decorated';
import type { IModel } from '@accordproject/concerto-metamodel';
/* eslint-enable no-unused-vars */

/**
 * A predicate over a Declaration, used by ModelFile#filter.
 */
export type FilterFunction = (declaration: Declaration) => boolean;
import { rust, engineHandles, engineViews } from '../engineloader';
import { optionalString } from '../engineutil';
import type { EngineHandle } from '../engine/bindings';

/**
 * Every ModelFile the ModelFile constructor ran for (BC-46). A
 * BaseModelManager accepts only these: an object the constructor never
 * built (a duck-typed object, `Object.create(ModelFile.prototype)`, a sinon
 * stub instance) was never loaded by the engine, so its manager could not
 * mirror it.
 */
const constructedModelFiles = new WeakSet<object>();

/**
 * Every BaseModelManager whose constructor ran (BC-47): the only managers
 * a ModelFile may be built for. Only such a manager has the engine mirror
 * (`rustHandle`) the ModelFile reads and validates through; a stub, a
 * duck-typed object or a Proxy wrapping a real manager is not one.
 */
const engineManagers = new WeakSet<object>();

/**
 * A view of a model file another manager already loaded, which the next
 * ModelFile constructor call builds (`ModelFile._sharedView`): the source
 * file, and the engine stage or registration of the same engine-side file
 * in the new manager.
 */
interface SharedViewSource {
    source: ModelFile;
    stage: { handle: object; id: number } | undefined;
    committed: object | undefined;
}

/**
 * The view `ModelFile._sharedView` is building; read and cleared by the
 * constructor it calls.
 */
let sharedViewSource: SharedViewSource | null = null;

/**
 * Class representing a Model File. A Model File contains a single namespace
 * and a set of model elements: assets, transactions etc.
 *
 * @class
 * @memberof module:concerto-core
 */
class ModelFile extends Decorated {
    modelManager: BaseModelManager;
    definitions: string | null | undefined;
    fileName: string | null | undefined;
    external: boolean;
    // Prototype accessors (`installLazyField`, below) until first read or
    // write, then plain own fields.
    declarations!: Declaration[];
    localTypes!: Map<string, Declaration> | null;
    imports: AstNode[];
    importShortNames: Map<string, string>;
    importWildcardNamespaces: string[];
    importUriMap: Record<string, string>;
    concertoVersion: string | null;
    version: string | null | undefined;
    // Set by fromAst(), which the constructor calls
    namespace!: string;
    /**
     * Create a ModelFile. This should only be called by framework code.
     * Use the ModelManager to manage ModelFiles.
     * @param {ModelManager} modelManager - the ModelManager that manages this
     * ModelFile
     * @param {object} ast - The abstract syntax tree of the model as a JSON object.
     * @param {string} [definitions] - The optional CTO model as a string.
     * @param {string} [fileName] - The optional filename for this modelfile
     * @throws {TypeError} if modelManager is not a BaseModelManager (BC-47)
     * @throws {IllegalModelException}
     */
    constructor(modelManager: BaseModelManager, ast: AstNode, definitions?: string | null, fileName?: string | null) {
        super(ast);
        // Set only for `ModelFile._sharedView`'s own call.
        const shared = sharedViewSource;
        sharedViewSource = null;
        // BC-47: only a BaseModelManager has the engine mirror this
        // ModelFile is loaded, read and validated through.
        if (typeof modelManager !== 'object' || modelManager === null || !engineManagers.has(modelManager)) {
            throw new TypeError('ModelFile expects a BaseModelManager built by its constructor');
        }
        constructedModelFiles.add(this);
        this.modelManager = modelManager;
        this.external = false;
        // `declarations` and `localTypes` are not set here: they are
        // ModelFile.prototype accessors (below) reading [] and null, and a
        // write stores a plain own field, so an eagerly built file gets
        // them as plain fields and a lazily built one has them deferred
        // (`deferDeclarations`).
        const views = engineViews();
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

        // Lazy views (engine/views-staging.ts): the AST crosses into the
        // engine once, here, and is loaded with every construction-time
        // check. When it loads, only the header (namespace, version,
        // imports) is set now, and the declaration views, and this file's
        // own decorators, are built on first use from one snapshot per
        // file. Otherwise the file is built eagerly, as fromAst would, so a
        // TS error is thrown here by the TS code. BC-19 (with BC-17 and
        // BC-20): the AST's shape is checked first, unless the manager set
        // `metamodelValidation: false`, so a malformed AST is an
        // IllegalModelException before any part of it is walked. A view of a
        // file another manager already loaded (`_sharedView`) shares the
        // engine-side file and copies its header, and is neither checked nor
        // staged again.
        let lazy: boolean;
        if (shared !== null) {
            lazy = views.adoptSharedView(this, shared.source, shared.stage, shared.committed);
        } else {
            const checkedText: string | object | undefined = views.checkAstShape(this);
            lazy = views.stageModelFile(this, checkedText);
        }
        // Set up the decorators.
        this.process();
        // Populate from the AST.
        if (shared !== null) {
            this._copyHeader(shared.source);
            if (!lazy && this.ast.declarations) {
                this._fromAstDeclarations(this.ast);
            }
        } else if (lazy) {
            this._fromAstHeader(this.ast);
        } else {
            this.fromAst(this.ast);
        }
        // Check version compatibility (a view's source was checked)
        if (shared === null) {
            this.isCompatibleVersion();
        }

        if (lazy) {
            views.deferDeclarations(this);
            return;
        }

        // Now build local types from Declarations
        this.localTypes = new Map();
        const namespace = this.getNamespace();
        for(let index in this.declarations) {
            let classDeclaration = this.declarations[index];
            let localType = namespace + '.' + classDeclaration.getName();
            this.localTypes.set(localType, this.declarations[index]);
        }
    }

    /**
     * A new ModelFile of `manager` that is a view of `source`, a model file
     * another manager already loaded: the same AST object and file name,
     * with `definitions`, and the same header (namespace, version, imports),
     * copied from `source` without an engine call. The engine-side file is
     * the one `source`'s manager holds, shared: `stage` is its stage in
     * `manager`'s rustHandle (`BaseModelManager.filter`, which registers it
     * from there), or `committed` the rustHandle that already holds it
     * (`BaseModelManager.fork`). The declaration views are built on first
     * use, as for any lazily built file, unless `manager` has decorator
     * factories and `source` was built eagerly; then they are built now, as
     * the constructor builds them.
     * @param {BaseModelManager} manager the manager the view belongs to
     * @param {ModelFile} source the model file it is a view of
     * @param {string} [definitions] the view's definitions
     * @param {object} [stage] the shared file's stage in manager's rustHandle
     * @param {object} [committed] the rustHandle that holds the shared file
     * @return {ModelFile} the view
     * @private
     * @internal
     */
    static _sharedView(manager: BaseModelManager, source: ModelFile, definitions: string | null | undefined,
        stage?: { handle: object; id: number }, committed?: object): ModelFile {
        sharedViewSource = { source, stage, committed };
        try {
            return new ModelFile(manager, source.ast, definitions, source.fileName);
        } finally {
            sharedViewSource = null;
        }
    }

    /**
     * `_fromAstHeader`'s fields, copied from `source`, a view of the same
     * AST (`_sharedView`), with no engine call: `namespace`, `version`,
     * `concertoVersion`, and copies of `imports`, `importShortNames`,
     * `importWildcardNamespaces` and `importUriMap`.
     * @param {ModelFile} source the view whose header is copied
     * @private
     * @internal
     */
    _copyHeader(source: ModelFile) {
        this.namespace = source.namespace;
        this.version = source.version;
        this.concertoVersion = source.concertoVersion;
        this.imports = source.imports.slice();
        this.importShortNames = new Map(source.importShortNames);
        this.importWildcardNamespaces = source.importWildcardNamespaces.slice();
        this.importUriMap = { ...source.importUriMap };
        engineViews().copyImportNames(this, source);
    }

    /**
     * Returns the ModelFile that defines this class.
     *
     * @protected
     * @return {ModelFile} the owning ModelFile
     */
    getModelFile(): ModelFile {
        return this;
    }

    /**
     * Returns true
     * @returns {boolean} true
     */
    isModelFile(): boolean {
        return true;
    }

    /**
     * Whether `value` is a ModelFile the ModelFile constructor built
     * (BC-46): the only kind of model file a BaseModelManager
     * accepts.
     * @param {*} value the value to check
     * @return {boolean} true if the ModelFile constructor built `value`
     * @private
     * @internal
     */
    static _isConstructed(value: unknown): value is ModelFile {
        return typeof value === 'object' && value !== null && constructedModelFiles.has(value);
    }

    /**
     * Records `manager` as a BaseModelManager whose constructor ran
     * (BC-47): the BaseModelManager constructor calls this before it builds
     * any ModelFile of its own.
     * @param {BaseModelManager} manager the manager being constructed
     * @private
     * @internal
     */
    static _registerManager(manager: BaseModelManager): void {
        engineManagers.add(manager);
    }

    /**
     * The handle of this ModelFile's own namespace in `this.modelManager`'s
     * `rustHandle`, when this ModelFile is the one registered for its
     * namespace and no write of the manager's is pending
     * (`BaseModelManager#_rustHandleMatchesModelFiles`). The handle is the
     * one the manager cached when it committed the file, so a registered
     * file's read makes no extra engine call. `undefined` otherwise: a
     * ModelFile detached from its manager's registration. The manager is
     * always a BaseModelManager (BC-47).
     * @return {number | undefined} the handle, or undefined to fall back to TS
     * @private
     * @internal
     */
    _rustHandleId(): number | undefined {
        if (!this._isRegistered()) {
            return undefined;
        }
        const manager = this.modelManager;
        // The handle the manager cached when it committed
        // the file. An error reading rustHandle propagates.
        return manager._rustModelFileId(this.namespace);
    }

    /**
     * Whether this ModelFile is the one its manager's `rustHandle` mirrors
     * for its namespace: the checks `_rustHandleId` makes before it looks
     * the handle up, none of which crosses into the engine. A registered
     * file's field-backed getters (`getVersion`, `isSystemModelFile`,
     * `getExternalImports`) answer exactly as the engine's own model file
     * did.
     * @return {boolean} true if registered and mirrored
     * @private
     * @internal
     */
    _isRegistered(): boolean {
        // The manager is always a BaseModelManager (BC-47).
        const manager = this.modelManager;
        // A ModelFile detached from its manager's own registration -- most
        // notably `filter()`'s result before it is ever added -- must never
        // answer from a same-namespace mirror that belongs to a different
        // (unfiltered) ModelFile object (a ModelFile being constructed or
        // added is not registered yet, and needs no boundary call to say
        // so).
        if (manager.modelFiles[this.namespace] !== this) {
            return false;
        }
        // A flag read, not a boundary call (`_mirrorPending`).
        return manager._rustHandleMatchesModelFiles();
    }

    /**
     * Returns the semantic version
     * @returns {string} the semantic version or null if the namespace for the model file is
     * unversioned
     */
    getVersion(): string | null | undefined {
        // `this.version` was written by the engine at construction. A
        // registered file answers `null`, never `undefined` or `''`, for a
        // namespace with no version.
        return this._isRegistered() ? this.version || null : this.version;
    }

    /**
     * Returns true if the ModelFile is a system namespace
     * @returns {Boolean} true if this is a system model file
     */
    isSystemModelFile(): boolean {
        // From `this.namespace`, which Rust wrote at construction. A
        // registered file answers as the engine's
        // `modelFileIsSystemModelFile` did (concerto-core
        // `ModelFile::is_system_namespace`: a `concerto@` namespace only);
        // otherwise the bare `concerto` namespace is a system one too, as the
        // namespace check during construction takes it.
        return this.namespace.startsWith('concerto@') || (this.namespace === 'concerto' && !this._isRegistered());
    }

    /**
     * Returns true if this ModelFile was downloaded from an external URI.
     * @return {boolean} true iff this ModelFile was downloaded from an external URI
     */
    isExternal(): boolean {
        return this.external;
    }

    /**
     * Returns the URI for an import, or null if the namespace was not associated with a URI.
     * @param {string} namespace - the namespace for the import
     * @return {string} the URI or null if the namespace was not associated with a URI.
     * @private
     */
    getImportURI(namespace: string): string | null {
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
    getExternalImports(): Record<string, string> {
        // `this.importUriMap` is the field Rust itself wrote at construction,
        // in import order (the order `modelFileGetExternalImports` kept). A
        // registered file returns a fresh copy, as the engine route did, so
        // mutating the result never reaches the file.
        return this._isRegistered() ? { ...this.importUriMap } : this.importUriMap;
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
    getModelManager(): BaseModelManager {
        return this.modelManager;
    }

    /**
     * Returns the types that have been imported into this ModelFile.
     *
     * @return {string[]} The array of fully-qualified names for types imported by
     * this ModelFile
     */
    getImports(): string[] {
        // `this.imports` was written by the engine at construction, so its
        // fully-qualified names are recorded once (`recordImportNames`): from
        // the staged header, or on the first call. Every later call answers
        // from that record, as a fresh array.
        const views = engineViews();
        const recorded: string[] | undefined = views.recordedImportNames(this);
        if (recorded !== undefined) {
            return recorded;
        }
        let result: string[] = [];
        const id = this._rustHandleId();
        if (id !== undefined) {
            const manager = this.modelManager;
            result = manager.rustHandle.modelFileGetImports(id);
        } else {
            this.imports.forEach( imp => {
                result = result.concat(ModelUtil.importFullyQualifiedNames(imp));
            });
        }
        views.recordImportNames(this, result.slice());
        return result;
    }

    /**
     * The error to throw for an error the engine threw validating this
     * ModelFile (`validate()`, and BaseModelManager's one-crossing add).
     *
     * rustHandle's `modelFile` (errors.ts's ErrorPayload) is not this
     * ModelFile, so `IllegalModelException`'s own constructor already baked
     * a message and fileName without this file's name into `e`. Re-wrap
     * with `this` so the public exception carries the same "File '<name>': "
     * prefix and `fileName` that v5.0.0's TS validate() produced for the
     * identical failure -- delegating to Rust must not change the shape of
     * the exception callers see.
     *
     * But that is only true for most of the checks Rust runs here -- TS
     * itself never attaches a file to one check, the duplicate-class-name
     * scan (`Duplicate class name ${fqn}`, thrown with no second argument at
     * all). `needsModelFile` (errors.ts's ErrorPayload, set from the
     * engine's own `err.model_file.is_some()`) is the contract's own record
     * of which case this is: true for the general case (imports,
     * per-declaration validation, ...), false for that one check. A filename
     * mismatch alone cannot tell the two apart, since Rust never has a JS
     * `ModelFile` to attach either way (`e.getFileName()` is always unset
     * here) -- so `needsModelFile === false` is returned as-is, and only the
     * general case re-wraps.
     * @param {*} e the error the engine threw
     * @return {*} the error to throw
     * @private
     * @internal
     */
    _engineValidationError(e: unknown): unknown {
        if (e instanceof IllegalModelException) {
            const needsModelFile = (e as unknown as { needsModelFile?: boolean }).needsModelFile;
            if (needsModelFile !== false && e.getFileName() !== this.getName()) {
                return new IllegalModelException(e.getShortMessage(), this, e.getFileLocation());
            }
        }
        return e;
    }

    /**
     * Validates the ModelFile.
     *
     * @throws {IllegalModelException} if the model is invalid
     * @protected
     */
    validate() {
        // The engine validates the file, told about `decoratorValidation`
        // and `dangerouslyAllowReservedSystemTypeNamesInUserModels` by the
        // BaseModelManager constructor. A ModelFile's manager is always a
        // BaseModelManager (BC-47), whose `addModelFile` validates and
        // registers a staged file in one engine call without calling this
        // method; a validation failure throws the mapped
        // `IllegalModelException`.
        const manager = this.modelManager;
        try {
            // The file Rust already loaded (staged, or registered from
            // its stage) is validated without sending the AST again
            // (engine/views-staging.ts `validateLoaded`).
            if (!engineViews().validateLoaded(this, manager.rustHandle)) {
                manager.rustHandle.modelFileValidateDetached(
                    JSON.stringify(this.getAst()),
                    optionalString(this.getDefinitions()),
                    optionalString(this.getName()),
                );
            }
        } catch (e) {
            throw this._engineValidationError(e);
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
    resolveType(context, type, fileLocation?) {
        // Resolved in the engine (`modelFileResolveType`) for a file its
        // manager has mirrored, with the IllegalModelException TS throws. A
        // file that is not mirrored (a detached file), or a non-string
        // argument, takes the TS path below.
        const id = typeof context === 'string' && typeof type === 'string' ? this._rustHandleId() : undefined;
        if (id !== undefined) {
            const manager = this.modelManager;
            manager.rustHandle.modelFileResolveType(id, context, type, fileLocation, this);
            return;
        }
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
        // A non-string never crosses the boundary (the binding's `&str`
        // parameter cannot take it: a JS non-string traps the engine). It
        // takes TS's own expression, which returns a falsy argument itself
        // and throws for a truthy non-string.
        if (typeof type !== 'string' || !type) {
            return (type && this.getLocalType(type) !== null);
        }
        const id = this._rustHandleId();
        if (id !== undefined) {
            const manager = this.modelManager;
            return manager.rustHandle.modelFileIsLocalType(id, type);
        }
        return this.getLocalType(type) !== null;
    }

    /**
     * Returns true if the type is imported from another namespace
     * @param {string} type - the short name of the type
     * @return {boolean} - true if the type is imported from another namespace
     * @private
     */
    isImportedType(type) {
        return this.importShortNames.has(type);
    }

    /**
     * Returns the FQN for a type that is imported from another namespace
     * @param {string} type - the short name of the type
     * @return {string} - the FQN of the resolved import
     * @throws {Error} - if the type is not imported
     * @private
     */
    resolveImport(type: string): string {
        if (this.importShortNames.has(type)) {
            return this.importShortNames.get(type)!;
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
    getImportedType(type: string): string {
        const fqn = this.resolveImport(type);
        return fqn.split('.').pop()!;
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
        // Resolved in Rust (concerto-wasm `modelFileGetTypeName`) for a file
        // its manager has mirrored into rustHandle. Rust answers by name: a
        // primitive's own name (no dot), the fully-qualified name of the
        // declaration found, which is mapped to its view in the model file
        // of its namespace, or undefined for null. A file that is not
        // mirrored and a non-string type take the TS path below.
        const id = typeof type === 'string' ? this._rustHandleId() : undefined;
        if (id !== undefined) {
            const manager = this.modelManager;
            // Through the manager's read memo, so one type is
            // resolved once per model version, not once per call.
            const name: string | undefined = manager._modelFileTypeName(this.namespace, id, type);
            if (name === undefined) {
                return null;
            }
            const dot = name.lastIndexOf('.');
            return dot < 0 ? name : manager.modelFiles[name.substring(0, dot)].getLocalType(name);
        }
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
        // Resolved in the engine (`modelFileGetFullyQualifiedTypeName`,
        // undefined for null) for a mirrored file. A file that is not
        // mirrored and a non-string type take the TS path below.
        const id = typeof type === 'string' ? this._rustHandleId() : undefined;
        if (id !== undefined) {
            const manager = this.modelManager;
            return manager.rustHandle.modelFileGetFullyQualifiedTypeName(id, type) ?? null;
        }
        // is the type a primitive?
        if(!ModelUtil.isPrimitiveType(type)) {
            // is it an imported type?
            if(!this.isImportedType(type)) {
                // is the type declared locally?
                if(!this.isLocalType(type)) {
                    return null;
                }
                else {
                    return this.getLocalType(type)!.getFullyQualifiedName();
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
    getLocalType(type: string): Declaration | null {
        // A lazily built file whose declaration views are not all built
        // yet builds only the one asked for (engine/views-staging.ts
        // `localType`).
        const lazy = engineViews().localType(this, type);
        if (lazy !== undefined) {
            return lazy;
        }
        if(!this.localTypes) {
            throw new Error('Internal error: local types are not yet initialized. Do not try to resolve types inside `process`.');
        }

        if(!type.startsWith(this.getNamespace())) {
            type = this.getNamespace() + '.' + type;
        }

        if (this.localTypes.has(type)) {
            return this.localTypes.get(type)!;
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
    getNamespace(): string {
        return this.namespace;
    }

    /**
     * Get the filename for this model file. Note that this may be null.
     * @return {string} The filename for this model file
     */
    getName(): string | null | undefined {
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
    getDeclarations<T extends Declaration>(type: new (...args: any[]) => T): T[] {
        const result: T[] = [];
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
    getAllDeclarations(): Declaration[] {
        return this.declarations;
    }

    /**
     * Get the definitions for this model.
     * @return {string} The definitions for this model.
     */
    getDefinitions(): string | null | undefined {
        return this.definitions;
    }

    /**
     * Get the ast for this model.
     * @return {object} The definitions for this model.
     */
    getAst(): IModel {
        // a ModelFile is always constructed from a metamodel Model node
        return this.ast as IModel;
    }

    /**
     * Get the expected concerto version
     * @return {string} The semver range for compatible concerto versions
     */
    getConcertoVersion(): string | null {
        return this.concertoVersion;
    }

    /**
     * Check whether this modelfile is compatible with the concerto version.
     * Models targeting an older major version are considered backward-compatible
     * with newer runtimes (e.g. a model declaring "^3.0.0" loads under v4).
     */
    isCompatibleVersion() {
        // Checked in the engine (`modelFileIsCompatibleVersion`, node-semver's
        // range grammar), which sets `this.concertoVersion` or throws the
        // Error TS throws. An AST without a `concertoVersion` (nearly every
        // model) is accepted without the engine call; a nullish `ast` still
        // goes to the binding, which throws for it.
        const ast: any = this.ast;
        if (ast !== null && ast !== undefined && !ast.concertoVersion) {
            return;
        }
        rust.modelFileIsCompatibleVersion(this);
    }
    /**
     * Verifies that an import is versioned if the strict
     * option has been set on the Model Manager
     * @param {*} imp - the import to validate
     * @private
     */
    enforceImportVersioning(imp) {
        // Checked in Rust (concerto-wasm
        // `modelFileEnforceImportVersioning`).
        rust.modelFileEnforceImportVersioning(imp);
    }

    /**
     * Populate from an AST
     * @param {object} ast - the AST obtained from the parser
     * @private
     */
    fromAst(ast: AstNode) {
        // The header (namespace, version and imports, `_fromAstHeader`) is
        // read and checked in Rust (concerto-wasm `modelFileFromAstHeader`).
        rust.modelFileFromAstHeader(this, ast);

        // declarations is an optional field
        if (!ast.declarations) {
            return;
        }

        this._fromAstDeclarations(ast);
    }

    /**
     * The part of fromAst before the declarations: the namespace, its
     * version and the imports.
     * @param {object} ast - the AST obtained from the parser
     * @private
     * @internal
     */
    _fromAstHeader(ast: AstNode) {
        // Read and checked in Rust (concerto-wasm `modelFileFromAstHeader`),
        // over this ModelFile and the AST's own JS values in TS's order:
        // `ast.namespace` (every part a valid identifier, and a version
        // unless isSystemModelFile()), then `this.namespace`, `this.version`
        // and `this.imports` (a copy of `ast.imports` plus, for a non-system
        // file, the implicit import of the system types), and
        // `this.importShortNames` and `this.importUriMap` from each import,
        // which must be versioned (enforceImportVersioning), not a wildcard
        // import, and not alias a primitive type. Each error keeps TS's
        // class.
        //
        // The engine call that staged the file (or a DecoratorManager
        // result) may have read its header already, which is then applied
        // without crossing again (`applyStagedHeaders`); otherwise the
        // engine reads it now.
        const views = engineViews();
        if (!views.applyStagedHeaders(this, ast)) {
            rust.modelFileFromAstHeader(this, ast);
        }
    }

    /**
     * The part of fromAst that builds the declarations.
     * @param {object} ast - the AST obtained from the parser, with declarations
     * @private
     * @internal
     */
    _fromAstDeclarations(ast: AstNode) {
        // Every declaration's and property's engine snapshot in one call,
        // read by the views built below (engine/views.ts
        // `beginModelFile`).
        const views = engineViews();
        const saved = views.beginModelFile(this, ast);
        try {
            this._fromAstDeclarationViews(ast);
        } finally {
            views.endModelFile(saved);
        }
    }

    /**
     * Builds the declaration views of `ast.declarations`.
     * @param {object} ast - the AST obtained from the parser, with declarations
     * @private
     * @internal
     */
    _fromAstDeclarationViews(ast: AstNode) {
        // A declaration view already built on its own (a lazily built
        // file's `getLocalType`, engine/views-staging.ts `localType`) is
        // reused, so each declaration has one view.
        const views = engineViews();
        for(let n=0; n < ast.declarations.length; n++) {
            const thing = ast.declarations[n];
            const built = views.builtDeclaration(this, n, thing);
            this.declarations.push(built !== undefined ? built : this._declarationView(thing));
        }
    }

    /**
     * Builds the view of one declaration of the AST.
     * @param {object} thing - the declaration's AST node
     * @return {Declaration} the view
     * @private
     * @internal
     */
    _declarationView(thing: AstNode): Declaration {
        switch(thing.$class) {
        case `${MetaModelNamespace}.AssetDeclaration`:
            // Default super type for asset
            if (!thing.superType) {
                thing = Object.assign({}, thing);
                thing.superType = {
                    $class: `${MetaModelNamespace}.TypeIdentified`,
                    name: 'Asset',
                };
            }
            return new AssetDeclaration(this, thing);
        case `${MetaModelNamespace}.TransactionDeclaration`:
            // Default super type for transaction
            if (!thing.superType) {
                thing = Object.assign({}, thing);
                thing.superType = {
                    $class: `${MetaModelNamespace}.TypeIdentified`,
                    name: 'Transaction',
                };
            }
            return new TransactionDeclaration(this, thing);
        case `${MetaModelNamespace}.EventDeclaration`:
            // Default super type for event
            if (!thing.superType) {
                thing = Object.assign({}, thing);
                thing.superType = {
                    $class: `${MetaModelNamespace}.TypeIdentified`,
                    name: 'Event',
                };
            }
            return new EventDeclaration(this, thing);
        case `${MetaModelNamespace}.ParticipantDeclaration`:
            // Default super type for participant
            if (!thing.superType) {
                thing = Object.assign({}, thing);
                thing.superType = {
                    $class: `${MetaModelNamespace}.TypeIdentified`,
                    name: 'Participant',
                };
            }
            return new ParticipantDeclaration(this, thing);
        case `${MetaModelNamespace}.EnumDeclaration`:
            return new EnumDeclaration(this, thing);
        case `${MetaModelNamespace}.MapDeclaration`:
            return new MapDeclaration(this, thing);
        case `${MetaModelNamespace}.ConceptDeclaration`:
            return new ConceptDeclaration(this, thing);
        case `${MetaModelNamespace}.BooleanScalar`:
        case `${MetaModelNamespace}.IntegerScalar`:
        case `${MetaModelNamespace}.LongScalar`:
        case `${MetaModelNamespace}.DoubleScalar`:
        case `${MetaModelNamespace}.StringScalar`:
        case `${MetaModelNamespace}.DateTimeScalar`:
            return new ScalarDeclaration(this, thing);
        default: {
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
     * The predicate is also invoked on declarations from imported files to
     * determine whether each import should be retained. It must be
     * side-effect-free and total across all reachable namespaces.
     *
     * @param {FilterFunction} predicate - the filter function over a Declaration object
     * @param {ModelManager} modelManager - the target ModelManager for the filtered ModelFile
     * @returns {ModelFile?} - the filtered ModelFile
     * @private
     */
    filter(predicate: FilterFunction, modelManager: BaseModelManager): ModelFile | null {
        const id = this._rustHandleId();
        if (id !== undefined) {
            const manager = this.modelManager;
            const sourceManager = this.getModelManager();
            // The Rust predicate carries no Declaration objects of its
            // own -- it calls back with each candidate's
            // fully-qualified name (its own namespace, not necessarily
            // this file's, for a declaration reached while pruning an
            // import) -- so look the FQN back up to the real TS
            // Declaration before calling the original predicate.
            const wrappedPredicate = (fqn: string): boolean => {
                const namespace = ModelUtil.getNamespace(fqn);
                const shortName = ModelUtil.getShortName(fqn);
                const sourceFile = sourceManager.getModelFile(namespace);
                const decl = sourceFile ? sourceFile.getLocalType(shortName) : null;
                if (!decl) {
                    return false;
                }
                return predicate(decl);
            };
            const handles = engineHandles();
            const target: EngineHandle | undefined = modelManager.rustHandle;
            if (target && target !== manager.rustHandle) {
                // A file the filter keeps exactly as it is (every
                // declaration kept, every import unchanged) is staged,
                // shared, in `modelManager`'s own rustHandle (staging
                // registers nothing there), and its view is built from this
                // file's own AST and header: no JSON round trip. Any other
                // result comes back as its AST, as `modelFileSnapshot`
                // returned it, with no scratch handle.
                const result: string | undefined = handles.withEngineCallbacks(
                    () => manager.rustHandle.modelFileFilterStaged(id, wrappedPredicate, target));
                if (result === undefined) {
                    return null;
                }
                const filtered = JSON.parse(result);
                if (filtered.stage !== undefined) {
                    return ModelFile._sharedView(modelManager, this, undefined, { handle: target, id: filtered.stage });
                }
                return new ModelFile(modelManager, filtered.ast, undefined, this.fileName);
            }
            // A scratch handle, never `modelManager`'s own: `filter`'s result
            // is returned detached (`BaseModelManager.filter` adds it later),
            // so writing into the manager's mirror here would register a
            // namespace ahead of `modelFiles`. Freed once its last use
            // returns.
            const scratch = new rust.ModelManagerHandle();
            let filteredSnapshot;
            try {
                const filteredId = handles.withEngineCallbacks(
                    () => manager.rustHandle.modelFileFilter(id, wrappedPredicate, scratch));
                if (filteredId === undefined) {
                    return null;
                }
                filteredSnapshot = JSON.parse(scratch.modelFileSnapshot(filteredId));
            } finally {
                handles.releaseHandle(scratch);
            }
            return new ModelFile(modelManager, filteredSnapshot.ast, undefined, this.fileName);
        }
        const declarations: AstNode[] = [];
        for (const declaration of this.declarations) {
            if (predicate(declaration)) {
                declarations.push(declaration.ast);
            }
        }

        if (declarations.length === 0) {
            return null;
        }

        const ast = {
            ...this.ast,
            declarations,
            imports: this.ast.imports?.map(imp => ({...imp})),
        };

        if (ast.imports) {
            const sourceManager = this.getModelManager();

            ast.imports = ast.imports.filter(imp => {
                const ns = imp.namespace;
                if (ns.startsWith('concerto@') || ns === 'concerto') {
                    return true;
                }

                const shortClass = ModelUtil.getShortName(imp.$class);

                if (shortClass === 'ImportType') {
                    const sourceFile = sourceManager.getModelFile(ns);
                    if (!sourceFile) {
                        return true;
                    }
                    const decl = sourceFile.getLocalType(imp.name);
                    return !decl || predicate(decl);
                }

                if (shortClass === 'ImportTypes') {
                    const sourceFile = sourceManager.getModelFile(ns);
                    if (!sourceFile) {
                        return true;
                    }
                    imp.types = imp.types.filter(type => {
                        const decl = sourceFile.getLocalType(type);
                        return !decl || predicate(decl);
                    });
                    if (imp.types.length === 0) {
                        return false;
                    }
                    if (imp.aliasedTypes && imp.aliasedTypes.length > 0) {
                        imp.aliasedTypes = imp.aliasedTypes.filter(a => imp.types.includes(a.name));
                    }
                    return true;
                }

                return true;
            });
        }

        return new ModelFile(modelManager, ast, undefined, this.fileName);
    }
}

// Built on first read in a lazily built file
// (engine/views-staging.ts `deferModelFileFields`), like the other
// lazy parts.
engineViews().installLazyField(ModelFile.prototype, 'declarations', () => [], true);
engineViews().installLazyField(ModelFile.prototype, 'localTypes', () => null, true);

export { ModelFile };
export default ModelFile;
