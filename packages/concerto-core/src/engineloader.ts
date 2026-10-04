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

// The one loader the public modules reach the engine (src/engine/) through.
//
// dist/, dist/esm and dist/esm-browser ship src/engine/ as JavaScript only,
// with no .d.ts, since it is not public API (tsconfig.build.internal.json).
// A bundler must never see a specifier it would resolve: `require` below
// takes a non-literal one (esbuild, rollup and browserify leave it alone)
// and never names the bare `require` (esbuild's ESM output would add its
// `__require` shim, which webpack reports as a critical dependency), and
// webpack folds the `typeof __webpack_require__` test and keeps only the
// dead-in-Node `__non_webpack_require__` branch, so it neither resolves nor
// warns.
//
// The specifiers are relative to this file, which sits next to engine/ in
// src/ and in dist/. Through the public ESM entry points (PORTING.md 1.5),
// Node ESM (dist/esm/index.mjs) works unaided: scripts/build-esm.js's Node
// banner sets a `globalThis.module` whose `require` rewrites `./engine` and
// `./engine/<subpath>` to the engine directory it finds at runtime from the
// chunk's own import.meta.url. The browser (dist/esm-browser/index.mjs)
// needs a bundler, or a host that supplies a synchronous `require`
// (scripts/browser-module-shim.js).
//
// `module.require` is checked before `globalThis.module.require` so that
// real Node CJS always resolves through its own require (the Node-ESM banner
// sets `globalThis.module` whenever it finds it undefined, so a process that
// imports dist/esm/index.mjs and later requires dist/index.js must not load
// the ESM engine build). A module context that gives every file a `module`
// with no `.require` (Vitest's vite-node) falls through to
// `globalThis.module.require`; `createRequire(__filename)` is the last
// resort, for a context with neither.
//
// Every engine module is required once, on first use, and kept: a call site
// on a per-element path never pays a module resolution again.
//
// Nothing here is exported from index.ts, and every export is `@internal`,
// so the declaration build (`stripInternal`) emits no type from it.

import { createRequire } from 'module';
import type {
    EngineBindings, EngineHandlesModule, EngineSerializerModule,
    EngineValidateInstanceModule, EngineValidateResourceModule, EngineViewsModule,
} from './engine/bindings';
declare const __webpack_require__: unknown;
declare const __non_webpack_require__: NodeRequire;

const engineModules: { [specifier: string]: any } = {};

/**
 * Requires an engine module, once.
 * @param {string} specifier its path, relative to this file (`./engine...`)
 * @return {*} the module
 * @internal
 */
/* istanbul ignore next: the bundler and ESM branches never run under Node's CommonJS require, where the suite runs */
function loadEngine(specifier: string): any {
    return engineModules[specifier] ??
        (engineModules[specifier] =
            typeof __webpack_require__ === 'function' ? __non_webpack_require__(specifier)
                : typeof module !== 'undefined' && typeof module.require === 'function' ? module.require(specifier)
                    : typeof (globalThis as any).module?.require === 'function' ? (globalThis as any).module.require(specifier)
                        : createRequire(__filename)(specifier));
}

/**
 * The engine bindings (concerto-wasm), loaded with this module.
 * @internal
 */
export const rust: EngineBindings = loadEngine('./engine').rust;

/**
 * src/engine/views.ts.
 * @return {object} the module
 * @internal
 */
export function engineViews(): EngineViewsModule {
    return engineModules['./engine/views'] ?? loadEngine('./engine/views');
}

/**
 * src/engine/serializer.ts.
 * @return {object} the module
 * @internal
 */
export function engineSerializer(): EngineSerializerModule {
    return engineModules['./engine/serializer'] ?? loadEngine('./engine/serializer');
}

/**
 * src/engine/validate-resource.ts.
 * @return {object} the module
 * @internal
 */
export function engineValidateResource(): EngineValidateResourceModule {
    return engineModules['./engine/validate-resource'] ?? loadEngine('./engine/validate-resource');
}

/**
 * src/engine/validate-instance.ts.
 * @return {object} the module
 * @internal
 */
export function engineValidateInstance(): EngineValidateInstanceModule {
    return engineModules['./engine/validate-instance'] ?? loadEngine('./engine/validate-instance');
}

/**
 * src/engine/handles.ts.
 * @return {object} the module
 * @internal
 */
export function engineHandles(): EngineHandlesModule {
    return engineModules['./engine/handles'] ?? loadEngine('./engine/handles');
}
