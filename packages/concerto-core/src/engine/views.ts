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

// Snapshot materialisation for the views whose Rust call builds objects
// (P0-04b trial scaffold; PORTING.md 1.5).
//
// A Rust call that constructs a model object returns a JSON snapshot of it.
// The view caches the snapshot in the object's own fields, so the TS getters
// (`getType()`, `getValidator()`, `getDefaultValue()`, `getLowerBound()`,
// ...) read it unchanged, without a boundary call per getter.

import { rust } from './index';
import { deferField, fileStates, inLazyFile, numberValidatorFromSnapshot, sizeValidatorFromSnapshot, stringValidatorFromSnapshot } from './views-staging';

// P5-06: the introspect modules the per-element views below construct
// objects from, required once on first use (they cannot be imported at
// module load: they import this module's callers) and cached, so a view run
// once per property does not pay a module resolution on every call.
let numberValidatorCache: any;
let stringValidatorCache: any;
let collectionSizeValidatorCache: any;
let fieldCache: any;

/**
 * The introspect/numbervalidator module, required once.
 * @return {object} the module
 */
function numberValidatorModule(): any {
    return numberValidatorCache ?? (numberValidatorCache = require('../introspect/numbervalidator'));
}

/**
 * The introspect/stringvalidator module, required once.
 * @return {object} the module
 */
function stringValidatorModule(): any {
    return stringValidatorCache ?? (stringValidatorCache = require('../introspect/stringvalidator'));
}

/**
 * The introspect/collectionsizevalidator module, required once.
 * @return {object} the module
 */
function collectionSizeValidatorModule(): any {
    return collectionSizeValidatorCache ?? (collectionSizeValidatorCache = require('../introspect/collectionsizevalidator'));
}

/**
 * The introspect/field module, required once.
 * @return {object} the module
 */
function fieldModule(): any {
    return fieldCache ?? (fieldCache = require('../introspect/field'));
}

let modelFileCache: any;

/**
 * The introspect/modelfile module, required once.
 * @return {object} the module
 */
function modelFileModule(): any {
    return modelFileCache ?? (modelFileCache = require('../introspect/modelfile'));
}

/**
 * ScalarDeclaration.process in rust mode, after super.process(): Rust
 * computes the type, the validator and the default value; this sets the same
 * fields, in the same order, as the TS body. A NumberValidator is rebuilt from
 * its snapshot; a StringValidator is still built by its TS constructor until
 * P2-02 ports it.
 * @param {object} declaration the ScalarDeclaration being processed
 */
function scalarDeclarationProcess(declaration: any): void {
    // P5-10b: the file's view snapshot when it has this scalar (only where
    // the binding succeeds, with a StringValidator's own snapshot too),
    // else the binding.
    const precomputed = batchOf(declaration.modelFile)?.scalars.get(declaration.ast);
    const snapshot = precomputed ?? rust.scalarDeclarationProcess(declaration);
    declaration.superType = null;
    declaration.superTypeDeclaration = null;
    declaration.idField = null;
    declaration.timestamped = false;
    declaration.abstract = false;
    const kind = snapshot.validator?.kind;
    if (precomputed && kind && inLazyFile(declaration)) {
        // Built on first read (P5-10b).
        const regexAst = declaration.ast.validator;
        deferField(declaration, 'validator', () => (kind === 'NumberValidator'
            ? numberValidatorFromSnapshot(declaration, snapshot.validator)
            : stringValidatorFromSnapshot(declaration, regexAst, snapshot.validator)));
        declaration.type = snapshot.type;
        declaration.defaultValue = snapshot.defaultValue;
        return;
    }
    declaration.validator = null;
    declaration.type = snapshot.type;
    if (kind === 'NumberValidator') {
        declaration.validator = numberValidatorFromSnapshot(declaration, snapshot.validator);
    } else if (kind === 'StringValidator') {
        const { StringValidator } = stringValidatorModule();
        declaration.validator = new StringValidator(declaration, declaration.ast.validator, declaration.ast.lengthValidator);
    }
    declaration.defaultValue = snapshot.defaultValue;
}

