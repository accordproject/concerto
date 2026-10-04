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

// The per-ModelFile state of the lazy load path (`FileState`), kept by
// ModelFile object. Its readers and writers are the other views modules.

import type { Batch } from './views-batch';

/** The per-ModelFile state of the lazy load path; an absent field is `undefined`. */
interface FileState {
    /** The staged load, until it is committed or dropped. */
    stage: Stage | undefined;
    /** The staged header, until `applyStagedFileHeader` applies it. */
    stagedHeader: StagedHeader | undefined;
    /** `getImports()` names, with the `imports` array and length they were recorded for. */
    importNames: string[] | undefined;
    importNamesFor: any[] | undefined;
    importNamesLength: number | undefined;
    /**
     * Set for a lazily built ModelFile. Its manager had no decorator factories
     * at construction, so none applies to its elements.
     */
    lazy: true | undefined;
    /** BC-19: the AST that passed `checkAstShape`, or was engine-written (`trustedAst`). */
    shapeChecked: object | undefined;
    /** BC-19: the shape check is pending, folded into `stageModelFileBytes`. */
    shapePending: true | undefined;
    deferred: DeferredFile | undefined;
    /** The rustHandle the ModelFile was registered in from its stage. */
    committed: object | undefined;
    /**
     * R2A-4: set for a view of a file `ModelFile.filter` kept whole, whose
     * `getAst()` is TS 5.0.0's filtered form (`filteredViewAst`), built on
     * the first read and kept in `ast`. A fork's view of it shares it.
     */
    filteredAst: { ast: object | undefined } | undefined;
}

const fileStates = new WeakMap<object, FileState>();

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
            filteredAst: undefined,
        };
        fileStates.set(modelFile, state);
    }
    return state;
}

/** A staged load: the rustHandle and its stage id. */
interface Stage {
    handle: any;
    id: number;
}

/** The rustHandle `modelFile` was registered in from its stage, or undefined. */
function committedHandle(modelFile: any): object | undefined {
    return fileStates.get(modelFile)?.committed;
}

/**
 * `modelFile`'s state, or undefined when it has none: for the staging and
 * lazy-parts modules, which own its fields. The other views read it through
 * the accessors below.
 */
function stateOf(modelFile: object): FileState | undefined {
    return fileStates.get(modelFile);
}

/** `modelFile`'s staged load, until it is committed or dropped. */
function stageOf(modelFile: object): Stage | undefined {
    return fileStates.get(modelFile)?.stage;
}

/** `modelFile`'s deferred declaration views, while it has some. */
function deferredOf(modelFile: object): DeferredFile | undefined {
    return fileStates.get(modelFile)?.deferred;
}

/** Whether `modelFile` is lazily built. */
function isLazy(modelFile: object): boolean {
    return fileStates.get(modelFile)?.lazy !== undefined;
}

/** BC-19: whether the AST `modelFile` holds now passed the shape check. */
function isShapeChecked(modelFile: any): boolean {
    return fileStates.get(modelFile)?.shapeChecked === modelFile.ast;
}

/**
 * The header the engine read when staging, flat: `[id, namespace, version,
 * system, n, key_1, name_1, ..., key_n, name_n, uriKey_1, uri_1, ...]`. The
 * `n` pairs are the `importShortNames` entries without the implicit system
 * import's five (`IMPLICIT_SHORT_NAMES`); the pairs after them are
 * `importUriMap`. A fixed system model's header has id 0.
 */
type StagedHeader = any[];

/** A lazy file whose declaration views are not all built. */
interface DeferredFile {
    /**
     * Each declaration's index by `localTypes` key, null when a declaration
     * cannot be indexed, undefined until needed.
     */
    byName: Map<string, number> | null | undefined;
    /** The declaration views built on their own, by index, with their AST node. */
    built: Map<number, { node: any; view: any }> | undefined;
    building: boolean;
    batch: Batch | null | undefined;
}

export {
    committedHandle,
    deferredOf,
    fileState,
    isLazy,
    isShapeChecked,
    stageOf,
    stateOf,
};

export type {
    DeferredFile,
    FileState,
    Stage,
    StagedHeader,
};
