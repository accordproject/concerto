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
//
// A ModelFile's AST crosses into the engine once, at construction
// (`stageModelFile`), and is loaded with every construction-time check into
// the handle's staging slot. On success the header is set and `declarations`
// and `localTypes` become accessors built on first use from one snapshot per
// file; `commitStaged` and `validateLoaded` reuse the loaded file. When the
// load fails, or the manager has decorator factories (BC-24), the ModelFile
// is built eagerly, so a TS error is thrown at the same point.

import { rust } from './index';
import { encodeAst, encodeAstCount } from './ast-codec';
import { optionalString } from './util';
import { WireWriter } from './wire';
import type { EngineErrorFlags } from './errors';
import { installedLazyViewsCheck } from './views-lazy';
import { excludedNamespaces, modelFileModule } from './views-modules';
import { committedHandle, fileState, stateOf } from './views-state';
import type { FileState, Stage, StagedHeader } from './views-state';

/**
 * Drops the stage of a ModelFile collected before it is committed, so its
 * loaded file does not wait for eviction. Best effort: the handle may be gone.
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
 * For ASTs of namespaces the manager never writes (the metamodel copy), the
 * verdict of the engine's last error-free load, by AST object: such a file is
 * never committed, so a repeat needs only the verdict.
 */
const acceptedUnmirrored = new WeakMap<object, AcceptedUnmirrored>();

interface AcceptedUnmirrored {
    text: string;
    definitions: string | undefined;
    fileName: string | undefined;
    header: StagedHeader | null;
    checked: boolean;
}

/** The implicit system import's names, in the order every non-system header ends with. */
const IMPLICIT_SHORT_NAMES = ['Concept', 'Asset', 'Transaction', 'Participant', 'Event'];

const IMPLICIT_NAMES = IMPLICIT_SHORT_NAMES.map((name) => `concerto@1.0.0.${name}`);

/** Records `names` as `modelFile.getImports()` for its current `imports` array. */
function recordImportNames(modelFile: any, names: string[], state: FileState = fileState(modelFile)): void {
    const imports = modelFile.imports;
    state.importNamesFor = imports;
    state.importNamesLength = imports.length;
    state.importNames = names;
}

/** A copy of the recorded `getImports()` names, or undefined if stale or absent. */
function recordedImportNames(modelFile: any): string[] | undefined {
    const state = stateOf(modelFile);
    const imports = modelFile.imports;
    if (state === undefined || state.importNames === undefined || state.importNamesFor !== imports ||
        state.importNamesLength !== imports.length) {
        return undefined;
    }
    return state.importNames.slice();
}

/**
 * BC-19: for the metamodel copy every manager builds, the JSON text that last
 * passed `checkAstShape`, by namespace, so it is not checked again. The fixed
 * system models use the engine's precomputed verdict instead.
 */
const shapeCheckedUnmirrored = new Map<string, string>();

const FIXED_SYSTEM_NAMESPACES = new Set(['concerto@1.0.0', 'concerto.decorator@1.0.0']);

/**
 * The fixed system models' ASTs, which every `new ModelManager()` builds. For
 * these `stageModelFile` asks the engine for its precomputed verdict, given
 * only when the text is exactly a system model's, so a mark lets no AST skip
 * the check.
 */
const systemModelAsts = new WeakSet<object>();

function markSystemModelAst(ast: object): void {
    systemModelAsts.add(ast);
}

/** Whether `namespace`'s shape check is remembered by namespace (`shapeCheckedUnmirrored`). */
function shapeMemoised(manager: any, namespace: unknown): namespace is string {
    return typeof namespace === 'string' && !FIXED_SYSTEM_NAMESPACES.has(namespace) && !manager._needsRustWrite(namespace);
}

/**
 * BC-19: the one AST the next `new ModelFile` takes unchecked, set by
 * `adoptStagedModels` for an engine-written result and cleared when the
 * constructor returns or throws. Private, so a user-built ModelFile is
 * always checked.
 */
let trustedAst: object | null = null;