/**
 * One property's precomputed snapshots (P5-06): `p` is its `propertyProcess`
 * snapshot and `f` its `fieldProcess` one, from the file's view snapshot;
 * `owner` is the view that took `p` last, the only one `f` may then go to,
 * and `parent` its declaration view. A declaration that runs `process()`
 * again (IdentifiedDeclaration's constructor does) rebuilds its property
 * views from the same AST nodes: a view with the same parent may take the
 * entry again (P5-10a).
 */
interface PrecomputedProperty {
    p: any;
    f: any;
    /** P5-10b: its `collectionSizeValidatorNew` snapshot, if any. */
    sz?: any;
    /** P5-10b: its `stringValidatorNew` snapshot, if any. */
    sv?: any;
    owner?: object;
    parent?: object;
}

/**
 * One declaration's precomputed construction decisions (P5-10a), from the
 * `d` entry of `modelFileViewSnapshot`: its (valid) `name`, the `fqn`
 * `Declaration.process` computes, and `cd`, the `classDeclarationProcess`
 * snapshot (or null). `defaulted` marks an entry computed with the default
 * super type `ModelFile.fromAst` gives an asset, participant, transaction or
 * event declaration that names none. `owner` is the view that took it, the
 * only one it may then go to, as often as that view runs `process()`
 * (IdentifiedDeclaration's constructor runs it twice).
 */
interface PrecomputedDeclaration {
    name: string;
    fqn: string;
    cd: any;
    defaulted: boolean;
    owner?: object;
}

/**
 * The precomputed snapshots of the `ModelFile` whose declarations are being
 * built, or null outside `beginModelFile`/`endModelFile`.
 */
interface Batch {
    /** The ModelFile the snapshots were computed for. */
    modelFile: any;
    /** Its namespace, as the snapshot's `fqn`s assumed it. */
    namespace: string;
    /** The property snapshots, by property AST node. */
    properties: Map<object, PrecomputedProperty>;
    /** The declaration entries, by declaration AST node. */
    declarations: Map<object, PrecomputedDeclaration>;
    /**
     * The declaration entries `ModelFile.fromAst` builds from a copy of the
     * AST node (the default super type), by that node's `properties` array,
     * which the copy shares.
     */
    defaulted: Map<object, PrecomputedDeclaration>;
    /**
     * P5-10b: the `decoratorProcess` results of each `decorators` array of
     * the file's declarations, properties and map key and value types, by
     * that array (which a defaulted copy of a declaration shares).
     */
    decorators: Map<object, any[]>;
    /** P5-10b: the `scalarDeclarationProcess` snapshots, by declaration AST node. */
    scalars: Map<object, any>;
    /** P5-10b: the map declarations whose `mapDeclarationProcess` passes, by AST node. */
    maps: Set<object>;
    /**
     * P5-10b: the `mapKeyTypeProcess`/`mapValueTypeProcess` types of those
     * maps' key and value types, by key or value AST node.
     */
    mapTypes: Map<object, string>;
}

let batch: Batch | null = null;

/**
 * Called just before a ModelFile's declarations are built (P5-06, extended
 * by P5-10a to one crossing per file): computes, in one engine call, the
 * construction-time snapshots of every declaration and property of the
 * file (`modelFileViewSnapshot`), so that the declaration and property views
 * `fromAst` builds read them (`declarationIsValidIdentifier`,
 * `declarationFullyQualifiedName`, `classDeclarationProcess`,
 * `propertyProcess`, `fieldProcess` below) instead of each crossing the
 * boundary. A snapshot is only ever used by the view built from that very
 * AST node (and by its rebuild when its declaration runs `process()`
 * again), during this one construction (see `endModelFile`); an
 * element the engine could not precompute (it would throw, or the AST cannot
 * cross) has none, and its view calls the per-element binding exactly as
 * before, so every error is raised by the same call as without the batch.
 * Called after `fromAst`'s header part, so the namespace is known. Never
 * throws.
 * @param {object} modelFile the ModelFile whose declarations are being built
 * @param {object} ast the AST they are built from
 * @return {object} the state to hand back to `endModelFile`
 */
