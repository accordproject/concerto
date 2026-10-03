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

// Lazy views (P5-10a, P5-10b) and the staging and prestaging of model files
// in a manager's rustHandle: split out of views.ts (P5-104, review M7),
// which re-exports them.

import { rust } from './index';
import { encodeAst, encodeAstCount } from './ast-codec';
import { optionalString } from './util';
import { WireWriter } from './wire';
import type { EngineErrorFlags } from './errors';
import { batchOf, collectionSizeValidatorModule, computeBatch, numberValidatorModule, stringValidatorModule, withBatch } from './views';
import type { Batch } from './views';

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
// The lazy-views check (CONCERTO_LAZY_VIEWS_CHECK=1) is a migration
// diagnostic, not an option. P5-100 (E-15, accordproject/concerto-rust#454)
// moved it out of this module into the fuzz harness
// (migration/fuzz/lib/lazy-views-check.js), which installs it with
// `installLazyViewsCheck`: it keeps the lazy path but builds the
// declaration views, and every part P5-10b defers (`buildDeferredParts`), at
// construction too, and reports on stderr any model Rust accepted whose TS
// construction throws (an under-rejection, which would move an error from
// construction to the first read) or mutates the AST.
// ---------------------------------------------------------------------------

/** The hook the fuzz harness installs (see above). */
interface LazyViewsCheck {
    /** After `applyStagedFileHeader` applied a staged header. */
    stagedFileHeader(modelFile: any, ast: any): void;
    /** After a staged header recorded the import names. */
    importNames(modelFile: any): void;
    /** After `deferDeclarations` deferred the declaration views. */
    deferred(modelFile: any): void;
}

/** The installed check, or null (always, outside the fuzz harness). */
let lazyViewsCheck: LazyViewsCheck | null = null;

/**
 * Installs (or, with null, removes) the fuzz harness's lazy-views check.
 * @param {object|null} check the check
 */
/* istanbul ignore next: the fuzz harness's hook (migration/fuzz/lib/lazy-views-check.js); the library never installs it */
function installLazyViewsCheck(check: LazyViewsCheck | null): void {
    lazyViewsCheck = check;
}

/**
 * P5-76 (accordproject/concerto-rust#418): the per-ModelFile state of the
 * lazy load path, in one record per ModelFile. Each `new ModelFile` used
 * to insert its key into seven separate weak collections (the stage, the
 * staged header, the shape-check marks, the lazy mark, the import names
 * and the deferred declarations), which was about a sixth of the TS-API
 * `modelfile_new` profile on conformance; one WeakMap entry, with a record
 * of a fixed shape, does the same job. An absent entry is
 * `undefined` in the record (no field ever stores `undefined` as a value).
 * P5-100 (E-5, accordproject/concerto-rust#454) removed the `FileSlot`
 * shims that gave each field the WeakMap/WeakSet interface of the
 * collection it replaced: the readers and writers use the fields.
 */
interface FileState {
    /**
     * The staged load of each lazily built ModelFile, until it is committed or
     * dropped.
     */
    stage: Stage | undefined;
    /**
     * P5-28: the staged header of each lazily built ModelFile, from
     * `stageModelFile` until its constructor applies it (`applyStagedFileHeader`).
     * P5-101 (D-4): a ModelFile that took a P5-27 prestage (`takePrestaged`)
     * has its header here too, in the same format.
     */
    stagedHeader: StagedHeader | undefined;
    /**
     * P5-32 `getImports()` names (`recordImportNames`), with the `imports`
     * array, and its length, they were recorded for.
     */
    importNames: string[] | undefined;
    importNamesFor: any[] | undefined;
    importNamesLength: number | undefined;
    /**
     * P5-10b: the lazily built ModelFiles. Their manager had no decorator
     * factories when each was constructed (factories keep the eager path), so
     * none applies to their elements' decorators: a factory added after
     * construction would not have applied to the views the eager constructor
     * built.
     */
    lazy: true | undefined;
    /**
     * P5-68 (BC-19-a, R1): every ModelFile whose AST passed `checkAstShape`,
     * or was let through it as engine-written (`trustedAst`), with that AST
     * object. `dcsSourceShapeChecked` reads it: a DecoratorManager result is
     * built from checked models only when every model file of the source
     * manager is here, with the AST it still holds.
     */
    shapeChecked: object | undefined;
    /**
     * P5-69 (BC-19-b, R1): every ModelFile whose AST `checkAstShape` has left
     * for `stageModelFile` to check, folded into the engine's one load of the
     * AST (`stageModelFileBytes`). `stageModelFile` completes the check on
     * every path, and removes the file.
     */
    shapePending: true | undefined;
    deferred: DeferredFile | undefined;
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
            committed: undefined,
        };
        fileStates.set(modelFile, state);
    }
    return state;
}

/**
 * A ModelFile's staged load: the rustHandle it was staged in and its stage id.
 */
interface Stage {
    handle: any;
    id: number;
}


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
const acceptedUnmirrored = new WeakMap<object, AcceptedUnmirrored>();

/**
 * An `acceptedUnmirrored` verdict: the text, definitions and file name Rust
 * loaded (P5-94: compared field by field, where they used to be compared as
 * one `JSON.stringify([text, definitions, fileName])` key, a string as long
 * as the text built for every lookup), the header it read, and whether the
 * load ran the shape check.
 */
interface AcceptedUnmirrored {
    text: string;
    definitions: string | undefined;
    fileName: string | undefined;
    header: StagedHeader | null;
    checked: boolean;
}

