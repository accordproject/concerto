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

// Loads the WASM engine and registers the one host function it calls back:
// the error factory.

import { makeError } from './errors';
import type { EngineBindings, EngineInternals } from './bindings';

/**
 * The concerto-wasm bindings: those the public classes call
 * (`EngineBindings`) and those only src/engine/ calls (`EngineInternals`).
 */
export type RustEngine = EngineBindings & EngineInternals;

/**
 * Loads the engine module (CONCERTO_ENGINE_MODULE, or the package
 * @accordproject/concerto-engine) and registers the host functions.
 */
function loadRustEngine(): RustEngine {
    const env = typeof process === 'undefined' ? undefined : process.env;
    const name = env?.CONCERTO_ENGINE_MODULE || '@accordproject/concerto-engine';
    const engine = require(name) as RustEngine;
    engine.setHost(makeError);
    return engine;
}

export { loadRustEngine };