function beginModelFile(modelFile: any, ast: any): Batch | null {
    const saved = batch;
    // P5-10b: a lazily built file whose snapshot was already computed for a
    // declaration built on its own reuses it.
    const deferred = fileStates.get(modelFile)?.deferred;
    if (deferred && deferred.batch !== undefined) {
        batch = deferred.batch;
        return saved;
    }
    batch = computeBatch(modelFile, ast);
    if (deferred) {
        deferred.batch = batch;
    }
    return saved;
}

/**
 * The batch of view snapshots of `modelFile`'s declarations (see
 * `beginModelFile`), or null. Never throws.
 * @param {object} modelFile the ModelFile
 * @param {object} ast the AST its declarations are built from
 * @return {object|null} the batch
 */
function computeBatch(modelFile: any, ast: any): Batch | null {
    let batch: Batch | null = null;
    // P5-103: no guard for an AST or a snapshot of an unexpected shape: the
    // engine loaded this AST (its declarations are an array of objects),
    // and any failure here is caught below, as before.
    try {
        const namespace = modelFile.namespace;
        {
            // P5-100 (E-6): read from the file the engine already holds,
            // when it holds this one, rather than from the AST sent again.
            const text = (ast === modelFile.ast ? heldViewSnapshot(modelFile, namespace) : undefined) ??
                rust.modelFileViewSnapshot(JSON.stringify(ast), namespace);
            if (typeof text === 'string') {
                const snapshots = JSON.parse(text);
                const next: Batch = {
                    modelFile,
                    namespace,
                    properties: new Map(),
                    declarations: new Map(),
                    defaulted: new Map(),
                    decorators: new Map(),
                    scalars: new Map(),
                    maps: new Set(),
                    mapTypes: new Map(),
                };
                const addDecorators = (node: any, dec: any) => {
                    const nodes = node?.decorators;
                    if (Array.isArray(dec) && Array.isArray(nodes) && nodes.length === dec.length &&
                        !next.decorators.has(nodes)) {
                        next.decorators.set(nodes, dec);
                    }
                };
                ast.declarations.forEach((declaration: any, i: number) => {
                    const snapshot = snapshots[i];
                    const properties = declaration.properties;
                    addDecorators(declaration, snapshot.dec);
                    if (snapshot.s && !next.scalars.has(declaration)) {
                        next.scalars.set(declaration, snapshot.s);
                    }
                    const m = snapshot.m;
                    const key = declaration.key;
                    const value = declaration.value;
                    if (m && key && typeof key === 'object' && value && typeof value === 'object' && key !== value) {
                        next.maps.add(declaration);
                        next.mapTypes.set(key, m.k.t);
                        next.mapTypes.set(value, m.v.t);
                        addDecorators(key, m.k.dec);
                        addDecorators(value, m.v.dec);
                    }
                    const d = snapshot.d;
                    if (d && typeof d.name === 'string' && d.name === declaration.name) {
                        if (!d.defaulted) {
                            if (!next.declarations.has(declaration)) {
                                next.declarations.set(declaration, d);
                            }
                        } else if (Array.isArray(properties) && !next.defaulted.has(properties)) {
                            next.defaulted.set(properties, d);
                        }
                    }
                    const entries = snapshot.p;
                    if (!Array.isArray(entries) || !Array.isArray(properties) || entries.length !== properties.length) {
                        return;
                    }
                    properties.forEach((node: any, j: number) => {
                        const entry = entries[j];
                        if (entry && node && typeof node === 'object' && !next.properties.has(node)) {
                            next.properties.set(node, entry);
                            addDecorators(node, entry.dec);
                        }
                    });
                });
                batch = next;
            }
        }
    } catch (e) {
        batch = null;
    }
    return batch;
}

/**
 * P5-100 (E-6, accordproject/concerto-rust#454): `modelFileViewSnapshot`
 * of `modelFile`'s AST as the engine already holds it: its staged copy, or
 * the file registered from that stage while its manager still holds it, so
 * that building the views does not send and parse the AST again. As
 * everywhere the engine's copy stands for the view's (`commitStaged`,
 * `validateLoaded`), the AST is taken to be unchanged since it was staged.
 * Undefined when the engine holds no such copy;
 * the caller then sends the AST, as before.
 * @param {object} modelFile the ModelFile
 * @param {string} [namespace] its namespace
 * @return {string|undefined} the snapshot text
 */
