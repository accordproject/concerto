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

// The construction snapshots of one ModelFile's declarations and properties
// (`Batch`), computed in one engine call before its views are built, and
// the batch the views under construction read.

import { rust } from './index';
import { fileStates } from './views-state';

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

/** The current batch, whichever file's it is, for the construction views. */
function currentBatch(): Batch | null {
    return batch;
}

/** The current batch, when it holds the snapshots of `modelFile`. */
function batchOf(modelFile: any): Batch | null {
    return batch && batch.modelFile === modelFile ? batch : null;
}

export {
    batchOf,
    beginModelFile,
    computeBatch,
    currentBatch,
    endModelFile,
    withBatch,
};

export type {
    Batch,
    PrecomputedDeclaration,
    PrecomputedProperty,
};
