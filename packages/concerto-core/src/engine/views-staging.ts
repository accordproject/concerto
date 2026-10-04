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

// Lazy views, and the staging and prestaging of model files in a manager's
// rustHandle.

import { rust } from './index';
import { encodeAst, encodeAstCount } from './ast-codec';
import { optionalString } from './util';
import { WireWriter } from './wire';
import type { EngineErrorFlags } from './errors';
import { batchOf, collectionSizeValidatorModule, computeBatch, numberValidatorModule, stringValidatorModule, withBatch } from './views';
import type { Batch } from './views';

// ---------------------------------------------------------------------------
// Lazy views.
//
// A ModelFile's AST crosses into the engine once, when the ModelFile is
// constructed (`stageModelFile`): the engine loads it, with every
// construction-time check, into its manager handle's staging slot. When that
// load succeeds, the ModelFile sets its namespace, version, imports and model
// decorators, and its `declarations` and `localTypes` become accessors that
// build the declaration and property views on first use
// (`deferDeclarations`, `materialise`), from one snapshot per file.
// Registering the file (`commitStaged`) and validating it (`validateLoaded`)
// reuse the loaded file instead of sending the AST again.
//
// When the load fails, or the manager has decorator factories (user code
// that runs, and may throw, during construction; BC-24 keeps them eager),
// the ModelFile is built eagerly, so a TS error is thrown by the TS code at
// the same point.
//
// The fuzz harness's lazy-views check (`installLazyViewsCheck`) keeps the
// lazy path but also builds every deferred part at construction, and reports
// any model the engine accepted whose TS construction throws or mutates the
// AST.
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

/** Installs (or, with null, removes) the fuzz harness's lazy-views check. */
/* istanbul ignore next: the fuzz harness's hook (migration/fuzz/lib/lazy-views-check.js); the library never installs it */
function installLazyViewsCheck(check: LazyViewsCheck | null): void {
    lazyViewsCheck = check;
}

/**
 * The per-ModelFile state of the lazy load path, one fixed-shape record per
 * ModelFile in one WeakMap. An absent field is `undefined` (no field stores
 * `undefined` as a value).
 */
interface FileState {
    /** The staged load, until it is committed or dropped. */
    stage: Stage | undefined;
    /**
     * The staged header, from `stageModelFile` (or `takePrestaged`) until the
     * constructor applies it (`applyStagedFileHeader`).
     */
    stagedHeader: StagedHeader | undefined;
    /**
     * `getImports()` names (`recordImportNames`), with the `imports` array,
     * and its length, they were recorded for.
     */
    importNames: string[] | undefined;
    importNamesFor: any[] | undefined;
    importNamesLength: number | undefined;
    /**
     * Set for a lazily built ModelFile. Its manager had no decorator
     * factories at construction, so none applies to its elements: a factory
     * added later would not have applied to eagerly built views either.
     */
    lazy: true | undefined;
    /**
     * BC-19: the AST object that passed `checkAstShape`, or was let through
     * as engine-written (`trustedAst`). `dcsSourceShapeChecked` reads it.
     */
    shapeChecked: object | undefined;
    /**
     * BC-19: the shape check is left for `stageModelFile` to complete, folded
     * into the engine's load of the AST (`stageModelFileBytes`).
     */
    shapePending: true | undefined;
    deferred: DeferredFile | undefined;
    /**
     * The rustHandle the ModelFile was registered in from its stage
     * (`commitStaged`, `validateAndCommitStaged`).
     */
    committed: object | undefined;
}

const fileStates = new WeakMap<object, FileState>();

/** `modelFile`'s record, created (with every field absent) when it has none. */
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

/** A ModelFile's staged load: the rustHandle it was staged in and its stage id. */
interface Stage {
    handle: any;
    id: number;
}


/**
 * The rustHandle `modelFile` was registered in from its stage, or undefined
 * (a field of its `fileStates` record, `committed`).
 */
function committedHandle(modelFile: any): object | undefined {
    return fileStates.get(modelFile)?.committed;
}

/**
 * Drops the stage of a ModelFile garbage-collected before it is committed or
 * dropped (constructed but never added), so its loaded file does not wait
 * for the staging slot's eviction. Best effort: the handle may be gone too.
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
 * metamodel copy), the verdict of the engine's last error-free load, by AST
 * object. Such a file is never committed, so a repeat of the same text needs
 * only the verdict: `new ModelManager()` builds the metamodel's ModelFile
 * from the same constant AST every time.
 */
const acceptedUnmirrored = new WeakMap<object, AcceptedUnmirrored>();

/**
 * An `acceptedUnmirrored` verdict: the text, definitions and file name the
 * engine loaded, the header it read, and whether the load ran the shape
 * check.
 */