/**
 * BC-19 (with BC-17, BC-20): the strict AST shape check, called by the
 * ModelFile constructor unless `metamodelValidation` is false. A malformed
 * AST throws `IllegalModelException`. The check is folded into the
 * engine's load in `stageModelFile`; this only marks the file pending and
 * returns the AST's JSON text, or its compact bytes for a manager that
 * writes it. Undefined when the check is off or for `trustedAst`.
 */
function checkAstShape(modelFile: any): CheckedAst | undefined {
    const manager = modelFile.modelManager;
    const ast = modelFile.ast;
    if (ast === trustedAst) {
        trustedAst = null;
        fileState(modelFile).shapeChecked = ast;
        return undefined;
    }
    if (manager.options?.metamodelValidation === false) {
        return undefined;
    }
    // With decorator factories the eager path checks the JSON text itself.
    if (compactStageable(manager, ast) && !hasDecoratorFactories(manager)) {
        const bytes = encodeAst(ast);
        if (bytes !== undefined) {
            fileState(modelFile).shapePending = true;
            return { bytes, encodeCount: encodeAstCount(), text: undefined };
        }
    }
    const text = systemModelAsts.has(ast) || shapeMemoised(manager, ast.namespace) ? stableAstText(ast) : JSON.stringify(ast);
    const namespace = ast.namespace;
    if (shapeMemoised(manager, namespace) && shapeCheckedUnmirrored.get(namespace) === text) {
        fileState(modelFile).shapeChecked = ast;
        return text;
    }
    fileState(modelFile).shapePending = true;
    return text;
}

/** An AST's JSON text with its compact bytes and, for a system model, the engine's header. */
interface KnownText {
    text: string;
    bytes: Uint8Array;
    header: string | undefined;
    parsedHeader: StagedHeader | null | undefined;
}

const knownTextsByAst = new WeakMap<object, KnownText>();

/** The same for the fixed system models, by namespace (each manager builds fresh objects). */
const knownSystemTexts = new Map<string, KnownText>();

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
 * `JSON.stringify(ast)` for a library-owned AST, reused while its compact
 * bytes are unchanged: equal bytes mean the same text.
 */
function stableAstText(ast: any): string {
    const system = systemModelAsts.has(ast);
    const namespace = system ? ast.namespace : undefined;
    const known = system ? knownSystemTexts.get(namespace) : knownTextsByAst.get(ast);
    const bytes = encodeAst(ast)!;
    if (known !== undefined && sameBytes(bytes, known.bytes)) {
        return known.text;
    }
    const text = JSON.stringify(ast);
    const entry: KnownText = { text, bytes: bytes.slice(), header: undefined, parsedHeader: undefined };
    if (system) {
        knownSystemTexts.set(namespace, entry);
    } else {
        knownTextsByAst.set(ast, entry);
    }
    return text;
}

/** An AST in the compact layout; `bytes` is valid while `encodeCount` is current. */
interface CompactAst {
    bytes: Uint8Array;
    encodeCount: number;
    text: string | undefined;
}

type CheckedAst = string | CompactAst;

/**
 * Whether an AST may cross in the compact layout: its manager writes the
 * namespace, and it is neither a fixed system model's nor prestaged.
 */
function compactStageable(manager: any, ast: any): boolean {
    return !systemModelAsts.has(ast) &&
        !prestaged.has(ast) && manager._needsRustWrite(ast.namespace);
}

/** Whether `manager` has decorator factories (which keep the eager path). */
function hasDecoratorFactories(manager: any): boolean {
    const factories = manager.getDecoratorFactories();
    return Array.isArray(factories) && factories.length > 0;
}

/** The compact bytes `checkAstShape` wrote, while still current; else undefined. */
function compactBytes(checked: CheckedAst | undefined): Uint8Array | undefined {
    return typeof checked === 'object' && checked.encodeCount === encodeAstCount() ? checked.bytes : undefined;
}