/**
 * P5-28 (accordproject/concerto-rust#333), P5-94 (#444), P5-101 (D-4, #455):
 * the header of a ModelFile's AST as the engine read it when staging, which
 * is what `modelFileFromAstHeader` would set on the ModelFile (concerto-wasm
 * `staged_header_from_parts`), in the one staged-header wire format, the
 * flat layout (concerto-wasm `FlatStaged`), kept as the parsed array itself:
 * `[id, namespace, version, system, n, key_1, name_1, ..., key_n, name_n,
 * uriKey_1, uri_1, ...]`, where the `n` pairs are the `importShortNames.set`
 * calls without the implicit system import's five (`IMPLICIT_SHORT_NAMES`),
 * which every non-system header ends with, and the pairs after them are the
 * `importUriMap` assignments, in order. Every staging path returns it: a
 * file staged from its AST (`stageModelFileBytes`), a fixed system model's
 * verdict (`systemModelFileHeader`, whose id slot is 0) and a
 * DecoratorManager result (`adoptStagedModels`); `applyStagedFileHeader`
 * is its one reader.
 */
type StagedHeader = any[];

/**
 * P5-94: the implicit system import's short names and fully-qualified
 * names, in the order every non-system header ends with them (concerto-wasm
 * `IMPLICIT_IMPORT_SHORT_NAMES`), for a `StagedHeader`.
 */
const IMPLICIT_SHORT_NAMES = ['Concept', 'Asset', 'Transaction', 'Participant', 'Event'];
const IMPLICIT_NAMES = IMPLICIT_SHORT_NAMES.map((name) => `concerto@1.0.0.${name}`);


/**
 * P5-32 (accordproject/concerto-rust#342): each ModelFile's `getImports()`
 * names (every import's fully-qualified names, in order), recorded for the
 * `imports` array they were computed from. A staged header records them when
 * it is applied (`applyStagedFileHeader`): its
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
 * (`stageModelFileBytes`); its JSON text is computed only where a
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
        fileState(modelFile).shapeChecked = ast;
        return undefined;
    }
    if (manager.options?.metamodelValidation === false) {
        return undefined;
    }
    // P5-95 (accordproject/concerto-rust#445): with decorator factories,
    // `stageLoadedModelFile` takes the eager path, which checks the AST's
    // JSON text on its own (`completeShapeCheck`) and never sends the
    // bytes, so the AST is not written in the compact layout for it.
    if (compactStageable(manager, ast) && !hasDecoratorFactories(manager)) {
        const bytes = encodeAst(ast);
        if (bytes !== undefined) {
            fileState(modelFile).shapePending = true;
            return { bytes, encodeCount: encodeAstCount(), text: undefined };
        }
    }
    // P5-94: the text of a fixed system model's AST, or of an AST of a
    // namespace whose check is remembered, is remembered with its compact
    // bytes (`stableAstText`), so the same AST is not stringified again.
    const text = systemModelAsts.has(ast) || shapeMemoised(manager, ast.namespace) ? stableAstText(ast) : JSON.stringify(ast);
    const namespace = ast.namespace;
    if (shapeMemoised(manager, namespace) && shapeCheckedUnmirrored.get(namespace) === text) {
        fileState(modelFile).shapeChecked = ast;
        return text;
    }
    fileState(modelFile).shapePending = true;
    return text;
}

/**
 * P5-94 (accordproject/concerto-rust#444): an AST's JSON text, remembered
 * with the AST's compact bytes (`encodeAst`) when the text was computed,
 * and, for a fixed system model, the engine's header for that text
 * (`systemModelVerdict`) and its parse.
 */
interface KnownText {
    text: string;
    bytes: Uint8Array;
    header: string | undefined;
    parsedHeader: StagedHeader | null | undefined;
}

/**
 * P5-94: the remembered text (`KnownText`) of each AST of a namespace the
 * manager never writes (the metamodel copy every `new ModelManager()`
 * builds from the same constant AST object), by AST object.
 */
const knownTextsByAst = new WeakMap<object, KnownText>();

/**
 * P5-94: the remembered text of the fixed system models' ASTs
 * (`systemModelAsts`), by namespace: each manager builds them from fresh
 * AST objects.
 */
const knownSystemTexts = new Map<string, KnownText>();

/**
 * P5-94: whether two byte arrays are equal.
 * @param {Uint8Array} a the first
 * @param {Uint8Array} b the second
 * @return {boolean} true if they have the same bytes
 */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
    const n = a.length;
    if (n !== b.length) {
        return false;
    }
    for (let i = 0; i < n; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

/**
 * P5-94 (accordproject/concerto-rust#444): `JSON.stringify(ast)` for a
 * fixed system model's AST (`systemModelAsts`, remembered by namespace) or
 * an AST of a namespace the manager never writes (remembered by object),
 * without the new string (about two thirds of a `new ModelManager()`'s
 * JS allocation, with the memo key built from it) when the AST still has
 * the compact bytes (`encodeAst`) it had when its text was remembered.
 * The bytes describe exactly the document `JSON.parse(JSON.stringify(ast))`
 * is (ast-codec.ts), so equal bytes mean the same text.
 * @param {object} ast the AST
 * @return {string} its JSON text
 */
function stableAstText(ast: any): string {
    // A fixed system model's AST is the library's own, with a string
    // namespace.
    const system = systemModelAsts.has(ast);
    const namespace = system ? ast.namespace : undefined;
    const known = system ? knownSystemTexts.get(namespace) : knownTextsByAst.get(ast);
    // Only the library's own ASTs come here (a fixed system model's, or the
    // metamodel copy's, `shapeMemoised`), which `encodeAst` always writes.
    const bytes = encodeAst(ast)!;
    if (known !== undefined && sameBytes(bytes, known.bytes)) {
        return known.text;
    }
    // `JSON.stringify` does not touch the writer, so `bytes` still holds.
    const text = JSON.stringify(ast);
    const entry: KnownText = { text, bytes: bytes.slice(), header: undefined, parsedHeader: undefined };
    if (system) {
        knownSystemTexts.set(namespace, entry);
    } else {
        knownTextsByAst.set(ast, entry);
    }
    return text;
}

/**
 * P5-92 (accordproject/concerto-rust#438): an AST `checkAstShape` wrote in
 * the compact binary layout (`encodeAst`) for the engine to load without
 * its JSON text: the bytes (a view of `encodeAst`'s reused buffer, valid
 * while `encodeAst` has not run again, `encodeCount`), and the JSON text,
 * once a path needs it (`astText`).
 */
interface CompactAst {
    bytes: Uint8Array;
    encodeCount: number;
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
 * (`stageModelFileBytes`, P5-101): the AST is loaded into a
 * manager that writes its namespace into rustHandle and is neither a fixed
 * system model's (`systemModelAsts`, whose verdict is looked up by its
 * text) nor a staged DecoratorManager result (`prestaged`, never sent
 * again). Every other AST crosses as JSON text, as before: an unmirrored
 * namespace's verdict is remembered by its text (`acceptedUnmirrored`,
 * `shapeCheckedUnmirrored`).
 * @param {object} manager the ModelFile's manager
 * @param {object} ast the AST
 * @return {boolean} true if the AST may cross in the compact layout
 */
