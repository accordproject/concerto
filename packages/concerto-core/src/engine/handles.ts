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
// Engine handle release (P5-97, accordproject/concerto-rust#448). P5-100
// (accordproject/concerto-rust#454) removed the P4-02 handle registry
// (`registryFor`, a module-level WeakMap by ModelManagerHandle) that no view
// ever used: per-manager state lives in `BaseModelManager._engine`.

/**
 * P5-97 (accordproject/concerto-rust#448): how many engine calls that call
 * back into user code (`ModelFile.filter`'s predicate) are running. While
 * one is, an engine handle it borrows cannot be freed: wasm-bindgen's
 * `free()` panics on a borrowed object.
 */
let callbackDepth = 0;

/**
 * Handles `releaseHandle` was asked to free while an engine call with
 * callbacks was running; freed when the outermost one returns.
 */
const pendingRelease: Array<{ free(): void }> = [];

/**
 * Frees `handle` (a concerto-wasm `ModelManagerHandle` the library created
 * for itself and holds no other reference to), so its engine memory is
 * released now rather than when the garbage collector runs its finalizer.
 * Internal only (the maintainer ruled out a public release API): the
 * library calls it for its own short-lived and replaced handles. Deferred
 * while an engine call that runs user code is on the stack
 * (`withEngineCallbacks`), since that call may borrow it; an error from
 * `free()` is ignored, as the finalizer would have freed it anyway.
 * @param {object} handle the handle
 */
function releaseHandle(handle: { free(): void } | undefined | null): void {
    if (!handle) {
        return;
    }
    if (callbackDepth > 0) {
        pendingRelease.push(handle);
        return;
    }
    freeQuietly(handle);
}

/**
 * `handle.free()`, ignoring any error.
 * @param {object} handle the handle
 */
function freeQuietly(handle: { free(): void }): void {
    try {
        handle.free();
    } catch (e) {
        // already freed, or still in use: the finalizer frees it
    }
}

/**
 * Runs `fn`, an engine call that calls back into user code, deferring every
 * `releaseHandle` made meanwhile until the outermost such call returns.
 * @param {Function} fn the engine call
 * @return {*} what `fn` returns
 */
function withEngineCallbacks<T>(fn: () => T): T {
    callbackDepth++;
    try {
        return fn();
    } finally {
        callbackDepth--;
        if (callbackDepth === 0 && pendingRelease.length > 0) {
            for (const handle of pendingRelease.splice(0)) {
                freeQuietly(handle);
            }
        }
    }
}

export { releaseHandle, withEngineCallbacks };