/** The JSON text of a checked AST, computed once when it was sent compact. */
function astText(ast: any, checked: CheckedAst): string {
    if (typeof checked === 'string') {
        return checked;
    }
    return checked.text ?? (checked.text = JSON.stringify(ast));
}

/**
 * BC-19: records that a pending ModelFile's AST passed the shape check.
 * `text` is undefined for an AST read in the compact layout.
 */
function shapeCheckPassed(modelFile: any, text: string | undefined, state: FileState | undefined = stateOf(modelFile)): void {
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
 * The engine's precomputed header for a fixed system model's text, which
 * also completes a pending shape check; undefined for any other text.
 */
function systemModelVerdict(modelFile: any, checkedText?: string): string | undefined {
    const ast = modelFile.ast;
    // The header is a fixed function of the text, so it is remembered with it.
    const text = checkedText ?? stableAstText(ast);
    const known = knownSystemTexts.get(ast.namespace);
    let header: string;
    if (known !== undefined && known.text === text && known.header !== undefined) {
        header = known.header;
    } else {
        const answer = rust.systemModelFileHeader(text);
        if (typeof answer !== 'string') {
            return undefined;
        }
        header = answer;
        if (known !== undefined && known.text === text) {
            known.header = header;
        }
    }
    const pending = stateOf(modelFile);
    if (pending?.shapePending !== undefined) {
        pending.shapePending = undefined;
        pending.shapeChecked = ast;
    }
    return header;
}

/**
 * BC-19: the shape check on its own, for a path that does not load the AST.
 * @throws {IllegalModelException} if the AST does not have the metamodel's shape
 */
function completeShapeCheck(modelFile: any, text: string, state: FileState | undefined = stateOf(modelFile)): void {
    if (state === undefined || state.shapePending === undefined) {
        return;
    }
    rust.checkAstShape(text);
    shapeCheckPassed(modelFile, text, state);
}

/**
 * The ModelFile constructor's staging step, split so the user files' path
 * is not trained on the system models.
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
 * `stageModelFile` for a fixed system model with an engine verdict: only the
 * header is needed. False with decorator factories; undefined without a verdict.
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
    // Shared and read-only; id 0, as nothing is staged.
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
 * The reused writer for `utf8Text`: a JS string crosses into WASM one UTF-16
 * unit at a time, so staging takes UTF-8 bytes, copied in one go.
 */
const utf8Writer = new WireWriter(64 * 1024);

/** `stageModelFileBytes`'s flags (concerto-wasm `STAGE_CHECKED`, `STAGE_COMPACT`). */
const STAGE_CHECKED = 1;

const STAGE_COMPACT = 2;

/** The UTF-8 bytes of `text`, in a buffer reused by the next call. */
function utf8Text(text: string): Uint8Array {
    return utf8Writer.utf8(text);
}

/**
 * Loads the AST into the manager's staging slot, once. True when the
 * ModelFile may be built lazily; on any other failure the caller builds it
 * eagerly, which throws the TS error itself. An AST the engine cannot read
 * at all with the check off is thrown here (`unreadableAst`), and a pending
 * shape check's error is thrown before any other.
 */
function stageLoadedModelFile(modelFile: any, checkedText?: CheckedAst): boolean {
    // BC-47: a BaseModelManager always has a rustHandle.
    const manager = modelFile.modelManager;
    const handle = manager.rustHandle;
    try {
        // BC-24: decorator factories keep the eager path.
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
        // A prestaged result is not loaded again, so it is checked on its own.
        if (checkedText !== undefined && prestage !== undefined) {
            completeShapeCheck(modelFile, astText(ast, checkedText), state);
        }
        if (prestage !== undefined) {
            takePrestaged(modelFile, handle, ast, prestage, state);
            state.lazy = true;
            return true;
        }
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
            // A verdict from an unchecked load does not vouch for the shape.
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
        // Staged, with its header read and any pending check folded in, in one call.
        const checked = state.shapePending !== undefined;
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
        if (checkedText !== undefined && stateOf(modelFile)?.shapePending !== undefined) {
            // The folded check's own error is thrown; after any other error, the
            // check runs now if it had not.
            if ((e as EngineErrorFlags | null)?.astShape) {
                throw e;
            }
            completeShapeCheck(modelFile, astText(modelFile.ast, checkedText));
        }
        return false;
    }
}

/**
 * The load step for a view of `source` (`ModelFile._sharedView`), which
 * shares its engine-side file and its AST (or an equal copy of it): records
 * the shared stage or committing handle, and `source`'s shape-check mark.
 * Lazy when `source` was or the manager has no decorator factories.
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
    const sourceState = stateOf(source);
    // The view's AST is `source`'s, or `filter`'s equal shallow copy of it.
    if (sourceState?.shapeChecked !== undefined && sourceState.shapeChecked === source.ast) {
        state.shapeChecked = modelFile.ast;
    }
    const factories = modelFile.modelManager.getDecoratorFactories();
    const lazy = sourceState?.lazy !== undefined || !(Array.isArray(factories) && factories.length > 0);
    if (lazy) {
        state.lazy = true;
    }
    return lazy;
}

/** Copies `source`'s recorded `getImports()` names to `modelFile`. */
function copyImportNames(modelFile: any, source: any): void {
    const names = recordedImportNames(source);
    if (names !== undefined) {
        recordImportNames(modelFile, names);
    }
}

/**
 * With decorator factories and the shape check off, reads the AST only to
 * throw `unreadableAst` for one the engine cannot read.
 */
function readUnchecked(modelFile: any, handle: any): void {
    const staged = JSON.parse(handle.stageModelFileBytes(utf8Text(JSON.stringify(modelFile.ast)),
        optionalString(modelFile.definitions), optionalString(modelFile.fileName), 0));
    handle.dropStagedModelFile(staged[0]);
}

/**
 * `ModelFile._fromAstHeader(ast)` from the staged header, without an engine
 * call. False, changing nothing, when there is no staged header.
 */
function applyStagedFileHeader(modelFile: any, ast: any, state: FileState | undefined = stateOf(modelFile)): boolean {
    const header = state?.stagedHeader;
    if (header === undefined) {
        return false;
    }
    state!.stagedHeader = undefined;
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
    const lazyViewsCheck = installedLazyViewsCheck();
    /* istanbul ignore if: the fuzz harness's hook (installLazyViewsCheck) */
    if (lazyViewsCheck) {
        lazyViewsCheck.stagedFileHeader(modelFile, ast);
        lazyViewsCheck.importNames(modelFile);
    }
    return true;
}

/** A result model's stage in a new manager's rustHandle, with its header. */
interface Prestage {
    handle: any;
    id: number;
    header: StagedHeader | undefined;
}

/** The stage of each DecoratorManager result model not yet built, by AST object. */
const prestaged = new WeakMap<object, Prestage>();

/**
 * Makes a prestaged AST's stage the ModelFile's own, as if `stageModelFile`
 * had just staged it.
 */
function takePrestaged(modelFile: any, handle: any, ast: any, prestage: Prestage, state: FileState): void {
    prestaged.delete(ast);
    const stage = { handle, id: prestage.id };
    state.stage = stage;
    stageFinalizer?.register(modelFile, stage, stage);
    if (prestage.header) {
        state.stagedHeader = prestage.header;
    }
}

/** `ModelFile._fromAstHeader`'s staged header. */
function applyStagedHeaders(modelFile: any, ast: any): boolean {
    return applyStagedFileHeader(modelFile, ast);
}


/**
 * `newModelManager.fromAst(ast, { disableValidation })` for a result the
 * engine staged (`staged[i]` is `[stageId, ...header]`), with the same files,
 * order and errors. Validation is skipped only when the engine `validated`
 * the result and every file was registered from its stage. With `trusted`
 * (BC-19), every model is engine-written, so the shape check is skipped.
 */
function adoptStagedModels(newModelManager: any, ast: any, staged: any[], validated: boolean, disableValidation?: boolean, trusted?: boolean): void {
    const { default: ModelFile } = modelFileModule();
    const handle = newModelManager.rustHandle;
    let allStaged = true;
    const models: any[] = ast.models;
    const built: any[] = [];
    try {
        models.forEach((model: any, i: number) => {
            if (excludedNamespaces().includes(model.namespace)) {
                return;
            }
            // Only the system models, skipped above, have no stage.
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
        // Registered in one call, in order, with `addModelFile`'s checks, as
        // `fromAst` adds them.
        newModelManager._addStagedModelFiles(built);
        allStaged = built.every((modelFile) => committedHandle(modelFile) === handle);
    } finally {
        // Drop any stage no ModelFile took.
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
    const state = stateOf(modelFile);
    return state === undefined ? undefined : takeStageOf(state, handle);
}

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
 * Registers `modelFile` in `handle` from its stage and returns its handle id.
 * Undefined when there is no usable stage; the caller then sends the AST.
 */
function commitStaged(modelFile: any, handle: any): number | undefined {
    const state = stateOf(modelFile);
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

/** The stage ids for `commitStagedAll`, overwritten with handle ids; reused to save garbage. */
let commitBuffer = new Uint32Array(64);

/**
 * `commitStaged` for several files in one call. Returns their handle ids (a
 * view valid until the next call), or undefined, changing nothing, when any
 * file has no usable stage or there are fewer than two.
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
        const state = stateOf(modelFiles[i]);
        const stage = state?.stage;
        if (!stage || stage.handle !== handle) {
            return undefined;
        }
        states[i] = state!;
        ids[i] = stage.id;
    }
    // Both callers reject an already-registered namespace, the only
    // registration error, so the call cannot fail part way.
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
 * `addModelFile`'s validation and registration of a staged file in one call;
 * undefined when there is no usable stage. A validation error is thrown as
 * `ModelFile.validate()` throws it; with `metamodel`, `validateAst`'s error
 * (`metamodelCheck`) is thrown unwrapped.
 */
function validateAndCommitStaged(modelFile: any, handle: any, metamodel?: boolean): number | undefined {
    const state = stateOf(modelFile);
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

/** Drops `modelFile`'s stage in `handle`. */
function dropStaged(modelFile: any, handle: any): void {
    const stage = takeStage(modelFile, handle);
    if (stage) {
        handle.dropStagedModelFile(stage.id);
    }
}

/**
 * `updateModelFile`'s write from `modelFile`'s stage; undefined when there is
 * no usable stage.
 */
function updateStaged(modelFile: any, handle: any): number | undefined {
    const state = stateOf(modelFile);
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

/** `validateAst` over the staged copy; false when there is no usable stage. */
function validateAstStaged(modelFile: any, handle: any): boolean {
    const stage = stateOf(modelFile)?.stage;
    if (!stage || stage.handle !== handle) {
        return false;
    }
    return handle.validateAstStaged(stage.id) === true;
}

/**
 * `updateExternalModels` from the downloaded files' stages; false, changing
 * nothing, unless every file is staged in `handle`. The stages are consumed
 * either way.
 */
function updateExternalStaged(modelFiles: any[], handle: any, next: object): boolean {
    const states: FileState[] = [];
    const ids: number[] = [];
    for (const modelFile of modelFiles) {
        const state = stateOf(modelFile);
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
 * `ModelFile.validate()` over the staged or registered file; false when
 * neither applies.
 */
function validateLoaded(modelFile: any, handle: any): boolean {
    const state = stateOf(modelFile);
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

export {
    adoptSharedView,
    adoptStagedModels,
    applyStagedFileHeader,
    applyStagedHeaders,
    checkAstShape,
    commitStaged,
    commitStagedAll,
    copyImportNames,
    dropStaged,
    markSystemModelAst,
    recordImportNames,
    recordedImportNames,
    stageModelFile,
    updateExternalStaged,
    updateStaged,
    validateAndCommitStaged,
    validateAstStaged,
    validateLoaded,
};