function compactStageable(manager: any, ast: any): boolean {
    return !systemModelAsts.has(ast) &&
        !prestaged.has(ast) && manager._needsRustWrite(ast.namespace);
}

/**
 * P5-95 (accordproject/concerto-rust#445): whether `manager` has decorator
 * factories, which keep `stageLoadedModelFile` on its eager path.
 * @param {object} manager the ModelFile's manager
 * @return {boolean} true if it has decorator factories
 */
function hasDecoratorFactories(manager: any): boolean {
    const factories = manager.getDecoratorFactories();
    return Array.isArray(factories) && factories.length > 0;
}

/**
 * P5-92: the bytes of an AST `checkAstShape` wrote in the compact layout,
 * while they are still `encodeAst`'s current output; otherwise undefined,
 * and the caller sends the AST's JSON text.
 * @param {string | object | undefined} checked what `checkAstShape` returned
 * @return {Uint8Array | undefined} the bytes
 */
function compactBytes(checked: CheckedAst | undefined): Uint8Array | undefined {
    return typeof checked === 'object' && checked.encodeCount === encodeAstCount() ? checked.bytes : undefined;
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
 * the engine's `systemModelFileHeader` returns when the AST's text is exactly
 * one of the fixed system models, whose load and shape check the engine ran
 * once. A pending shape check is then complete, as `shapeCheckPassed` would
 * record it, but not remembered by namespace. Undefined, with nothing
 * recorded, for any other file or text, which is then loaded and checked
 * as before.
 * @param {object} modelFile the ModelFile being constructed
 * @param {string} [checkedText] the AST's JSON text, when `checkAstShape`
 * already computed it
 * @return {string | undefined} the header's JSON text, or undefined
 */
function systemModelVerdict(modelFile: any, checkedText?: string): string | undefined {
    // The caller (`stageSystemModelFile`) has checked that this is a fixed
    // system model's AST (`systemModelAsts`).
    const ast = modelFile.ast;
    // P5-94: the engine's header for a text it gave one for is remembered
    // with that text (`knownSystemTexts`): the verdict is a fixed function
    // of the text (the engine's own constant system models), so the same
    // text is not sent again.
    const text = checkedText ?? stableAstText(ast);
    const known = knownSystemTexts.get(ast.namespace);
    let header: string;
    if (known !== undefined && known.text === text && known.header !== undefined) {
        header = known.header;
    } else {
        // P5-101 (D-7): a free engine function, which reads no handle.
        const answer = rust.systemModelFileHeader(text);
        if (typeof answer !== 'string') {
            return undefined;
        }
        header = answer;
        if (known !== undefined && known.text === text) {
            known.header = header;
        }
    }
    const pending = fileStates.get(modelFile);
    if (pending?.shapePending !== undefined) {
        pending.shapePending = undefined;
        pending.shapeChecked = ast;
    }
    return header;
}

/**
 * P5-69 (BC-19-b, R1): the shape check of a pending ModelFile on its own,
 * for a path that does not load the AST with the check
 * (`rustHandle.checkAstShape`, which runs the same fold over its own parse
 * of the text). Nothing when the file is not pending.
 * @param {object} modelFile the ModelFile being constructed
 * @param {string} text the AST's JSON text
 * @param {object} [state] `modelFile`'s `fileStates` record (P5-91)
 * @throws {IllegalModelException} if the AST does not have the metamodel's shape
 */
function completeShapeCheck(modelFile: any, text: string, state: FileState | undefined = fileStates.get(modelFile)): void {
    if (state === undefined || state.shapePending === undefined) {
        return;
    }
    // P5-101 (D-7): a free engine function, which reads no handle.
    rust.checkAstShape(text);
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
 * P5-94: the parse of each header text `systemModelVerdict` returned (the
 * engine gives one only for its few fixed system model texts).
 */
const parsedSystemHeaders = new Map<string, StagedHeader>();

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
    const systemHeader = systemModelVerdict(modelFile, checkedText);
    if (systemHeader === undefined) {
        return undefined;
    }
    const factories = manager.getDecoratorFactories();
    if (Array.isArray(factories) && factories.length > 0) {
        return false;
    }
    // P5-94: the parse of each system header text, shared: the header is
    // only read (`applyStagedFileHeader`), never changed.
    // P5-101 (D-4): in the one header format, its id slot 0 (nothing is
    // staged). Each fixed system model has a versioned namespace, so it
    // always has a header.
    let header = parsedSystemHeaders.get(systemHeader);
    if (header === undefined) {
        header = JSON.parse(systemHeader) as StagedHeader;
        parsedSystemHeaders.set(systemHeader, header);
    }
    const state = fileState(modelFile);
    state.stagedHeader = header;
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
/**
 * The writer `utf8Text` encodes into (wire.ts, P5-101 E-14: one buffer
 * policy for every byte buffer the engine is handed): reused across calls,
 * where a fresh `TextEncoder.encode` array per call is an external
 * allocation, which made the garbage collector run more often.
 */
const utf8Writer = new WireWriter(64 * 1024);

/** `stageModelFileBytes`'s flags (concerto-wasm `STAGE_CHECKED`, `STAGE_COMPACT`). */
const STAGE_CHECKED = 1;
const STAGE_COMPACT = 2;

/**
 * The UTF-8 bytes of `text`, for the engine's staging binding: a view of a
 * reused buffer, valid until the next call (the binding copies it into the
 * engine's memory before it returns).
 * @param {string} text the text
 * @return {Uint8Array} its UTF-8 bytes
 */
function utf8Text(text: string): Uint8Array {
    return utf8Writer.utf8(text);
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
 * it runs here first, folded into the load (`stageModelFileBytes`) or on
 * its own (`completeShapeCheck`) where nothing is loaded, and its error is
 * thrown; any other error is handled as before.
 *
 * P5-92 (accordproject/concerto-rust#438): an AST `checkAstShape` wrote in
 * the compact binary layout is loaded, and checked, from those bytes
 * (`stageModelFileBytes`); with the check off, an AST loaded into a
 * manager that writes its namespace is written in that layout here
 * (`stageModelFileBytes` too). Either way the engine's verdict and
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
                completeShapeCheck(modelFile, astText(modelFile.ast, checkedText));
            }
            return false;
        }
        const ast = modelFile.ast;
        // P5-91 (accordproject/concerto-rust#437): the file's record, looked
        // up (or created) once for the whole step, and the AST's prestage.
        const state = fileState(modelFile);
        const prestage = prestaged.get(ast);
        // P5-69: a prestaged AST is not loaded again, so it is checked on
        // its own first.
        if (checkedText !== undefined && prestage !== undefined) {
            completeShapeCheck(modelFile, astText(ast, checkedText), state);
        }
        // P5-27 (F6): a DecoratorManager result model Rust has already
        // loaded, and staged in this handle (`adoptStagedModels`), is used
        // as it is, without sending its AST again.
        if (prestage !== undefined) {
            takePrestaged(modelFile, handle, ast, prestage, state);
            state.lazy = true;
            return true;
        }
        // P5-92: the AST in the compact layout, when `checkAstShape` wrote
        // it so, or, with the check off, when it may cross so; otherwise its
        // JSON text, as before.
        let compact = compactBytes(checkedText);
        if (checkedText === undefined && compactStageable(manager, ast)) {
            compact = encodeAst(ast);
        }
        let text: string | undefined = compact !== undefined ? undefined
            : checkedText === undefined ? JSON.stringify(ast) : astText(ast, checkedText);
        const definitions = optionalString(modelFile.definitions);
        const fileName = optionalString(modelFile.fileName);
        // P5-92: an AST of a namespace the manager does not write is never
        // in the compact layout (`compactStageable`), so it has its text.
        const unmirrored = !manager._needsRustWrite(ast.namespace);
        const accepted = unmirrored ? acceptedUnmirrored.get(ast) : undefined;
        if (accepted !== undefined && accepted.text === text && accepted.definitions === definitions &&
            accepted.fileName === fileName) {
            // P5-69: a verdict from a load without the check does not
            // vouch for the shape.
            if (accepted.checked) {
                shapeCheckPassed(modelFile, text, state);
            } else {
                completeShapeCheck(modelFile, text as string, state);
            }
            if (accepted.header !== null) {
                state.stagedHeader = accepted.header;
            }
            state.lazy = true;
            return true;
        }
        // P5-28 (accordproject/concerto-rust#333): staged and its header
        // read in one call, from one decode of the AST, so the
        // constructor's `_fromAstHeader` does not cross again
        // (`applyStagedFileHeader`). P5-101 (D-4, D-10): through the one
        // staging binding (`stageModelFileBytes`), from the compact layout
        // (P5-92) or the text as UTF-8 (P5-76), with the shape check folded
        // into the load when it is pending (P5-69), and its result in the
        // one header format (`StagedHeader`).
        const checked = state.shapePending !== undefined;
        // P5-92: there is text whenever there are no bytes.
        const jsonText = text as string;
        if (compact === undefined && !checked) {
            completeShapeCheck(modelFile, jsonText, state);
        }
        const staged: StagedHeader = JSON.parse(handle.stageModelFileBytes(
            compact ?? utf8Text(jsonText), definitions, fileName,
            (checked ? STAGE_CHECKED : 0) | (compact !== undefined ? STAGE_COMPACT : 0)));
        const id: number = staged[0];
        const header: StagedHeader | null = staged.length > 1 ? staged : null;
        if (compact !== undefined) {
            shapeCheckPassed(modelFile, undefined, state);
        } else if (checked) {
            shapeCheckPassed(modelFile, jsonText, state);
        }
        if (unmirrored) {
            // Never committed: keep the verdict (and the header), not the
            // loaded file.
            handle.dropStagedModelFile(id);
            acceptedUnmirrored.set(ast, { text: jsonText, definitions, fileName, header, checked });
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
        if (checkedText === undefined && (e as EngineErrorFlags | null)?.unreadableAst) {
            throw e;
        }
        if (checkedText !== undefined && fileStates.get(modelFile)?.shapePending !== undefined) {
            // P5-69: the shape check's own error, from the folded load
            // (`astShape`, engine/errors.ts), is thrown, as `checkAstShape`
            // threw it before. Any other error is the load's, after the
            // check passed, or one thrown before the check ran, which then
            // runs now.
            if ((e as EngineErrorFlags | null)?.astShape) {
                throw e;
            }
            completeShapeCheck(modelFile, astText(modelFile.ast, checkedText));
        }
        return false;
    }
}

/**
 * P5-97 (accordproject/concerto-rust#448): the ModelFile constructor's
 * load step for a view of `source` (`ModelFile._sharedView`), in place of
 * `checkAstShape` and `stageModelFile`: the view's AST is `source`'s own
 * object, which the engine has already checked and loaded, and the
 * engine-side file is the same one, shared. Records `stage`, the shared
 * file's stage in the view's manager's rustHandle (registered from there
 * by `commitStaged`, as any staged file), or `committed`, the rustHandle
 * that already holds it; and `source`'s shape-check mark, when `source`
 * still holds the AST it was checked with. Returns whether the declaration
 * views are built lazily: when `source`'s were, or the view's manager has
 * no decorator factories (as `stageModelFile` decides it for a new file);
 * otherwise the constructor builds them now, with the factories.
 * @param {object} modelFile the view being constructed
 * @param {object} source the ModelFile it is a view of
 * @param {object} [stage] the shared file's stage
 * @param {object} [committed] the rustHandle that holds the shared file
 * @return {boolean} true if the declarations may be built lazily
 */
function adoptSharedView(modelFile: any, source: any, stage?: Stage, committed?: object): boolean {
    const state = fileState(modelFile);
    if (stage !== undefined) {
        state.stage = stage;
        stageFinalizer?.register(modelFile, stage, stage);
    }
    if (committed !== undefined) {
        state.committed = committed;
    }
    const sourceState = fileStates.get(source);
    if (sourceState?.shapeChecked !== undefined && sourceState.shapeChecked === source.ast) {
        state.shapeChecked = sourceState.shapeChecked;
    }
    const factories = modelFile.modelManager.getDecoratorFactories();
    const lazy = sourceState?.lazy !== undefined || !(Array.isArray(factories) && factories.length > 0);
    if (lazy) {
        state.lazy = true;
    }
    return lazy;
}

/**
 * P5-97: records for `modelFile` the `getImports()` names recorded for
 * `source`, the view it copied its header from (`ModelFile._copyHeader`),
 * when there are any.
 * @param {object} modelFile the view
 * @param {object} source the ModelFile it is a view of
 */
function copyImportNames(modelFile: any, source: any): void {
    const names = recordedImportNames(source);
    if (names !== undefined) {
        recordImportNames(modelFile, names);
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
    const staged = JSON.parse(handle.stageModelFileBytes(utf8Text(JSON.stringify(modelFile.ast)),
        optionalString(modelFile.definitions), optionalString(modelFile.fileName), 0));
    handle.dropStagedModelFile(staged[0]);
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
    // P5-101 (D-4): the one header format (`StagedHeader`), read from this
    // AST by the load that staged it moments ago (P5-103: so its namespace
    // is the header's, and its imports nullish or an array).
    const astImports = ast.imports;
    modelFile.namespace = ast.namespace;
    modelFile.version = header[2];
    const system: boolean = header[3];
    const imports = astImports ? astImports.concat([]) : [];
    if (!system) {
        imports.push({
            $class: 'concerto.metamodel@1.0.0.ImportTypes',
            namespace: 'concerto@1.0.0',
            types: ['Concept', 'Asset', 'Transaction', 'Participant', 'Event'],
        });
    }
    modelFile.imports = imports;
    // P5-94: indexed loops, so no iterator or destructuring garbage per
    // entry; the same `set`s and assignments, in the same order.
    const shortNames = modelFile.importShortNames;
    const uriMap = modelFile.importUriMap;
    const n: number = header[4];
    const implicit = system ? 0 : IMPLICIT_NAMES.length;
    const names: string[] = new Array(n + implicit);
    let at = 5;
    for (let i = 0; i < n; i++, at += 2) {
        const fqn = header[at + 1];
        shortNames.set(header[at], fqn);
        names[i] = fqn;
    }
    for (let i = 0; i < implicit; i++) {
        shortNames.set(IMPLICIT_SHORT_NAMES[i], IMPLICIT_NAMES[i]);
        names[n + i] = IMPLICIT_NAMES[i];
    }
    for (; at < header.length; at += 2) {
        uriMap[header[at]] = header[at + 1];
    }
    recordImportNames(modelFile, names, state);
    /* istanbul ignore if: the fuzz harness's hook (installLazyViewsCheck) */
    if (lazyViewsCheck) {
        lazyViewsCheck.stagedFileHeader(modelFile, ast);
        lazyViewsCheck.importNames(modelFile);
    }
    return true;
}

/**
 * Builds a lazily built ModelFile's declaration views, the way its
 * constructor would have: `fromAst`'s declarations part, then
 * `localTypes`. Makes both plain own fields first (and drops their
 * pending builders); if TS construction throws, both are deferred again
 * (`deferModelFileFields`), so every later access throws again.
 * @param {object} modelFile the ModelFile
 */
function materialise(modelFile: any): void {
    // Called only for a file `deferDeclarations` deferred (its pending
    // builders, or the fuzz harness's hook just after it), so the file has
    // its pending builders and its `deferred` record.
    const thunks = pendingFields.get(modelFile)!;
    thunks.delete('declarations');
    thunks.delete('localTypes');
    defineOwn(modelFile, 'declarations', []);
    defineOwn(modelFile, 'localTypes', null);
    const state = fileStates.get(modelFile)!;
    const deferred = state.deferred!;
    deferred.building = true;
    try {
        // `fromAst`'s declarations part (declarations is an optional field).
        if (modelFile.ast.declarations) {
            modelFile._fromAstDeclarations(modelFile.ast);
        }
    } catch (e) {
        // Defensive: the engine's load rejects every model whose
        // declarations' TS construction throws (the fuzz harness checks it).
        deferModelFileFields(modelFile);
        throw e;
    } finally {
        deferred.building = false;
    }
    state.deferred = undefined;
    const localTypes = new Map();
    const namespace = modelFile.getNamespace();
    for (const declaration of modelFile.declarations) {
        localTypes.set(namespace + '.' + declaration.getName(), declaration);
    }
    modelFile.localTypes = localTypes;
}

/**
 * P5-100 (E-13, accordproject/concerto-rust#454): the pending builder of a
 * lazily built ModelFile's `declarations` (`deferModelFileFields`), shared
 * by every file: `installLazyField` calls it with the file as `this`.
 * @this {object} the ModelFile
 * @return {Array} its declarations
 */
function buildModelFileDeclarations(this: any): any {
    materialise(this);
    return this.declarations;
}

/**
 * P5-100 (E-13): the pending builder of a lazily built ModelFile's
 * `localTypes`, as `buildModelFileDeclarations`.
 * @this {object} the ModelFile
 * @return {Map} its local types
 */
function buildModelFileLocalTypes(this: any): any {
    materialise(this);
    return this.localTypes;
}

/**
 * P5-100 (E-13, accordproject/concerto-rust#454): defers a ModelFile's
 * `declarations` and `localTypes` through the same prototype-level
 * accessors (`installLazyField` on `ModelFile.prototype`, introspect/
 * modelfile.ts) and pending builders (`pendingFields`) as the other lazy
 * parts. It replaces P5-94's per-instance accessors, their `early` state
 * and the prototype walk that found their file. A ModelFile never sets
 * the two fields in its constructor: until it is staged, a read gives
 * `[]` or `null` and a write stores a plain own field, as the class fields
 * did; an eagerly built file keeps them as plain own fields.
 * @param {object} modelFile the ModelFile
 */
function deferModelFileFields(modelFile: any): void {
    deferField(modelFile, 'declarations', buildModelFileDeclarations);
    deferField(modelFile, 'localTypes', buildModelFileLocalTypes);
}

/**
 * Called at the end of the ModelFile constructor when `stageModelFile`
 * returned true: defers the declaration views (or, with the fuzz harness's
 * lazy-views check installed, lets it build them now).
 * @param {object} modelFile the ModelFile
 */
function deferDeclarations(modelFile: any): void {
    // P5-91 (accordproject/concerto-rust#437): one lookup of the file's
    // record, and no `built` map until a view is built on its own.
    // Called once, at the end of the file's constructor.
    fileState(modelFile).deferred = { byName: undefined, built: undefined, building: false, batch: undefined };
    deferModelFileFields(modelFile);
    lazyViewsCheck?.deferred(modelFile);
}

/**
 * A result model's stage in a new ModelManager's rustHandle, and its header
 * in the one header format (`StagedHeader`, P5-101 D-4), when it has one.
 */
interface Prestage {
    handle: any;
    id: number;
    header: StagedHeader | undefined;
}

/**
 * The stage of each DecoratorManager result model not yet built, by AST
 * object: set by `adoptStagedModels` just before it constructs the
 * ModelFile from that AST.
 */
const prestaged = new WeakMap<object, Prestage>();

/**
 * Called by `stageModelFile` when `ast` has a prestage: makes that stage the
 * ModelFile's own, as if `stageModelFile` had just staged
 * `JSON.stringify(ast)`. `adoptStagedModels` prestages each result model in
 * the new manager's rustHandle and builds its ModelFile there at once, the
 * way `fromAst` builds it (no definitions, no file name, a namespace the
 * manager writes to its rustHandle), so the prestage is always this
 * file's (P5-103 removed the checks for any other case).
 * @param {object} modelFile the ModelFile being constructed
 * @param {object} handle the manager's rustHandle
 * @param {object} ast the ModelFile's AST
 * @param {object} prestage the AST's prestage (`prestaged`), which the
 * caller has looked up (P5-91)
 * @param {object} state the ModelFile's `fileStates` record (P5-91)
 */
function takePrestaged(modelFile: any, handle: any, ast: any, prestage: Prestage, state: FileState): void {
    prestaged.delete(ast);
    const stage = { handle, id: prestage.id };
    state.stage = stage;
    stageFinalizer?.register(modelFile, stage, stage);
    // P5-101 (D-4): a DecoratorManager result's header is in the one
    // header format, applied as any staged file's (`applyStagedFileHeader`).
    if (prestage.header) {
        state.stagedHeader = prestage.header;
    }
}

/**
 * P5-91 (accordproject/concerto-rust#437): `ModelFile._fromAstHeader`'s
 * staged header, with one lookup of the file's record. P5-101 (D-4): a
 * DecoratorManager result's header is in the one header format too, so
 * `applyStagedFileHeader` applies every staged header.
 * @param {object} modelFile the ModelFile being constructed
 * @param {object} ast the AST its header is read from
 * @return {boolean} true if a staged header was applied
 */
function applyStagedHeaders(modelFile: any, ast: any): boolean {
    return applyStagedFileHeader(modelFile, ast);
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
    const built: any[] = [];
    try {
        models.forEach((model: any, i: number) => {
            if (DCS_EXCLUDE_NS.includes(model.namespace)) {
                return;
            }
            // P5-101 (D-4): `[stageId, ...header]`, in the one header
            // format (`StagedHeader`), or `[stageId]`. The engine stages
            // every model but the system ones (null), skipped above.
            const entry = staged[i];
            prestaged.set(model, { handle, id: entry[0], header: entry.length > 1 ? entry : undefined });
            let modelFile;
            if (trusted) {
                trustedAst = model;
            }
            try {
                modelFile = new ModelFile(newModelManager, model);
            } finally {
                trustedAst = null;
            }
            built.push(modelFile);
        });
        // P5-101 (D-10, M5): the files are registered from their stages in
        // one engine call (`commitStagedAll`, through the manager's
        // `_addStagedModelFiles`), where `addModelFile` crossed once per
        // file: in the same order, with `addModelFile`'s checks, and without
        // validating them (`disableValidation`), as `fromAst` adds them. The
        // files are built first, which reads nothing another result file's
        // registration changes; a construction error leaves the manager,
        // which the caller then drops, with fewer files added.
        newModelManager._addStagedModelFiles(built);
        allStaged = built.every((modelFile) => committedHandle(modelFile) === handle);
    } finally {
        // A stage no ModelFile took (the loop threw first).
        models.forEach((model: any) => {
            const prestage = prestaged.get(model);
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
 * The stage ids `commitStagedAll` hands the engine, which overwrites them
 * with the files' handles: one buffer, grown on demand and reused, since a
 * new `Uint32Array` per call (an off-heap backing store) cost about 1 ms of
 * garbage collection on an extract of 47 files (P5-101, M5).
 */
let commitBuffer = new Uint32Array(64);

/**
 * P5-101 (D-10, M5; accordproject/concerto-rust#455): `commitStaged` for
 * several files, in order, in one engine call (concerto-wasm
 * `commitStagedModelFiles`), for the batch `addModelFiles` and the
 * DecoratorManager results (`adoptStagedModels`). Returns the
 * files' handles, in order (a view of a reused buffer, valid until the
 * next call), or undefined, having changed nothing, when any of them has no
 * usable stage in `handle` (or there are fewer than two): the caller then
 * writes each file on its own, as before.
 * @param {object[]} modelFiles the ModelFiles being added
 * @param {object} handle the manager's rustHandle
 * @return {ArrayLike<number>|undefined} the registered files' handles, or undefined
 */
function commitStagedAll(modelFiles: any[], handle: any): ArrayLike<number> | undefined {
    const n = modelFiles.length;
    if (n < 2) {
        return undefined;
    }
    const states: FileState[] = new Array(n);
    if (commitBuffer.length < n) {
        commitBuffer = new Uint32Array(Math.max(n, commitBuffer.length * 2));
    }
    const ids = commitBuffer.subarray(0, n);
    for (let i = 0; i < n; i++) {
        const state = fileStates.get(modelFiles[i]);
        const stage = state?.stage;
        if (!stage || stage.handle !== handle) {
            return undefined;
        }
        states[i] = state!;
        ids[i] = stage.id;
    }
    // P5-103: the engine's only registration error, a namespace already
    // registered, is rejected by both callers before they get here, so the
    // call cannot fail part way.
    const committed: boolean = handle.commitStagedModelFiles(ids);
    if (!committed) {
        return undefined;
    }
    for (const state of states) {
        takeStageOf(state, handle);
        state.committed = handle;
    }
    return ids;
}

/**
 * P5-34 (I-5): `BaseModelManager.addModelFile`'s validation and registration
 * of a staged file in one engine call (concerto-wasm
 * `validateAndCommitStagedModelFile`), in place of `ModelFile.validate()`'s
 * `modelFileValidateStaged` followed by `commitStaged`. Returns undefined,
 * having changed nothing, when there is no usable stage (not staged, staged
 * in another handle, or evicted); the caller
 * then validates and registers the file as before. A validation error is
 * thrown as `ModelFile.validate()` throws it (`_engineValidationError`),
 * and leaves the file staged, as that path does.
 *
 * P5-101 (D-9, accordproject/concerto-rust#455): with `metamodel`,
 * `BaseModelManager.validateAst`'s check runs first, in the same engine
 * call, over the staged AST (`validateAstStaged`'s check): one crossing
 * where there were two. Its error is thrown as `validateAst` throws it
 * (marked `metamodelCheck` by the engine), unwrapped.
 * @param {object} modelFile the ModelFile being added
 * @param {object} handle the manager's rustHandle
 * @param {boolean} [metamodel] whether to run the metamodel check first
 * @return {number|undefined} the registered file's handle, or undefined if
 * the file was not registered
 */
function validateAndCommitStaged(modelFile: any, handle: any, metamodel?: boolean): number | undefined {
    const state = fileStates.get(modelFile);
    const stage = state?.stage;
    if (!stage || stage.handle !== handle) {
        return undefined;
    }
    let id: number | undefined;
    try {
        id = handle.validateAndCommitStagedModelFile(stage.id, metamodel === true);
    } catch (e) {
        if ((e as EngineErrorFlags | null)?.metamodelCheck) {
            throw e;
        }
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
 * P5-100 (E-6): `BaseModelManager.updateModelFile`'s rustHandle write from
 * `modelFile`'s stage (concerto-wasm `updateStagedModelFile`): replaces the
 * file registered under its namespace with the one Rust loaded at
 * construction. Returns undefined when there is no usable stage (not
 * staged, staged in another handle, or evicted); the caller then sends the
 * AST as before. An error propagates,
 * as `updateModelFile`'s would.
 * @param {object} modelFile the ModelFile replacing the registered one
 * @param {object} handle the manager's rustHandle
 * @return {number|undefined} the registered file's handle, or undefined
 */
function updateStaged(modelFile: any, handle: any): number | undefined {
    const state = fileStates.get(modelFile);
    const stage = state === undefined ? undefined : takeStageOf(state, handle);
    if (!stage) {
        return undefined;
    }
    const id = handle.updateStagedModelFile(stage.id);
    if (id === undefined) {
        return undefined;
    }
    state!.committed = handle;
    return id;
}

/**
 * P5-100 (E-6): `BaseModelManager.validateAst`'s check over `modelFile`'s
 * staged copy (concerto-wasm `validateAstStaged`), without sending the AST.
 * Returns false when there is no usable stage; the caller then sends the
 * AST as before. Throws what the check throws.
 * @param {object} modelFile the ModelFile
 * @param {object} handle the manager's rustHandle
 * @return {boolean} true if checked
 */
function validateAstStaged(modelFile: any, handle: any): boolean {
    const stage = fileStates.get(modelFile)?.stage;
    if (!stage || stage.handle !== handle) {
        return false;
    }
    return handle.validateAstStaged(stage.id) === true;
}

/**
 * P5-100 (E-6): `BaseModelManager.updateExternalModels`'s rustHandle update
 * from the downloaded files' stages (concerto-wasm
 * `updateExternalModelsStaged`), without sending their ASTs. Returns false,
 * having changed nothing, unless every file is staged in `handle` (and the
 * engine still holds every stage); the caller then
 * sends the ASTs as before. Throws what that update throws; either way the
 * stages are consumed.
 * @param {object[]} modelFiles the downloaded files' ModelFiles, in order
 * @param {object} handle the manager's rustHandle
 * @param {object} next the manager's model files once updated, by namespace
 * @return {boolean} true if updated
 */
function updateExternalStaged(modelFiles: any[], handle: any, next: object): boolean {
    const states: FileState[] = [];
    const ids: number[] = [];
    for (const modelFile of modelFiles) {
        const state = fileStates.get(modelFile);
        const stage = state?.stage;
        if (!stage || stage.handle !== handle) {
            return false;
        }
        states.push(state!);
        ids.push(stage.id);
    }
    let updated: boolean;
    try {
        updated = handle.updateExternalModelsStaged(Uint32Array.from(ids), next) === true;
    } catch (e) {
        // The engine consumed the stages.
        for (const state of states) {
            takeStageOf(state, handle);
        }
        throw e;
    }
    if (updated) {
        for (const state of states) {
            takeStageOf(state, handle);
            state.committed = handle;
        }
    }
    return updated;
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
    const deferred = fileStates.get(modelFile)?.deferred;
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
    const cached = fileStates.get(modelFile)?.deferred?.built?.get(index);
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
// - P5-100 (E-13, accordproject/concerto-rust#454): a ModelFile's
//   `declarations` and `localTypes` (part 1's declaration views), with the
//   same accessors and pending builders (`deferModelFileFields`), deferred
//   whenever the file is (they are built by `materialise`, not from the
//   snapshot, so they throw where the declarations' TS construction does).
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
const pendingFields = new WeakMap<object, Map<string, (this: any) => any>>();

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
 * a plain own field, as the class field did. A builder is called with the
 * element as `this`, so one function can serve every element.
 * P5-100 (E-13): with `buildOnWrite`, a write to a field still pending
 * builds it first (a ModelFile's `declarations` and `localTypes`, which
 * are built together, so writing one must not drop the other's build).
 * @param {object} proto the class prototype
 * @param {string} key the field
 * @param {Function} [initial] the value of a field never set
 * @param {boolean} [buildOnWrite] build a pending value before a write
 */
function installLazyField(proto: object, key: string, initial?: () => any, buildOnWrite?: boolean): void {
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
                value = thunk.call(this);
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
            if (buildOnWrite && pendingFields.get(this)?.has(key) === true) {
                void this[key];
            }
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
function deferField(target: any, key: string, build: (this: any) => any): void {
    // An own field left by an earlier read: the element runs process()
    // again (IdentifiedDeclaration's constructor, MapDeclaration's) after
    // its part was read. Deleting a field it does not own does nothing.
    delete target[key];
    let thunks = pendingFields.get(target);
    if (!thunks) {
        thunks = new Map();
        pendingFields.set(target, thunks);
    }
    thunks.set(key, build);
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
    if (fileStates.get(modelFile)?.lazy === undefined) {
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
    if (fileStates.get(modelFile)?.lazy !== undefined) {
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
    return modelFile !== undefined && fileStates.get(modelFile)?.lazy !== undefined;
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
        rust.mapDeclarationProcess(view);
    } else if (fileStates.get(view.modelFile)?.lazy !== undefined) {
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
    return type !== undefined ? type : rust.mapKeyTypeProcess(view);
}

/**
 * `MapValueType.process`'s type: from the view snapshot, else the binding.
 * @param {object} view the MapValueType
 * @return {string} the type
 */
function mapValueTypeProcess(view: any): string {
    const type = batchOf(view.modelFile)?.mapTypes.get(view.ast);
    return type !== undefined ? type : rust.mapValueTypeProcess(view);
}

/**
 * Builds every deferred part of a lazily built file's views: its
 * decorators, and each declaration's, property's and map type's
 * decorators, validators and map types. Used by
 * the fuzz harness's lazy-views check (`installLazyViewsCheck`), which
 * reports any that throws.
 * @param {object} modelFile the ModelFile
 */
/* istanbul ignore next: called by the fuzz harness's hook only (migration/fuzz/lib/lazy-views-check.js) */
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
    adoptSharedView,
    adoptStagedModels,
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
    deferField,
    dropStaged,
    fileStates,
    inLazyFile,
    installLazyField,
    installLazyViewsCheck,
    localType,
    mapDeclarationProcess,
    mapKeyTypeProcess,
    mapValueTypeProcess,
    markSystemModelAst,
    materialise,
    numberValidatorFromSnapshot,
    recordImportNames,
    recordedImportNames,
    sizeValidatorFromSnapshot,
    stageModelFile,
    stringValidatorFromSnapshot,
    updateExternalStaged,
    updateStaged,
    validateAndCommitStaged,
    validateAstStaged,
    validateLoaded,
};
