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

// The construction views: a Rust call that builds a model object returns a
// JSON snapshot of it, which the view stores in the object's own fields, so
// the TS getters read it without a crossing per getter.

import { rust } from './index';
import { deferField, fileStates, inLazyFile, numberValidatorFromSnapshot, sizeValidatorFromSnapshot, stringValidatorFromSnapshot } from './views-staging';

// The introspect modules the views construct objects from, required on
// first use (they import this module's callers) and cached.
let numberValidatorCache: any;
let stringValidatorCache: any;
let collectionSizeValidatorCache: any;
let fieldCache: any;

/** The introspect/numbervalidator module, required once. */
function numberValidatorModule(): any {
    return numberValidatorCache ?? (numberValidatorCache = require('../introspect/numbervalidator'));
}

/** The introspect/stringvalidator module, required once. */
function stringValidatorModule(): any {
    return stringValidatorCache ?? (stringValidatorCache = require('../introspect/stringvalidator'));
}

/** The introspect/collectionsizevalidator module, required once. */
function collectionSizeValidatorModule(): any {
    return collectionSizeValidatorCache ?? (collectionSizeValidatorCache = require('../introspect/collectionsizevalidator'));
}

/** The introspect/field module, required once. */
function fieldModule(): any {
    return fieldCache ?? (fieldCache = require('../introspect/field'));
}

let modelFileCache: any;

/** The introspect/modelfile module, required once. */
function modelFileModule(): any {
    return modelFileCache ?? (modelFileCache = require('../introspect/modelfile'));
}

/**
 * ScalarDeclaration.process, after super.process(): the engine computes the
 * type, validator and default value, set in TS 5.0.0's order. A
 * NumberValidator is rebuilt from its snapshot, a StringValidator built by
 * its constructor (`stringValidatorNew`).
 */
