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
// JSON snapshot, stored in the object's own fields so getters do not cross.

import { rust } from './index';
import { deferField, fileStates, inLazyFile, numberValidatorFromSnapshot, sizeValidatorFromSnapshot, stringValidatorFromSnapshot } from './views-staging';

// Introspect modules, required on first use (they import this module's
// callers) and cached.
let numberValidatorCache: any;
let stringValidatorCache: any;
let collectionSizeValidatorCache: any;
let fieldCache: any;

function numberValidatorModule(): any {
    return numberValidatorCache ?? (numberValidatorCache = require('../introspect/numbervalidator'));
}

function stringValidatorModule(): any {
    return stringValidatorCache ?? (stringValidatorCache = require('../introspect/stringvalidator'));
}

function collectionSizeValidatorModule(): any {
    return collectionSizeValidatorCache ?? (collectionSizeValidatorCache = require('../introspect/collectionsizevalidator'));
}

function fieldModule(): any {
    return fieldCache ?? (fieldCache = require('../introspect/field'));
}

let modelFileCache: any;

function modelFileModule(): any {
    return modelFileCache ?? (modelFileCache = require('../introspect/modelfile'));
}

/**
 * ScalarDeclaration.process, after super.process(): type, validator and
 * default value from the engine, set in TS 5.0.0's order.
 */
