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

/*
 * Injected into concerto-core's browser ESM build (see scripts/build-esm.js)
 * to bind the free `module` identifier the rust-mode views read in
 * `loadEngine`: `module.require(specifier)` (modelutil.ts, introspect/*.ts;
 * P4-11a, PORTING.md 1.5, OD-11). That call is a property read on a free
 * identifier, never a literal `require(...)`, so esbuild's ESM output never
 * gets a `require` call to shim with `__require`.
 *
 * Browser rust mode needs a bundler, or a host that supplies a synchronous
 * `require`. The views load the engine synchronously, and a browser cannot
 * load an ES module synchronously, so this build does NOT load
 * dist/esm-browser/engine/*.mjs by itself. This shim only forwards to the
 * `globalThis.module` that the bundler or host provides. That `require` must
 * resolve './engine', '../engine' and '../engine/<subpath>' to the matching
 * dist/esm-browser/engine/*.mjs module. It must also resolve the engine's own
 * `require`s, such as '@accordproject/concerto-engine' in src/engine/rust.ts,
 * the same way. e2e/tests/wasm-engine.spec.ts stands in for that bundler.
 * Node ESM (dist/esm/index.mjs) needs none of this: its build banner
 * resolves the engine itself.
 *
 * The shim reads `globalThis.module` once, when this build first imports it,
 * so the bundler or host must set it before importing concerto-core. Nothing
 * in the default (CONCERTO_ENGINE=ts) mode reads `module` at all, so a page
 * that never sets rust mode never calls the fallback.
 */

const globals = typeof globalThis !== 'undefined' ? globalThis : {};

const fallback = {
    /**
     * Stand-in for CommonJS `module.require` in a browser with none.
     *
     * @param {string} specifier - the module specifier rust mode wants
     * @return {never} never returns; always throws
     */
    require(specifier) {
        throw new Error(
            `Cannot load "${specifier}": CONCERTO_ENGINE=rust in a browser needs a bundler, or a host ` +
            'that supplies a synchronous require; the browser ESM build cannot load the engine by ' +
            'itself. Bundle concerto-core, or set globalThis.module = { require: ... } before ' +
            'importing it (see e2e/tests/wasm-engine.spec.ts).'
        );
    },
};

export const module = globals.module || fallback;
