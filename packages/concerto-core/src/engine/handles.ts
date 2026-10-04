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

// Engine handle release. Per-manager state lives in
// `BaseModelManager._engine`.

/**
 * How many engine calls that call back into user code
 * (`ModelFile.filter`'s predicate) are running. While one is, an engine
 * handle it borrows cannot be freed: wasm-bindgen's `free()` panics on a
 * borrowed object.
 */
let callbackDepth = 0;

/**
 * Handles `releaseHandle` was asked to free while an engine call with
 * callbacks was running; freed when the outermost one returns.
 */
const pendingRelease: Array<{ free(): void }> = [];

/**
 * Frees `handle`, a `ModelManagerHandle` the library created for itself and
 * holds no other reference to, now rather than at finalization. Internal
 * only: there is no public release API. Deferred while an engine call that
 * runs user code is on the stack (`withEngineCallbacks`), since that call
 * may borrow it; an error from `free()` is ignored.
 */
function releaseHandle(handle: { free(): void }): void {
    if (callbackDepth > 0) {
        pendingRelease.push(handle);
        return;
    }
    freeQuietly(handle);
}

/** `handle.free()`, ignoring any error. */
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
