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

// The engine loader. The public classes delegate their converted members to
// the Rust engine through this directory. It is left out of the declaration
// build (tsconfig.build.json), so the .d.ts snapshot does not see it, but it
// ships as JavaScript (dist/engine/, and dist/esm*/engine/ in an esbuild pass
// of its own so its `require` calls stay out of the public chunks). The
// public modules load it through a non-literal specifier
// (src/engineloader.ts), so a bundle of dist/ leaves it out unless something
// calls in.
//
// Boundary placement rule: a crossing costs more than a small amount of
// work, so per-item pure work over data TypeScript already holds (a predicate
// over a `$class`, a type name, a primitive value) runs in TypeScript with
// the engine's semantics. Work that needs engine state or many crossings is
// batched or snapshotted: one call per file, document or walk
// (`modelFileViewSnapshot`, `serializerFromJsonCompact`,
// `classDeclarationGetIdentifierFieldNameWalk`), cached for as long as it
// holds (`EngineState`, keyed on the manager's model version). Data the
// engine already holds is referred to by id, not sent again. This is a
// costing rule for crossings, not a rule against porting logic to Rust.

import type { RustEngine } from './rust';

/** Loads the Rust engine. */
function selectEngine(): RustEngine {
    return require('./rust').loadRustEngine();
}

const rust = selectEngine();

export { rust };
