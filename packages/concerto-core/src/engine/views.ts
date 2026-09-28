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
    return rust!.modelUtilIsValidIdentifier(view.ast.name);
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
    // P5-10b: with a custom `options.regExp` engine, a lazily built file's
    // StringValidators were built at construction (`probeCustomRegExp`).
    const custom = !!field.parent?.modelFile?.modelManager?.options?.regExp;
    if (kind === 'StringValidator' && custom) {
        const probed = takeProbedStringValidator(field);
        if (probed !== undefined) {
            field.validator = probed;
            field.defaultValue = snapshot.defaultValue;
            return;
        }
    }
    // P5-10b: in a lazily built file, a validator whose construction is
    // known to succeed is built on first read: a NumberValidator from its
    // snapshot, a StringValidator (without a custom `options.regExp`) from
    // its `stringValidatorNew` snapshot.
    const sv = custom ? undefined : entry?.sv;
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
    const sourceModels = modelManager.getAst(true, false).models;
    const result = rust![binding](sourceModels, options);
    if (options?.removeDecoratorsFromModel) {
        // result.modelManager.models also carries the Rust engine's own
        // system namespaces (its doc comment above: "the Rust-side manager
        // carries its own copy of them"), which sourceModels (system
        // namespaces excluded, `getAst`'s second argument false) does not,
        // so the two arrays line up by namespace, not by index.
        const sourceByNamespace = new Map<string, any>(sourceModels.map((m: any) => [m.namespace, m]));
        result.modelManager.models.forEach((resultModel: any) => {
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
    const updatedModelManager = new ModelManager();
    updatedModelManager.fromAst(result.modelManager);
    result.modelManager = updatedModelManager;
    return result;
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
// When Rust's load fails, or the manager is not a real BaseModelManager, or
// it has decorator factories (user code `Decorated.process` runs, and may
// throw from, during construction; running them on first read is BC-24,
// not adopted), the ModelFile is built eagerly exactly as before, so a TS
// error is thrown by the TS code, at the same point. A custom
// `options.regExp` engine (user code the StringValidator constructor runs
// during construction: the lifted fallback SVR-CTOR-006 expects its throw
// at load) no longer forces the eager path (P5-10b): only the Fields'
// StringValidators are built at construction (`probeCustomRegExp`), and
// the file is built eagerly only when one of them throws.
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
const stages = new WeakMap<object, Stage>();

/**
 * The rustHandle each ModelFile was registered in from its stage.
 */
const committed = new WeakMap<object, any>();

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
 * file name) Rust last loaded without error, by AST object. Such a file is
 * never committed from its stage, so a repeat of the same text needs only
 * the verdict, not another load: `new ModelManager()` builds the metamodel's
 * ModelFile from the same constant AST every time.
 */
const acceptedUnmirrored = new WeakMap<object, string>();

/**
 * P5-10b: the lazily built ModelFiles. Their manager had no decorator
 * factories when each was constructed (factories keep the eager path), so
 * none applies to their elements' decorators: a factory added after
 * construction would not have applied to the views the eager constructor
 * built.
 */
const lazyFiles = new WeakSet<object>();

/**
 * Called by the ModelFile constructor, before `process()` and the header
 * part of `fromAst` (P5-10b: before `process()`, so the file's own
 * decorators can be deferred too): loads the AST in the manager's
 * rustHandle staging slot, once. Returns true when the ModelFile may be
 * built lazily: the manager is a real BaseModelManager with a rustHandle
 * and no decorator factories, Rust loaded the AST without error, and, with
 * a custom `options.regExp`, the Fields' StringValidators were built
 * without error (`probeCustomRegExp`). Never throws: on any
 * failure the caller builds the ModelFile eagerly, which throws the TS error
 * itself.
 * @param {object} modelFile the ModelFile being constructed
 * @return {boolean} true if the declarations may be built lazily
 */
function stageModelFile(modelFile: any): boolean {
    constructedFiles.add(modelFile);
    const manager = modelFile.modelManager;
    const handle = manager?.rustHandle;
    if (!handle || typeof handle.stageModelFile !== 'function' ||
        typeof manager._rustHandleMatchesModelFiles !== 'function' ||
        typeof manager._needsRustWrite !== 'function') {
        return false;
    }
    try {
        // Decorator factories are user code `Decorated.process` runs (and
        // may throw from) during construction: they keep the eager path, so
        // `newDecorator` runs at the same point as before (running it on
        // first read is BC-24, a maintainer decision not taken here).
        const factories = manager.getDecoratorFactories();
        if (Array.isArray(factories) && factories.length > 0) {
            return false;
        }
        const ast = modelFile.ast;
        const text = JSON.stringify(ast);
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
        const key = unmirrored ? JSON.stringify([text, definitions ?? null, fileName ?? null]) : null;
        // P5-10b: a custom `options.regExp` engine is user code the
        // StringValidator constructor runs (and may throw from) during
        // construction: once Rust has accepted the AST, those validators
        // are built now (`probeCustomRegExp`), and only they.
        const customRegExp = !!manager.options?.regExp;
        if (key !== null && acceptedUnmirrored.get(ast) === key) {
            if (customRegExp && !probeCustomRegExp(modelFile, ast)) {
                return false;
            }
            lazyFiles.add(modelFile);
            return true;
        }
        const id: number = handle.stageModelFile(text, definitions, fileName);
        if (customRegExp && !probeCustomRegExp(modelFile, ast)) {
            handle.dropStagedModelFile(id);
            return false;
        }
        if (key !== null) {
            // Never committed: keep the verdict, not the loaded file.
            handle.dropStagedModelFile(id);
            acceptedUnmirrored.set(ast, key);
        } else {
            const stage = { handle, id };
            stages.set(modelFile, stage);
            stageFinalizer?.register(modelFile, stage, stage);
        }
        lazyFiles.add(modelFile);
        return true;
    } catch (e) {
        return false;
    }
}


/**
 * P5-10b: the StringValidators built by `probeCustomRegExp` when a lazily
 * built file was constructed, by that ModelFile and then by the property
 * AST node each was built from, until `fieldProcess` gives each to the
 * Field built from that node in that file. Keyed by file as well as node
 * because two files (in one manager or two) can share AST objects, and
 * each file's Fields must get the validators its own manager's engine built.
 */
const probedStringValidators = new WeakMap<object, WeakMap<object, any>>();

/**
 * Whether a property AST node is one `Field.process` builds a
 * StringValidator for: a String property (`propertyProcess` sets `type`
 * to 'String') with a truthy `validator` or `lengthValidator` (the
 * `fieldProcess` binding's selection).
 * @param {object} node the property AST node
 * @return {boolean} true if its Field gets a StringValidator
 */
function hasStringValidator(node: any): boolean {
    if (!node || typeof node !== 'object' || typeof node.$class !== 'string') {
        return false;
    }
    const $class = node.$class;
    if ($class !== 'StringProperty' && !$class.endsWith('.StringProperty')) {
        return false;
    }
    return !!node.validator || !!node.lengthValidator;
}

/**
 * P5-10b: for a manager with a custom `options.regExp` engine, builds
 * every StringValidator the eager constructor would build for the file's
 * Fields, now, at construction, with the same arguments and the same
 * engine, so a throw from that user code happens at the same point. Each
 * is built against a stand-in for its Field (whose name, AST, parent file
 * and fully qualified name are all the constructor reads) and handed to
 * the Field when it is built. Returns false when one throws, or the AST
 * cannot be walked; the caller then builds the file eagerly, which throws
 * the TS error itself.
 * @param {object} modelFile the ModelFile being constructed
 * @param {object} ast its AST
 * @return {boolean} true if every validator was built
 */
function probeCustomRegExp(modelFile: any, ast: any): boolean {
    const declarations = ast?.declarations;
    if (declarations === undefined || declarations === null) {
        return true;
    }
    if (!Array.isArray(declarations)) {
        return false;
    }
    const built: Array<[object, any]> = [];
    try {
        const { StringValidator } = stringValidatorModule();
        const namespace = ast.namespace;
        for (const declaration of declarations) {
            const properties = declaration?.properties;
            if (properties === undefined || properties === null) {
                continue;
            }
            if (!Array.isArray(properties)) {
                return false;
            }
            for (const node of properties) {
                if (!hasStringValidator(node)) {
                    continue;
                }
                const parent = { getModelFile: () => modelFile };
                const standIn = {
                    ast: node,
                    getName: () => node.name,
                    getParent: () => parent,
                    getFullyQualifiedName: () => `${namespace}.${declaration.name}.${node.name}`,
                };
                built.push([node, new StringValidator(standIn, node.validator, node.lengthValidator)]);
            }
        }
    } catch (e) {
        return false;
    }
    const byNode = new WeakMap<object, any>();
    for (const [node, validator] of built) {
        byNode.set(node, validator);
    }
    probedStringValidators.set(modelFile, byNode);
    return true;
}

/**
 * The StringValidator `probeCustomRegExp` built for `field`'s AST node,
 * now attached to `field`, once; undefined if there is none.
 * @param {object} field the Field being processed
 * @return {object|undefined} the StringValidator
 */
function takeProbedStringValidator(field: any): any {
    const node = field.ast;
    const modelFile = field.parent?.modelFile;
    const byNode = modelFile && typeof modelFile === 'object' ? probedStringValidators.get(modelFile) : undefined;
    const validator = byNode && node && typeof node === 'object' ? byNode.get(node) : undefined;
    if (validator === undefined) {
        return undefined;
    }
    byNode!.delete(node);
    validator.field = field;
    return validator;
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
 * Installs the `declarations` and `localTypes` accessors that build the
 * declaration views on first use (read or write).
 * @param {object} modelFile the ModelFile
 */
function defineLazyFields(modelFile: any): void {
    if (!deferredFiles.has(modelFile)) {
        deferredFiles.set(modelFile, { byName: undefined, built: new Map(), building: false, batch: undefined });
    }
    for (const key of ['declarations', 'localTypes']) {
        Object.defineProperty(modelFile, key, {
            configurable: true,
            enumerable: true,
            get() {
                materialise(modelFile);
                return modelFile[key];
            },
            set(value) {
                materialise(modelFile);
                modelFile[key] = value;
            },
        });
    }
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

/**
 * Every ModelFile the ModelFile constructor ran for: the constructor always
 * calls `stageModelFile`, the start of the engine path. A stub ModelFile
 * (`sinon.createStubInstance(ModelFile)`, `Object.create`) never ran the
 * constructor, so it is not here (accordproject/concerto-rust#262).
 */
const constructedFiles = new WeakSet<object>();

/**
 * Whether `modelFile` was built through the engine path, that is, whether the
 * ModelFile constructor ran for it. False only for a stub ModelFile the
 * constructor never ran for, the one case a manager does not mirror into its
 * rustHandle (accordproject/concerto-rust#262). A constructor-built file
 * whose AST the engine refuses is still engine-built: its mirror write
 * throws the engine's error.
 * @param {object} modelFile the ModelFile
 * @return {boolean} true if the ModelFile was built through the engine path
 */
function isEngineBuilt(modelFile: any): boolean {
    return constructedFiles.has(modelFile);
}

/**
 * Forgets `modelFile`'s stage, returning it if it was staged in `handle`.
 * @param {object} modelFile the ModelFile
 * @param {object} handle the manager's rustHandle
 * @return {object|undefined} the stage
 */
function takeStage(modelFile: any, handle: any): Stage | undefined {
    const stage = stages.get(modelFile);
    if (!stage || stage.handle !== handle) {
        return undefined;
    }
    stages.delete(modelFile);
    stageFinalizer?.unregister(stage);
    return stage;
}

/**
 * The rustHandle write for `modelFile` from its stage: registers the file
 * Rust loaded at construction. Returns false when there is no usable stage
 * (not staged, staged in another handle, or evicted); the caller then sends
 * the AST as before. A registration error propagates, as
 * `addModelWithDefinitions`'s would.
 * @param {object} modelFile the ModelFile being added
 * @param {object} handle the manager's rustHandle
 * @return {boolean} true if the file was registered from its stage
 */
function commitStaged(modelFile: any, handle: any): boolean {
    const stage = takeStage(modelFile, handle);
    if (!stage) {
        return false;
    }
    const id = handle.commitStagedModelFile(stage.id);
    if (id === undefined) {
        return false;
    }
    committed.set(modelFile, handle);
    return true;
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
    const stage = stages.get(modelFile);
    if (stage && stage.handle === handle) {
        return handle.modelFileValidateStaged(stage.id);
    }
    if (committed.get(modelFile) === handle) {
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
    /** The declaration views built on their own, by index, with their AST node. */
    built: Map<number, { node: any; view: any }>;
    /** True while a declaration view of the file is being built. */
    building: boolean;
    /** The file's view snapshots, once computed. */
    batch: Batch | null | undefined;
}

const deferredFiles = new WeakMap<object, DeferredFile>();

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
    const cached = deferred.built.get(index);
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
    deferred.built.set(index, { node, view });
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
    const cached = deferredFiles.get(modelFile)?.built.get(index);
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
 * the fields its constructor sets when no custom `options.regExp` is
 * configured, in the same order.
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

export {
    localType,
    builtDeclaration,
    installLazyField,
    isPending,
    deferDecorators,
    decoratorFactories,
    mapDeclarationProcess,
    mapKeyTypeProcess,
    mapValueTypeProcess,
    stageModelFile,
    deferDeclarations,
    commitStaged,
    dropStaged,
    isEngineBuilt,
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
    decoratorManagerDecorateModels,
    decoratorManagerExtractDecorators,
    decoratorManagerExtractVocabularies,
    decoratorManagerExtractNonVocabDecorators,
};
