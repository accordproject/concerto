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
 * snapshot and `f` its `fieldProcess` one, from `modelFilePropertySnapshots`;
 * `owner` is the view that took `p`, the only one `f` may then go to.
 */
interface PrecomputedProperty {
    p: any;
    f: any;
    owner?: object;
}

/**
 * The precomputed snapshots of the `ModelFile` being constructed, by
 * property AST node, or null outside `beginModelFile`/`endModelFile`.
 */
let precomputed: Map<object, PrecomputedProperty> | null = null;

/**
 * Called by the ModelFile constructor in rust mode just before `fromAst`
 * (P5-06): computes the `propertyProcess`/`fieldProcess` snapshots of every
 * property of `ast` in one engine call, so that `propertyProcess` and
 * `fieldProcess` below, run for each property view `fromAst` builds, read
 * them instead of each crossing the boundary. A snapshot is only ever used
 * by the view built from that very AST node, once, during this one
 * construction (see `endModelFile`); a property the engine could not
 * precompute (it would throw, or the AST cannot cross) has none, and its
 * view calls the per-property binding exactly as before, so every error is
 * raised by the same call as without the batch. Never throws.
 * @param {object} ast the model file's AST
 * @return {object} the state to hand back to `endModelFile`
 */
function beginModelFile(ast: any): Map<object, PrecomputedProperty> | null {
    const saved = precomputed;
    precomputed = null;
    try {
        if (ast && Array.isArray(ast.declarations)) {
            const text = rust!.modelFilePropertySnapshots(JSON.stringify(ast));
            if (typeof text === 'string') {
                const snapshots = JSON.parse(text);
                const map = new Map<object, PrecomputedProperty>();
                ast.declarations.forEach((declaration: any, i: number) => {
                    const entries = Array.isArray(snapshots) ? snapshots[i] : null;
                    const properties = declaration && typeof declaration === 'object' ? declaration.properties : null;
                    if (!Array.isArray(entries) || !Array.isArray(properties) || entries.length !== properties.length) {
                        return;
                    }
                    properties.forEach((node: any, j: number) => {
                        const entry = entries[j];
                        if (entry && node && typeof node === 'object' && !map.has(node)) {
                            map.set(node, entry);
                        }
                    });
                });
                precomputed = map;
            }
        }
    } catch (e) {
        precomputed = null;
    }
    return saved;
}

/**
 * Ends the construction `beginModelFile` started: drops every snapshot not
 * taken, so none can outlive it.
 * @param {object} saved what `beginModelFile` returned
 */