interface AcceptedUnmirrored {
    text: string;
    definitions: string | undefined;
    fileName: string | undefined;
    header: StagedHeader | null;
    checked: boolean;
}

/**
 * The header of a ModelFile's AST as the engine read it when staging (what
 * `modelFileFromAstHeader` would set), in the flat layout every staging path
 * returns: `[id, namespace, version, system, n, key_1, name_1, ..., key_n,
 * name_n, uriKey_1, uri_1, ...]`, where the `n` pairs are the
 * `importShortNames.set` calls without the implicit system import's five
 * (`IMPLICIT_SHORT_NAMES`), which every non-system header ends with, and the
 * pairs after them are the `importUriMap` assignments. A fixed system model's
 * header has id 0. `applyStagedFileHeader` is its one reader.
 */
type StagedHeader = any[];

/**
 * The implicit system import's short and fully-qualified names, in the order
 * every non-system header ends with them.
 */
const IMPLICIT_SHORT_NAMES = ['Concept', 'Asset', 'Transaction', 'Participant', 'Event'];
const IMPLICIT_NAMES = IMPLICIT_SHORT_NAMES.map((name) => `concerto@1.0.0.${name}`);


/**
 * Records `names` as `modelFile.getImports()` for its current `imports`
 * array (by `applyStagedFileHeader`, else by `ModelFile.getImports`'s first
 * answer).
 * @param {string[]} names its imports' fully-qualified names, in order
 * @param {object} [state] `modelFile`'s `fileStates` record
 */
function recordImportNames(modelFile: any, names: string[], state: FileState = fileState(modelFile)): void {
    const imports = modelFile.imports;
    state.importNamesFor = imports;
    state.importNamesLength = imports.length;
    state.importNames = names;
}

/**
 * `modelFile.getImports()` as recorded (`recordImportNames`), as a fresh
 * array, or undefined when nothing is recorded for its current `imports`
 * array.
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
 * BC-19: for the metamodel copy every manager builds (a namespace it never
 * writes into rustHandle), the JSON text that last passed `checkAstShape`,
 * by namespace, so `new ModelManager()` and `clearModelFiles()` do not check
 * it again. The fixed system models take the engine's precomputed verdict
 * instead (`systemModelAsts`).
 */
const shapeCheckedUnmirrored = new Map<string, string>();

/**
 * The namespaces of the two fixed system models, never answered by
 * `shapeCheckedUnmirrored`: any AST of them but their own is always checked.
 */
const FIXED_SYSTEM_NAMESPACES = new Set(['concerto@1.0.0', 'concerto.decorator@1.0.0']);

/**
 * The AST objects of the fixed system models, which `BaseModelManager`
 * builds a ModelFile for on every `new ModelManager()` and
 * `clearModelFiles()`. For such a file `stageModelFile` asks the engine for
 * its precomputed verdict (`systemModelFileHeader`), given only when the
 * text is exactly a fixed system model's; any other text is loaded and
 * checked. So a mark lets no AST skip the check.
 */
const systemModelAsts = new WeakSet<object>();

/**
 * Marks `ast` as a fixed system model's AST (`systemModelAsts`).
 * @param {object} ast the AST the system model's ModelFile is built from
 */
function markSystemModelAst(ast: object): void {
    systemModelAsts.add(ast);
}

/**
 * Whether the shape check of `namespace` is remembered by namespace: one
 * `manager` never writes into rustHandle, other than the fixed system ones.
 * @return {boolean} true if the check is remembered by namespace
 */
function shapeMemoised(manager: any, namespace: unknown): namespace is string {
    return typeof namespace === 'string' && !FIXED_SYSTEM_NAMESPACES.has(namespace) && !manager._needsRustWrite(namespace);
}


/**
 * BC-19: the one AST the next `new ModelFile(manager, ast)` takes without
 * `checkAstShape`: set by `adoptStagedModels` for a DecoratorManager result
 * the engine just wrote from checked models, immediately before it
 * constructs that ModelFile, and cleared when the constructor returns or
 * throws. Private, so a ModelFile user code constructs is always checked.
 */
let trustedAst: object | null = null;


/**
 * BC-19 (with BC-17 and BC-20): the strict AST shape check at model load,
 * called by the ModelFile constructor before `stageModelFile`, unless the
 * manager was built with `metamodelValidation: false`. An AST without the
 * metamodel's shape (a non-array `decorators`, a non-string name, an empty
 * super type name, anything the metamodel check rejects) throws an
 * `IllegalModelException`. Undefined, with no check, when the check is off
 * or for the one engine-written AST (`trustedAst`).
 *
 * The check is folded into the engine's load of the AST in
 * `stageModelFile`, which parses it once: this marks the file pending
 * (`shapePending`), and `stageModelFile` checks it on every path, before any
 * other error. A namespace remembered by its text (`shapeMemoised`) is not
 * checked again. An AST loaded into a manager that writes it
 * (`compactStageable`) is written in the compact layout (`encodeAst`)
 * instead of `JSON.stringify`d; its JSON text is computed only where a path
 * needs it (`astText`).
 * @return {string | object | undefined} the AST's JSON text, or the AST in
 * the compact layout (`CompactAst`), when it is checked
 */
