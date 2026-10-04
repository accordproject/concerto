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

// Engine handle release.

/**
 * How many engine calls that call back into user code are running; a handle
 * they borrow cannot be freed (wasm-bindgen's `free()` panics).
 */
let callbackDepth = 0;

/** Handles whose release waits for the outermost callback call to return. */
const pendingRelease: Array<{ free(): void }> = [];

/**
 * Frees a `ModelManagerHandle` the library alone holds, now rather than at
 * finalization; deferred while a callback call may borrow it. Internal only.
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

/** Runs `fn`, deferring every `releaseHandle` until the outermost such call returns. */
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
