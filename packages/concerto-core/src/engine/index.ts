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
// The engine loader (P4-02; P5-02 removed the CONCERTO_ENGINE=ts|rust flag:
// the Rust engine is now the only path).
//
// The converted members always delegate to the Rust engine; nothing in
// concerto-core runs a TS body for them any more. The whole directory is
// rust-mode code: it is excluded from the declaration build
// (tsconfig.build.json), so the .d.ts snapshot does not move (PORTING.md
// 1.5), and since P5-103 it counts towards the nyc gate like the rest of
// src/ (accordproject/concerto-rust#457). It still ships, as
// JavaScript only with no .d.ts (OD-11): tsconfig.build.internal.json
// compiles it into dist/engine/, and scripts/build-esm.js builds it into
// dist/esm*/engine/ in a pass of its own, with the public modules it imports
// kept external, so the `require` calls here never put esbuild's `__require`
// shim into the public modules' shared chunks. The public modules load it
// through a non-literal specifier (src/engineloader.ts, P5-100), so a bundle
// of dist/ leaves it out unless something actually calls in.
//
// Boundary placement rule (P5-100, M2; accordproject/concerto-rust#454). A
// call from TypeScript into the engine costs more than a small amount of
// work, so concerto-core does not cross the boundary for per-item pure work
// over data TypeScript already holds: a predicate or a string operation over
// a value the view already has (a declaration's `$class`, a type name, a
// primitive field value) runs in TypeScript, with the engine's semantics,
// and the Rust function stays for the engine's own use. Work that needs the
// engine's state, or that would take many crossings, is batched or
// snapshotted instead: one call answers for a whole file, document or walk
// (`modelFileViewSnapshot`, `serializerFromJsonCompact`,
// `classDeclarationGetIdentifierFieldNameWalk`), and its answer is kept for
// as long as it holds (`EngineState` in `bindings.d.ts`, keyed on the
// manager's model version). Data the engine already holds is not sent back
// to it: a staged or loaded model file is referred to by its id, and its AST
// is sent only where the engine no longer holds it. This is a placement rule for crossings, not a rule against porting
// logic to Rust.

import type { RustEngine } from './rust';

/**
 * Loads the Rust engine.
 * @return {RustEngine} the engine
 */
function selectEngine(): RustEngine {
    return require('./rust').loadRustEngine();
}

const rust = selectEngine();

export { rust };
