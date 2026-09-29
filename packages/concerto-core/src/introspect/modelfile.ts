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

// The Rust engine (src/engine/index.ts) is the only path (P5-02: the
// CONCERTO_ENGINE=ts|rust flag from P4-02 is gone). See classdeclaration.ts's
// own copy of this comment for the bundler/webpack reasoning this loader
// relies on.
import { createRequire } from 'module';
declare const __webpack_require__: unknown;
declare const __non_webpack_require__: NodeRequire;
// P5-06: memoised per specifier (see introspect/property.ts).
/* istanbul ignore next */
const engineModules: { [specifier: string]: any } = {};
/* istanbul ignore next */
const loadEngine = (specifier: string) =>
    engineModules[specifier] ??
    (engineModules[specifier] =
        typeof __webpack_require__ === 'function' ? __non_webpack_require__(specifier) : typeof module !== 'undefined' && typeof module.require === 'function' ? module.require(specifier) : typeof (globalThis as any).module?.require === 'function' ? (globalThis as any).module.require(specifier) : createRequire(__filename)(specifier));
/* istanbul ignore next */
const rust: { [binding: string]: (...args: any[]) => any } = loadEngine('../engine').rust;

/**
 * Every ModelFile the ModelFile constructor ran for (P5-34, BC-46). A
 * BaseModelManager accepts only these: an object the constructor never
 * built (a duck-typed object, `Object.create(ModelFile.prototype)`, a sinon
 * stub instance) was never loaded by the engine, so its manager could not
 * mirror it.
 */
