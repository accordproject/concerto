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

// The engine loader. This directory is left out of the declaration build,
// but ships as JavaScript (dist/engine/, and its own esbuild pass under
// dist/esm*/engine/). The public modules load it through a non-literal
// specifier (src/engineloader.ts), so a bundle leaves it out unless called.
//
// Boundary rule: per-item pure work over data TypeScript already holds runs
// in TypeScript with the engine's semantics. Work that needs engine state or
// many crossings is batched to one call per file, document or walk, cached
// per model version (`EngineState`); data the engine holds is referred to
// by id. This costs crossings; it is not a rule against porting to Rust.

import type { RustEngine } from './rust';

/** Loads the Rust engine. */
function selectEngine(): RustEngine {
    return require('./rust').loadRustEngine();
}

const rust = selectEngine();

export { rust };