function checkAstShape(modelFile: any): CheckedAst | undefined {
    const manager = modelFile.modelManager;
    const ast = modelFile.ast;
    // BC-19: an AST the engine just wrote from checked models.
    if (ast === trustedAst) {
        trustedAst = null;
        fileState(modelFile).shapeChecked = ast;
        return undefined;
    }
    if (manager.options?.metamodelValidation === false) {
        return undefined;
    }
    // With decorator factories the eager path checks the JSON text itself,
    // so no compact bytes are written.
    if (compactStageable(manager, ast) && !hasDecoratorFactories(manager)) {
        const bytes = encodeAst(ast);
        if (bytes !== undefined) {
            fileState(modelFile).shapePending = true;
            return { bytes, encodeCount: encodeAstCount(), text: undefined };
        }
    }
    // The text of a fixed system model's AST, or of a remembered namespace's,
    // is remembered with its compact bytes (`stableAstText`).
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
 * An AST's JSON text, remembered with its compact bytes and, for a fixed
 * system model, the engine's header for it and its parse.
 */
interface KnownText {
    text: string;
    bytes: Uint8Array;
    header: string | undefined;
    parsedHeader: StagedHeader | null | undefined;
}

/**
 * The remembered text of each AST of a namespace the manager never writes,
 * by AST object.
 */
const knownTextsByAst = new WeakMap<object, KnownText>();

/**
 * The remembered text of the fixed system models' ASTs, by namespace (each
 * manager builds them from fresh objects).
 */
const knownSystemTexts = new Map<string, KnownText>();

/**
 * Whether two byte arrays are equal.
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
 * `JSON.stringify(ast)` for a fixed system model's AST or the metamodel
 * copy's, without building the string again while the AST has the compact
 * bytes it had when its text was remembered: equal bytes mean the same
 * text.
 */
function stableAstText(ast: any): string {
    // Only the library's own ASTs come here, which `encodeAst` always
    // writes.
    const system = systemModelAsts.has(ast);
    const namespace = system ? ast.namespace : undefined;
    const known = system ? knownSystemTexts.get(namespace) : knownTextsByAst.get(ast);
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
 * An AST `checkAstShape` wrote in the compact layout: the bytes (valid while
 * `encodeAst` has not run again, `encodeCount`), and the JSON text once a
 * path needs it.
 */
interface CompactAst {
    bytes: Uint8Array;
    encodeCount: number;
    text: string | undefined;
}

/**
 * What `checkAstShape` hands `stageModelFile` for a checked AST: its JSON
 * text, or the AST in the compact layout.
 */
type CheckedAst = string | CompactAst;

/**
 * Whether a ModelFile's AST may cross in the compact layout
 * (`stageModelFileBytes`): it is loaded into a manager that writes its
 * namespace, and is neither a fixed system model's (verdict looked up by
 * text) nor a staged DecoratorManager result (`prestaged`).
 * @return {boolean} true if the AST may cross in the compact layout
 */
function compactStageable(manager: any, ast: any): boolean {
    return !systemModelAsts.has(ast) &&
        !prestaged.has(ast) && manager._needsRustWrite(ast.namespace);
}

/**
 * Whether `manager` has decorator factories, which keep
 * `stageLoadedModelFile` on its eager path.
 * @return {boolean} true if it has decorator factories
 */
function hasDecoratorFactories(manager: any): boolean {
    const factories = manager.getDecoratorFactories();
    return Array.isArray(factories) && factories.length > 0;
}

/**
 * The bytes of an AST `checkAstShape` wrote in the compact layout, while
 * they are still `encodeAst`'s current output; otherwise undefined, and
 * the caller sends the AST's JSON text.
 * @param {string | object | undefined} checked what `checkAstShape` returned
 */
function compactBytes(checked: CheckedAst | undefined): Uint8Array | undefined {
    return typeof checked === 'object' && checked.encodeCount === encodeAstCount() ? checked.bytes : undefined;
}

/**
 * The JSON text of a checked AST: the text `checkAstShape` computed, or,
 * for an AST it wrote in the compact layout, `JSON.stringify(ast)`,
 * computed once, on the paths that still need it.
 * @param {string | object} checked what `checkAstShape` returned
 */
function astText(ast: any, checked: CheckedAst): string {
    if (typeof checked === 'string') {
        return checked;
    }
    return checked.text ?? (checked.text = JSON.stringify(ast));
}

/**
 * BC-19: records that a pending ModelFile's AST passed the shape check.
 * `text` is computed only for a namespace remembered by its text
 * (`shapeMemoised`); it is undefined for an AST read in the compact layout.
 * @param {object} [state] `modelFile`'s `fileStates` record
 */
function shapeCheckPassed(modelFile: any, text: string | undefined, state: FileState | undefined = fileStates.get(modelFile)): void {
    // `state` is `modelFile`'s record, when the caller has it.
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
 * The engine's precomputed verdict for a fixed system model's ModelFile: the
 * header text `systemModelFileHeader` returns when the AST's text is exactly
 * a fixed system model's. A pending shape check is then complete, but not
 * remembered by namespace. Undefined, recording nothing, for any other text.
 * @param {string} [checkedText] the AST's JSON text, when `checkAstShape`
 * already computed it
 * @return {string | undefined} the header's JSON text, or undefined
 */
function systemModelVerdict(modelFile: any, checkedText?: string): string | undefined {
    // The caller has checked this is a fixed system model's AST.
    const ast = modelFile.ast;
    // The header is a fixed function of the text, so it is remembered with
    // it (`knownSystemTexts`) and the text is not sent again.
    const text = checkedText ?? stableAstText(ast);
    const known = knownSystemTexts.get(ast.namespace);
    let header: string;
    if (known !== undefined && known.text === text && known.header !== undefined) {
        header = known.header;
    } else {
        // A free engine function, which reads no handle.
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
 * BC-19: the shape check of a pending ModelFile on its own, for a path that
 * does not load the AST with the check. Nothing when the file is not
 * pending.
 * @param {object} [state] `modelFile`'s `fileStates` record
 * @throws {IllegalModelException} if the AST does not have the metamodel's shape
 */
function completeShapeCheck(modelFile: any, text: string, state: FileState | undefined = fileStates.get(modelFile)): void {
    if (state === undefined || state.shapePending === undefined) {
        return;
    }
    // A free engine function, which reads no handle.
    rust.checkAstShape(text);
    shapeCheckPassed(modelFile, text, state);
}

/**
 * The ModelFile constructor's staging step: `stageSystemModelFile` for a
 * fixed system model, else `stageLoadedModelFile`. Kept apart so the user
 * files' path is not trained on the system models.
 * @param {string | object} [checkedText] the AST's JSON text, or the AST in
 * the compact layout, when `checkAstShape` checks it
 * @return {boolean} true if the declarations may be built lazily
 */
function stageModelFile(modelFile: any, checkedText?: CheckedAst): boolean {
    // A fixed system model's AST is never in the compact layout.
    return stageSystemModelFile(modelFile, typeof checkedText === 'object' ? undefined : checkedText) ??
        stageLoadedModelFile(modelFile, checkedText);
}

/** The parse of each header text `systemModelVerdict` returned. */
const parsedSystemHeaders = new Map<string, StagedHeader>();

/**
 * `stageModelFile` for a fixed system model's ModelFile with an engine
 * verdict: neither loaded nor checked again, and never committed, so only
 * the header is needed. With decorator factories the file is built eagerly.
 * Undefined for any other file or text.
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
    // The parsed header is shared: it is only read. Its id slot is 0
    // (nothing is staged); a fixed system model always has a header.
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
 * The writer `utf8Text` encodes into, reused across calls. A JS string
 * crosses into WASM one UTF-16 code unit at a time, so the staging binding
 * takes JSON text as UTF-8 bytes, copied in one go.
 */
const utf8Writer = new WireWriter(64 * 1024);

/** `stageModelFileBytes`'s flags (concerto-wasm `STAGE_CHECKED`, `STAGE_COMPACT`). */
const STAGE_CHECKED = 1;
const STAGE_COMPACT = 2;

/**
 * The UTF-8 bytes of `text`: a view of a reused buffer, valid until the next
 * call (the binding copies it before it returns).
 */
function utf8Text(text: string): Uint8Array {
    return utf8Writer.utf8(text);
}

/**
 * Called by the ModelFile constructor before `process()` and `fromAst`'s
 * header part: loads the AST into the manager's rustHandle staging slot,
 * once. True when the ModelFile may be built lazily: the manager has no
 * decorator factories and the engine loaded the AST. On any other failure
 * the caller builds the ModelFile eagerly, which throws the TS error itself.
 *
 * With the shape check off, an AST the engine cannot read at all is thrown
 * here (`unreadableAst`), even with decorator factories, so a malformed AST
 * never reaches the eager walk. With the check pending, it runs first,
 * folded into the load or on its own (`completeShapeCheck`), and its error
 * is thrown. The AST crosses in the compact layout where it can, else as
 * JSON text (`astText`), with the same verdict and error either way.
 * @param {string | object} [checkedText] the AST's JSON text, or the AST in
 * the compact layout, when `checkAstShape` checks it
 * @return {boolean} true if the declarations may be built lazily
 */
function stageLoadedModelFile(modelFile: any, checkedText?: CheckedAst): boolean {
    // BC-47: the ModelFile constructor accepts only a BaseModelManager,
    // which always has a rustHandle.
    const manager = modelFile.modelManager;
    const handle = manager.rustHandle;
    try {
        // Decorator factories are user code that runs (and may throw)
        // during construction, so they keep the eager path (BC-24).
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
        const state = fileState(modelFile);
        const prestage = prestaged.get(ast);
        // A prestaged AST is not loaded again, so it is checked on its own.
        if (checkedText !== undefined && prestage !== undefined) {
            completeShapeCheck(modelFile, astText(ast, checkedText), state);
        }
        // A DecoratorManager result the engine already staged in this
        // handle is used as it is.
        if (prestage !== undefined) {
            takePrestaged(modelFile, handle, ast, prestage, state);
            state.lazy = true;
            return true;
        }
        // The compact layout where it can be, else the JSON text.
        let compact = compactBytes(checkedText);
        if (checkedText === undefined && compactStageable(manager, ast)) {
            compact = encodeAst(ast);
        }
        let text: string | undefined = compact !== undefined ? undefined
            : checkedText === undefined ? JSON.stringify(ast) : astText(ast, checkedText);
        const definitions = optionalString(modelFile.definitions);
        const fileName = optionalString(modelFile.fileName);
        // An unmirrored namespace's AST is never compact, so it has text.
        const unmirrored = !manager._needsRustWrite(ast.namespace);
        const accepted = unmirrored ? acceptedUnmirrored.get(ast) : undefined;
        if (accepted !== undefined && accepted.text === text && accepted.definitions === definitions &&
            accepted.fileName === fileName) {
            // A verdict from a load without the check does not vouch for
            // the shape.
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
        // Staged, with its header read, in one call from one decode of the
        // AST, with the shape check folded in when it is pending.
        const checked = state.shapePending !== undefined;
        // There is text whenever there are no bytes.
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
            // Never committed: keep the verdict and header, not the file.
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
            // The folded shape check's own error (`astShape`) is thrown;
            // any other error came from the load after the check passed, or
            // before it ran, in which case it runs now.
            if ((e as EngineErrorFlags | null)?.astShape) {
                throw e;
            }
            completeShapeCheck(modelFile, astText(modelFile.ast, checkedText));
        }
        return false;
    }
}

/**
 * The ModelFile constructor's load step for a view of `source`
 * (`ModelFile._sharedView`), in place of `checkAstShape` and
 * `stageModelFile`: the view shares `source`'s AST object and engine-side
 * file. Records the shared file's `stage` in the view's manager's rustHandle,
 * or the rustHandle that already holds it (`committed`), and `source`'s
 * shape-check mark while it still holds that AST. Lazy when `source` was, or
 * when the view's manager has no decorator factories.
 * @param {object} source the ModelFile it is a view of
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
 * Records for `modelFile` the `getImports()` names recorded for `source`,
 * the view it copied its header from (`ModelFile._copyHeader`), when
 * there are any.
 * @param {object} source the ModelFile it is a view of
 */
function copyImportNames(modelFile: any, source: any): void {
    const names = recordedImportNames(source);
    if (names !== undefined) {
        recordImportNames(modelFile, names);
    }
}

/**
 * Reads the AST of a ModelFile whose manager has decorator factories and
 * the shape check off, only to throw `stageModelFile`'s `unreadableAst`
 * error for an AST the engine cannot read. The staged file is dropped.
 */
function readUnchecked(modelFile: any, handle: any): void {
    const staged = JSON.parse(handle.stageModelFileBytes(utf8Text(JSON.stringify(modelFile.ast)),
        optionalString(modelFile.definitions), optionalString(modelFile.fileName), 0));
    handle.dropStagedModelFile(staged[0]);
}


/**
 * `ModelFile._fromAstHeader(ast)` from the header `stageModelFile` read,
 * without an engine call: sets `namespace`, `version` and `imports` (a copy
 * of `ast.imports` plus the implicit system import for a non-system file),
 * and fills `importShortNames` and `importUriMap`. False, changing nothing,
 * when there is no staged header; the caller then calls
 * `modelFileFromAstHeader`.
 * @param {object} ast the AST its header is read from
 * @param {object} [state] `modelFile`'s `fileStates` record
 * @return {boolean} true if the header was set
 */
function applyStagedFileHeader(modelFile: any, ast: any, state: FileState | undefined = fileStates.get(modelFile)): boolean {
    const header = state?.stagedHeader;
    if (header === undefined) {
        return false;
    }
    state!.stagedHeader = undefined;
    // Read from this AST by the load that staged it moments ago.
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
    // Indexed loops: no iterator garbage per entry.
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
 * Builds a lazily built ModelFile's declaration views as its constructor
 * would have (`fromAst`'s declarations part, then `localTypes`), as plain
 * own fields; if that throws, both are deferred again, so every later access
 * throws again.
 */
function materialise(modelFile: any): void {
    // Only for a file `deferDeclarations` deferred.
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
 * The pending builder of a lazily built ModelFile's `declarations`
 * (`deferModelFileFields`), shared by every file: `installLazyField` calls
 * it with the file as `this`.
 * @this {object} the ModelFile
 */
function buildModelFileDeclarations(this: any): any {
    materialise(this);
    return this.declarations;
}

/**
 * The pending builder of a lazily built ModelFile's `localTypes`,
 * as `buildModelFileDeclarations`.
 * @this {object} the ModelFile
 */
function buildModelFileLocalTypes(this: any): any {
    materialise(this);
    return this.localTypes;
}

/**
 * Defers a ModelFile's `declarations` and `localTypes` through the
 * prototype-level accessors (`installLazyField` on `ModelFile.prototype`)
 * and pending builders the other lazy parts use. Until a file is staged, a
 * read gives `[]` or `null` and a write stores a plain own field; an eagerly
 * built file keeps them as plain own fields.
 */
function deferModelFileFields(modelFile: any): void {
    deferField(modelFile, 'declarations', buildModelFileDeclarations);
    deferField(modelFile, 'localTypes', buildModelFileLocalTypes);
}

/**
 * Called at the end of the ModelFile constructor when `stageModelFile`
 * returned true: defers the declaration views (or, with the fuzz harness's
 * lazy-views check installed, lets it build them now).
 */
function deferDeclarations(modelFile: any): void {
    // No `built` map until a view is built on its own.
    fileState(modelFile).deferred = { byName: undefined, built: undefined, building: false, batch: undefined };
    deferModelFileFields(modelFile);
    lazyViewsCheck?.deferred(modelFile);
}

/**
 * A result model's stage in a new ModelManager's rustHandle, and its
 * `StagedHeader` when it has one.
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
 * `JSON.stringify(ast)`. `adoptStagedModels` builds each result's ModelFile
 * in the manager it prestaged it in, as `fromAst` builds it, so the
 * prestage is always this file's.
 * @param {object} prestage the AST's prestage (`prestaged`), which the
 * caller has looked up
 * @param {object} state the ModelFile's `fileStates` record
 */
function takePrestaged(modelFile: any, handle: any, ast: any, prestage: Prestage, state: FileState): void {
    prestaged.delete(ast);
    const stage = { handle, id: prestage.id };
    state.stage = stage;
    stageFinalizer?.register(modelFile, stage, stage);
    // Applied as any staged file's header.
    if (prestage.header) {
        state.stagedHeader = prestage.header;
    }
}

/**
 * `ModelFile._fromAstHeader`'s staged header, a DecoratorManager result's
 * included.
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
 * `clearModelFiles()`, for a result the engine staged: `staged[i]` is
 * `[stageId, header]` for `ast.models[i]`, or null. The same ModelFiles are
 * constructed and added, in the same order, with the same errors.
 * `validateModelFiles()` runs as in `fromAst`, unless the engine `validated`
 * the result and every file was registered from its stage (the rustHandle
 * then holds exactly the files validated, under the same options).
 * @param {object} newModelManager the new ModelManager, cleared
 * @param {object} ast the result's `{ $class, models }` AST
 * @param {Array} staged the stage of each model, or null
 * @param {boolean} validated whether Rust validated the result
 * @param {boolean} [disableValidation] fromAst's `disableValidation` option
 * @param {boolean} [trusted] BC-19: every result model is an AST the engine
 * just wrote from nodes that passed `checkAstShape`, so each ModelFile skips
 * the check (`trustedAst`)
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
            // `[stageId, ...header]` or `[stageId]`; only the system models
            // (skipped above) are null.
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
        // Registered from their stages in one engine call, in order, with
        // `addModelFile`'s checks and without validation, as `fromAst` adds
        // them. A construction error leaves the manager, which the caller
        // drops, with fewer files added.
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

/** Forgets `modelFile`'s stage, returning it if it was staged in `handle`. */
function takeStage(modelFile: any, handle: any): Stage | undefined {
    const state = fileStates.get(modelFile);
    return state === undefined ? undefined : takeStageOf(state, handle);
}

/**
 * `takeStage` over the file's record, already looked up.
 * @param {object} state the ModelFile's `fileStates` record
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
 * Registers `modelFile` in `handle` from the file the engine loaded at
 * construction. Undefined when there is no usable stage (not staged, staged
 * elsewhere, or evicted); the caller then sends the AST. A registration
 * error propagates.
 * @return {number|undefined} the registered file's handle (the
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
 * with the files' handles: one reused buffer, since a new `Uint32Array` per
 * call costs garbage collection.
 */
let commitBuffer = new Uint32Array(64);

/**
 * `commitStaged` for several files in one engine call, for the batch
 * `addModelFiles` and DecoratorManager results. Returns the files' handles in
 * order (a view of a reused buffer, valid until the next call), or
 * undefined, changing nothing, when any file has no usable stage in `handle`
 * or there are fewer than two: the caller then writes each on its own.
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
    // The engine's only registration error, a namespace already
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
 * `BaseModelManager.addModelFile`'s validation and registration of a staged
 * file in one engine call. Undefined, changing nothing, when there is no
 * usable stage; the caller then validates and registers the file itself. A
 * validation error is thrown as `ModelFile.validate()` throws it, and leaves
 * the file staged. With `metamodel`, `validateAst`'s check runs first in the
 * same call, and its error (marked `metamodelCheck`) is thrown unwrapped.
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
 */
function dropStaged(modelFile: any, handle: any): void {
    const stage = takeStage(modelFile, handle);
    if (stage) {
        handle.dropStagedModelFile(stage.id);
    }
}

/**
 * `BaseModelManager.updateModelFile`'s rustHandle write from `modelFile`'s
 * stage, replacing the file registered under its namespace. Undefined when
 * there is no usable stage; the caller then sends the AST. An error
 * propagates.
 * @param {object} modelFile the ModelFile replacing the registered one
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
 * `BaseModelManager.validateAst`'s check over `modelFile`'s staged copy
 * (concerto-wasm `validateAstStaged`), without sending the AST. Returns
 * false when there is no usable stage; the caller then sends the AST as
 * before. Throws what the check throws.
 */
function validateAstStaged(modelFile: any, handle: any): boolean {
    const stage = fileStates.get(modelFile)?.stage;
    if (!stage || stage.handle !== handle) {
        return false;
    }
    return handle.validateAstStaged(stage.id) === true;
}

/**
 * `BaseModelManager.updateExternalModels`'s rustHandle update from the
 * downloaded files' stages (concerto-wasm `updateExternalModelsStaged`),
 * without sending their ASTs. Returns false, having changed nothing, unless
 * every file is staged in `handle` (and the engine still holds every
 * stage); the caller then sends the ASTs. Throws what that update
 * throws; either way the stages are consumed.
 * @param {object[]} modelFiles the downloaded files' ModelFiles, in order
 * @param {object} next the manager's model files once updated, by namespace
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
 * when neither applies; the caller then calls `modelFileValidateDetached`. Throws what that binding throws.
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
 * A lazily built file whose declaration views are not all built yet
 * (its `declarations`/`localTypes` accessors are still installed).
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
     * node; undefined until the first.
     */
    built: Map<number, { node: any; view: any }> | undefined;
    /** True while a declaration view of the file is being built. */
    building: boolean;
    /** The file's view snapshots, once computed. */
    batch: Batch | null | undefined;
}


/** The metamodel classes `ModelFile._declarationView` builds a view for. */
const DECLARATION_CLASSES = new Set([
    'AssetDeclaration', 'TransactionDeclaration', 'EventDeclaration', 'ParticipantDeclaration',
    'EnumDeclaration', 'MapDeclaration', 'ConceptDeclaration', 'BooleanScalar', 'IntegerScalar',
    'LongScalar', 'DoubleScalar', 'StringScalar', 'DateTimeScalar',
].map((name) => `concerto.metamodel@1.0.0.${name}`));

/**
 * The `localTypes` key of each declaration of `ast`, or null when one is
 * not a plain declaration node with a string name and a known class (then
 * every view is built, which raises any error there).
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
 * `ModelFile.getLocalType` for a lazily built file whose views are not all
 * built (the ModelManager-level lookups resolve through it): builds only the
 * view asked for, once, with the file's view snapshots, and returns it (the
 * same view `declarations` then holds), or null when the file declares no
 * such type. Undefined when the caller must answer itself (not lazy, all
 * built, or not indexable). While a view of the file is being built, throws
 * what `getLocalType` throws during construction.
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
 */
function builtDeclaration(modelFile: any, index: number, node: any): any {
    const cached = fileStates.get(modelFile)?.deferred?.built?.get(index);
    return cached && cached.node === node ? cached.view : undefined;
}

// ---------------------------------------------------------------------------
// Lazy views, part 2: parts of a lazily built file's views built on first
// read: decorators, validators (`validator`, `sizeValidator`), a
// MapDeclaration's `key` and `value`, and a ModelFile's `declarations` and
// `localTypes` (built by `materialise`).
//
// Each is deferred only when the view snapshot proves building it cannot
// throw, and is then built from the snapshot without another engine call;
// anything else is built at the same point as TS 5.0.0 builds it. The fields
// are prototype accessors (`installLazyField`) over a pending builder: an
// unread part is never built, an element outside a lazy file stores a plain
// own field, the first read replaces the accessor with a plain own field,
// and a builder that throws stays pending, so every later read throws again.
// ---------------------------------------------------------------------------

/** The pending builders of each element's deferred parts, by field name. */
const pendingFields = new WeakMap<object, Map<string, (this: any) => any>>();

/** Stores `value` as `target`'s own plain field `key`. */
function defineOwn(target: any, key: string, value: any): void {
    Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
}

/**
 * Installs the accessor for field `key` on `proto`: a read builds a deferred
 * value (or returns and keeps `initial()` for a field never set), and a
 * write stores a plain own field. A builder is called with the element as
 * `this`. With `buildOnWrite`, a write to a pending field builds it first
 * (`declarations` and `localTypes` are built together).
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

/** Defers `target`'s field `key`: `build` makes its value on first read. */
function deferField(target: any, key: string, build: (this: any) => any): void {
    // An own field left by an earlier read, when the element runs
    // `process()` again.
    delete target[key];
    let thunks = pendingFields.get(target);
    if (!thunks) {
        thunks = new Map();
        pendingFields.set(target, thunks);
    }
    thunks.set(key, build);
}

let decoratorCache: any;

/** The introspect/decorator module, required once. */
function decoratorModule(): any {
    return decoratorCache ?? (decoratorCache = require('../introspect/decorator'));
}

/**
 * A Decorator rebuilt from its `decoratorProcess` snapshot: the fields its
 * constructor and `process()` set, in the same order.
 * @param {object} entry the snapshot `{n, a}`
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
 * `Decorated.process`'s decorator loop for a deferred `decorators`: each
 * Decorator rebuilt from its snapshot, or constructed where there is none,
 * into the element's own `decorators` list as it is filled.
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
 * `decorators` when building them cannot throw (every node is an object).
 * False when the caller builds them now.
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
 * `Decorated.process`'s `getDecoratorFactories()`: none for a lazily built
 * file, whose manager had none at construction.
 * @param {object} modelFile the ModelFile of the element being processed
 */
function decoratorFactories(modelFile: any): any[] | undefined {
    if (fileStates.get(modelFile)?.lazy !== undefined) {
        return [];
    }
    return modelFile.getModelManager()?.getDecoratorFactories();
}

/** Whether `element`'s model file is lazily built. */
function inLazyFile(element: any): boolean {
    const modelFile = element.modelFile ?? element.parent?.modelFile;
    return modelFile !== undefined && fileStates.get(modelFile)?.lazy !== undefined;
}

/**
 * A NumberValidator rebuilt from its snapshot: the fields the Validator and
 * NumberValidator constructors set.
 * @param {object} snapshot `{lowerBound, upperBound}`
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
 * A StringValidator rebuilt from its `stringValidatorNew` snapshot: the
 * fields its constructor sets, in the same order.
 * @param {object} regexAst the `validator` AST it was built from
 * @param {object} snapshot `{minLength, maxLength}`
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
 * snapshot: the fields its constructor sets, in the same order.
 * @param {object} ast the `sizeValidator` AST it was built from
 * @param {object} snapshot `{minSize, maxSize}`
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
 * `MapDeclaration.process`'s key and value types. When the view snapshot has
 * the map, the check is not run again and, in a lazily built file, `key` and
 * `value` are built on first read; otherwise the `mapDeclarationProcess`
 * binding runs and the types are built now.
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

/** `MapKeyType.process`'s type: from the view snapshot, else the binding. */
function mapKeyTypeProcess(view: any): string {
    const type = batchOf(view.modelFile)?.mapTypes.get(view.ast);
    return type !== undefined ? type : rust.mapKeyTypeProcess(view);
}

/** `MapValueType.process`'s type: from the view snapshot, else the binding. */
function mapValueTypeProcess(view: any): string {
    const type = batchOf(view.modelFile)?.mapTypes.get(view.ast);
    return type !== undefined ? type : rust.mapValueTypeProcess(view);
}

/**
 * Builds every deferred part of a lazily built file's views, for the fuzz
 * harness's lazy-views check.
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