function scalarDeclarationProcess(declaration: any): void {
    // The file's view snapshot when it has this scalar, else the binding.
    const precomputed = batchOf(declaration.modelFile)?.scalars.get(declaration.ast);
    const snapshot = precomputed ?? rust.scalarDeclarationProcess(declaration);
    declaration.superType = null;
    declaration.superTypeDeclaration = null;
    declaration.idField = null;
    declaration.timestamped = false;
    declaration.abstract = false;
    const kind = snapshot.validator?.kind;
    if (precomputed && kind && inLazyFile(declaration)) {
        // Built on first read.
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
 * One property's precomputed snapshots: `p` (`propertyProcess`) and `f`
 * (`fieldProcess`). `owner` is the view that took `p` last, the only one
 * `f` may go to, and `parent` its declaration view: a declaration that runs
 * `process()` again rebuilds its property views from the same AST nodes, so
 * a view with the same parent may take the entry again.
 */
interface PrecomputedProperty {
    p: any;
    f: any;
    /** Its `collectionSizeValidatorNew` snapshot, if any. */
    sz?: any;
    /** Its `stringValidatorNew` snapshot, if any. */
    sv?: any;
    owner?: object;
    parent?: object;
}

/**
 * One declaration's precomputed construction decisions (`d` of
 * `modelFileViewSnapshot`): its valid `name`, its `fqn`, and `cd`, the
 * `classDeclarationProcess` snapshot or null. `defaulted` marks an entry
 * computed with the default super type `fromAst` gives an asset,
 * participant, transaction or event that names none. `owner` is the only
 * view it may go to, as often as that view runs `process()`.
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
     * The entries of declarations `fromAst` builds from a copy of the AST node
     * (the default super type), by the `properties` array the copy shares.
     */
    defaulted: Map<object, PrecomputedDeclaration>;
    /**
     * The `decoratorProcess` results, by `decorators` array (which a defaulted
     * copy of a declaration shares).
     */
    decorators: Map<object, any[]>;
    /** The `scalarDeclarationProcess` snapshots, by declaration AST node. */
    scalars: Map<object, any>;
    /** The map declarations whose `mapDeclarationProcess` passes, by AST node. */
    maps: Set<object>;
    /**
     * The `mapKeyTypeProcess`/`mapValueTypeProcess` types, by key or value AST
     * node.
     */
    mapTypes: Map<object, string>;
}

let batch: Batch | null = null;

/**
 * Called before a ModelFile's declarations are built, after `fromAst`'s
 * header part: computes the construction snapshots of every declaration and
 * property of the file in one engine call (`modelFileViewSnapshot`), for the
 * views `fromAst` builds to read instead of crossing each. A snapshot is used
 * only by the view built from that AST node (and its rebuild), during this
 * construction. An element the engine could not precompute has none, and its
 * view calls the per-element binding, so every error is raised by the same
 * call as without the batch. Never throws.
 * @param {object} modelFile the ModelFile whose declarations are being built
 * @param {object} ast the AST they are built from
 * @return {object} the state to hand back to `endModelFile`
 */
function beginModelFile(modelFile: any, ast: any): Batch | null {
    const saved = batch;
    // A lazily built file reuses a snapshot already computed for one of its
    // declarations.
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
 * @param {object} ast the AST its declarations are built from
 */
function computeBatch(modelFile: any, ast: any): Batch | null {
    let batch: Batch | null = null;
    // No shape guard: the engine loaded this AST, and any failure is caught
    // below.
    try {
        const namespace = modelFile.namespace;
        {
            // Read from the file the engine holds, when it holds this one.
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
 * `modelFileViewSnapshot` of `modelFile`'s AST as the engine holds it (its
 * stage, or the file committed from it while its manager still holds it),
 * taking the AST to be unchanged since staging; undefined when the engine
 * holds no copy, and the caller sends the AST.
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
 * undefined. For the defaulted copy `fromAst` makes of a declaration that
 * names no super type, the entry is found by the shared `properties` array,
 * and only when it carries the super type the entry was computed with.
 */
function declarationEntry(view: any): PrecomputedDeclaration | undefined {
    if (!batch || view.modelFile !== batch.modelFile) {
        return undefined;
    }
        // The Decorated constructor rejects a view with no AST.
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
 * `Declaration.process`'s `ModelUtil.isValidIdentifier(this.ast.name)`: true
 * when the view snapshot has an entry for this view (only a valid name has
 * one), else the binding.
 * @return {boolean} whether the name is a valid identifier
 */
function declarationIsValidIdentifier(view: any): boolean {
    const entry = declarationEntry(view);
    if (entry && (entry.owner === undefined || entry.owner === view) && view.ast.name === entry.name) {
        entry.owner = view;
        return true;
    }
    // BC-01: `ModelUtil.isValidIdentifier` answers false for a non-string,
    // but `Declaration.process` tests `String(this.ast.name)`, as TS 5.0.0
    // did.
    return rust.modelUtilIsValidIdentifier(String(view.ast.name));
}

/**
 * `Declaration.process`'s `ModelUtil.getFullyQualifiedName`: from the view
 * snapshot for its owner while the namespace is the one the snapshot
 * assumed, else the binding.
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
 * `ClassDeclaration.process`'s superType/idField decision: the snapshot's
 * `cd` for its owner while its name and fqn are the ones it assumed, else the
 * binding.
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
 * Whether a view's `type` is the one a `fieldProcess` snapshot assumed.
 * @param {*} actual the view's `type`
 * @param {*} expected the type the snapshot was computed with
 * @return {boolean} true if the snapshot applies
 */
function sameType(actual: any, expected: any): boolean {
    // `== null`: null or undefined.
    return actual === expected || (actual == null && expected == null);
}

/**
 * Property.process, after super.process(): the engine computes name, type,
 * array and optional, set in TS 5.0.0's order. `type` stays unset when the
 * snapshot omits it (an `EnumProperty`, where TS never assigns it), so
 * `getType()` reads `undefined` as in TS 5.0.0.
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
        // Built on first read.
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
 * Field.process, after Property's: the engine computes the validator and
 * default value, as `scalarDeclarationProcess` does for a scalar.
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
    // In a lazily built file, a validator known to build is built on first
    // read from its snapshot.
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
 * Field.getScalarField, after its `scalarField` cache check: the engine
 * resolves the field's type, checks it is a scalar, and returns the
 * synthetic field's AST (the scalar's AST with the matching `*Property`
 * `$class` and the field's name), built here as TS 5.0.0 builds it.
 * @param {object} field the Field whose scalar field is being unboxed
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

/** The current batch, when it holds the snapshots of `modelFile`. */
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

// The rest of the views, re-exported: this is the module the engine loader
// loads (`engineViews()`).
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