const constructedModelFiles = new WeakSet<object>();

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
    declarations: Declaration[];
    localTypes: Map<string, Declaration> | null;
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
     * @throws {IllegalModelException}
     */
    constructor(modelManager: BaseModelManager, ast: AstNode, definitions?: string | null, fileName?: string | null) {
        super(ast);
        constructedModelFiles.add(this);
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

        // P5-10a lazy views (engine/views.ts): the AST crosses into Rust
        // once, here, and Rust loads it with every construction-time check
        // it makes. When it loads, only the header (namespace, version,
        // imports) is populated now, and the declaration views are built on
        // first use, from one batch snapshot per file. Otherwise the file is
        // built eagerly, as fromAst would, so a TS error is thrown here by
        // the TS code. P5-10b: staged before the decorators are set up, so
        // that a lazily built file's own decorators are built on first read
        // too (staging never throws, so every error keeps its point).
        const views = loadEngine('../engine/views');
        const lazy: boolean = views.stageModelFile(this);
        // Set up the decorators.
        this.process();
        // Populate from the AST.
        if (lazy) {
            this._fromAstHeader(this.ast);
        } else {
            this.fromAst(this.ast);
        }
        // Check version compatibility
        this.isCompatibleVersion();

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
     * (P5-34, BC-46): the only kind of model file a BaseModelManager
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
     * The handle of this ModelFile's own namespace in `this.modelManager`'s
     * `rustHandle` (P4-08), when this ModelFile is the one registered for
     * its namespace and no write of the manager's is pending
     * (`BaseModelManager#_rustHandleMatchesModelFiles`). The handle is the
     * one the manager cached when it committed the file (P5-34), so a
     * registered file's read makes no extra engine call. `undefined`
     * otherwise -- including for a `ModelFile` built by a white-box test on
     * a stubbed `modelManager`, whose `_rustHandleMatchesModelFiles` is
     * itself undefined and so falsy here.
     * @return {number | undefined} the handle, or undefined to fall back to TS
     * @private
     * @internal
     */
    _rustHandleId(): number | undefined {
        /* istanbul ignore next */
        if (!this._isRegistered()) {
            return undefined;
        }
        const manager = this.modelManager as unknown as { rustHandle: { [binding: string]: (...args: any[]) => any }; _rustModelFileId?: (namespace: string) => number | undefined };
        // P5-34: the handle the manager cached when it committed the file.
        // An error reading rustHandle propagates
        // (accordproject/concerto-rust#262).
        /* istanbul ignore next */
        return typeof manager._rustModelFileId === 'function'
            ? manager._rustModelFileId(this.namespace)
            : manager.rustHandle.modelFileId(this.namespace);
    }

    /**
     * Whether this ModelFile is the one its manager's `rustHandle` mirrors
     * for its namespace (P5-32, accordproject/concerto-rust#342): the
     * checks `_rustHandleId` makes before it looks the handle up, none of
     * which crosses into the engine. A registered file's field-backed
     * getters (`getVersion`, `isSystemModelFile`, `getExternalImports`)
     * answer exactly as the engine's own model file did.
     * @return {boolean} true if registered and mirrored
     * @private
     * @internal
     */
    _isRegistered(): boolean {
        const manager = this.modelManager as unknown as { rustHandle?: unknown; _rustHandleMatchesModelFiles?: () => boolean; modelFiles?: Record<string, unknown> } | null | undefined;
        /* istanbul ignore next */
        if (!manager || !manager.rustHandle || typeof manager._rustHandleMatchesModelFiles !== 'function') {
            return false;
        }
        // A ModelFile detached from its manager's own registration -- most
        // notably `filter()`'s result before it is ever added -- must never
        // answer from a same-namespace mirror that belongs to a different
        // (unfiltered) ModelFile object (P5-10a: a ModelFile being
        // constructed or added is not registered yet, and needs no boundary
        // call to say so).
        /* istanbul ignore next */
        if (!manager.modelFiles || manager.modelFiles[this.namespace] !== this) {
            return false;
        }
        // P5-34: a flag read, not a boundary call (`_mirrorPending`).
        return manager._rustHandleMatchesModelFiles();
    }

    /**
     * Returns the semantic version
     * @returns {string} the semantic version or null if the namespace for the model file is
     * unversioned
     */
    getVersion(): string | null | undefined {
        // P5-32 (accordproject/concerto-rust#342): `this.version` is the
        // field Rust itself wrote at construction (concerto-wasm
        // `modelFileFromAstHeader`, or the staged header P5-28 applies), so
        // no engine call is needed. A registered file answers as the
        // engine's `modelFileGetVersion` did: `null`, never `undefined` or
        // `''`, for a namespace with no version.
        return this._isRegistered() ? this.version || null : this.version;
    }

    /**
     * Returns true if the ModelFile is a system namespace
     * @returns {Boolean} true if this is a system model file
     */
    isSystemModelFile(): boolean {
        // P5-32 (accordproject/concerto-rust#342): from `this.namespace`,
        // which Rust wrote at construction. A registered file answers as the
        // engine's `modelFileIsSystemModelFile` did (concerto-core
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
        // P5-32 (accordproject/concerto-rust#342): `this.importUriMap` is the
        // field Rust itself wrote at construction, in import order (the
        // order `modelFileGetExternalImports` kept, #263). A registered file
        // returns a fresh copy, as the engine route did, so mutating the
        // result never reaches the file.
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
        // P5-32 (accordproject/concerto-rust#342): `this.imports` is the
        // field Rust itself wrote at construction, so its fully-qualified
        // names are recorded once (engine/views.ts `recordImportNames`):
        // from the staged header when one was applied, with no engine call,
        // or else on the first call, through the engine's own model file
        // for a registered file, as before, and the TS body otherwise (the
        // two agree). Every later call answers from that record, with no
        // engine call, as a fresh array, as both routes did.
        const views = loadEngine('../engine/views');
        const recorded: string[] | undefined = views.recordedImportNames(this);
        if (recorded !== undefined) {
            return recorded;
        }
        let result: string[] = [];
        const id = this._rustHandleId();
        /* istanbul ignore if */
        if (id !== undefined) {
            const manager = this.modelManager as unknown as { rustHandle: { [binding: string]: (...args: any[]) => any } };
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
     * ModelFile (`validate()`, and BaseModelManager's one-crossing add,
     * P5-34).
     *
     * rustHandle's `modelFile` (errors.ts's ErrorPayload) is not this
     * ModelFile, so `IllegalModelException`'s own constructor already baked
     * a message and fileName without this file's name into `e`. Re-wrap
     * with `this` so the public exception carries the same "File '<name>': "
     * prefix and `fileName` that the TS validate() body produces for the
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
        // P4-08 (accordproject/concerto-rust#67, maintainer decision
        // 2026-09-26): delegates fully to Rust in rust mode, unconditionally,
        // now that P4-08a/b/e closed the gaps the earlier attempts (see the
        // history in `BaseModelManager.addModelFile`) hit -- rustHandle's
        // validation is now told about `decoratorValidation` and
        // `dangerouslyAllowReservedSystemTypeNamesInUserModels`
        // (`BaseModelManager`'s constructor), so it no longer silently skips
        // an option-gated TS check the way step 4's narrower attempt still
        // could.
        //
        // BaseModelManager accepts only ModelFiles its constructor built
        // (P5-34, BC-46), and its `addModelFile` validates and registers a
        // staged file in one engine call without calling this method
        // (`_rustValidateAndMirrorAdd`). The collaborator fallback below (no
        // `rustHandle`, e.g. a stubbed manager, or a real-but-detached
        // `ModelFile` built against a plain manager) runs the TS body; a
        // genuine validation failure throws the mapped
        // `IllegalModelException` (src/engine/errors.ts) and propagates
        // unchanged.
        const manager = this.modelManager as unknown as { rustHandle?: { [binding: string]: (...args: any[]) => any } | null };
        /* istanbul ignore next */
        if (manager && manager.rustHandle) {
            try {
                // P5-10a: the file Rust already loaded (staged, or
                // registered from its stage) is validated without sending
                // the AST again (engine/views.ts `validateLoaded`).
                if (!loadEngine('../engine/views').validateLoaded(this, manager.rustHandle)) {
                    // Falsy non-string `definitions`/`fileName` (`0`, `false`,
                    // `NaN`) pass the constructor's truthy-only check and
                    // reach here raw: only a genuine string is forwarded to
                    // the wasm `Option<String>` params, matching the
                    // `stageModelFile` guard above
                    // (accordproject/concerto-rust#294 follow-up).
                    const definitions = this.getDefinitions();
                    const fileName = this.getName();
                    manager.rustHandle.modelFileValidateDetached(
                        JSON.stringify(this.getAst()),
                        typeof definitions === 'string' ? definitions : undefined,
                        typeof fileName === 'string' ? fileName : undefined,
                    );
                }
                return;
            } catch (e) {
                throw this._engineValidationError(e);
            }
        }

        super.validate();

        // A dictionary of imports to versions to track unique namespaces
        const importsMap = new Map();

        // Validate all of the imports to check that they reference
        // namespaces or types that actually exist.
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

            if (!modelFile.isLocalType(importShortName)) {
                let formatter = Globalize.messageFormatter('modelmanager-gettype-notypeinns');
                throw new IllegalModelException(formatter({
                    type: importShortName,
                    namespace: importNamespace
                }), this);
            }
        });

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
    resolveType(context, type, fileLocation?) {
        // P5-11 (accordproject/concerto-rust#287): resolved in Rust
        // (concerto-wasm `modelFileResolveType`) for a file its manager has
        // mirrored into rustHandle, with the IllegalModelException TS throws
        // (naming this file). A file that is not mirrored (a stub manager,
        // a detached file) and non-string arguments, which the binding's
        // `&str` parameters cannot take, keep the TS body below.
        const id = typeof context === 'string' && typeof type === 'string' ? this._rustHandleId() : undefined;
        /* istanbul ignore if */
        if (id !== undefined) {
            const manager = this.modelManager as unknown as { rustHandle: { [binding: string]: (...args: any[]) => any } };
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
        /* istanbul ignore if */
        if (id !== undefined) {
            const manager = this.modelManager as unknown as { rustHandle: { [binding: string]: (...args: any[]) => any } };
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
        // P5-11 (accordproject/concerto-rust#287): resolved in Rust
        // (concerto-wasm `modelFileGetTypeName`) for a file its manager has
        // mirrored into rustHandle. Rust answers by name: a primitive's own
        // name (no dot), the fully-qualified name of the declaration found,
        // which is mapped to its view in the model file of its namespace, or
        // undefined for null. A file that is not mirrored and a non-string
        // type keep the TS body below.
        const id = typeof type === 'string' ? this._rustHandleId() : undefined;
        /* istanbul ignore if */
        if (id !== undefined) {
            const manager = this.modelManager as unknown as { rustHandle: { [binding: string]: (...args: any[]) => any }; modelFiles: Record<string, ModelFile> };
            const name: string | undefined = manager.rustHandle.modelFileGetTypeName(id, type);
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
        // P5-11 (accordproject/concerto-rust#287): resolved in Rust
        // (concerto-wasm `modelFileGetFullyQualifiedTypeName`, undefined for
        // null) for a file its manager has mirrored into rustHandle. A file
        // that is not mirrored and a non-string type keep the TS body below.
        const id = typeof type === 'string' ? this._rustHandleId() : undefined;
        /* istanbul ignore if */
        if (id !== undefined) {
            const manager = this.modelManager as unknown as { rustHandle: { [binding: string]: (...args: any[]) => any } };
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
        // P5-10b: a lazily built file whose declaration views are not all
        // built yet builds only the one asked for (engine/views.ts
        // `localType`).
        const lazy = loadEngine('../engine/views').localType(this, type);
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
        // P5-11 (accordproject/concerto-rust#287): checked in Rust
        // (concerto-wasm `modelFileIsCompatibleVersion`, node-semver's range
        // grammar ported in concerto-rust semver_range.rs), which sets
        // `this.concertoVersion` or throws the Error TS throws.
        rust.modelFileIsCompatibleVersion(this);
    }
    /**
     * Verifies that an import is versioned if the strict
     * option has been set on the Model Manager
     * @param {*} imp - the import to validate
     * @private
     */
    enforceImportVersioning(imp) {
        // P5-11 (accordproject/concerto-rust#287): checked in Rust
        // (concerto-wasm `modelFileEnforceImportVersioning`).
        rust.modelFileEnforceImportVersioning(imp);
    }

    /**
     * Populate from an AST
     * @param {object} ast - the AST obtained from the parser
     * @private
     */
    fromAst(ast: AstNode) {
        // P5-11 (accordproject/concerto-rust#287): the header (namespace,
        // version and imports, `_fromAstHeader`) is read and checked in Rust
        // (concerto-wasm `modelFileFromAstHeader`).
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
        // P5-11 (accordproject/concerto-rust#287): read and checked in Rust
        // (concerto-wasm `modelFileFromAstHeader`), over this ModelFile and
        // the AST's own JS values in TS's order: `ast.namespace` (every part
        // a valid identifier, and a version unless isSystemModelFile()),
        // then `this.namespace`, `this.version` and `this.imports` (a copy of
        // `ast.imports` plus, for a non-system file, the implicit import of
        // the system types), and `this.importShortNames` and
        // `this.importUriMap` from each import, which must be versioned
        // (enforceImportVersioning), not a wildcard import, and not alias a
        // primitive type. Each error keeps TS's class.
        //
        // The engine call that staged the file may have read its header
        // already, and then it is applied without crossing again: P5-27 (F6)
        // for a DecoratorManager result model (engine/views.ts
        // `applyStagedHeader`), P5-28 (accordproject/concerto-rust#333) for
        // a file `stageModelFile` staged (`applyStagedFileHeader`). At most
        // one of them has a header for a file; otherwise the engine reads it
        // now.
        const views = loadEngine('../engine/views');
        if (!views.applyStagedHeader(this, ast) && !views.applyStagedFileHeader(this, ast)) {
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
        // P5-06/P5-10a: every declaration's and property's engine snapshot
        // in one call, read by the views built below (engine/views.ts
        // `beginModelFile`).
        const views = loadEngine('../engine/views');
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
        // P5-10b: a declaration view already built on its own (a lazily
        // built file's `getLocalType`, engine/views.ts `localType`) is
        // reused, so each declaration has one view.
        const views = loadEngine('../engine/views');
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
        /* istanbul ignore if */
        if (id !== undefined) {
            const manager = this.modelManager as unknown as { rustHandle: { [binding: string]: (...args: any[]) => any } };
            const sourceManager = this.getModelManager();
            // A scratch handle, never `modelManager`'s own `rustHandle`:
            // `filter`'s result is returned *detached* (TS never adds it
            // to `modelManager` here -- `BaseModelManager.filter` does
            // that later, via `addModelFiles`), so writing straight into
            // `modelManager`'s real mirror here would register a
            // namespace there ahead of the TS side, breaking the
            // namespace-set invariant `_rustHandleMatchesModelFiles` relies on.
            const scratch = new (rust.ModelManagerHandle as unknown as { new (): { [binding: string]: (...args: any[]) => any } })();
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
            const filteredId = manager.rustHandle.modelFileFilter(id, wrappedPredicate, scratch);
            if (filteredId === undefined) {
                return null;
            }
            const filteredSnapshot = JSON.parse(scratch.modelFileSnapshot(filteredId));
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

export { ModelFile };
export default ModelFile;