function endModelFile(saved: Map<object, PrecomputedProperty> | null): void {
    precomputed = saved;
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
    const entry = precomputed?.get(property.ast);
    let snapshot;
    if (entry && entry.p && entry.owner === undefined) {
        entry.owner = property;
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
    const entry = precomputed?.get(field.ast);
    let snapshot;
    if (entry && entry.owner === field && entry.f && sameType(field.type, 'type' in entry.p ? entry.p.type : undefined)) {
        precomputed!.delete(field.ast);
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
// P5-06a lazy-views spike (accordproject/concerto-rust#226)
//
// In rust mode a ModelFile's AST crosses into Rust once, when the ModelFile
// is constructed (`stageModelFile`): Rust loads it and keeps the result in
// its manager handle's staging slot. When that load succeeds, the ModelFile
// populates only its namespace, version and imports, and its `declarations`
// and `localTypes` become accessors that build the declaration views on
// first use (`deferDeclarations`). Registering the file in the manager's
// `rustHandle` mirror (`commitStaged`) and validating it (`validateLoaded`)
// then reuse the loaded file instead of sending the AST again.
//
// When Rust's load fails, the ModelFile is built eagerly exactly as before,
// so the TS error is thrown by the TS code, at the same point.
//
// CONCERTO_LAZY_VIEWS=0 turns the lazy path off (every ModelFile is built
// eagerly, as before). CONCERTO_LAZY_VIEWS_CHECK=1 keeps the stage but
// builds the declaration views at construction, and reports on stderr any
// model Rust accepted but whose TS construction throws or mutates the AST.
// ---------------------------------------------------------------------------

const lazyEnv = typeof process === 'undefined' ? undefined : process.env;
const lazyViewsEnabled = lazyEnv?.CONCERTO_LAZY_VIEWS !== '0';
const lazyViewsCheck = lazyEnv?.CONCERTO_LAZY_VIEWS_CHECK === '1';

/**
 * A ModelFile's staged load: the rustHandle it was staged in and its stage id.
 */
interface Stage {
    handle: any;
    id: number;
}

/**
 * The staged load of each lazily built ModelFile, until it is committed.
 */
const stages = new WeakMap<object, Stage>();

/**
 * The rustHandle each ModelFile was registered in from its stage.
 */
const committed = new WeakMap<object, any>();

/**
 * For ASTs of namespaces the manager never mirrors into rustHandle (the
 * system models, the metamodel), the JSON text (with the definitions and
 * file name) Rust last loaded without error, by AST object. Such a file is
 * never committed from its stage, so a repeat of the same text needs only
 * the verdict, not another load: `new ModelManager()` builds the metamodel's
 * ModelFile from the same constant AST every time.
 */
const acceptedUnmirrored = new WeakMap<object, string>();

/**
 * Called by the ModelFile constructor in rust mode, after `process()`:
 * loads the AST in the manager's rustHandle staging slot, once. Returns true
 * when the ModelFile may be built lazily: the manager is a real
 * BaseModelManager with a rustHandle and no decorator factories (a factory
 * is user code that must run during construction), and Rust loaded the AST
 * without error. Never throws: on any failure the caller builds the
 * ModelFile eagerly, which throws the TS error itself.
 * @param {object} modelFile the ModelFile being constructed
 * @return {boolean} true if the declarations may be built lazily
 */
function stageModelFile(modelFile: any): boolean {
    if (!lazyViewsEnabled) {
        return false;
    }
    const manager = modelFile.modelManager;
    const handle = manager?.rustHandle;
    if (!handle || typeof handle.stageModelFile !== 'function' || typeof manager._rustMirrorTrustworthy !== 'function') {
        return false;
    }
    try {
        const factories = manager.getDecoratorFactories?.();
        if (factories && factories.length > 0) {
            return false;
        }
        const text = JSON.stringify(modelFile.ast);
        const definitions = modelFile.definitions ?? undefined;
        const fileName = modelFile.fileName ?? undefined;
        const unmirrored = typeof manager._rustMirrorEligible === 'function' &&
            !manager._rustMirrorEligible(modelFile.ast.namespace);
        const key = unmirrored ? JSON.stringify([text, definitions ?? null, fileName ?? null]) : null;
        if (key !== null && acceptedUnmirrored.get(modelFile.ast) === key) {
            return true;
        }
        const id = handle.stageModelFile(text, definitions, fileName);
        if (key !== null) {
            // Never committed: keep the verdict, not the loaded file.
            handle.dropStagedModelFile(id);
            acceptedUnmirrored.set(modelFile.ast, key);
        } else {
            stages.set(modelFile, { handle, id });
        }
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Builds a lazily built ModelFile's declaration views, the way its
 * constructor would have: `fromAst`'s declarations part (with the P5-06
 * batch snapshots), then `localTypes`. Replaces the accessors with plain
 * fields first; if TS construction throws, the accessors are put back, so
 * every later access throws again.
 * @param {object} modelFile the ModelFile
 */
function materialise(modelFile: any): void {
    const field = (key: string, value: any) => Object.defineProperty(modelFile, key, {
        value, writable: true, enumerable: true, configurable: true
    });
    field('declarations', []);
    field('localTypes', null);
    // The file was deferred only because its manager had no decorator
    // factories then; one added since must not apply to it, just as it
    // would not have applied to the views its constructor built.
    const manager = modelFile.modelManager;
    const factories = manager?.getDecoratorFactories?.();
    const hideFactories = factories && factories.length > 0;
    const ownDescriptor = hideFactories ? Object.getOwnPropertyDescriptor(manager, 'getDecoratorFactories') : undefined;
    try {
        if (hideFactories) {
            Object.defineProperty(manager, 'getDecoratorFactories', { value: () => [], configurable: true, writable: true });
        }
        if (modelFile.ast.declarations) {
            const saved = beginModelFile(modelFile.ast);
            try {
                modelFile._fromAstDeclarations(modelFile.ast);
            } finally {
                endModelFile(saved);
            }
        }
    } catch (e) {
        restoreFactories(manager, hideFactories, ownDescriptor);
        defineLazyFields(modelFile);
        throw e;
    }
    restoreFactories(manager, hideFactories, ownDescriptor);
    const localTypes = new Map();
    const namespace = modelFile.getNamespace();
    for (const declaration of modelFile.declarations) {
        localTypes.set(namespace + '.' + declaration.getName(), declaration);
    }
    modelFile.localTypes = localTypes;
}

/**
 * Undoes `materialise`'s hiding of the manager's decorator factories.
 * @param {object} manager the ModelManager
 * @param {boolean} hidden whether they were hidden
 * @param {object} [ownDescriptor] the manager's own `getDecoratorFactories`
 * property before, if it had one
 */
function restoreFactories(manager: any, hidden: boolean, ownDescriptor?: PropertyDescriptor): void {
    if (!hidden) {
        return;
    }
    if (ownDescriptor) {
        Object.defineProperty(manager, 'getDecoratorFactories', ownDescriptor);
    } else {
        delete manager.getDecoratorFactories;
    }
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
            process.stderr.write(`P5-06a LAZY-CHECK under-rejection: ${modelFile.namespace} ${e?.name}: ${e?.message}\n`);
            throw e;
        }
        if (JSON.stringify(modelFile.ast) !== before) {
            process.stderr.write(`P5-06a LAZY-CHECK ast-mutated: ${modelFile.namespace}\n`);
        }
    }
}

/**
 * The rustHandle mirror write for `modelFile` from its stage (P5-06a):
 * registers the file Rust loaded at construction. Returns false when there
 * is no usable stage (not staged, staged in another handle, or evicted);
 * the caller then sends the AST as before. A registration error propagates,
 * as `addModelWithDefinitions`'s would.
 * @param {object} modelFile the ModelFile being added
 * @param {object} handle the manager's rustHandle
 * @return {boolean} true if the file was registered from its stage
 */
function commitStaged(modelFile: any, handle: any): boolean {
    const stage = stages.get(modelFile);
    if (!stage || stage.handle !== handle) {
        return false;
    }
    stages.delete(modelFile);
    const id = handle.commitStagedModelFile(stage.id);
    if (id === undefined) {
        return false;
    }
    committed.set(modelFile, handle);
    return true;
}

/**
 * Drops `modelFile`'s stage when it will not be registered in `handle`.
 * @param {object} modelFile the ModelFile
 * @param {object} handle the manager's rustHandle
 */
function dropStaged(modelFile: any, handle: any): void {
    const stage = stages.get(modelFile);
    if (stage && stage.handle === handle) {
        stages.delete(modelFile);
        handle.dropStagedModelFile(stage.id);
    }
}

/**
 * `ModelFile.validate()`'s Rust call without sending the AST again
 * (P5-06a): validates the staged file, or the file registered from it.
 * Returns false when neither applies; the caller then calls
 * `modelFileValidateDetached` as before. Throws what that binding throws.
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
    commitStaged,
    dropStaged,
    validateLoaded,
    beginModelFile,
    endModelFile,
    scalarDeclarationProcess,
    propertyProcess,
    fieldProcess,
    fieldGetScalarField,
    decoratorManagerDecorateModels,
    decoratorManagerExtractDecorators,
    decoratorManagerExtractVocabularies,
    decoratorManagerExtractNonVocabDecorators,
};
