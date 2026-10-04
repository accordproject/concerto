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

// The one route from public modules to the engine; every export is `@internal`.
// Bundler safety: no literal specifier and no named bare `require`.
// `module.require` first, so Node CJS never loads the ESM engine build.

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

/** The engine bindings (concerto-wasm), loaded with this module. @internal */
export const rust: EngineBindings = loadEngine('./engine').rust;

/** src/engine/views.ts. @internal */
export function engineViews(): EngineViewsModule {
    return engineModules['./engine/views'] ?? loadEngine('./engine/views');
}

/** src/engine/serializer.ts. @internal */
export function engineSerializer(): EngineSerializerModule {
    return engineModules['./engine/serializer'] ?? loadEngine('./engine/serializer');
}

/** src/engine/validate-resource.ts. @internal */
export function engineValidateResource(): EngineValidateResourceModule {
    return engineModules['./engine/validate-resource'] ?? loadEngine('./engine/validate-resource');
}

/** src/engine/validate-instance.ts. @internal */
export function engineValidateInstance(): EngineValidateInstanceModule {
    return engineModules['./engine/validate-instance'] ?? loadEngine('./engine/validate-instance');
}

/** src/engine/handles.ts. @internal */
export function engineHandles(): EngineHandlesModule {
    return engineModules['./engine/handles'] ?? loadEngine('./engine/handles');
}