function heldViewSnapshot(modelFile: any, namespace: string | undefined): string | undefined {
    const state = fileStates.get(modelFile);
    if (state === undefined) {
        return undefined;
    }
    const stage = state.stage;
    if (stage !== undefined) {
        return stage.handle.stagedModelFileViewSnapshot(stage.id, namespace);
    }
    const committed: any = state.committed;
    const manager = modelFile.modelManager;
    if (committed === undefined || namespace === undefined || manager?.rustHandle !== committed ||
        manager.modelFiles?.[namespace] !== modelFile) {
        return undefined;
    }
    const id = manager._rustModelFileId(namespace);
    return id === undefined ? undefined : committed.modelFileViewSnapshotOf(id, namespace);
}

/**
 * Ends the construction `beginModelFile` started: drops every snapshot not
 * taken, so none can outlive it.
 * @param {object} saved what `beginModelFile` returned
 */
function endModelFile(saved: Batch | null): void {
    batch = saved;
}

/**
 * The precomputed entry for a declaration view being constructed, or
 * undefined. `ModelFile.fromAst` hands an asset, participant, transaction or
 * event declaration that names no super type a shallow copy of its AST node
 * with the default one added; that copy is found by the `properties` array
 * it shares with the original, and only when it carries exactly the default
 * super type the entry was computed with.
 * @param {object} view the Declaration view
 * @return {object|undefined} the entry
 */
function declarationEntry(view: any): PrecomputedDeclaration | undefined {
    if (!batch || view.modelFile !== batch.modelFile) {
        return undefined;
    }
    // The Decorated constructor rejects a view with no AST; any other
    // AST that is not an object is found in neither map below.
    const ast = view.ast;
    const direct = batch.declarations.get(ast);
    if (direct) {
        return direct;
    }
    const properties = ast.properties;
    const copy = Array.isArray(properties) ? batch.defaulted.get(properties) : undefined;
    if (copy && copy.name === ast.name && ast.superType && typeof ast.superType === 'object' &&
        copy.cd && ast.superType.name === copy.cd.superType) {
        return copy;
    }
    return undefined;
}

/**
 * `Declaration.process`'s `ModelUtil.isValidIdentifier(this.ast.name)`
 * (P5-10a): true from the file's view snapshot when it has an entry for this
 * view's AST node (the entry exists only for a valid name, and the view then
 * owns it), else the `modelUtilIsValidIdentifier` binding, as before.
 * @param {object} view the Declaration view being processed
 * @return {boolean} whether the name is a valid identifier
 */
function declarationIsValidIdentifier(view: any): boolean {
    const entry = declarationEntry(view);
    if (entry && (entry.owner === undefined || entry.owner === view) && view.ast.name === entry.name) {
        entry.owner = view;
        return true;
    }
    // BC-01 (R1) changed only `ModelUtil.isValidIdentifier`, which now answers
    // false for a non-string. `Declaration.process` keeps testing
    // `String(this.ast.name)`, as TS 5.0.0's `ID_REGEX.test` did.
    return rust.modelUtilIsValidIdentifier(String(view.ast.name));
}

/**
 * `Declaration.process`'s `ModelUtil.getFullyQualifiedName(this.modelFile.getNamespace(), this.name)`
 * (P5-10a): from the view snapshot for the view that owns the entry, while
 * the namespace is still the one the snapshot assumed, else the binding.
 * @param {object} view the Declaration view being processed
 * @return {string} the fully qualified name
 */
function declarationFullyQualifiedName(view: any): string {
    const namespace = view.modelFile.getNamespace();
    const entry = declarationEntry(view);
    if (entry && entry.owner === view && view.name === entry.name && namespace === batch!.namespace) {
        return entry.fqn;
    }
    return rust.modelUtilGetFullyQualifiedName(namespace, view.name);
}

/**
 * `ClassDeclaration.process`'s superType/idField decision (P5-10a): the
 * view snapshot's `cd` for the view that owns the entry, when its name and
 * fully qualified name are still the ones the snapshot assumed, else the
 * `classDeclarationProcess` binding, as before.
 * @param {object} view the ClassDeclaration view being processed
 * @return {object} `{superType, idField, addIdentifierField, addTimestampField}`
 */
