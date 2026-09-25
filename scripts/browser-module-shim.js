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
 * Injected into the browser ESM build (see scripts/build-esm.js) to bind the
 * free `module` identifier the rust-mode views read: `module.require(specifier)`
 * (modelutil.ts, introspect/numbervalidator.ts, introspect/scalardeclaration.ts;
 * P4-11a, PORTING.md 1.5, OD-11). That call is a property read on a free
 * identifier, never a literal `require(...)`, so it never gives esbuild's ESM
 * output a `require` call to shim with `__require` — but it does need a
 * `module` to read `.require` off, and a browser has neither Node's `module`
 * object nor anything to build one from (no `require`, no `createRequire`).
 *
 * The shim defers to a real `globalThis.module` whenever the page has one — a
 * downstream bundler's own CommonJS interop, or a test harness standing in for
 * one (e2e/tests/wasm-engine.spec.ts) — exactly the same contract
 * src/engine/rust.ts already relies on for its own bare
 * `require('@accordproject/concerto-engine')` in this build. Nothing in the
 * default (CONCERTO_ENGINE=ts) mode reads `module` at all, so a page that
 * never sets rust mode never calls the fallback.
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
            `Cannot load "${specifier}": CONCERTO_ENGINE=rust through the browser ESM graph needs a ` +
            'CommonJS-style require, which this page does not provide. Set globalThis.module = ' +
            '{ require: ... } before importing this module (see e2e/tests/wasm-engine.spec.ts), or ' +
            'load it through a bundler that resolves module.require itself.'
        );
    },
};

export const module = globals.module || fallback;
