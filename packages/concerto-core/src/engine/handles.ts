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
// Handle registry (P4-02; plan §3 target architecture): maps a live TS
// object (a ModelFile, Declaration or Property view) to its Rust handle —
// the arena's `ModelFileId`/`DeclId`/`PropId`, which the WASM binding
// (concerto-wasm ModelManagerHandle, P4-01) exposes to JS as a plain u32
// number. A handle keeps naming the same element for the life of the
// ModelManager (PORTING.md 1.4), so the registry is a stable map, one per
// ModelManagerHandle: two views built for the same handle are never
// confused, and a handle from the wrong manager is never looked up by
// accident. Views that hold a handle (P4-03 onward) register themselves here
// instead of inventing their own bookkeeping.

/**
 * One ModelManagerHandle's registry of live TS objects to their Rust
 * handles. Entries are held weakly, so a view that is garbage collected
 * drops out of the registry on its own.
 */
class HandleRegistry {
    private readonly handles = new WeakMap<object, number>();

    /**
     * Records that `view` is the live TS object for `handle`.
     * @param {object} view the ModelFile, Declaration or Property view
     * @param {number} handle its Rust handle (a plain u32 number)
     */
    register(view: object, handle: number): void {
        this.handles.set(view, handle);
    }

    /**
     * The Rust handle registered for a live TS object.
     * @param {object} view the view to look up
     * @return {number|undefined} its handle, or undefined if none is registered
     */
    handleOf(view: object): number | undefined {
        return this.handles.get(view);
    }
}

const registries = new WeakMap<object, HandleRegistry>();

/**
 * The handle registry for a ModelManagerHandle, created on first use.
 * `manager` is the opaque object the loader hands back for a ModelManager
 * (`rust.ts`); the registry lives exactly as long as that object does.
 * @param {object} manager the ModelManagerHandle to register views against
 * @return {HandleRegistry} its registry
 */
function registryFor(manager: object): HandleRegistry {
    let registry = registries.get(manager);
    if (!registry) {
        registry = new HandleRegistry();
        registries.set(manager, registry);
    }
    return registry;
}

export { HandleRegistry, registryFor };