function scalarDeclarationProcess(declaration: any): void {
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
 * One property's snapshots: `p` (`propertyProcess`) and `f` (`fieldProcess`).
 * `owner` is the view that took `p` last, the only one `f` may go to; a view
 * with the same `parent` (a rebuild) may take the entry again.
 */
interface PrecomputedProperty {
    p: any;
    f: any;
    sz?: any;
    sv?: any;
    owner?: object;
    parent?: object;
}

/**
 * One declaration's snapshot (`d` of `modelFileViewSnapshot`): `name`, `fqn`
 * and `cd` (`classDeclarationProcess`, or null). `defaulted` marks an entry
 * computed with the default super type `fromAst` gives. `owner` is the only
 * view it may go to.
 */
interface PrecomputedDeclaration {
    name: string;
    fqn: string;
    cd: any;
    defaulted: boolean;
    owner?: object;
}

/** The view snapshots of the ModelFile whose declarations are being built. */
interface Batch {
    modelFile: any;
    /** The namespace the snapshot's `fqn`s assumed. */
    namespace: string;
    /** Snapshots by AST node; `defaulted` by the `properties` array a defaulted copy shares. */
    properties: Map<object, PrecomputedProperty>;
    declarations: Map<object, PrecomputedDeclaration>;
    defaulted: Map<object, PrecomputedDeclaration>;
    /** `decoratorProcess` results, by `decorators` array (shared by a defaulted copy). */
    decorators: Map<object, any[]>;
    scalars: Map<object, any>;
    /** Map declarations whose `mapDeclarationProcess` passes. */
    maps: Set<object>;
    /** Map key and value types, by key or value AST node. */
    mapTypes: Map<object, string>;
}

let batch: Batch | null = null;

/**
 * Computes the construction snapshots of every declaration and property of
 * a file in one engine call (`modelFileViewSnapshot`), before its
 * declarations are built. A snapshot is used only by the view built from its
 * AST node; an element without one calls its own binding, so errors come
 * from the same call. Never throws. Returns the state for `endModelFile`.
 */
function beginModelFile(modelFile: any, ast: any): Batch | null {
    const saved = batch;
    // A lazy file reuses a snapshot already computed for a declaration.
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

/** The view snapshots of `modelFile`'s declarations, or null. Never throws. */
function computeBatch(modelFile: any, ast: any): Batch | null {
    let batch: Batch | null = null;
    // No shape guard: the engine loaded this AST; any failure is caught below.
    try {
        const namespace = modelFile.namespace;
        {
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
 * `modelFileViewSnapshot` of the file as the engine holds it (staged or
 * committed), taking the AST to be unchanged; undefined if it holds none.
 */
function heldViewSnapshot(modelFile: any, namespace: string | undefined): string | undefined {
    const state = fileStates.get(modelFile);
    if (state === undefined) {
        return undefined;
    }
    const stage = state.stage;
    if (stage !== undefined) {
        try {
            return stage.handle.stagedModelFileViewSnapshot(stage.id, namespace);
        } catch (e) {
            // The stage's handle was released since (`clearModelFiles` frees
            // the handle it replaces): the snapshot of the AST text answers.
            return undefined;
        }
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

/** Ends a `beginModelFile` construction, dropping every snapshot not taken. */
function endModelFile(saved: Batch | null): void {
    batch = saved;
}

/**
 * The snapshot entry for a declaration view being constructed. A defaulted
 * copy is found by its shared `properties` array, only with the super type
 * the entry was computed with.
 */
function declarationEntry(view: any): PrecomputedDeclaration | undefined {
    if (!batch || view.modelFile !== batch.modelFile) {
        return undefined;
    }
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

/** `Declaration.process`'s `isValidIdentifier`: true if the snapshot has an entry, else the binding. */
function declarationIsValidIdentifier(view: any): boolean {
    const entry = declarationEntry(view);
    if (entry && (entry.owner === undefined || entry.owner === view) && view.ast.name === entry.name) {
        entry.owner = view;
        return true;
    }
    // BC-01: `Declaration.process` tests `String(this.ast.name)`, as TS 5.0.0.
    return rust.modelUtilIsValidIdentifier(String(view.ast.name));
}

/** `Declaration.process`'s fully qualified name: from the snapshot while its namespace holds. */
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
 * `cd` while its name and fqn hold, else the binding.
 */
function classDeclarationProcess(view: any): any {
    const entry = declarationEntry(view);
    if (entry && entry.owner === view && entry.cd && view.name === entry.name && view.fqn === entry.fqn) {
        return { ...entry.cd };
    }
    return rust.classDeclarationProcess(view);
}

/** Whether a view's `type` is the one a `fieldProcess` snapshot assumed. */
function sameType(actual: any, expected: any): boolean {
    return actual === expected || (actual == null && expected == null);
}

/**
 * Property.process, after super.process(): name, type, array and optional
 * from the engine, in TS 5.0.0's order. `type` stays unset when the snapshot
 * omits it (an `EnumProperty`), as in TS 5.0.0.
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
        const sz = entry.sz;
        deferField(property, 'sizeValidator', () => sizeValidatorFromSnapshot(property, sizeAst, sz));
        return;
    }
    const { default: CollectionSizeValidator } = collectionSizeValidatorModule();
    property.sizeValidator = sizeAst
        ? new CollectionSizeValidator(property, sizeAst)
        : null;
}

/** Field.process, after Property's: the validator and default value. */
function fieldProcess(field: any): void {
    const entry = batch?.properties.get(field.ast);
    let snapshot;
    if (entry && entry.owner === field && entry.f && sameType(field.type, 'type' in entry.p ? entry.p.type : undefined)) {
        snapshot = entry.f;
    } else {
        snapshot = rust.fieldProcess(field);
    }
    const kind = snapshot.validator?.kind;
    // In a lazy file, a validator known to build is built on first read.
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
 * Field.getScalarField, after its cache check: the engine resolves the
 * scalar and returns the synthetic field's AST, built as TS 5.0.0 builds it.
 */
function fieldGetScalarField(field: any): any {
    const { Field } = fieldModule();
    const fieldAst = rust.fieldGetScalarField(field);
    const scalarField = new Field(field.getParent(), fieldAst);
    scalarField.array = field.isArray();
    return scalarField;
}

/** Runs `fn` with `saved` as the current batch, restoring the previous one. */
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

// The rest of the views, re-exported for the engine loader.
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