function classDeclarationProcess(view: any): any {
    const entry = declarationEntry(view);
    if (entry && entry.owner === view && entry.cd && view.name === entry.name && view.fqn === entry.fqn) {
        return { ...entry.cd };
    }
    return rust.classDeclarationProcess(view);
}

/**
 * Whether a view's `type` is the one a precomputed `fieldProcess` snapshot
 * assumed (the `type` its `propertyProcess` snapshot set, or none).
 * @param {*} actual the view's `type`
 * @param {*} expected the type the snapshot was computed with
 * @return {boolean} true if the snapshot applies
 */
function sameType(actual: any, expected: any): boolean {
    // `== null`: null or undefined.
    return actual === expected || (actual == null && expected == null);
}

/**
 * Property.process in rust mode, after super.process(): Rust computes the
 * name, type, array and optional fields from the AST, in the same order as
 * the TS body. `type` is left unset when the snapshot omits it (the
 * `EnumProperty` case, where TS never assigns `this.type`), so `getType()`
 * reads `undefined` there exactly as ts mode does. `sizeValidator` is still
 * built here, the same way ts mode does, since `CollectionSizeValidator`'s
 * own constructor already ports the Rust engine (P0-04b trial).
 * @param {object} property the Property (or Field/EnumValueDeclaration/
 * RelationshipDeclaration) being processed
 */
function propertyProcess(property: any): void {
    const entry = batch?.properties.get(property.ast);
    let snapshot;
    if (entry && entry.p && (entry.owner === undefined ||
        (property.parent !== undefined && entry.parent === property.parent))) {
        entry.owner = property;
        entry.parent = property.parent;
        snapshot = entry.p;
    } else {
        snapshot = rust.propertyProcess(property);
    }
    property.name = snapshot.name;
    if ('type' in snapshot) {
        property.type = snapshot.type;
    }
    property.array = snapshot.array;
    property.optional = snapshot.optional;
    const sizeAst = property.ast.sizeValidator;
    if (sizeAst && entry?.sz && inLazyFile(property)) {
        // Built on first read, from the view snapshot (P5-10b).
        const sz = entry.sz;
        deferField(property, 'sizeValidator', () => sizeValidatorFromSnapshot(property, sizeAst, sz));
        return;
    }
    const { default: CollectionSizeValidator } = collectionSizeValidatorModule();
    property.sizeValidator = sizeAst
        ? new CollectionSizeValidator(property, sizeAst)
        : null;
}

/**
 * Field.process in rust mode, after `super.process()` (Property's, already
 * run): Rust computes the validator and the default value, the identical
 * selection `scalarDeclarationProcess` makes for `ScalarDeclaration` — a
 * `NumberValidator` is rebuilt from its snapshot; a `StringValidator` is
 * still built by its TS constructor until P2-02 ports it.
 * @param {object} field the Field being processed
 */
function fieldProcess(field: any): void {
    const entry = batch?.properties.get(field.ast);
    let snapshot;
    if (entry && entry.owner === field && entry.f && sameType(field.type, 'type' in entry.p ? entry.p.type : undefined)) {
        snapshot = entry.f;
    } else {
        snapshot = rust.fieldProcess(field);
    }
    const kind = snapshot.validator?.kind;
    // P5-10b: in a lazily built file, a validator whose construction is
    // known to succeed is built on first read: a NumberValidator from its
    // snapshot, a StringValidator from its `stringValidatorNew` snapshot.
    const sv = entry?.sv;
    if ((kind === 'NumberValidator' || (kind === 'StringValidator' && sv)) && inLazyFile(field)) {
        const numberSnapshot = snapshot.validator;
        const regexAst = field.ast.validator;
        deferField(field, 'validator', () => (kind === 'NumberValidator'
            ? numberValidatorFromSnapshot(field, numberSnapshot)
            : stringValidatorFromSnapshot(field, regexAst, sv)));
        field.defaultValue = snapshot.defaultValue;
        return;
    }
    field.validator = null;
    if (kind === 'NumberValidator') {
        field.validator = numberValidatorFromSnapshot(field, snapshot.validator);
    } else if (kind === 'StringValidator') {
        const { StringValidator } = stringValidatorModule();
        field.validator = new StringValidator(field, field.ast.validator, field.ast.lengthValidator);
    }
    field.defaultValue = snapshot.defaultValue;
}

