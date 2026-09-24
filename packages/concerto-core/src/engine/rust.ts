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
// Loads the WASM engine for CONCERTO_ENGINE=rust (P4-02; P0-04b trial
// scaffold) and registers the host functions it calls back: the error factory
// and semver.parse.

import semver from 'semver';
import { makeError } from './errors';

/**
 * The bindings of the concerto-wasm module (concerto-rust concerto-wasm/src/lib.rs).
 * Only the three trial units are bound.
 */
export interface RustEngine {
    [binding: string]: (...args: any[]) => any;
}

/**
 * Loads the engine module (CONCERTO_ENGINE_MODULE, or the package
 * @accordproject/concerto-engine) and registers the host functions.
 * @return {RustEngine} the engine
 */
function loadRustEngine(): RustEngine {
    const env = typeof process === 'undefined' ? undefined : process.env;
    const name = env?.CONCERTO_ENGINE_MODULE || '@accordproject/concerto-engine';
    const engine = require(name) as RustEngine;
    engine.setHost(makeError, (version: string) => semver.parse(version));
    return engine;
}

export { loadRustEngine };
