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

/* istanbul ignore file */
// Snapshot materialisation for the views whose Rust call builds objects
// (P0-04b trial scaffold; PORTING.md 1.5).
//
// A Rust call that constructs a model object returns a JSON snapshot of it.
// The view caches the snapshot in the object's own fields, so the TS getters
// (`getType()`, `getValidator()`, `getDefaultValue()`, `getLowerBound()`,
// ...) read it unchanged, without a boundary call per getter.

import { rust } from './index';
import { encodeAst, encodeAstGeneration } from './ast-codec';

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
    const snapshot = precomputed ?? rust!.scalarDeclarationProcess(declaration);
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
    const deferred = deferredFiles.get(modelFile);
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
    try {
        const namespace = modelFile.namespace;
        if (ast && Array.isArray(ast.declarations)) {
            const text = rust!.modelFileViewSnapshot(
                JSON.stringify(ast),
                typeof namespace === 'string' ? namespace : undefined,
            );
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
                    const snapshot = Array.isArray(snapshots) ? snapshots[i] : null;
                    if (!snapshot || !declaration || typeof declaration !== 'object') {
                        return;
                    }
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
    const ast = view.ast;
    if (!ast || typeof ast !== 'object') {
        return undefined;
    }
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
    return rust!.modelUtilIsValidIdentifier(String(view.ast.name));
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
    return rust!.modelUtilGetFullyQualifiedName(namespace, view.name);
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
    return rust!.classDeclarationProcess(view);
}

/**
 * Whether a view's `type` is the one a precomputed `fieldProcess` snapshot
 * assumed (the `type` its `propertyProcess` snapshot set, or none).
 * @param {*} actual the view's `type`
 * @param {*} expected the type the snapshot was computed with
 * @return {boolean} true if the snapshot applies
 */
function sameType(actual: any, expected: any): boolean {
    const nullish = (v: any) => v === null || v === undefined;
    return actual === expected || (nullish(actual) && nullish(expected));
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
        snapshot = rust!.propertyProcess(property);
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
        snapshot = rust!.fieldProcess(field);
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
    const fieldAst = rust!.fieldGetScalarField(field);
    const scalarField = new Field(field.getParent(), fieldAst);
    scalarField.array = field.isArray();
    return scalarField;
}

/**
 * DecoratorManager.validate's structural check (`serializer.fromJSON(
 * decoratorCommandSet)`), once the TS body has built `validationModelManager`
 * (the metamodel, `modelFiles` and the DCS model). P5-27 (F6): the command
 * set is checked against the manager's rustHandle's own resident manager
 * (concerto-wasm `ModelManagerHandle.dcsValidate`), which mirrors its model
 * files (P5-34: a BaseModelManager holds only ModelFiles its constructor
 * built, all mirrored) and so already holds exactly the models the per-call
 * binding would load: the model files are neither sent again nor loaded into
 * a second manager. Only an engine without the binding takes the per-call
 * `decoratorManagerValidate`, which rebuilds them, as before. Either throws
 * the same errors: any error loading the models has already been thrown by
 * the TS body while it built `validationModelManager`.
 * @param {object} validationModelManager the validation ModelManager, built
 * @param {*} decoratorCommandSet the DecoratorCommandSet object
 * @param {object[]} [modelFiles] the model files validate was given
 */
function decoratorManagerValidate(validationModelManager: any, decoratorCommandSet: any, modelFiles?: any[]): void {
    const handle = validationModelManager.rustHandle;
    if (handle && typeof handle.dcsValidate === 'function') {
        handle.dcsValidate(decoratorCommandSet);
        return;
    }
    rust!.decoratorManagerValidate(decoratorCommandSet, modelFiles?.map((mf: any) => mf.getAst()));
}

/**
 * P5-68 (BC-19-a, R1): whether a `decorateModels` result may skip the AST
 * shape check: every source model was checked (`dcsSourceShapeChecked`) and
 * everything the commands add passes it (`dcsCommandsShapeChecked`).
 * @param {object} modelManager the input ModelManager
 * @param {object} handle an engine handle, for `checkAstShape`
 * @param {object[]} decoratorCommandSets the decorator command sets
 * @param {object} [options] the decorateModels options
 * @return {boolean} true if the result models may skip the check
 */
function decorateResultTrusted(modelManager: any, handle: any, decoratorCommandSets: any[], options?: any): boolean {
    return dcsSourceShapeChecked(modelManager) && dcsCommandsShapeChecked(handle, decoratorCommandSets, options);
}

/**
 * DecoratorManager.decorateModels in rust mode, after the TS body's
 * `skipValidationAndResolution` handling. Metamodel resolution itself is not
 * ported (concerto-rust src/dcs/mod.rs `decorate_models`'s doc comment), but
 * the ModelManager this phase runs against is still the TS one (P4-08 has not
 * converted it), so resolution runs here, on the TS side, exactly as the
 * ts-mode body does (`resolveMetaModel` unless
 * `options.disableMetamodelResolution`), and the already-resolved AST is
 * handed across. System namespaces are left out (`getAst`'s second argument
 * false): the Rust-side manager carries its own copy of them, and re-adding
 * one is a duplicate-namespace error there. The decorated AST comes back and
 * is loaded into a new ModelManager, as the TS body does.
 * @param {object} modelManager the input ModelManager
 * @param {object[]} decoratorCommandSets the decorator command sets, as an array
 * @param {object} [options] the decorateModels options
 * @return {object} a new ModelManager with the decorations applied
 */
function decoratorManagerDecorateModels(modelManager: any, decoratorCommandSets: any[], options?: any): any {
    const { default: ModelManager } = require('../modelmanager');
    const source = sourceDcsHandle(modelManager, 'dcsDecorateModels');
    if (source) {
        // P5-55 (T1, F-A1): on the source manager's own rustHandle, which
        // resolves its models itself; nothing is copied.
        const decoratedModelManager = new ModelManager({
            decoratorValidation: modelManager.getDecoratorValidation()
        });
        decoratedModelManager.clearModelFiles();
        const target = decoratedModelManager.rustHandle;
        assertDistinctHandles(source, target);
        const result = source.dcsDecorateModels(target, decoratorCommandSets, options ?? {});
        adoptStagedModels(decoratedModelManager, result.ast, result.staged, result.validated, options?.disableMetamodelValidation,
            decorateResultTrusted(modelManager, target, decoratorCommandSets, options));
        return decoratedModelManager;
    }
    if (residentDcsAvailable()) {
        // P5-27 (F6): the resident input manager, and the result staged
        // into the new manager's rustHandle (see `adoptStagedModels`).
        const { dcs, resident } = dcsManagerFor(modelManager, !options?.disableMetamodelResolution);
        try {
            const decoratedModelManager = new ModelManager({
                decoratorValidation: modelManager.getDecoratorValidation()
            });
            decoratedModelManager.clearModelFiles();
            const result = dcs.decorateModels(decoratedModelManager.rustHandle, decoratorCommandSets, options ?? {});
            adoptStagedModels(decoratedModelManager, result.ast, result.staged, result.validated, options?.disableMetamodelValidation,
                decorateResultTrusted(modelManager, decoratedModelManager.rustHandle, decoratorCommandSets, options));
            return decoratedModelManager;
        } finally {
            if (!resident) {
                dcs.free();
            }
        }
    }
    const ast = modelManager.getAst(!options?.disableMetamodelResolution, false);
    const decoratedAst = rust!.decoratorManagerDecorateModels(ast.models, decoratorCommandSets, options ?? {});
    const newModelManager = new ModelManager({
        decoratorValidation: modelManager.getDecoratorValidation()
    });
    newModelManager.fromAst(decoratedAst, { disableValidation: options?.disableMetamodelValidation });
    return newModelManager;
}

/**
 * Restores a `decorators` field the TS extractor leaves present-but-`undefined`
 * (`decoratorextractor.ts` `filterOutDecorators`'s `Action.EXTRACT_ALL` branch
 * assigns `decl.decorators = undefined` rather than deleting the key) after
 * the Rust extractor's `filter_out_decorators` (`concerto-rust` `dcs/extractor.rs`)
 * deletes the key outright (`map.remove("decorators")`) instead. Both are
 * `undefined` when read and identical once JSON-serialised, but the oracle
 * distinguishes a present-and-`undefined` field from an absent one (task
 * accordproject/concerto-rust#157), so a node whose *source* counterpart had
 * a (truthy) `decorators` field, and whose extracted counterpart now has
 * none, gets that field set back to `undefined` here — matching the TS shape
 * without touching the Rust engine's own behaviour or its JSON output.
 * @param {object} sourceNode the pre-extraction AST node (declaration,
 * property, or map key/value type)
 * @param {object} resultNode the corresponding post-extraction AST node
 */
function restoreUndefinedDecorators(sourceNode: any, resultNode: any): void {
    if (!sourceNode || !resultNode || typeof resultNode !== 'object') {
        return;
    }
    if (sourceNode.decorators && !('decorators' in resultNode)) {
        resultNode.decorators = undefined;
    }
    if (Array.isArray(sourceNode.properties) && Array.isArray(resultNode.properties)) {
        sourceNode.properties.forEach((sourceProperty: any, i: number) => {
            restoreUndefinedDecorators(sourceProperty, resultNode.properties[i]);
        });
    }
    if (sourceNode.key && resultNode.key) {
        restoreUndefinedDecorators(sourceNode.key, resultNode.key);
    }
    if (sourceNode.value && resultNode.value) {
        restoreUndefinedDecorators(sourceNode.value, resultNode.value);
    }
}

/**
 * `restoreUndefinedDecorators` over every result model and its
 * declarations. `resultModels` also carries the Rust engine's own system
 * namespaces (the Rust-side manager carries its own copy of them, see
 * `decoratorManagerDecorateModels`), which `sourceModels` (system
 * namespaces excluded, `getAst`'s second argument false) does not, so the
 * two arrays line up by namespace, not by index.
 * @param {object[]} sourceModels the pre-extraction models
 * @param {object[]} resultModels the extracted models, re-shaped in place
 */
function restoreAllUndefinedDecorators(sourceModels: any[], resultModels: any[]): void {
    const sourceByNamespace = new Map<string, any>(sourceModels.map((m: any) => [m.namespace, m]));
    resultModels.forEach((resultModel: any) => {
        const sourceModel = sourceByNamespace.get(resultModel.namespace);
        // The model (namespace) itself can carry decorators
        // (`decoratorextractor.ts` `processModels`), as well as its
        // declarations.
        restoreUndefinedDecorators(sourceModel, resultModel);
        (resultModel.declarations || []).forEach((resultDecl: any, j: number) => {
            restoreUndefinedDecorators(sourceModel?.declarations?.[j], resultDecl);
        });
    });
}

/**
 * The three DecoratorManager.extract* methods in rust mode, after the TS
 * body's option defaults. The AST is resolved here, on the TS side, as each
 * ts-mode body resolves its own `getAst(true, ...)`, with the system
 * namespaces left out as in `decoratorManagerDecorateModels`. Rust returns
 * the stripped models' AST, loaded here into a new ModelManager, and the
 * extracted command sets and vocabularies; each caller returns the fields
 * its TS body returns, in the same order. When `options.removeDecoratorsFromModel`
 * is set, `restoreUndefinedDecorators` re-shapes the stripped declarations to
 * match the TS extractor exactly (see its doc comment).
 * @param {string} binding the concerto-wasm binding to call
 * @param {object} modelManager the input ModelManager
 * @param {object} options the extract options, defaults applied
 * @return {object} the binding's result, with `modelManager` materialised
 */
function decoratorManagerExtract(binding: string, modelManager: any, options: any): any {
    const { default: ModelManager } = require('../modelmanager');
    const source = sourceDcsHandle(modelManager, SOURCE_EXTRACT[binding]);
    if (source) {
        return decoratorManagerExtractOnSource(binding, source, modelManager, options);
    }
    if (residentDcsAvailable()) {
        return decoratorManagerExtractStaged(binding, modelManager, options);
    }
    const sourceModels = modelManager.getAst(true, false).models;
    const result = rust![binding](sourceModels, options);
    if (options?.removeDecoratorsFromModel) {
        restoreAllUndefinedDecorators(sourceModels, result.modelManager.models);
    }
    const updatedModelManager = new ModelManager();
    updatedModelManager.fromAst(result.modelManager);
    result.modelManager = updatedModelManager;
    return result;
}

/**
 * The DcsManagerHandle method for each per-call extract binding.
 */
const STAGED_EXTRACT: { [binding: string]: string } = {
    decoratorManagerExtractDecorators: 'extractDecorators',
    decoratorManagerExtractVocabularies: 'extractVocabularies',
    decoratorManagerExtractNonVocabDecorators: 'extractNonVocabDecorators',
};

/**
 * The source-handle method for each per-call extract binding (P5-55).
 */
const SOURCE_EXTRACT: { [binding: string]: string } = {
    decoratorManagerExtractDecorators: 'dcsExtractDecorators',
    decoratorManagerExtractVocabularies: 'dcsExtractVocabularies',
    decoratorManagerExtractNonVocabDecorators: 'dcsExtractNonVocabDecorators',
};

/**
 * `decoratorManagerExtract` on the source ModelManager's own rustHandle
 * (P5-55, T1, F-A1; concerto-wasm `ModelManagerHandle.dcsExtract*`), with
 * the result staged into the new ModelManager's rustHandle as
 * `decoratorManagerExtractStaged` stages it. Rust resolves the handle's
 * models itself, as the per-call binding's input was resolved, so the
 * source models are read only when `restoreUndefinedDecorators` needs them,
 * and then unresolved (`getAst(false, false)`: the model files' own ASTs,
 * not copied): it reads only which nodes have `decorators`, and their
 * `declarations`, `properties`, `key` and `value`, which resolution never
 * changes, so a per-call `resolveMetaModel` would only cost time.
 * @param {string} binding the per-call concerto-wasm binding it replaces
 * @param {object} source the source ModelManager's rustHandle
 * @param {object} modelManager the input ModelManager
 * @param {object} options the extract options, defaults applied
 * @return {object} the result, with `modelManager` materialised
 */
function decoratorManagerExtractOnSource(binding: string, source: any, modelManager: any, options: any): any {
    const { default: ModelManager } = require('../modelmanager');
    const updatedModelManager = new ModelManager();
    updatedModelManager.clearModelFiles();
    const target = updatedModelManager.rustHandle;
    assertDistinctHandles(source, target);
    const result = source[SOURCE_EXTRACT[binding]](target, options);
    const { staged, validated } = result;
    delete result.staged;
    delete result.validated;
    if (options?.removeDecoratorsFromModel) {
        restoreAllUndefinedDecorators(modelManager.getAst(false, false).models, result.modelManager.models);
    }
    adoptStagedModels(updatedModelManager, result.modelManager, staged, validated, undefined, dcsSourceShapeChecked(modelManager));
    result.modelManager = updatedModelManager;
    return result;
}

/**
 * `decoratorManagerExtract` on the resident DCS input manager, with the
 * result staged into the new ModelManager's rustHandle (P5-27, F6; see
 * `adoptStagedModels`). The same result, and the same errors at the same
 * points: the input is `getAst(true, false)`'s models, and the result
 * AST, re-shaped by `restoreUndefinedDecorators` when
 * `options.removeDecoratorsFromModel` is set, is what the new ModelManager
 * is built from.
 * @param {string} binding the per-call concerto-wasm binding it replaces
 * @param {object} modelManager the input ModelManager
 * @param {object} options the extract options, defaults applied
 * @return {object} the result, with `modelManager` materialised
 */
function decoratorManagerExtractStaged(binding: string, modelManager: any, options: any): any {
    const { default: ModelManager } = require('../modelmanager');
    const { dcs, resident, sourceModels } = dcsManagerFor(modelManager, true);
    try {
        const updatedModelManager = new ModelManager();
        updatedModelManager.clearModelFiles();
        const result = dcs[STAGED_EXTRACT[binding]](updatedModelManager.rustHandle, options);
        const { staged, validated } = result;
        delete result.staged;
        delete result.validated;
        if (options?.removeDecoratorsFromModel) {
            restoreAllUndefinedDecorators(sourceModels, result.modelManager.models);
        }
        adoptStagedModels(updatedModelManager, result.modelManager, staged, validated, undefined, dcsSourceShapeChecked(modelManager));
        result.modelManager = updatedModelManager;
        return result;
    } finally {
        if (!resident) {
            dcs.free();
        }
    }
}

/**
 * DecoratorManager.extractDecorators in rust mode (see decoratorManagerExtract).
 * @param {object} modelManager the input ModelManager
 * @param {object} options the extract options, defaults applied
 * @return {object} `{modelManager, decoratorCommandSet, vocabularies}`
 */
function decoratorManagerExtractDecorators(modelManager: any, options: any): any {
    const result = decoratorManagerExtract('decoratorManagerExtractDecorators', modelManager, options);
    return {
        modelManager: result.modelManager,
        decoratorCommandSet: result.decoratorCommandSet,
        vocabularies: result.vocabularies
    };
}

/**
 * DecoratorManager.extractVocabularies in rust mode (see decoratorManagerExtract).
 * @param {object} modelManager the input ModelManager
 * @param {object} options the extract options, defaults applied
 * @return {object} `{modelManager, vocabularies}`
 */
function decoratorManagerExtractVocabularies(modelManager: any, options: any): any {
    const result = decoratorManagerExtract('decoratorManagerExtractVocabularies', modelManager, options);
    return {
        modelManager: result.modelManager,
        vocabularies: result.vocabularies
    };
}

/**
 * DecoratorManager.extractNonVocabDecorators in rust mode (see decoratorManagerExtract).
 * @param {object} modelManager the input ModelManager
 * @param {object} options the extract options, defaults applied
 * @return {object} `{modelManager, decoratorCommandSet}`
 */
function decoratorManagerExtractNonVocabDecorators(modelManager: any, options: any): any {
    const result = decoratorManagerExtract('decoratorManagerExtractNonVocabDecorators', modelManager, options);
    return {
        modelManager: result.modelManager,
        decoratorCommandSet: result.decoratorCommandSet
    };
}

// ---------------------------------------------------------------------------
// Lazy views (P5-10a, accordproject/concerto-rust#269; from the P5-06a spike,
// #226). The design note is on #269.
//
// A ModelFile's AST crosses into Rust once, when the ModelFile is
// constructed (`stageModelFile`): Rust loads it, with every construction-time
// check the Rust port makes, and keeps the loaded file in its manager
// handle's staging slot. When that load succeeds, the ModelFile populates
// its namespace, version, imports and model decorators as before, and its
// `declarations` and `localTypes` become accessors that build the
// declaration and property views on first use (`deferDeclarations`,
// `materialise`), from one batch snapshot per file (`beginModelFile`).
// Registering the file in the manager's `rustHandle` (`commitStaged`) and
// validating it (`validateLoaded`) then reuse the loaded file instead of
// sending the AST again.
//
// When Rust's load fails, or the manager has decorator factories (user code `Decorated.process` runs, and may
// throw from, during construction; running them on first read is BC-24,
// not adopted), the ModelFile is built eagerly exactly as before, so a TS
// error is thrown by the TS code, at the same point. (P5-52, BC-28, R1:
// `options.regExp` is ignored, so no custom regex engine runs during
// construction; every `regex=` is compiled and evaluated by the engine.)
//
// CONCERTO_LAZY_VIEWS_CHECK=1 is a migration diagnostic, not an option: it
// keeps the lazy path but builds the declaration views, and every part
// P5-10b defers (`buildDeferredParts`), at construction too, and reports on stderr any model Rust accepted whose TS construction throws
// (an under-rejection, which would move an error from construction to the
// first read) or mutates the AST.
// ---------------------------------------------------------------------------

const lazyEnv = typeof process === 'undefined' ? undefined : process.env;
const lazyViewsCheck = lazyEnv?.CONCERTO_LAZY_VIEWS_CHECK === '1';

/**
 * P5-76 (accordproject/concerto-rust#418): the per-ModelFile state of the
 * lazy load path, in one record per ModelFile. Each `new ModelFile` used
 * to insert its key into seven separate weak collections (the stage, the
 * staged header, the shape-check marks, the lazy mark, the import names
 * and the deferred declarations), which was about a sixth of the TS-API
 * `modelfile_new` profile on conformance; one WeakMap entry, with a record
 * of a fixed shape, does the same job. Each `FileSlot` below keeps the
 * WeakMap/WeakSet interface of the collection it replaces, keyed weakly by
 * the ModelFile as before, so its readers and writers are unchanged. An
 * absent entry is `undefined` in the record (no slot ever stores
 * `undefined` as a value).
 */
interface FileState {
    stage: Stage | undefined;
    stagedHeader: StagedHeader | undefined;
    /**
     * P5-32 `getImports()` names (`recordImportNames`), with the `imports`
     * array, and its length, they were recorded for.
     */
    importNames: string[] | undefined;
    importNamesFor: any[] | undefined;
    importNamesLength: number | undefined;
    lazy: true | undefined;
    shapeChecked: object | undefined;
    shapePending: true | undefined;
    deferred: DeferredFile | undefined;
    /**
     * P5-91 (accordproject/concerto-rust#437): the P5-27 prestage header
     * (`takePrestaged`, `applyStagedHeader`), which had a WeakMap of its own.
     */
    prestageHeader: any[] | undefined;
    /**
     * P5-91: the rustHandle the ModelFile was registered in from its stage
     * (`commitStaged`, `validateAndCommitStaged`), which had a WeakMap of its
     * own, so each `addModelFile` inserted one more weak entry.
     */
    committed: object | undefined;
}

const fileStates = new WeakMap<object, FileState>();

/**
 * P5-91 (accordproject/concerto-rust#437): `modelFile`'s record, created
 * (with every field absent) when it has none. The load path's steps
 * (`stageModelFile`, the header, `deferDeclarations`, the commit) each look
 * the record up once and then read and write its fields directly, instead
 * of one `fileStates` lookup per slot operation.
 * @param {object} modelFile the ModelFile
 * @return {object} its record
 */
function fileState(modelFile: object): FileState {
    let state = fileStates.get(modelFile);
    if (state === undefined) {
        state = {
            stage: undefined,
            stagedHeader: undefined,
            importNames: undefined,
            importNamesFor: undefined,
            importNamesLength: undefined,
            lazy: undefined,
            shapeChecked: undefined,
            shapePending: undefined,
            deferred: undefined,
            prestageHeader: undefined,
            committed: undefined,
        };
        fileStates.set(modelFile, state);
    }
    return state;
}

/**
 * One field of the per-ModelFile record (`fileStates`), with the interface
 * of the WeakMap (`get`, `set`, `has`, `delete`) or WeakSet (`add`, `has`,
 * `delete`) it replaces.
 */
class FileSlot<K extends keyof FileState> {
    private readonly field: K;

    /**
     * @param {string} field the record field this slot reads and writes
     */
    constructor(field: K) {
        this.field = field;
    }

    /**
     * @param {*} modelFile the ModelFile
     * @return {*} the value, or undefined
     */
    get(modelFile: any): FileState[K] {
        return fileStates.get(modelFile)?.[this.field];
    }

    /**
     * @param {*} modelFile the ModelFile
     * @return {boolean} true if a value is set
     */
    has(modelFile: any): boolean {
        const state = fileStates.get(modelFile);
        return state !== undefined && state[this.field] !== undefined;
    }

    /**
     * @param {object} modelFile the ModelFile
     * @param {*} value the value
     */
    set(modelFile: object, value: NonNullable<FileState[K]>): void {
        fileState(modelFile)[this.field] = value;
    }

    /**
     * WeakSet's `add`, for the slots that hold a mark.
     * @param {object} modelFile the ModelFile
     */
    add(this: FileSlot<'lazy' | 'shapePending'>, modelFile: object): void {
        this.set(modelFile, true);
    }

    /**
     * @param {*} modelFile the ModelFile
     * @return {boolean} true if a value was set
     */
    delete(modelFile: any): boolean {
        const state = fileStates.get(modelFile);
        if (state === undefined || state[this.field] === undefined) {
            return false;
        }
        state[this.field] = undefined;
        return true;
    }
}

/**
 * A ModelFile's staged load: the rustHandle it was staged in and its stage id.
 */
interface Stage {
    handle: any;
    id: number;
}

/**
 * The staged load of each lazily built ModelFile, until it is committed or
 * dropped.
 */
const stages = new FileSlot('stage');

/**
 * The rustHandle `modelFile` was registered in from its stage, or undefined
 * (P5-91: a field of its `fileStates` record, `committed`).
 * @param {object} modelFile the ModelFile
 * @return {object|undefined} the rustHandle
 */
function committedHandle(modelFile: any): object | undefined {
    return fileStates.get(modelFile)?.committed;
}

/**
 * Drops the stage of a ModelFile that is garbage-collected before it is
 * committed or dropped (constructed but never added: `filter`, a manager's
 * `validateModelFile`, user code), so its loaded file does not wait for the
 * staging slot's own eviction. Best effort: the handle may be gone too.
 */
const FinalizationRegistryCtor = (globalThis as any).FinalizationRegistry;
const stageFinalizer: { register(target: object, held: Stage, token: object): void; unregister(token: object): void } | null =
    typeof FinalizationRegistryCtor === 'function'
        ? new FinalizationRegistryCtor((stage: Stage) => {
            try {
                stage.handle.dropStagedModelFile(stage.id);
            } catch (e) {
                // the handle was freed or replaced: nothing to drop
            }
        })
        : null;

/**
 * For ASTs of namespaces the manager never writes into rustHandle (the
 * system models, the metamodel), the JSON text (with the definitions and
 * file name) Rust last loaded without error, by AST object, and whether that
 * load ran BC-19's shape check (P5-69). Such a file is
 * never committed from its stage, so a repeat of the same text needs only
 * the verdict, not another load: `new ModelManager()` builds the metamodel's
 * ModelFile from the same constant AST every time.
 */
const acceptedUnmirrored = new WeakMap<object, { key: string; header: StagedHeader | null; checked: boolean }>();

/**
 * P5-28 (accordproject/concerto-rust#333): the header of a ModelFile's AST
 * as `stageModelFileWithHeader` read it when staging, which is what
 * `modelFileFromAstHeader` would set on the ModelFile (concerto-wasm
 * `staged_header_from_parts`): the namespace, its version (or null),
 * whether the file is a system model file, and the `importShortNames.set`
 * and `importUriMap` assignments in order.
 */
interface StagedHeader {
    namespace: string;
    version: string | null;
    system: boolean;
    shortNames: Array<[string, string]>;
    uriMap: Array<[string, string]>;
}

/**
 * P5-28: the staged header of each lazily built ModelFile, from
 * `stageModelFile` until its constructor applies it (`applyStagedFileHeader`).
 * Never set for a ModelFile that took a P5-27 prestage (`takePrestaged`),
 * whose header is its record's `prestageHeader`.
 */
const stagedFileHeaders = new FileSlot('stagedHeader');

/**
 * P5-32 (accordproject/concerto-rust#342): each ModelFile's `getImports()`
 * names (every import's fully-qualified names, in order), recorded for the
 * `imports` array they were computed from. A staged header records them when
 * it is applied (`applyStagedFileHeader`, `applyStagedHeader`): its
 * `importShortNames.set(key, fqn)` calls are one per imported name, in
 * import order, so their `fqn`s are exactly those names, and no engine call
 * is needed. Otherwise `ModelFile.getImports` records its first answer.
 * P5-91 (accordproject/concerto-rust#437): kept in three fields of the
 * file's `fileStates` record (`importNames`, `importNamesFor`,
 * `importNamesLength`), so recording allocates no memo object.
 */

/**
 * P5-32: records `names` as `modelFile.getImports()` for its current
 * `imports` array.
 * @param {object} modelFile the ModelFile
 * @param {string[]} names its imports' fully-qualified names, in order
 * @param {object} [state] `modelFile`'s `fileStates` record (P5-91)
 */
function recordImportNames(modelFile: any, names: string[], state: FileState = fileState(modelFile)): void {
    const imports = modelFile.imports;
    state.importNamesFor = imports;
    state.importNamesLength = imports.length;
    state.importNames = names;
}

/**
 * P5-32: `modelFile.getImports()` as recorded (`recordImportNames`), as a
 * fresh array, or undefined when nothing is recorded for its current
 * `imports` array.
 * @param {object} modelFile the ModelFile
 * @return {string[] | undefined} a copy of the recorded names, or undefined
 */
function recordedImportNames(modelFile: any): string[] | undefined {
    const state = fileStates.get(modelFile);
    const imports = modelFile.imports;
    if (state === undefined || state.importNames === undefined || state.importNamesFor !== imports ||
        state.importNamesLength !== imports.length) {
        return undefined;
    }
    return state.importNames.slice();
}

/**
 * CONCERTO_LAZY_VIEWS_CHECK=1 (P5-32): reports on stderr when the import
 * names a staged header recorded differ from each import's
 * `importFullyQualifiedNames`, which is what `getImports` computes otherwise.
 * @param {object} modelFile the ModelFile a staged header was just applied to
 */
function checkRecordedImportNames(modelFile: any): void {
    let names: string[] = [];
    try {
        for (const imp of modelFile.imports) {
            names = names.concat(rust!.modelUtilImportFullyQualifiedNames(imp));
        }
    } catch (e: any) {
        process.stderr.write(`LAZY-CHECK import-names error: ${modelFile.namespace} ${e?.name}: ${e?.message}\n`);
        return;
    }
    if (JSON.stringify(names) !== JSON.stringify(recordedImportNames(modelFile))) {
        process.stderr.write(`LAZY-CHECK import-names mismatch: ${modelFile.namespace}\n`);
    }
}

/**
 * P5-10b: the lazily built ModelFiles. Their manager had no decorator
 * factories when each was constructed (factories keep the eager path), so
 * none applies to their elements' decorators: a factory added after
 * construction would not have applied to the views the eager constructor
 * built.
 */
const lazyFiles = new FileSlot('lazy');

/**
 * P5-49 (BC-19 with BC-17 and BC-20, R1): for the namespaces a manager
 * never writes into rustHandle (the system models and the metamodel copy
 * every manager builds, `_needsRustWrite`), the JSON text that last passed
 * `checkAstShape`, by namespace, so that `new ModelManager()` and
 * `clearModelFiles()` do not check the same system ASTs again. Keyed by
 * namespace rather than by AST object, because each manager builds its
 * system models from fresh AST objects. P5-73: since then only the
 * metamodel copy is remembered here; the fixed system models take the
 * engine's precomputed verdict instead (`systemModelAsts`), and are never
 * looked up here (`shapeMemoised`).
 */
const shapeCheckedUnmirrored = new Map<string, string>();

/**
 * P5-73 (accordproject/concerto-rust#414): the namespaces of the two fixed
 * system models. `shapeCheckedUnmirrored` never answers for them: their own
 * ModelFiles take the engine's precomputed verdict (`systemModelAsts`), and
 * any other AST of these namespaces, a user's included, is always checked.
 */
const FIXED_SYSTEM_NAMESPACES = new Set(['concerto@1.0.0', 'concerto.decorator@1.0.0']);

/**
 * P5-73 (accordproject/concerto-rust#414): the AST objects of the fixed
 * system models, which `BaseModelManager` builds a ModelFile for on every
 * `new ModelManager()` and `clearModelFiles()` (`addDecoratorModel`,
 * `addRootModel`), marked by `markSystemModelAst` just before. For such a
 * file `stageModelFile` asks the engine for its precomputed verdict
 * (`rustHandle.systemModelFileHeader`), which it gives only when the AST's
 * text is exactly one of the fixed system models, whose load and shape
 * check it ran once; for any other text the file is loaded and checked as
 * every other. So a mark lets no AST skip the check, and an unmarked AST of
 * a system namespace is always checked.
 */
const systemModelAsts = new WeakSet<object>();

/**
 * P5-73: marks `ast` as a fixed system model's AST, built by
 * `BaseModelManager` from its own constant copy (`systemModelAsts`).
 * @param {object} ast the AST the system model's ModelFile is built from
 */
function markSystemModelAst(ast: object): void {
    systemModelAsts.add(ast);
}

/**
 * Whether the shape check of `namespace` is remembered by namespace
 * (`shapeCheckedUnmirrored`): a namespace `manager` never writes into
 * rustHandle, but for the fixed system models' (P5-73).
 * @param {object} manager the ModelFile's manager
 * @param {*} namespace the AST's namespace
 * @return {boolean} true if the check is remembered by namespace
 */
function shapeMemoised(manager: any, namespace: unknown): namespace is string {
    return typeof namespace === 'string' && !FIXED_SYSTEM_NAMESPACES.has(namespace) && !manager._needsRustWrite(namespace);
}

/**
 * P5-68 (BC-19-a, R1): every ModelFile whose AST passed `checkAstShape`,
 * or was let through it as engine-written (`trustedAst`), with that AST
 * object. `dcsSourceShapeChecked` reads it: a DecoratorManager result is
 * built from checked models only when every model file of the source
 * manager is here, with the AST it still holds.
 */
const shapeChecked = new FileSlot('shapeChecked');

/**
 * P5-68 (BC-19-a, R1): the one AST the next `new ModelFile(manager, ast)`
 * takes without `checkAstShape`. Set only by
 * `adoptStagedModels`, for a DecoratorManager result AST the engine has
 * just written from checked models, immediately before it constructs that
 * ModelFile, and cleared as soon as the constructor returns or throws. It is
 * private to this module, so a ModelFile user code constructs is always
 * checked.
 */
let trustedAst: object | null = null;

/**
 * P5-69 (BC-19-b, R1): every ModelFile whose AST `checkAstShape` has left
 * for `stageModelFile` to check, folded into the engine's one load of the
 * AST (`stageModelFileChecked`). `stageModelFile` completes the check on
 * every path, and removes the file.
 */
const shapePending = new FileSlot('shapePending');

/**
 * P5-49 (BC-19 with BC-17 and BC-20, R1): the strict AST shape check at
 * model load. Called by the ModelFile constructor after its own argument
 * checks and before `stageModelFile`, unless the manager was built with
 * `metamodelValidation: false` (the opt-out). The AST crosses into Rust as
 * JSON text (`rustHandle.checkAstShape`, concerto-core
 * `instance::metamodel::check_ast_shape`), which throws an
 * `IllegalModelException` for an AST that does not have the metamodel's
 * shape: a non-array `decorators` (BC-17), a non-string name or an empty
 * super type name (BC-20), or anything else the metamodel check rejects
 * (BC-19). Returns the JSON text, which `stageModelFile` then reuses, or
 * undefined when the check is off. P5-68 (BC-19-a): also undefined, without
 * the check, for the one DecoratorManager result AST `adoptStagedModels`
 * marks as engine-written from checked models (`trustedAst`).
 *
 * P5-69 (BC-19-b, R1): the check itself is folded into the engine's load
 * of the AST, which `stageModelFile` runs next, so that the text is parsed
 * once (concerto-rust `ModelFile::from_json_text_checked_with_imports`).
 * This marks the file as pending (`shapePending`) instead of calling the
 * engine; `stageModelFile` then checks it, on every path, before any other
 * error and with the same error. A namespace the manager never writes,
 * whose same text has already passed, is not checked again, as before,
 * but for the fixed system models' namespaces (P5-73, `shapeMemoised`):
 * their own ModelFiles take the engine's precomputed verdict in
 * `stageModelFile`, and any other AST of them is checked.
 *
 * P5-92 (accordproject/concerto-rust#438): an AST the engine is to load
 * into a manager it writes (`compactStageable`) is written straight from
 * the object into the compact binary layout (`encodeAst`) instead of being
 * `JSON.stringify`d, and is checked, as pending, by the same fold
 * (`stageModelFileCheckedCompact`); its JSON text is computed only where a
 * path still needs it (`astText`). An AST `encodeAst` leaves to the text
 * path is checked as before.
 * @param {object} modelFile the ModelFile being constructed
 * @return {string | object | undefined} the AST's JSON text, or the AST in
 * the compact layout (`CompactAst`), when it is checked
 */
function checkAstShape(modelFile: any): CheckedAst | undefined {
    const manager = modelFile.modelManager;
    const ast = modelFile.ast;
    // P5-68 (BC-19-a): an AST the engine has just written, for a DCS result
    // manager, from models that all passed this check (`adoptStagedModels`).
    if (ast === trustedAst) {
        trustedAst = null;
        shapeChecked.set(modelFile, ast);
        return undefined;
    }
    if (manager.options?.metamodelValidation === false) {
        return undefined;
    }
    if (compactStageable(manager, ast, 'stageModelFileCheckedCompact')) {
        const bytes = encodeAst(ast);
        if (bytes !== undefined) {
            shapePending.add(modelFile);
            return { bytes, generation: encodeAstGeneration(), text: undefined };
        }
    }
    const text = JSON.stringify(ast);
    const namespace = ast.namespace;
    if (shapeMemoised(manager, namespace) && shapeCheckedUnmirrored.get(namespace) === text) {
        shapeChecked.set(modelFile, ast);
        return text;
    }
    shapePending.add(modelFile);
    return text;
}

/**
 * P5-92 (accordproject/concerto-rust#438): an AST `checkAstShape` wrote in
 * the compact binary layout (`encodeAst`) for the engine to load without
 * its JSON text: the bytes (a view of `encodeAst`'s reused buffer, valid
 * while `encodeAst` has not run again, `generation`), and the JSON text,
 * once a path needs it (`astText`).
 */
interface CompactAst {
    bytes: Uint8Array;
    generation: number;
    text: string | undefined;
}

/**
 * What `checkAstShape` hands `stageModelFile` for a checked AST: its JSON
 * text, or the AST in the compact layout (P5-92).
 */
type CheckedAst = string | CompactAst;

/**
 * P5-92: whether a ModelFile's AST may cross into the engine in the
 * compact binary layout (`encodeAst`) through the staging binding
 * `binding`: the engine has that binding, and the AST is loaded into a
 * manager that writes its namespace into rustHandle and is neither a fixed
 * system model's (`systemModelAsts`, whose verdict is looked up by its
 * text) nor a staged DecoratorManager result (`prestaged`, never sent
 * again). Every other AST crosses as JSON text, as before: an unmirrored
 * namespace's verdict is remembered by its text (`acceptedUnmirrored`,
 * `shapeCheckedUnmirrored`).
 * @param {object} manager the ModelFile's manager
 * @param {object} ast the AST
 * @param {string} binding the compact staging binding
 * @return {boolean} true if the AST may cross in the compact layout
 */
function compactStageable(manager: any, ast: any, binding: string): boolean {
    return typeof manager.rustHandle?.[binding] === 'function' && !systemModelAsts.has(ast) &&
        !prestaged.has(ast) && manager._needsRustWrite(ast.namespace);
}

/**
 * P5-92: the bytes of an AST `checkAstShape` wrote in the compact layout,
 * while they are still `encodeAst`'s current output; otherwise undefined,
 * and the caller sends the AST's JSON text.
 * @param {string | object | undefined} checked what `checkAstShape` returned
 * @return {Uint8Array | undefined} the bytes
 */
function compactBytes(checked: CheckedAst | undefined): Uint8Array | undefined {
    return typeof checked === 'object' && checked.generation === encodeAstGeneration() ? checked.bytes : undefined;
}

/**
 * P5-92: the JSON text of a checked AST: the text `checkAstShape` computed,
 * or, for an AST it wrote in the compact layout, `JSON.stringify(ast)`,
 * computed once, on the paths that still need it.
 * @param {object} ast the AST
 * @param {string | object} checked what `checkAstShape` returned
 * @return {string} the AST's JSON text
 */
function astText(ast: any, checked: CheckedAst): string {
    if (typeof checked === 'string') {
        return checked;
    }
    return checked.text ?? (checked.text = JSON.stringify(ast));
}

/**
 * P5-69 (BC-19-b, R1): records that a pending ModelFile's AST, as `text`,
 * has passed the shape check, as `checkAstShape` recorded it before.
 * P5-92: `text` is undefined for an AST the engine read in the compact
 * layout; it is computed only for a namespace remembered by its text
 * (`shapeMemoised`), which such an AST never has.
 * @param {object} modelFile the ModelFile being constructed
 * @param {string} [text] the AST's JSON text
 * @param {object} [state] `modelFile`'s `fileStates` record (P5-91)
 */
function shapeCheckPassed(modelFile: any, text: string | undefined, state: FileState | undefined = fileStates.get(modelFile)): void {
    // P5-91: `state` is `modelFile`'s record, when the caller has it.
    if (state === undefined || state.shapePending === undefined) {
        return;
    }
    state.shapePending = undefined;
    const manager = modelFile.modelManager;
    const ast = modelFile.ast;
    const namespace = ast.namespace;
    if (shapeMemoised(manager, namespace)) {
        shapeCheckedUnmirrored.set(namespace, text ?? JSON.stringify(ast));
    }
    state.shapeChecked = ast;
}

/**
 * P5-73 (accordproject/concerto-rust#414): the engine's precomputed verdict
 * for a fixed system model's ModelFile (`systemModelAsts`): the header text
 * `rustHandle.systemModelFileHeader` returns when the AST's text is exactly
 * one of the fixed system models, whose load and shape check the engine ran
 * once. A pending shape check is then complete, as `shapeCheckPassed` would
 * record it, but not remembered by namespace. Undefined, with nothing
 * recorded, for any other file or text, which is then loaded and checked
 * as before.
 * @param {object} modelFile the ModelFile being constructed
 * @param {object} handle the manager's rustHandle
 * @param {string} [checkedText] the AST's JSON text, when `checkAstShape`
 * already computed it
 * @return {string | undefined} the header's JSON text, or undefined
 */
function systemModelVerdict(modelFile: any, handle: any, checkedText?: string): string | undefined {
    const ast = modelFile.ast;
    if (!systemModelAsts.has(ast) || typeof handle.systemModelFileHeader !== 'function') {
        return undefined;
    }
    const header = handle.systemModelFileHeader(checkedText ?? JSON.stringify(ast));
    if (typeof header !== 'string') {
        return undefined;
    }
    if (shapePending.has(modelFile)) {
        shapePending.delete(modelFile);
        shapeChecked.set(modelFile, ast);
    }
    return header;
}

/**
 * P5-69 (BC-19-b, R1): the shape check of a pending ModelFile on its own,
 * for a path that does not load the AST with the check
 * (`rustHandle.checkAstShape`, which runs the same fold over its own parse
 * of the text). Nothing when the file is not pending.
 * @param {object} modelFile the ModelFile being constructed
 * @param {object} handle the manager's rustHandle
 * @param {string} text the AST's JSON text
 * @param {object} [state] `modelFile`'s `fileStates` record (P5-91)
 * @throws {IllegalModelException} if the AST does not have the metamodel's shape
 */
function completeShapeCheck(modelFile: any, handle: any, text: string, state: FileState | undefined = fileStates.get(modelFile)): void {
    if (state === undefined || state.shapePending === undefined) {
        return;
    }
    handle.checkAstShape(text);
    shapeCheckPassed(modelFile, text, state);
}

/**
 * The ModelFile constructor's staging step, `stageLoadedModelFile`, but for
 * a fixed system model the engine gives its precomputed verdict for
 * (P5-73, `stageSystemModelFile`). Kept apart so the body the user files go
 * through is not trained on the system models every `new ModelManager()`
 * builds.
 * @param {object} modelFile the ModelFile being constructed
 * @param {string | object} [checkedText] the AST's JSON text, or the AST in
 * the compact layout (P5-92), when `checkAstShape` checks it
 * @return {boolean} true if the declarations may be built lazily
 */
function stageModelFile(modelFile: any, checkedText?: CheckedAst): boolean {
    // P5-92: a fixed system model's AST is never written in the compact
    // layout (`compactStageable`).
    return stageSystemModelFile(modelFile, typeof checkedText === 'object' ? undefined : checkedText) ??
        stageLoadedModelFile(modelFile, checkedText);
}

/**
 * P5-73 (accordproject/concerto-rust#414): `stageModelFile` for a fixed
 * system model's ModelFile (`systemModelAsts`) whose text the engine gives
 * its precomputed verdict for (`systemModelVerdict`): it is neither loaded
 * nor checked again, and never committed (rustHandle holds its own copy),
 * so only the verdict and the header are needed. With decorator factories
 * the file is built eagerly, as `stageLoadedModelFile` builds it, without
 * the check. Undefined for any other file or text, which
 * `stageLoadedModelFile` then loads and checks.
 * @param {object} modelFile the ModelFile being constructed
 * @param {string} [checkedText] the AST's JSON text, when `checkAstShape`
 * already computed it
 * @return {boolean | undefined} true if the declarations may be built
 * lazily, false for the eager path, undefined if there is no verdict
 */
function stageSystemModelFile(modelFile: any, checkedText?: string): boolean | undefined {
    if (!systemModelAsts.has(modelFile.ast)) {
        return undefined;
    }
    const manager = modelFile.modelManager;
    const systemHeader = systemModelVerdict(modelFile, manager.rustHandle, checkedText);
    if (systemHeader === undefined) {
        return undefined;
    }
    const factories = manager.getDecoratorFactories();
    if (Array.isArray(factories) && factories.length > 0) {
        return false;
    }
    const header = JSON.parse(systemHeader) as StagedHeader | null;
    const state = fileState(modelFile);
    if (header !== null) {
        state.stagedHeader = header;
    }
    state.lazy = true;
    return true;
}

/**
 * P5-76 (accordproject/concerto-rust#418): the engine's string parameters
 * cross into WASM one UTF-16 code unit at a time (wasm-bindgen's ASCII
 * loop), which made passing a large AST's JSON text a sizeable part of a
 * `ModelFile`'s construction. The `...Utf8` staging bindings take the same
 * text as the UTF-8 bytes a `TextEncoder` writes, copied in one go.
 */
const utf8Encoder = new TextEncoder();

/**
 * The buffer `utf8Text` encodes into, reused across calls (a fresh
 * `TextEncoder.encode` array per call is an external allocation, which
 * made the garbage collector run more often), and the largest it is kept.
 */
let utf8Buffer = new Uint8Array(0);
const UTF8_BUFFER_KEPT = 4 * 1024 * 1024;

/**
 * The UTF-8 bytes of `text`, for the engine's `...Utf8` bindings: a view
 * of a reused buffer, valid until the next call (the binding copies it
 * into the engine's memory before it returns).
 * @param {string} text the text
 * @return {Uint8Array} its UTF-8 bytes
 */
function utf8Text(text: string): Uint8Array {
    // At most three bytes per UTF-16 code unit.
    const most = text.length * 3;
    if (most > UTF8_BUFFER_KEPT) {
        return utf8Encoder.encode(text);
    }
    if (utf8Buffer.length < most) {
        utf8Buffer = new Uint8Array(Math.max(most, 2 * utf8Buffer.length, 64 * 1024));
    }
    const { written } = utf8Encoder.encodeInto(text, utf8Buffer);
    return utf8Buffer.subarray(0, written);
}

/**
 * Called by the ModelFile constructor, before `process()` and the header
 * part of `fromAst` (P5-10b: before `process()`, so the file's own
 * decorators can be deferred too): loads the AST in the manager's
 * rustHandle staging slot, once. Returns true when the ModelFile may be
 * built lazily: the manager (always a BaseModelManager, BC-47) has no
 * decorator factories and Rust loaded the AST without error. On any other
 * failure the caller builds the ModelFile eagerly, which throws the TS error
 * itself. P5-61: when the shape check is off (no `checkedText`), an AST the
 * engine cannot read at all is thrown here (`unreadableAst`, an
 * IllegalModelException), so a malformed AST is an error at load, never
 * left to the eager walk; the AST is read for that even for a manager with
 * decorator factories. With the check on, the check has rejected any such
 * AST already. P5-69 (BC-19-b): with the check pending (`shapePending`),
 * it runs here first, folded into the load (`stageModelFileChecked`) or on
 * its own (`completeShapeCheck`) where nothing is loaded, and its error is
 * thrown; any other error is handled as before.
 *
 * P5-92 (accordproject/concerto-rust#438): an AST `checkAstShape` wrote in
 * the compact binary layout is loaded, and checked, from those bytes
 * (`stageModelFileCheckedCompact`); with the check off, an AST loaded into a
 * manager that writes its namespace is written in that layout here
 * (`stageModelFileWithHeaderCompact`). Either way the engine's verdict and
 * error are those of the AST's JSON text, which is computed only on the
 * paths that still need it (`astText`), and sent instead for an AST
 * `encodeAst` leaves to the text path.
 * @param {object} modelFile the ModelFile being constructed
 * @param {string | object} [checkedText] the AST's JSON text, or the AST in
 * the compact layout, when `checkAstShape` checks it
 * @return {boolean} true if the declarations may be built lazily
 */
function stageLoadedModelFile(modelFile: any, checkedText?: CheckedAst): boolean {
    // P5-35 (BC-47): the ModelFile constructor accepts only a
    // BaseModelManager, which always has a rustHandle.
    const manager = modelFile.modelManager;
    const handle = manager.rustHandle;
    try {
        // Decorator factories are user code `Decorated.process` runs (and
        // may throw from) during construction: they keep the eager path, so
        // `newDecorator` runs at the same point as before (running it on
        // first read is BC-24, a maintainer decision not taken here).
        const factories = manager.getDecoratorFactories();
        if (Array.isArray(factories) && factories.length > 0) {
            if (checkedText === undefined) {
                readUnchecked(modelFile, handle);
            } else {
                completeShapeCheck(modelFile, handle, astText(modelFile.ast, checkedText));
            }
            return false;
        }
        const ast = modelFile.ast;
        // P5-91 (accordproject/concerto-rust#437): the file's record, looked
        // up (or created) once for the whole step, and the AST's prestage.
        const state = fileState(modelFile);
        const prestage = ast && typeof ast === 'object' ? prestaged.get(ast) : undefined;
        // P5-69: a prestaged AST is not loaded again, so it is checked on
        // its own first.
        if (checkedText !== undefined && prestage !== undefined) {
            completeShapeCheck(modelFile, handle, astText(ast, checkedText), state);
        }
        // P5-27 (F6): a DecoratorManager result model Rust has already
        // loaded, and staged in this handle (`adoptStagedModels`), is used
        // as it is, without sending its AST again.
        if (prestage !== undefined && takePrestaged(modelFile, manager, handle, ast, prestage, state)) {
            state.lazy = true;
            return true;
        }
        // P5-92: the AST in the compact layout, when `checkAstShape` wrote
        // it so, or, with the check off, when it may cross so; otherwise its
        // JSON text, as before.
        let compact = compactBytes(checkedText);
        if (checkedText === undefined && compactStageable(manager, ast, 'stageModelFileWithHeaderCompact')) {
            compact = encodeAst(ast);
        }
        let text: string | undefined = compact !== undefined ? undefined
            : checkedText === undefined ? JSON.stringify(ast) : astText(ast, checkedText);
        // `ModelFile`'s constructor only rejects a *truthy* non-string
        // `definitions`/`fileName` (introspect/modelfile.ts): `0`, `false`
        // and `NaN` are stored as-is, and `?? undefined` maps only
        // null/undefined, so either would otherwise reach `stageModelFile`'s
        // wasm `Option<String>` params raw and trap the engine
        // (accordproject/concerto-rust#294 follow-up). Only a genuine string
        // is forwarded; anything else becomes `undefined`, matching v5.0.0
        // (no wasm call at all).
        const definitions = typeof modelFile.definitions === 'string' ? modelFile.definitions : undefined;
        const fileName = typeof modelFile.fileName === 'string' ? modelFile.fileName : undefined;
        const unmirrored = !manager._needsRustWrite(ast.namespace);
        if (unmirrored && text === undefined) {
            // P5-92: never the case for an AST `compactStageable` let
            // through, unless its namespace changed since.
            compact = undefined;
            text = checkedText === undefined ? JSON.stringify(ast) : astText(ast, checkedText);
        }
        const key = unmirrored ? JSON.stringify([text, definitions ?? null, fileName ?? null]) : null;
        const accepted = key !== null ? acceptedUnmirrored.get(ast) : undefined;
        if (accepted !== undefined && accepted.key === key) {
            // P5-69: a verdict from a load without the check does not
            // vouch for the shape.
            if (accepted.checked) {
                shapeCheckPassed(modelFile, text, state);
            } else {
                completeShapeCheck(modelFile, handle, text as string, state);
            }
            if (accepted.header !== null) {
                state.stagedHeader = accepted.header;
            }
            state.lazy = true;
            return true;
        }
        // P5-28 (accordproject/concerto-rust#333): staged and its header
        // read in one call, from one decode of the text, so the
        // constructor's `_fromAstHeader` does not cross again
        // (`applyStagedFileHeader`). An engine without that binding stages as
        // before.
        let id: number;
        let header: StagedHeader | null = null;
        const checked = state.shapePending !== undefined;
        // P5-92: there is text whenever there are no bytes.
        const jsonText = text as string;
        if (compact !== undefined) {
            // P5-92: the shape check (when pending) and the load, from the
            // compact layout, with the verdict and the error of the text
            // (`ModelFile::from_compact_checked_with_imports`).
            const staged = JSON.parse(checked
                ? handle.stageModelFileCheckedCompact(compact, definitions, fileName)
                : handle.stageModelFileWithHeaderCompact(compact, definitions, fileName));
            id = staged.id;
            header = staged.header;
            shapeCheckPassed(modelFile, undefined, state);
        } else if (checked && typeof handle.stageModelFileChecked === 'function') {
            // P5-69 (BC-19-b): the shape check and the load, from one
            // parse of the text. P5-76: the text crosses as UTF-8 bytes
            // where the engine takes them (`utf8Text`).
            const staged = JSON.parse(typeof handle.stageModelFileCheckedUtf8 === 'function'
                ? handle.stageModelFileCheckedUtf8(utf8Text(jsonText), definitions, fileName)
                : handle.stageModelFileChecked(jsonText, definitions, fileName));
            id = staged.id;
            header = staged.header;
            shapeCheckPassed(modelFile, jsonText, state);
        } else if (typeof handle.stageModelFileWithHeader === 'function') {
            completeShapeCheck(modelFile, handle, jsonText, state);
            const staged = JSON.parse(typeof handle.stageModelFileWithHeaderUtf8 === 'function'
                ? handle.stageModelFileWithHeaderUtf8(utf8Text(jsonText), definitions, fileName)
                : handle.stageModelFileWithHeader(jsonText, definitions, fileName));
            id = staged.id;
            header = staged.header;
        } else {
            completeShapeCheck(modelFile, handle, jsonText, state);
            id = handle.stageModelFile(jsonText, definitions, fileName);
        }
        if (key !== null) {
            // Never committed: keep the verdict (and the header), not the
            // loaded file.
            handle.dropStagedModelFile(id);
            acceptedUnmirrored.set(ast, { key, header, checked });
        } else {
            const stage = { handle, id };
            state.stage = stage;
            stageFinalizer?.register(modelFile, stage, stage);
        }
        if (header !== null) {
            state.stagedHeader = header;
        }
        state.lazy = true;
        return true;
    } catch (e) {
        if (checkedText === undefined && (e as { unreadableAst?: boolean } | null)?.unreadableAst) {
            throw e;
        }
        if (checkedText !== undefined && shapePending.has(modelFile)) {
            // P5-69: the shape check's own error, from the folded load
            // (`astShape`, engine/errors.ts), is thrown, as `checkAstShape`
            // threw it before. Any other error is the load's, after the
            // check passed, or one thrown before the check ran, which then
            // runs now.
            if ((e as { astShape?: boolean } | null)?.astShape) {
                throw e;
            }
            completeShapeCheck(modelFile, handle, astText(modelFile.ast, checkedText));
        }
        return false;
    }
}

/**
 * P5-61: reads the AST of a ModelFile whose manager has decorator factories
 * and the shape check off, only to throw `stageModelFile`'s `unreadableAst`
 * error for an AST the engine cannot read. The staged file is dropped.
 * @param {object} modelFile the ModelFile being constructed
 * @param {object} handle the manager's rustHandle
 */
function readUnchecked(modelFile: any, handle: any): void {
    const definitions = typeof modelFile.definitions === 'string' ? modelFile.definitions : undefined;
    const fileName = typeof modelFile.fileName === 'string' ? modelFile.fileName : undefined;
    handle.dropStagedModelFile(handle.stageModelFile(JSON.stringify(modelFile.ast), definitions, fileName));
}


/**
 * P5-28 (accordproject/concerto-rust#333): `ModelFile._fromAstHeader(ast)`
 * from the header `stageModelFile` read when it staged the file, without an
 * engine call: sets `namespace`, `version` and `imports` (a copy of
 * `ast.imports`, keeping its own import objects, plus the implicit import
 * of the system types for a non-system file) and fills `importShortNames`
 * and `importUriMap`, as `modelFileFromAstHeader` would. Returns false, having
 * changed nothing, when there is no staged header for `modelFile` or `ast`
 * is not the AST it was read from in the shape it was read (its namespace
 * not that string, its imports neither nullish nor an array of as many
 * imports); the caller then calls `modelFileFromAstHeader`, as before.
 * @param {object} modelFile the ModelFile being constructed
 * @param {object} ast the AST its header is read from
 * @param {object} [state] `modelFile`'s `fileStates` record (P5-91)
 * @return {boolean} true if the header was set
 */
function applyStagedFileHeader(modelFile: any, ast: any, state: FileState | undefined = fileStates.get(modelFile)): boolean {
    const header = state?.stagedHeader;
    if (header === undefined) {
        return false;
    }
    state!.stagedHeader = undefined;
    if (ast !== modelFile.ast || ast.namespace !== header.namespace) {
        return false;
    }
    const astImports = ast.imports;
    if (astImports !== undefined && astImports !== null && !Array.isArray(astImports)) {
        return false;
    }
    modelFile.namespace = ast.namespace;
    modelFile.version = header.version;
    const imports = astImports ? astImports.concat([]) : [];
    if (!header.system) {
        imports.push({
            $class: 'concerto.metamodel@1.0.0.ImportTypes',
            namespace: 'concerto@1.0.0',
            types: ['Concept', 'Asset', 'Transaction', 'Participant', 'Event'],
        });
    }
    modelFile.imports = imports;
    const shortNames = modelFile.importShortNames;
    const names: string[] = [];
    for (const [key, fqn] of header.shortNames) {
        shortNames.set(key, fqn);
        names.push(fqn);
    }
    const uriMap = modelFile.importUriMap;
    for (const [key, uri] of header.uriMap) {
        uriMap[key] = uri;
    }
    recordImportNames(modelFile, names, state);
    if (lazyViewsCheck) {
        checkStagedFileHeader(modelFile, ast);
        checkRecordedImportNames(modelFile);
    }
    return true;
}

/**
 * CONCERTO_LAZY_VIEWS_CHECK=1 (P5-28): runs `modelFileFromAstHeader` over
 * the JS values, on a scratch object inheriting from `modelFile`, and
 * reports on stderr any field `applyStagedFileHeader` set differently, or an
 * error it threw.
 * @param {object} modelFile the ModelFile `applyStagedFileHeader` just set
 * @param {object} ast its AST
 */
function checkStagedFileHeader(modelFile: any, ast: any): void {
    const scratch = Object.create(modelFile);
    scratch.importShortNames = new Map();
    scratch.importUriMap = {};
    try {
        rust!.modelFileFromAstHeader(scratch, ast);
    } catch (e: any) {
        process.stderr.write(`LAZY-CHECK header under-rejection: ${modelFile.namespace} ${e?.name}: ${e?.message}\n`);
        return;
    }
    const fields = (view: any) => JSON.stringify([
        view.namespace, view.version === undefined ? '<undefined>' : view.version, view.imports,
        [...view.importShortNames], Object.entries(view.importUriMap),
    ]);
    if (fields(scratch) !== fields(modelFile)) {
        process.stderr.write(`LAZY-CHECK header-mismatch: ${modelFile.namespace}\n`);
    }
}

/**
 * Builds a lazily built ModelFile's declaration views, the way its
 * constructor would have: `fromAst`'s declarations part, then
 * `localTypes`. Replaces the accessors with plain fields first; if TS
 * construction throws, the accessors are put back, so every later access
 * throws again.
 * @param {object} modelFile the ModelFile
 */
function materialise(modelFile: any): void {
    const field = (key: string, value: any) => Object.defineProperty(modelFile, key, {
        value, writable: true, enumerable: true, configurable: true
    });
    field('declarations', []);
    field('localTypes', null);
    const deferred = deferredFiles.get(modelFile);
    if (deferred) {
        deferred.building = true;
    }
    try {
        // `fromAst`'s declarations part (declarations is an optional field).
        if (modelFile.ast.declarations) {
            modelFile._fromAstDeclarations(modelFile.ast);
        }
    } catch (e) {
        defineLazyFields(modelFile);
        throw e;
    } finally {
        if (deferred) {
            deferred.building = false;
        }
    }
    deferredFiles.delete(modelFile);
    const localTypes = new Map();
    const namespace = modelFile.getNamespace();
    for (const declaration of modelFile.declarations) {
        localTypes.set(namespace + '.' + declaration.getName(), declaration);
    }
    modelFile.localTypes = localTypes;
}

/**
 * The object whose own `key` property is the lazy accessor `get` (or
 * `set`) belongs to: `receiver` itself, or the first object on its
 * prototype chain with that accessor. That is the ModelFile the accessor
 * was installed on, which the accessors used to capture in a closure.
 * @param {*} receiver the `this` the accessor was called with
 * @param {string} key `declarations` or `localTypes`
 * @param {Function} accessor the accessor function called
 * @return {object|undefined} the ModelFile, or undefined
 */
function lazyFieldOwner(receiver: any, key: string, accessor: unknown): any {
    for (let o = receiver; o !== null && o !== undefined && (typeof o === 'object' || typeof o === 'function'); o = Object.getPrototypeOf(o)) {
        const descriptor = Object.getOwnPropertyDescriptor(o, key);
        if (descriptor !== undefined) {
            return descriptor.get === accessor || descriptor.set === accessor ? o : undefined;
        }
    }
    return undefined;
}

/**
 * P5-76 (accordproject/concerto-rust#418): the `declarations` and
 * `localTypes` accessor descriptors, shared by every lazily built
 * ModelFile. They used to be built per file, with closures over it, so
 * each file's accessors were new functions: V8 then gave every lazily
 * built ModelFile a hidden class of its own when they were installed,
 * which was about 4-7% of the TS-API `modelfile_new` profile. With shared
 * functions the files share their hidden classes. Each accessor finds its
 * file from its receiver (`lazyFieldOwner`), and builds it as before.
 */
const lazyFieldDescriptors: Record<string, PropertyDescriptor> = {};
for (const key of ['declarations', 'localTypes']) {
    const descriptor: PropertyDescriptor = {
        configurable: true,
        enumerable: true,
        get(this: any) {
            const modelFile = lazyFieldOwner(this, key, descriptor.get);
            materialise(modelFile);
            return modelFile[key];
        },
        set(this: any, value: any) {
            const modelFile = lazyFieldOwner(this, key, descriptor.set);
            materialise(modelFile);
            modelFile[key] = value;
        },
    };
    lazyFieldDescriptors[key] = descriptor;
}

/**
 * Installs the `declarations` and `localTypes` accessors that build the
 * declaration views on first use (read or write).
 * @param {object} modelFile the ModelFile
 */
function defineLazyFields(modelFile: any): void {
    // P5-91 (accordproject/concerto-rust#437): one lookup of the file's
    // record, and no `built` map until a view is built on its own.
    const state = fileState(modelFile);
    if (state.deferred === undefined) {
        state.deferred = { byName: undefined, built: undefined, building: false, batch: undefined };
    }
    Object.defineProperty(modelFile, 'declarations', lazyFieldDescriptors.declarations);
    Object.defineProperty(modelFile, 'localTypes', lazyFieldDescriptors.localTypes);
}

/**
 * Called at the end of the ModelFile constructor when `stageModelFile`
 * returned true: defers the declaration views (or, with
 * CONCERTO_LAZY_VIEWS_CHECK=1, builds them now and reports any divergence).
 * @param {object} modelFile the ModelFile
 */
function deferDeclarations(modelFile: any): void {
    defineLazyFields(modelFile);
    if (lazyViewsCheck) {
        const before = JSON.stringify(modelFile.ast);
        try {
            materialise(modelFile);
            // P5-10b: and every part built on first read.
            buildDeferredParts(modelFile);
        } catch (e: any) {
            process.stderr.write(`LAZY-CHECK under-rejection: ${modelFile.namespace} ${e?.name}: ${e?.message}\n`);
            throw e;
        }
        if (JSON.stringify(modelFile.ast) !== before) {
            process.stderr.write(`LAZY-CHECK ast-mutated: ${modelFile.namespace}\n`);
        }
    }
}

// ---------------------------------------------------------------------------
// P5-27 (F6, accordproject/concerto-rust#332): a resident DCS manager with
// staged-handle results.
//
// `decorateModels` and the three `extract*` methods used to send the source
// models' AST to Rust on every call, which rebuilt its input manager from
// it, and to load the result's AST into a new ModelManager with `fromAst`,
// which sent every result model back to Rust (`stageModelFile`), read each
// header across the boundary (`modelFileFromAstHeader`) and validated the
// set again (`validateModelFiles`).
//
// Now the input manager stays resident in Rust (concerto-wasm
// `DcsManagerHandle`), one per source ModelManager and resolution flag,
// rebuilt when the source manager's rustHandle epoch or model files change
// (`dcsManagerFor`). Each operation stages the result's model files into
// the new ModelManager's own rustHandle and returns their stage ids and
// headers with the result AST. `adoptStagedModels` then does what `fromAst`
// does, but each ModelFile takes its stage (`takePrestaged`) and header
// (`applyStagedHeader`) instead of crossing again, and `validateModelFiles`
// is skipped when Rust has validated exactly those files, under the same
// (default) options the new manager's rustHandle has. Every error is still
// thrown by the same Rust or TS code, at the same point of the call.
// ---------------------------------------------------------------------------

/**
 * A result model's stage in a new ModelManager's rustHandle, and its header
 * (concerto-wasm `staged_header`: `[version, shortNames, uris]`, or null).
 */
interface Prestage {
    handle: any;
    id: number;
    header: any[] | null;
}

/**
 * The stage of each DecoratorManager result model not yet built, by AST
 * object: set by `adoptStagedModels` just before it constructs the
 * ModelFile from that AST.
 */
const prestaged = new WeakMap<object, Prestage>();

/**
 * Called by `stageModelFile`: when `ast` has a prestage in `handle`, and
 * the ModelFile is being built the way `fromAst` builds it (no definitions,
 * no file name, a namespace the manager writes
 * to its rustHandle), makes that stage the ModelFile's own, as if
 * `stageModelFile` had just staged `JSON.stringify(ast)`. Otherwise drops
 * the prestage, and the caller stages the AST as before.
 * @param {object} modelFile the ModelFile being constructed
 * @param {object} manager its model manager
 * @param {object} handle the manager's rustHandle
 * @param {object} ast the ModelFile's AST
 * @param {object} prestage the AST's prestage (`prestaged`), which the
 * caller has looked up (P5-91)
 * @param {object} state the ModelFile's `fileStates` record (P5-91)
 * @return {boolean} true if the ModelFile took the prestage
 */
function takePrestaged(modelFile: any, manager: any, handle: any, ast: any, prestage: Prestage, state: FileState): boolean {
    if (prestage.handle !== handle) {
        return false;
    }
    prestaged.delete(ast);
    if (modelFile.definitions !== undefined || modelFile.fileName !== undefined ||
        !manager._needsRustWrite(ast.namespace)) {
        handle.dropStagedModelFile(prestage.id);
        return false;
    }
    const stage = { handle, id: prestage.id };
    state.stage = stage;
    stageFinalizer?.register(modelFile, stage, stage);
    if (prestage.header) {
        state.prestageHeader = prestage.header;
    }
    return true;
}

/**
 * `ModelFile._fromAstHeader(ast)` from the header Rust computed when it
 * staged the file (concerto-wasm `staged_header`): sets the same
 * `namespace`, `version` and `imports` (a copy of `ast.imports` plus the
 * implicit import of the system types), and the same `importShortNames`
 * and `importUriMap` entries in the same order, as `modelFileFromAstHeader`
 * would. Rust returns a header only when that binding would not throw.
 * Returns false when there is none; the caller then calls the binding.
 * @param {object} modelFile the ModelFile being constructed
 * @param {object} ast its AST
 * @param {object} [state] `modelFile`'s `fileStates` record (P5-91)
 * @return {boolean} true if the header was applied
 */
function applyStagedHeader(modelFile: any, ast: any, state: FileState | undefined = fileStates.get(modelFile)): boolean {
    // P5-91: the prestage header is a field of the file's record
    // (`prestageHeader`), no longer a WeakMap of its own.
    const header = state?.prestageHeader;
    if (header === undefined || ast !== modelFile.ast) {
        return false;
    }
    state!.prestageHeader = undefined;
    const [version, shortNames, uris] = header;
    modelFile.namespace = ast.namespace;
    modelFile.version = version;
    const imports = ast.imports ? ast.imports.concat([]) : [];
    imports.push({
        $class: 'concerto.metamodel@1.0.0.ImportTypes',
        namespace: 'concerto@1.0.0',
        types: ['Concept', 'Asset', 'Transaction', 'Participant', 'Event'],
    });
    modelFile.imports = imports;
    const names: string[] = [];
    for (let i = 0; i < shortNames.length; i += 2) {
        modelFile.importShortNames.set(shortNames[i], shortNames[i + 1]);
        names.push(shortNames[i + 1]);
    }
    for (let i = 0; i < uris.length; i += 2) {
        modelFile.importUriMap[uris[i]] = uris[i + 1];
    }
    // P5-32: one `set` per imported name, as for `applyStagedFileHeader`.
    recordImportNames(modelFile, names, state);
    if (lazyViewsCheck) {
        checkRecordedImportNames(modelFile);
    }
    return true;
}

/**
 * P5-91 (accordproject/concerto-rust#437): `ModelFile._fromAstHeader`'s
 * `applyStagedHeader(modelFile, ast) || applyStagedFileHeader(modelFile,
 * ast)`, with one lookup of the file's record for both. At most one of them
 * has a header for a file.
 * @param {object} modelFile the ModelFile being constructed
 * @param {object} ast the AST its header is read from
 * @return {boolean} true if a staged header was applied
 */
function applyStagedHeaders(modelFile: any, ast: any): boolean {
    const state = fileStates.get(modelFile);
    if (state === undefined) {
        return false;
    }
    return applyStagedHeader(modelFile, ast, state) || applyStagedFileHeader(modelFile, ast, state);
}

/**
 * TS `EXCLUDE_NS` (basemodelmanager.ts): the system namespaces `fromAst`
 * skips.
 */
const DCS_EXCLUDE_NS = ['concerto@1.0.0', 'concerto', 'concerto.decorator@1.0.0'];

/**
 * `newModelManager.fromAst(ast, { disableValidation })`, after its
 * `clearModelFiles()` (which the caller has already run, so that Rust could
 * stage the result into the new rustHandle), for a result Rust staged:
 * `staged[i]` is `[stageId, header]` for `ast.models[i]`, or null. The same
 * ModelFiles are constructed and added, in the same order, with the same
 * errors. `validateModelFiles()` runs as `fromAst` runs it, unless Rust
 * `validated` the result and every model file was registered from its
 * stage: the rustHandle then holds exactly the files Rust validated, under
 * the default options both managers have, so it would pass.
 * @param {object} newModelManager the new ModelManager, cleared
 * @param {object} ast the result's `{ $class, models }` AST
 * @param {Array} staged the stage of each model, or null
 * @param {boolean} validated whether Rust validated the result
 * @param {boolean} [disableValidation] fromAst's `disableValidation` option
 * @param {boolean} [trusted] P5-68 (BC-19-a): true when every result model
 * is an AST the engine has just written from nodes that all passed
 * `checkAstShape` (`dcsSourceShapeChecked`, and for `decorateModels`
 * `dcsCommandsShapeChecked`): each ModelFile then skips the check
 * (`trustedAst`), which that AST would pass
 */
function adoptStagedModels(newModelManager: any, ast: any, staged: any[], validated: boolean, disableValidation?: boolean, trusted?: boolean): void {
    const { default: ModelFile } = require('../introspect/modelfile');
    const handle = newModelManager.rustHandle;
    let allStaged = true;
    const models: any[] = ast.models;
    try {
        models.forEach((model: any, i: number) => {
            if (DCS_EXCLUDE_NS.includes(model.namespace)) {
                return;
            }
            const entry = staged[i];
            if (entry) {
                prestaged.set(model, { handle, id: entry[0], header: entry[1] });
            }
            let modelFile;
            if (trusted) {
                trustedAst = model;
            }
            try {
                modelFile = new ModelFile(newModelManager, model);
            } finally {
                trustedAst = null;
            }
            newModelManager.addModelFile(modelFile, null, null, true);
            if (committedHandle(modelFile) !== handle) {
                allStaged = false;
            }
        });
    } finally {
        // A stage no ModelFile took (the loop threw first).
        models.forEach((model: any) => {
            const prestage = model && typeof model === 'object' ? prestaged.get(model) : undefined;
            if (prestage !== undefined) {
                prestaged.delete(model);
                prestage.handle.dropStagedModelFile(prestage.id);
            }
        });
    }
    if (!disableValidation && !(validated && allStaged)) {
        newModelManager.validateModelFiles();
    }
}

/**
 * The resident DCS input manager of one source ModelManager, for one
 * resolution flag, and what it was built from.
 */
interface DcsResident {
    handle: any;
    epoch: number;
    files: any[];
    asts: any[];
    /** `getAst(resolve, false).models`, as the manager was built from them. */
    sourceModels: any[];
    dcs: any;
}

/**
 * The resident DCS input managers, by source ModelManager: index 0 for
 * `getAst(false, false)`, 1 for `getAst(true, false)`.
 */
const dcsResidents = new WeakMap<object, Array<DcsResident | undefined>>();

/**
 * Whether the engine has the resident DCS manager (concerto-wasm
 * `DcsManagerHandle`, P5-27); without it, the DecoratorManager views keep
 * the per-call bindings.
 * @return {boolean} true if it does
 */
function residentDcsAvailable(): boolean {
    return typeof (rust as any).DcsManagerHandle === 'function';
}

/**
 * Whether the resident DCS input manager of `modelManager` may be kept:
 * `getAst` is BaseModelManager's own, over `getModelFiles` and
 * `resolveMetaModel` also its own, over the manager's rustHandle, which
 * mirrors every model file (P5-34) and whose epoch moves on every model
 * change.
 * @param {object} modelManager the source ModelManager
 * @return {boolean} true if it may be kept
 */
function dcsCacheable(modelManager: any): boolean {
    const { default: BaseModelManager } = require('../basemodelmanager');
    const proto = BaseModelManager.prototype;
    const handle = modelManager?.rustHandle;
    return !!handle && typeof handle.epoch === 'function' &&
        modelManager.getAst === proto.getAst &&
        modelManager.getModelFiles === proto.getModelFiles &&
        modelManager.resolveMetaModel === proto.resolveMetaModel;
}

/**
 * P5-68 (BC-19-a, R1): whether every model a DecoratorManager operation
 * reads from `modelManager` passed `checkAstShape`: `dcsCacheable` holds
 * (the models are `getAst`'s own reading of the model files, as on the
 * source handle), and every model file, as `getAst(…, false)` lists them,
 * was checked with the AST object it holds now and reads it with
 * ModelFile's own `getAst`. A manager built with `metamodelValidation:
 * false`, or holding any file one built, never qualifies.
 * @param {object} modelManager the source ModelManager
 * @return {boolean} true if every source model was checked
 */
function dcsSourceShapeChecked(modelManager: any): boolean {
    if (!dcsCacheable(modelManager)) {
        return false;
    }
    const { default: ModelFile } = require('../introspect/modelfile');
    const getAst = ModelFile.prototype.getAst;
    return modelManager.getModelFiles(false).every((f: any) =>
        shapeChecked.get(f) === f.ast && f.getAst === getAst);
}

/**
 * P5-68 (BC-19-a, R1): whether everything `decorateModels` adds to the
 * source models passes `checkAstShape`: each command's decorator, and the
 * `ImportType` nodes the engine declares for it and for each of its
 * type-reference arguments (concerto-rust `dcs::synthetic_decorator_imports`:
 * the node's own namespace, else `options.defaultNamespace`, when truthy).
 * They are checked once, together, as the decorators and imports of one
 * synthetic model. This is a superset of what the engine can add (every
 * command, applied or not, and every candidate import). It runs only after
 * the engine has applied the commands, so each set, command, decorator and
 * argument is an object; anything else fails the check or throws here, and
 * either way the answer is false, so the caller then checks each result
 * model as before.
 * @param {object} handle an engine handle, for `checkAstShape`
 * @param {object[]} decoratorCommandSets the decorator command sets
 * @param {object} [options] the decorateModels options
 * @return {boolean} true if the added nodes have the metamodel's shape
 */
function dcsCommandsShapeChecked(handle: any, decoratorCommandSets: any[], options?: any): boolean {
    const defaultNamespace = options?.defaultNamespace;
    const decorators: any[] = [];
    const imports: any[] = [];
    const importFor = (node: any) => {
        const namespace = node.namespace || defaultNamespace;
        if (namespace) {
            imports.push({ $class: 'concerto.metamodel@1.0.0.ImportType', name: node.name, namespace });
        }
    };
    try {
        for (const commandSet of decoratorCommandSets) {
            // `decoratorCommandSets.flatMap(commandSet => commandSet.commands)`.
            const commands = commandSet.commands;
            for (const command of Array.isArray(commands) ? commands : [commands]) {
                const decorator = command.decorator;
                decorators.push(decorator);
                importFor(decorator);
                for (const arg of Array.isArray(decorator.arguments) ? decorator.arguments : []) {
                    if (arg.type) {
                        importFor(arg.type);
                    }
                }
            }
        }
        handle.checkAstShape(JSON.stringify({
            $class: 'concerto.metamodel@1.0.0.Model',
            namespace: 'concerto.dcs.shapecheck@1.0.0',
            imports,
            declarations: [],
            decorators,
        }));
        return true;
    } catch {
        return false;
    }
}

/**
 * P5-55 (T1, F-A1, accordproject/concerto-rust#376): the source
 * ModelManager's own rustHandle, when the DecoratorManager operation can run
 * on it (concerto-wasm `ModelManagerHandle.dcsDecorateModels` and
 * `dcsExtract*`) instead of on a `DcsManagerHandle` built from a copy of its
 * models: the engine has `method`, `dcsCacheable` holds (the manager's
 * `getAst`, `getModelFiles` and `resolveMetaModel` are BaseModelManager's
 * own) and the handle mirrors the model files (`_mirrorPending`, P5-34).
 * The handle then holds exactly the models `getAst(resolve, false)` reads,
 * with the same system models, and resolves them itself, so no epoch or
 * invalidation is needed. Otherwise undefined, and the caller keeps the
 * `DcsManagerHandle` or the per-call binding, as before.
 * @param {object} modelManager the source ModelManager
 * @param {string} method the handle method the caller will call
 * @return {object|undefined} the rustHandle, or undefined
 */
function sourceDcsHandle(modelManager: any, method: string): any {
    if (!dcsCacheable(modelManager) || modelManager._mirrorPending) {
        return undefined;
    }
    const handle = modelManager.rustHandle;
    return typeof handle[method] === 'function' ? handle : undefined;
}

/**
 * The operations on the source handle borrow it and the new manager's
 * handle at once: the two must differ (the new manager is always built for
 * the call, so they always do), or wasm-bindgen's borrow check would panic.
 * @param {object} source the source ModelManager's rustHandle
 * @param {object} target the new ModelManager's rustHandle
 */
function assertDistinctHandles(source: any, target: any): void {
    /* istanbul ignore next */
    if (source === target) {
        throw new Error('DecoratorManager: the result ModelManager must not share the source ModelManager\'s engine handle');
    }
}

/**
 * The DCS input manager for `modelManager.getAst(resolve, false).models`
 * (concerto-wasm `DcsManagerHandle`): the resident one while the manager's
 * rustHandle, its epoch, its model files and their ASTs are the ones it was
 * built from, or else a new one, built from `getAst` as each per-call
 * binding builds its own (the same errors, at the same point), and kept.
 * @param {object} modelManager the source ModelManager
 * @param {boolean} resolve getAst's `resolve` argument
 * @return {object} `{dcs, resident, sourceModels}`: the DcsManagerHandle,
 * whether it is kept (when not, the caller frees it once done), and the
 * models it was built from (read only)
 */
function dcsManagerFor(modelManager: any, resolve: boolean): any {
    const cacheable = dcsCacheable(modelManager);
    const slot = resolve ? 1 : 0;
    let handle: any;
    let epoch = 0;
    let files: any[] = [];
    if (cacheable) {
        handle = modelManager.rustHandle;
        epoch = handle.epoch();
        files = modelManager.getModelFiles(false);
        const resident = dcsResidents.get(modelManager)?.[slot];
        if (resident && resident.handle === handle && resident.epoch === epoch &&
            resident.files.length === files.length &&
            resident.files.every((f: any, i: number) => f === files[i] && resident.asts[i] === f.ast)) {
            return { dcs: resident.dcs, resident: true, sourceModels: resident.sourceModels };
        }
    }
    const models = modelManager.getAst(resolve, false).models;
    const dcs = new (rust as any).DcsManagerHandle(models);
    if (cacheable) {
        let residents = dcsResidents.get(modelManager);
        if (!residents) {
            residents = [];
            dcsResidents.set(modelManager, residents);
        }
        residents[slot]?.dcs.free();
        residents[slot] = { handle, epoch, files, asts: files.map((f: any) => f.ast), sourceModels: models, dcs };
    }
    return { dcs, resident: cacheable, sourceModels: models };
}

/**
 * Forgets `modelFile`'s stage, returning it if it was staged in `handle`.
 * @param {object} modelFile the ModelFile
 * @param {object} handle the manager's rustHandle
 * @return {object|undefined} the stage
 */
function takeStage(modelFile: any, handle: any): Stage | undefined {
    const state = fileStates.get(modelFile);
    return state === undefined ? undefined : takeStageOf(state, handle);
}

/**
 * `takeStage` over the file's record, already looked up (P5-91).
 * @param {object} state the ModelFile's `fileStates` record
 * @param {object} handle the manager's rustHandle
 * @return {object|undefined} the stage
 */
function takeStageOf(state: FileState, handle: any): Stage | undefined {
    const stage = state.stage;
    if (!stage || stage.handle !== handle) {
        return undefined;
    }
    state.stage = undefined;
    stageFinalizer?.unregister(stage);
    return stage;
}

/**
 * The rustHandle write for `modelFile` from its stage: registers the file
 * Rust loaded at construction. Returns undefined when there is no usable
 * stage (not staged, staged in another handle, or evicted); the caller then
 * sends the AST as before. A registration error propagates, as
 * `addModelWithDefinitions`'s would.
 * @param {object} modelFile the ModelFile being added
 * @param {object} handle the manager's rustHandle
 * @return {number|undefined} the registered file's handle (P5-34: the
 * manager caches it), or undefined if the file was not registered
 */
function commitStaged(modelFile: any, handle: any): number | undefined {
    const state = fileStates.get(modelFile);
    const stage = state === undefined ? undefined : takeStageOf(state, handle);
    if (!stage) {
        return undefined;
    }
    const id = handle.commitStagedModelFile(stage.id);
    if (id === undefined) {
        return undefined;
    }
    state!.committed = handle;
    return id;
}

/**
 * P5-34 (I-5): `BaseModelManager.addModelFile`'s validation and registration
 * of a staged file in one engine call (concerto-wasm
 * `validateAndCommitStagedModelFile`), in place of `ModelFile.validate()`'s
 * `modelFileValidateStaged` followed by `commitStaged`. Returns undefined,
 * having changed nothing, when there is no usable stage (not staged, staged
 * in another handle, evicted, or an engine without the binding); the caller
 * then validates and registers the file as before. A validation error is
 * thrown as `ModelFile.validate()` throws it (`_engineValidationError`),
 * and leaves the file staged, as that path does.
 * @param {object} modelFile the ModelFile being added
 * @param {object} handle the manager's rustHandle
 * @return {number|undefined} the registered file's handle, or undefined if
 * the file was not registered
 */
function validateAndCommitStaged(modelFile: any, handle: any): number | undefined {
    const state = fileStates.get(modelFile);
    const stage = state?.stage;
    if (!stage || stage.handle !== handle || typeof handle.validateAndCommitStagedModelFile !== 'function') {
        return undefined;
    }
    let id: number | undefined;
    try {
        id = handle.validateAndCommitStagedModelFile(stage.id);
    } catch (e) {
        throw modelFile._engineValidationError(e);
    }
    if (id === undefined) {
        return undefined;
    }
    takeStageOf(state!, handle);
    state!.committed = handle;
    return id;
}

/**
 * Drops `modelFile`'s stage when it will not be registered from it in
 * `handle`.
 * @param {object} modelFile the ModelFile
 * @param {object} handle the manager's rustHandle
 */
function dropStaged(modelFile: any, handle: any): void {
    const stage = takeStage(modelFile, handle);
    if (stage) {
        handle.dropStagedModelFile(stage.id);
    }
}

/**
 * `ModelFile.validate()`'s Rust call without sending the AST again:
 * validates the staged file, or the file registered from it. Returns false
 * when neither applies; the caller then calls `modelFileValidateDetached`
 * as before. Throws what that binding throws.
 * @param {object} modelFile the ModelFile
 * @param {object} handle the manager's rustHandle
 * @return {boolean} true if validated
 */
function validateLoaded(modelFile: any, handle: any): boolean {
    const state = fileStates.get(modelFile);
    const stage = state?.stage;
    if (stage && stage.handle === handle) {
        return handle.modelFileValidateStaged(stage.id);
    }
    if (state?.committed === handle) {
        const id = modelFile._rustHandleId();
        if (id !== undefined) {
            handle.modelFileValidate(id);
            return true;
        }
    }
    return false;
}

/**
 * P5-10b: a lazily built file whose declaration views are not all built
 * yet (its `declarations`/`localTypes` accessors are still installed).
 */
interface DeferredFile {
    /**
     * Each declaration's index in `ast.declarations`, by the key its view
     * has in `localTypes`, or null when a declaration cannot be told apart
     * without building every view; undefined until first needed.
     */
    byName: Map<string, number> | null | undefined;
    /**
     * The declaration views built on their own, by index, with their AST
     * node; undefined until the first (P5-91).
     */
    built: Map<number, { node: any; view: any }> | undefined;
    /** True while a declaration view of the file is being built. */
    building: boolean;
    /** The file's view snapshots, once computed. */
    batch: Batch | null | undefined;
}

const deferredFiles = new FileSlot('deferred');

/**
 * The metamodel classes `ModelFile._declarationView` builds a view for.
 */
const DECLARATION_CLASSES = new Set([
    'AssetDeclaration', 'TransactionDeclaration', 'EventDeclaration', 'ParticipantDeclaration',
    'EnumDeclaration', 'MapDeclaration', 'ConceptDeclaration', 'BooleanScalar', 'IntegerScalar',
    'LongScalar', 'DoubleScalar', 'StringScalar', 'DateTimeScalar',
].map((name) => `concerto.metamodel@1.0.0.${name}`));

/**
 * The `localTypes` key of each declaration of `ast`, or null when one is
 * not a plain declaration node with a string name and a known class (then
 * every view is built, as before, which raises any error there).
 * @param {object} ast the file's AST
 * @param {string} namespace the file's namespace
 * @return {Map|null} the index of each declaration, by key
 */
function declarationIndex(ast: any, namespace: string): Map<string, number> | null {
    const declarations = ast?.declarations;
    const byName = new Map<string, number>();
    if (declarations === undefined || declarations === null) {
        return byName;
    }
    if (!Array.isArray(declarations)) {
        return null;
    }
    for (let i = 0; i < declarations.length; i++) {
        const node = declarations[i];
        if (!node || typeof node !== 'object' || typeof node.name !== 'string' ||
            !DECLARATION_CLASSES.has(node.$class)) {
            return null;
        }
        // `localTypes` is filled in order: a later declaration of the same
        // name replaces an earlier one.
        byName.set(namespace + '.' + node.name, i);
    }
    return byName;
}

/**
 * `ModelFile.getLocalType` for a lazily built file whose declaration views
 * are not all built (P5-10b, the ModelManager-level accessors: `getType`,
 * `getAssetDeclaration`, ... all resolve through it): builds only the view
 * of the declaration asked for, once, with the file's view snapshots (one
 * engine call per file, shared with the full build), and returns it, or
 * null when the file declares no such type. That view is the one
 * `declarations` then holds. Returns undefined when the caller must answer
 * as before (the file is not lazily built, or all its views are built, or
 * its declarations cannot be indexed without building them all). While a
 * view of the file is being built, throws the error `getLocalType` throws
 * during construction.
 * @param {object} modelFile the ModelFile
 * @param {string} type the short or fully qualified name
 * @return {object|null|undefined} the declaration view, null, or undefined
 */
function localType(modelFile: any, type: string): any {
    const deferred = deferredFiles.get(modelFile);
    if (!deferred) {
        return undefined;
    }
    if (deferred.building) {
        throw new Error('Internal error: local types are not yet initialized. Do not try to resolve types inside `process`.');
    }
    const namespace = modelFile.getNamespace();
    if (deferred.byName === undefined) {
        deferred.byName = declarationIndex(modelFile.ast, namespace);
    }
    if (deferred.byName === null) {
        return undefined;
    }
    const key = type.startsWith(namespace) ? type : namespace + '.' + type;
    const index = deferred.byName.get(key);
    if (index === undefined) {
        return null;
    }
    const node = modelFile.ast.declarations[index];
    const cached = deferred.built?.get(index);
    if (cached && cached.node === node) {
        return cached.view;
    }
    if (deferred.batch === undefined) {
        deferred.batch = computeBatch(modelFile, modelFile.ast);
    }
    deferred.building = true;
    let view;
    try {
        view = withBatch(deferred.batch, () => modelFile._declarationView(node));
    } finally {
        deferred.building = false;
    }
    (deferred.built ??= new Map()).set(index, { node, view });
    return view;
}

/**
 * The view of declaration `index` of a lazily built file, if `localType`
 * already built it from `node`, for `ModelFile._fromAstDeclarationViews` to
 * reuse, else undefined.
 * @param {object} modelFile the ModelFile
 * @param {number} index the declaration's index
 * @param {object} node its AST node
 * @return {object|undefined} the view
 */
function builtDeclaration(modelFile: any, index: number, node: any): any {
    const cached = deferredFiles.get(modelFile)?.built?.get(index);
    return cached && cached.node === node ? cached.view : undefined;
}

// ---------------------------------------------------------------------------
// Lazy views, part 2 (P5-10b, accordproject/concerto-rust#270): the parts of
// a lazily built file's views that are built on first read.
//
// - Decorators (`Decorated.decorators`): built when first read (a file
//   whose manager has decorator factories is built eagerly; BC-24 is not
//   adopted).
// - Validators: a Field's or a ScalarDeclaration's `validator` (number or
//   string) and a Property's `sizeValidator`.
// - A MapDeclaration's `key` and `value` types.
//
// Each is deferred only when the file's view snapshot proves that building
// it cannot throw (an entry exists only where the per-element binding would
// succeed), and is then built from that snapshot without another engine
// call. Anything else is built as before, at the same point, so an error
// is raised by the same call. The fields are prototype accessors
// (`installLazyField`) over a pending builder, so an element whose part is
// never read never builds it, and an element outside a lazily built file
// (or a part that is not deferred) stores it as a plain own field, as
// before. The first read replaces the accessor with a plain own field, so
// every later read returns the same object; if building throws, the part
// stays pending and every later read throws again.
// ---------------------------------------------------------------------------

/** The pending builders of each element's deferred parts, by field name. */
const pendingFields = new WeakMap<object, Map<string, () => any>>();

/**
 * Stores `value` as `target`'s own plain field `key`.
 * @param {object} target the element
 * @param {string} key the field
 * @param {*} value the value
 */
function defineOwn(target: any, key: string, value: any): void {
    Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
}

/**
 * Installs the accessor for field `key` on `proto`: a read builds a
 * deferred value (or, for an element that never set the field, returns
 * `initial()` and keeps it, when `initial` is given), and a write stores
 * a plain own field, as the class field did.
 * @param {object} proto the class prototype
 * @param {string} key the field
 * @param {Function} [initial] the value of a field never set
 */
function installLazyField(proto: object, key: string, initial?: () => any): void {
    Object.defineProperty(proto, key, {
        configurable: true,
        enumerable: false,
        get(this: any) {
            if (this === proto) {
                return undefined;
            }
            const thunks = pendingFields.get(this);
            const thunk = thunks?.get(key);
            if (thunk === undefined) {
                if (!initial) {
                    return undefined;
                }
                const value = initial();
                defineOwn(this, key, value);
                return value;
            }
            thunks!.delete(key);
            let value;
            try {
                value = thunk();
            } catch (e) {
                if (Object.prototype.hasOwnProperty.call(this, key)) {
                    delete this[key];
                }
                thunks!.set(key, thunk);
                throw e;
            }
            defineOwn(this, key, value);
            return value;
        },
        set(this: any, value: any) {
            pendingFields.get(this)?.delete(key);
            defineOwn(this, key, value);
        },
    });
}

/**
 * Defers `target`'s field `key`: `build` makes its value on first read.
 * @param {object} target the element
 * @param {string} key the field
 * @param {Function} build the builder
 */
function deferField(target: any, key: string, build: () => any): void {
    if (Object.prototype.hasOwnProperty.call(target, key)) {
        // The element runs process() again (IdentifiedDeclaration's
        // constructor, MapDeclaration's) after its part was read.
        delete target[key];
    }
    let thunks = pendingFields.get(target);
    if (!thunks) {
        thunks = new Map();
        pendingFields.set(target, thunks);
    }
    thunks.set(key, build);
}

/**
 * Whether `target`'s field `key` is deferred and not built yet.
 * @param {object} target the element
 * @param {string} key the field
 * @return {boolean} true if pending
 */
function isPending(target: any, key: string): boolean {
    return pendingFields.get(target)?.has(key) === true;
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

let decoratorCache: any;

/**
 * The introspect/decorator module, required once.
 * @return {object} the module
 */
function decoratorModule(): any {
    return decoratorCache ?? (decoratorCache = require('../introspect/decorator'));
}

/**
 * A Decorator rebuilt from its `decoratorProcess` snapshot: the fields its
 * constructor and `process()` set, in the same order.
 * @param {object} element the decorated element
 * @param {object} ast the decorator's AST node
 * @param {object} entry the snapshot `{n, a}`
 * @return {object} the Decorator
 */
function decoratorFromSnapshot(element: any, ast: any, entry: any): any {
    const { Decorator } = decoratorModule();
    const decorator = Object.create(Decorator.prototype);
    decorator.ast = ast;
    decorator.parent = element;
    decorator.arguments = entry.a.map((a: any) => (a !== null && typeof a === 'object'
        ? { type: a.type, name: a.name, array: a.array }
        : a));
    decorator.name = entry.n;
    return decorator;
}

/**
 * `Decorated.process`'s decorator loop, for a deferred `decorators` (no
 * decorator factory applies in a lazily built file): a Decorator is
 * rebuilt from the snapshot (or constructed, where there is none). The
 * list is the element's `decorators` while it is filled, as it was during
 * `process()`.
 * @param {object} element the decorated element
 * @param {object[]} nodes the decorator AST nodes
 * @param {object[]|undefined} snapshot their snapshots
 * @return {object[]} the decorators
 */
function buildDecorators(element: any, nodes: any[], snapshot: any[] | undefined): any[] {
    const list: any[] = [];
    defineOwn(element, 'decorators', list);
    for (let n = 0; n < nodes.length; n++) {
        const thing = nodes[n];
        let decorator;
        const entry = snapshot?.[n];
        if (entry) {
            decorator = decoratorFromSnapshot(element, thing, entry);
        } else {
            const { Decorator } = decoratorModule();
            decorator = new Decorator(element, thing);
        }
        list.push(decorator);
    }
    return list;
}

/**
 * `Decorated.process` for an element of a lazily built file: defers its
 * `decorators` when it has some and building them cannot throw (every node
 * is an object, which `decoratorProcess` never rejects). Returns false when
 * the caller builds them now, as before.
 * @param {object} element the element being processed
 * @return {boolean} true if deferred
 */
function deferDecorators(element: any): boolean {
    const nodes = element.ast.decorators;
    if (!Array.isArray(nodes) || nodes.length === 0) {
        return false;
    }
    for (let n = 0; n < nodes.length; n++) {
        const node = nodes[n];
        if (node === null || typeof node !== 'object') {
            return false;
        }
    }
    let modelFile;
    try {
        modelFile = element.getModelFile();
    } catch (e) {
        // The caller's own call raises it, at the same point.
        return false;
    }
    if (!lazyFiles.has(modelFile)) {
        return false;
    }
    const snapshot = batchOf(modelFile)?.decorators.get(nodes);
    deferField(element, 'decorators', () => buildDecorators(element, nodes, snapshot));
    return true;
}

/**
 * `Decorated.process`'s `modelFile.getModelManager()?.getDecoratorFactories()`,
 * where it builds the decorators itself: for a lazily built file, the
 * factories that apply (none: its manager had none at construction), since
 * one added since would not have applied to the views the eager
 * constructor built.
 * @param {object} modelFile the ModelFile of the element being processed
 * @return {object[]|undefined} the decorator factories that apply
 */
function decoratorFactories(modelFile: any): any[] | undefined {
    if (lazyFiles.has(modelFile)) {
        return [];
    }
    return modelFile.getModelManager()?.getDecoratorFactories();
}

/**
 * Whether `element`'s model file is lazily built.
 * @param {object} element the element
 * @return {boolean} true if lazy
 */
function inLazyFile(element: any): boolean {
    const modelFile = element.modelFile ?? element.parent?.modelFile;
    return modelFile !== undefined && lazyFiles.has(modelFile);
}

/**
 * A NumberValidator rebuilt from its snapshot: the fields the Validator and
 * NumberValidator constructors set.
 * @param {object} element the field or scalar declaration
 * @param {object} snapshot `{lowerBound, upperBound}`
 * @return {object} the NumberValidator
 */
function numberValidatorFromSnapshot(element: any, snapshot: any): any {
    const { NumberValidator } = numberValidatorModule();
    const validator = Object.create(NumberValidator.prototype);
    validator.validator = element.ast.validator;
    validator.field = element;
    validator.lowerBound = snapshot.lowerBound;
    validator.upperBound = snapshot.upperBound;
    return validator;
}

/**
 * A StringValidator rebuilt from its `stringValidatorNew` snapshot (P5-10b):
 * the fields its constructor sets, in the same order.
 * @param {object} element the field or scalar declaration
 * @param {object} regexAst the `validator` AST it was built from
 * @param {object} snapshot `{minLength, maxLength}`
 * @return {object} the StringValidator
 */
function stringValidatorFromSnapshot(element: any, regexAst: any, snapshot: any): any {
    const { StringValidator } = stringValidatorModule();
    const validator = Object.create(StringValidator.prototype);
    validator.validator = regexAst;
    validator.field = element;
    validator.minLength = snapshot.minLength;
    validator.maxLength = snapshot.maxLength;
    validator.regex = regexAst ? new RegExp(regexAst.pattern, regexAst.flags) : null;
    return validator;
}

/**
 * A CollectionSizeValidator rebuilt from its `collectionSizeValidatorNew`
 * snapshot (P5-10b): the fields its constructor sets, in the same order.
 * @param {object} property the property
 * @param {object} ast the `sizeValidator` AST it was built from
 * @param {object} snapshot `{minSize, maxSize}`
 * @return {object} the CollectionSizeValidator
 */
function sizeValidatorFromSnapshot(property: any, ast: any, snapshot: any): any {
    const { default: CollectionSizeValidator } = collectionSizeValidatorModule();
    const validator = Object.create(CollectionSizeValidator.prototype);
    validator.validator = ast;
    validator.field = property;
    validator.minSize = snapshot.minSize;
    validator.maxSize = snapshot.maxSize;
    return validator;
}

/**
 * `MapDeclaration.process`'s key and value types (P5-10b). When the file's
 * view snapshot has the map (its `mapDeclarationProcess` check passes and
 * its key and value types' processing cannot throw), the check is not run
 * again, and, in a lazily built file, `key` and `value` are built on first
 * read (`buildKey`/`buildValue`, with the file's snapshots). Otherwise the
 * `mapDeclarationProcess` binding runs, and the types are built now, as
 * before.
 * @param {object} view the MapDeclaration being processed
 * @param {Function} buildKey builds its MapKeyType
 * @param {Function} buildValue builds its MapValueType
 */
function mapDeclarationProcess(view: any, buildKey: () => any, buildValue: () => any): void {
    const current = batchOf(view.modelFile);
    if (!current || !current.maps.has(view.ast)) {
        rust!.mapDeclarationProcess(view);
    } else if (lazyFiles.has(view.modelFile)) {
        deferField(view, 'key', () => withBatch(current, buildKey));
        deferField(view, 'value', () => withBatch(current, buildValue));
        return;
    }
    view.key = buildKey();
    view.value = buildValue();
}

/**
 * `MapKeyType.process`'s type: from the view snapshot, else the binding.
 * @param {object} view the MapKeyType
 * @return {string} the type
 */
function mapKeyTypeProcess(view: any): string {
    const type = batchOf(view.modelFile)?.mapTypes.get(view.ast);
    return type !== undefined ? type : rust!.mapKeyTypeProcess(view);
}

/**
 * `MapValueType.process`'s type: from the view snapshot, else the binding.
 * @param {object} view the MapValueType
 * @return {string} the type
 */
function mapValueTypeProcess(view: any): string {
    const type = batchOf(view.modelFile)?.mapTypes.get(view.ast);
    return type !== undefined ? type : rust!.mapValueTypeProcess(view);
}

/**
 * Builds every deferred part of a lazily built file's views: its
 * decorators, and each declaration's, property's and map type's
 * decorators, validators and map types. Used by
 * CONCERTO_LAZY_VIEWS_CHECK=1, which reports any that throws.
 * @param {object} modelFile the ModelFile
 */
function buildDeferredParts(modelFile: any): void {
    const touch = (element: any, keys: string[]) => {
        for (const key of keys) {
            // eslint-disable-next-line no-unused-expressions
            element[key];
        }
    };
    touch(modelFile, ['decorators']);
    for (const declaration of modelFile.declarations) {
        touch(declaration, ['decorators', 'validator', 'key', 'value']);
        if (declaration.key) {
            touch(declaration.key, ['decorators']);
        }
        if (declaration.value) {
            touch(declaration.value, ['decorators']);
        }
        for (const property of declaration.properties ?? []) {
            touch(property, ['decorators', 'validator', 'sizeValidator']);
        }
    }
}

// ---------------------------------------------------------------------------
// Property lookups (P5-14, accordproject/concerto-rust#308): a
// ClassDeclaration view's `getProperties()` list, and the name lookup
// `getProperty()` makes over it, are cached once per view, so repeated calls
// do not cross into the engine again.
//
// A miss runs the `classDeclarationGetProperties` binding exactly as before,
// so every error is raised by the same call. While it runs, the super type's
// `getProperties()` call it makes (TS: `classDecl.getProperties()`) comes
// back through this module and is recorded, so the entry knows which view
// supplied the inherited part and which of that view's entries it copied.
// An entry is reused only while:
// - no model file was added, updated or deleted in any ModelManager since
//   it was built (`invalidatePropertyLookups`, called by BaseModelManager
//   where it changes its `modelFiles` map in place: `addModelFile`,
//   `updateModelFile`, `deleteModelFile`, `addModelFiles`), and the view's
//   manager still holds the same `modelFiles` map (`clearModelFiles` and the
//   roll-back of a failed `addModelFiles` or `updateExternalModels` replace
//   the whole map). These are the points where TS 5.0.0 could resolve a
//   super type differently;
// - the view's own properties array, its length, its `superType` and its
//   `modelFile` are the ones it was built from;
// - the super type's view still holds the entry it was built from, and
//   that entry is itself still reusable.
// Only views of model files the ModelFile constructor built for a real
// BaseModelManager are cached (a stub collaborator's answers can change
// without a model change); anything else calls the binding every time, as
// before.
//
// `getProperties()` returns a new array on every call, as TS 5.0.0 did
// whenever it concatenated a super type's properties, and as the binding did
// on every call: mutating it reaches neither the cache nor the engine. The
// Property objects in it are the views themselves, so identity is unchanged
// (BC-23).
// ---------------------------------------------------------------------------

/** Bumped whenever any ModelManager's model files change. */
let propertyGeneration = 0;

/**
 * Drops every cached property lookup: called by BaseModelManager whenever
 * it adds, replaces or deletes a model file in its `modelFiles` map. (A
 * manager that replaces the whole map is caught by `lookupValid`.)
 */
function invalidatePropertyLookups(): void {
    propertyGeneration++;
}

/**
 * The model epoch `invalidatePropertyLookups` moves (P5-29): BaseModelManager
 * keys its getNamespaces/getType/resolveType memo on it.
 * @return {number} the current `propertyGeneration`
 */
function modelGeneration(): number {
    return propertyGeneration;
}

/** One ClassDeclaration view's cached `getProperties()` list. */
interface PropertyLookup {
    /** `propertyGeneration` when it was built. */
    generation: number;
    /** The own properties array (`getOwnProperties()`, `properties`) it was built from. */
    own: any[];
    /** That array's length then. */
    ownLength: number;
    /** The view's `superType` then. */
    superType: any;
    /** The view's `modelFile` then. */
    modelFile: any;
    /** Its manager's `modelFiles` map then. */
    modelFiles: any;
    /** The super type's view that supplied the inherited part, or null. */
    superView: any;
    /** That view's entry the inherited part was copied from, or null. */
    superEntry: PropertyLookup | null;
    /** The list: own properties, then the super type's. Never handed out. */
    list: any[];
    /** The first property of each name in `list`, built on first `getProperty`. */
    byName?: Map<string, any>;
}

const propertyLookups = new WeakMap<object, PropertyLookup>();

/** A `getProperties()` call the binding made while an entry was being built. */
interface LookupCall {
    view: any;
    result: any[];
}

/** The entries being built, innermost last, with the calls each one made. */
const lookupFrames: LookupCall[][] = [];

/**
 * Whether `view`'s property lookups may be cached: its model file was built
 * by the ModelFile constructor (`ModelFile._isConstructed`), which accepts
 * only a BaseModelManager (P5-35, BC-47).
 * @param {object} view the ClassDeclaration view
 * @return {boolean} true if cacheable
 */
function lookupCacheable(view: any): boolean {
    return modelFileModule().default._isConstructed(view?.modelFile);
}

/**
 * Whether `entry` is still `view`'s answer (see the section comment).
 * @param {object} view the ClassDeclaration view
 * @param {object} entry its cached entry
 * @return {boolean} true if it may be reused
 */
function lookupValid(view: any, entry: PropertyLookup): boolean {
    if (entry.generation !== propertyGeneration || view.superType !== entry.superType ||
        view.modelFile !== entry.modelFile || view.properties !== entry.own ||
        view.modelFile.modelManager?.modelFiles !== entry.modelFiles) {
        return false;
    }
    const own = view.getOwnProperties();
    if (own !== entry.own || own.length !== entry.ownLength) {
        return false;
    }
    if (entry.superView === null) {
        return true;
    }
    return propertyLookups.get(entry.superView) === entry.superEntry && lookupValid(entry.superView, entry.superEntry!);
}

/**
 * `view`'s cached entry, if it may be reused, else undefined.
 * @param {object} view the ClassDeclaration view
 * @return {object|undefined} the entry
 */
function validLookup(view: any): PropertyLookup | undefined {
    const entry = propertyLookups.get(view);
    if (entry === undefined) {
        return undefined;
    }
    if (lookupValid(view, entry)) {
        return entry;
    }
    propertyLookups.delete(view);
    return undefined;
}

/**
 * The entry for a list the binding just returned, or undefined when it
 * cannot be cached: the own properties are not the view's `properties`
 * array, or, with a super type, the inherited part did not come from
 * exactly one recorded `getProperties()` call of a cached view.
 * @param {object} view the ClassDeclaration view
 * @param {any[]} own the own properties array before the call
 * @param {object} state the view's `superType`, `modelFile` and manager's
 * `modelFiles`, and `propertyGeneration`, before the call
 * @param {any[]} list what the binding returned
 * @param {object[]} calls the `getProperties()` calls it made
 * @return {object|undefined} the entry
 */
function newLookup(view: any, own: any, state: { superType: any; modelFile: any; modelFiles: any; generation: number },
    list: any, calls: LookupCall[]): PropertyLookup | undefined {
    if (!Array.isArray(own) || view.properties !== own || view.superType !== state.superType ||
        view.modelFile !== state.modelFile || !Array.isArray(list) || state.generation !== propertyGeneration ||
        view.modelFile.modelManager?.modelFiles !== state.modelFiles) {
        return undefined;
    }
    const ownLength = own.length;
    let superView: any = null;
    let superEntry: PropertyLookup | null = null;
    let inherited: any[] = [];
    if (state.superType !== null) {
        if (calls.length !== 1) {
            return undefined;
        }
        superView = calls[0].view;
        superEntry = propertyLookups.get(superView) ?? null;
        inherited = calls[0].result;
        if (superEntry === null || superView === view) {
            return undefined;
        }
    } else if (calls.length !== 0) {
        return undefined;
    }
    if (list.length !== ownLength + inherited.length) {
        return undefined;
    }
    for (let n = 0; n < ownLength; n++) {
        if (list[n] !== own[n]) {
            return undefined;
        }
    }
    for (let n = 0; n < inherited.length; n++) {
        if (list[ownLength + n] !== inherited[n]) {
            return undefined;
        }
    }
    return {
        generation: state.generation,
        own,
        ownLength,
        superType: state.superType,
        modelFile: state.modelFile,
        modelFiles: state.modelFiles,
        superView,
        superEntry,
        list: list.slice(),
    };
}

/**
 * `ClassDeclaration.getProperties` (P5-14): a copy of the cached list, or
 * the `classDeclarationGetProperties` binding's answer, cached when it can
 * be. Throws what the binding throws.
 * @param {object} view the ClassDeclaration view
 * @return {object[]} the properties, own first, then the super type's
 */
function classDeclarationGetProperties(view: any): any[] {
    const parent = lookupFrames.length > 0 ? lookupFrames[lookupFrames.length - 1] : undefined;
    const result = propertiesOf(view);
    parent?.push({ view, result });
    return result;
}

/**
 * The body of `classDeclarationGetProperties`, without recording the call
 * in the enclosing frame.
 * @param {object} view the ClassDeclaration view
 * @return {object[]} the properties
 */
function propertiesOf(view: any): any[] {
    if (!lookupCacheable(view)) {
        return rust!.classDeclarationGetProperties(view);
    }
    const cached = validLookup(view);
    if (cached !== undefined) {
        return cached.list.slice();
    }
    const own = view.properties;
    const state = {
        superType: view.superType,
        modelFile: view.modelFile,
        modelFiles: view.modelFile.modelManager.modelFiles,
        generation: propertyGeneration,
    };
    const calls: LookupCall[] = [];
    lookupFrames.push(calls);
    let list;
    try {
        list = rust!.classDeclarationGetProperties(view);
    } finally {
        lookupFrames.pop();
    }
    const entry = newLookup(view, own, state, list, calls);
    if (entry !== undefined) {
        propertyLookups.set(view, entry);
    }
    return list;
}

/**
 * `ClassDeclaration.getProperty` (P5-14): the first property of that name in
 * the cached `getProperties()` list, which is the property the binding
 * returns (the own property of that name, else the super type's answer),
 * or null. The list is built (with the binding, as `getProperties()` builds
 * it) when it is not cached; when that is not possible, or it throws, the
 * `classDeclarationGetProperty` binding answers, as before, and throws what
 * it throws.
 * @param {object} view the ClassDeclaration view
 * @param {string} name the property name
 * @return {object|null} the property, or null
 */
function classDeclarationGetProperty(view: any, name: any): any {
    if (typeof name === 'string' && lookupCacheable(view)) {
        let entry = validLookup(view);
        if (entry === undefined) {
            try {
                propertiesOf(view);
                entry = propertyLookups.get(view);
            } catch (e) {
                // The binding below raises its own error, if any.
                entry = undefined;
            }
        }
        if (entry !== undefined) {
            let byName = entry.byName;
            if (byName === undefined) {
                byName = new Map();
                for (const property of entry.list) {
                    const key = property.getName();
                    if (!byName.has(key)) {
                        byName.set(key, property);
                    }
                }
                entry.byName = byName;
            }
            const property = byName.get(name);
            return property === undefined ? null : property;
        }
    }
    return rust!.classDeclarationGetProperty(view, name);
}

// ---------------------------------------------------------------------------
// Identifier field names (P5-19, accordproject/concerto-rust#317): the
// answer of `ClassDeclaration.getIdentifierFieldName()` is kept per view,
// keyed on the model epoch P5-14 introduced (`propertyGeneration`), so the
// repeated calls Factory, Serializer and ResourceValidator make
// (`isIdentified()`, `isSystemIdentified()`, `getIdentifierFieldName()`) do
// not cross into the engine again.
//
// A miss runs the `classDeclarationGetIdentifierFieldNameWalk` binding,
// which walks the super types in one call and returns every declaration it
// read, and whether the walk ran without calling back (see the binding's doc
// comment in concerto-wasm). Its answer is kept only when it did, for views
// of model files built for a real BaseModelManager (as P5-14's property
// lookups), and is reused only while:
// - no model file was added, updated or deleted since (`propertyGeneration`,
//   bumped by `invalidatePropertyLookups`), and each manager on the way still
//   holds the same `modelFiles` map;
// - every declaration in the chain still has the `idField`, `superType`,
//   `superTypeDeclaration` and `modelFile` it had, and its model file the
//   same manager.
// Anything else calls the binding every time. A call that throws keeps
// nothing. P5-36 (BC-50, accordproject/concerto-rust#346): the walk always
// inlines the ClassDeclaration methods, and replacing a method the walk
// reaches (on the object or its prototype) is not supported, so the cache no
// longer compares them.
// ---------------------------------------------------------------------------

/** One declaration of a cached identifier walk, as it was read. */
interface IdentifierLevel {
    view: any;
    idField: any;
    superType: any;
    superTypeDeclaration: any;
    modelFile: any;
    manager: any;
    modelFiles: any;
}

/** One ClassDeclaration view's cached `getIdentifierFieldName()` answer. */
interface IdentifierEntry {
    /** `propertyGeneration` when it was built. */
    generation: number;
    /** The declarations the walk read, the view first. */
    levels: IdentifierLevel[];
    value: any;
}

const identifierEntries = new WeakMap<object, IdentifierEntry>();

/**
 * `view` as the walk read it, or undefined when it may not be cached.
 * @param {object} view a declaration of the chain
 * @return {object|undefined} the level
 */
function identifierLevel(view: any): IdentifierLevel | undefined {
    if (!lookupCacheable(view)) {
        return undefined;
    }
    const manager = view.modelFile.modelManager;
    return {
        view,
        idField: view.idField,
        superType: view.superType,
        superTypeDeclaration: view.superTypeDeclaration,
        modelFile: view.modelFile,
        manager,
        modelFiles: manager.modelFiles,
    };
}

/**
 * Whether `entry` is still its view's answer (see the section comment).
 * @param {object} entry the cached entry
 * @return {boolean} true if it may be reused
 */
function identifierValid(entry: IdentifierEntry): boolean {
    if (entry.generation !== propertyGeneration) {
        return false;
    }
    for (const level of entry.levels) {
        const view = level.view;
        if (view.idField !== level.idField || view.superType !== level.superType ||
            view.superTypeDeclaration !== level.superTypeDeclaration || view.modelFile !== level.modelFile ||
            level.modelFile.modelManager !== level.manager || level.manager.modelFiles !== level.modelFiles) {
            return false;
        }
    }
    return true;
}

/**
 * `ClassDeclaration.getIdentifierFieldName` (P5-19): the cached answer, or
 * the `classDeclarationGetIdentifierFieldNameWalk` binding's, cached when it
 * can be. Throws what the binding throws.
 * @param {object} view the ClassDeclaration view
 * @return {string|null} the name of the identifying field, or null
 */
function classDeclarationGetIdentifierFieldName(view: any): any {
    const cacheable = lookupCacheable(view);
    if (cacheable) {
        const entry = identifierEntries.get(view);
        if (entry !== undefined) {
            if (identifierValid(entry)) {
                return entry.value;
            }
            identifierEntries.delete(view);
        }
    }
    const generation = propertyGeneration;
    const result = rust!.classDeclarationGetIdentifierFieldNameWalk(view);
    const value = result[0];
    if (cacheable && result[1] === true && generation === propertyGeneration) {
        const levels: IdentifierLevel[] = [];
        for (let n = 2; n < result.length; n++) {
            const level = identifierLevel(result[n]);
            if (level === undefined) {
                return value;
            }
            levels.push(level);
        }
        identifierEntries.set(view, { generation, levels, value });
    }
    return value;
}

export {
    classDeclarationGetIdentifierFieldName,
    invalidatePropertyLookups,
    modelGeneration,
    classDeclarationGetProperties,
    classDeclarationGetProperty,
    localType,
    builtDeclaration,
    installLazyField,
    isPending,
    deferDecorators,
    decoratorFactories,
    mapDeclarationProcess,
    mapKeyTypeProcess,
    mapValueTypeProcess,
    checkAstShape,
    markSystemModelAst,
    stageModelFile,
    applyStagedHeader,
    applyStagedFileHeader,
    applyStagedHeaders,
    recordImportNames,
    recordedImportNames,
    deferDeclarations,
    commitStaged,
    validateAndCommitStaged,
    dropStaged,
    validateLoaded,
    beginModelFile,
    endModelFile,
    declarationIsValidIdentifier,
    declarationFullyQualifiedName,
    classDeclarationProcess,
    scalarDeclarationProcess,
    propertyProcess,
    fieldProcess,
    fieldGetScalarField,
    decoratorManagerValidate,
    decoratorManagerDecorateModels,
    decoratorManagerExtractDecorators,
    decoratorManagerExtractVocabularies,
    decoratorManagerExtractNonVocabDecorators,
};
