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
    const snapshot = rust!.scalarDeclarationProcess(declaration);
    declaration.superType = null;
    declaration.superTypeDeclaration = null;
    declaration.idField = null;
    declaration.timestamped = false;
    declaration.abstract = false;
    declaration.validator = null;
    declaration.type = snapshot.type;
    if (snapshot.validator?.kind === 'NumberValidator') {
        const { NumberValidator } = numberValidatorModule();
        const validator = Object.create(NumberValidator.prototype);
        // The fields the Validator and NumberValidator constructors set.
        validator.validator = declaration.ast.validator;
        validator.field = declaration;
        validator.lowerBound = snapshot.validator.lowerBound;
        validator.upperBound = snapshot.validator.upperBound;
        declaration.validator = validator;
    } else if (snapshot.validator?.kind === 'StringValidator') {
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
    batch = null;
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
                };
                ast.declarations.forEach((declaration: any, i: number) => {
                    const snapshot = Array.isArray(snapshots) ? snapshots[i] : null;
                    if (!snapshot || !declaration || typeof declaration !== 'object') {
                        return;
                    }
                    const properties = declaration.properties;
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
                        }
                    });
                });
                batch = next;
            }
        }
    } catch (e) {
        batch = null;
    }
    return saved;
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
    const { default: CollectionSizeValidator } = collectionSizeValidatorModule();
    property.sizeValidator = property.ast.sizeValidator
        ? new CollectionSizeValidator(property, property.ast.sizeValidator)
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
    field.validator = null;
    if (snapshot.validator?.kind === 'NumberValidator') {
        const { NumberValidator } = numberValidatorModule();
        const validator = Object.create(NumberValidator.prototype);
        // The fields the Validator and NumberValidator constructors set.
        validator.validator = field.ast.validator;
        validator.field = field;
        validator.lowerBound = snapshot.validator.lowerBound;
        validator.upperBound = snapshot.validator.upperBound;
        field.validator = validator;
    } else if (snapshot.validator?.kind === 'StringValidator') {
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
// it has decorator factories or a custom `options.regExp` engine (user code
// that runs during construction: P5-10b moves them), the ModelFile is built
// eagerly exactly as before, so a TS error is thrown by the TS code, at the
// same point.
//
// CONCERTO_LAZY_VIEWS_CHECK=1 is a migration diagnostic, not an option: it
// keeps the lazy path but builds the declaration views at construction too,
// and reports on stderr any model Rust accepted whose TS construction throws
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
 * The ModelFiles whose declaration views `materialise` is building: their
 * manager's decorator factories are hidden from them (`decoratorFactories`).
 */
const materialising = new Set<object>();

/**
 * Called by the ModelFile constructor, after `process()` and before the
 * header part of `fromAst`: loads the AST in the manager's rustHandle
 * staging slot, once. Returns true when the ModelFile may be built lazily:
 * the manager is a real BaseModelManager with a rustHandle, no decorator
 * factories and no custom `options.regExp`, and Rust loaded the AST without
 * error. Never throws: on any
 * failure the caller builds the ModelFile eagerly, which throws the TS error
 * itself.
 * @param {object} modelFile the ModelFile being constructed
 * @return {boolean} true if the declarations may be built lazily
 */
function stageModelFile(modelFile: any): boolean {
    const manager = modelFile.modelManager;
    const handle = manager?.rustHandle;
    if (!handle || typeof handle.stageModelFile !== 'function' ||
        typeof manager._rustHandleMatchesModelFiles !== 'function' ||
        typeof manager._needsRustWrite !== 'function') {
        return false;
    }
    try {
        const factories = manager.getDecoratorFactories();
        if (factories && factories.length > 0) {
            return false;
        }
        // A custom `options.regExp` engine is user code the StringValidator
        // constructor runs (and may throw from) during construction too.
        if (manager.options?.regExp) {
            return false;
        }
        const ast = modelFile.ast;
        const text = JSON.stringify(ast);
        const definitions = modelFile.definitions ?? undefined;
        const fileName = modelFile.fileName ?? undefined;
        const unmirrored = !manager._needsRustWrite(ast.namespace);
        const key = unmirrored ? JSON.stringify([text, definitions ?? null, fileName ?? null]) : null;
        if (key !== null && acceptedUnmirrored.get(ast) === key) {
            return true;
        }
        const id = handle.stageModelFile(text, definitions, fileName);
        if (key !== null) {
            // Never committed: keep the verdict, not the loaded file.
            handle.dropStagedModelFile(id);
            acceptedUnmirrored.set(ast, key);
        } else {
            const stage = { handle, id };
            stages.set(modelFile, stage);
            stageFinalizer?.register(modelFile, stage, stage);
        }
        return true;
    } catch (e) {
        return false;
    }
}


/**
 * `Decorated.process`'s `modelFile.getModelManager()?.getDecoratorFactories()`:
 * none while `materialise` builds that file's views. A lazily built file was
 * deferred only because its manager had no decorator factories at
 * construction; one added since must not apply to it, just as it would not
 * have applied to the views its constructor built.
 * @param {object} modelFile the ModelFile of the element being processed
 * @return {object[]|undefined} the decorator factories that apply
 */
function decoratorFactories(modelFile: any): any[] | undefined {
    if (materialising.has(modelFile)) {
        return [];
    }
    return modelFile.getModelManager()?.getDecoratorFactories();
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
    materialising.add(modelFile);
    try {
        // `fromAst`'s declarations part (declarations is an optional field).
        if (modelFile.ast.declarations) {
            modelFile._fromAstDeclarations(modelFile.ast);
        }
    } catch (e) {
        defineLazyFields(modelFile);
        throw e;
    } finally {
        materialising.delete(modelFile);
    }
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

export {
    stageModelFile,
    deferDeclarations,
    decoratorFactories,
    commitStaged,
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
    decoratorManagerDecorateModels,
    decoratorManagerExtractDecorators,
    decoratorManagerExtractVocabularies,
    decoratorManagerExtractNonVocabDecorators,
};