/**
 * Field.getScalarField in rust mode, after the `this.scalarField` cache
 * check (still done by the view, since the cached instance stays a JS
 * object) — the P2-09 partial audit found this still TS although the
 * ledger says RUST (P2-04+P4-07, both closed). Rust resolves the field's
 * type (calling back into `field`'s own `ModelFile`, not yet Rust-backed),
 * checks it is a scalar declaration and, if so, returns the synthetic
 * field's AST: the scalar's own AST with `$class` swapped for the matching
 * `*Property` class and `name` set to the field's own name. This
 * constructs the `Field` instance and sets `array` from `field.isArray()`,
 * exactly as the TS body's `new Field(this.getParent(), fieldAst)` and
 * `this.scalarField.array = this.isArray()` do.
 * @param {object} field the Field whose scalar field is being unboxed
 * @return {object} the synthetic Field instance
 */
function fieldGetScalarField(field: any): any {
    const { Field } = fieldModule();
    const fieldAst = rust.fieldGetScalarField(field);
    const scalarField = new Field(field.getParent(), fieldAst);
    scalarField.array = field.isArray();
    return scalarField;
}


/**
 * Runs `fn` with `saved` as the current batch (the snapshots of the file a
 * deferred part belongs to), restoring the current one afterwards.
 * @param {object} saved the batch
 * @param {Function} fn what to run
 * @return {*} what `fn` returns
 */
function withBatch<T>(saved: Batch | null, fn: () => T): T {
    const current = batch;
    batch = saved;
    try {
        return fn();
    } finally {
        batch = current;
    }
}

/**
 * The current batch, when it holds the snapshots of `modelFile`.
 * @param {object} modelFile the ModelFile
 * @return {object|null} the batch
 */
function batchOf(modelFile: any): Batch | null {
    return batch && batch.modelFile === modelFile ? batch : null;
}

export {
    batchOf,
    beginModelFile,
    classDeclarationProcess,
    collectionSizeValidatorModule,
    computeBatch,
    declarationFullyQualifiedName,
    declarationIsValidIdentifier,
    endModelFile,
    fieldGetScalarField,
    fieldProcess,
    modelFileModule,
    numberValidatorModule,
    propertyProcess,
    scalarDeclarationProcess,
    stringValidatorModule,
    withBatch,
};

export type {
    Batch,
};

// P5-104 (accordproject/concerto-rust#458, review M7): the rest of the
// engine views, split out of this module, which stays the one the engine
// loader loads (`engineViews()`) and re-exports them unchanged.
export {
    decoratorManagerDecorateModels,
    decoratorManagerExtractDecorators,
    decoratorManagerExtractNonVocabDecorators,
    decoratorManagerExtractVocabularies,
    decoratorManagerValidate,
} from './views-dcs';

export {
    adoptSharedView,
    applyStagedFileHeader,
    applyStagedHeaders,
    buildDeferredParts,
    builtDeclaration,
    checkAstShape,
    commitStaged,
    commitStagedAll,
    copyImportNames,
    decoratorFactories,
    deferDeclarations,
    deferDecorators,
    dropStaged,
    installLazyField,
    installLazyViewsCheck,
    localType,
    mapDeclarationProcess,
    mapKeyTypeProcess,
    mapValueTypeProcess,
    markSystemModelAst,
    materialise,
    recordImportNames,
    recordedImportNames,
    stageModelFile,
    updateExternalStaged,
    updateStaged,
    validateAndCommitStaged,
    validateAstStaged,
    validateLoaded,
} from './views-staging';

export {
    classDeclarationGetIdentifierFieldName,
    classDeclarationGetProperties,
    classDeclarationGetProperty,
    declarationArenaRef,
    declarationViews,
    modelFileArenaRef,
    notInArena,
} from './views-lookups';
