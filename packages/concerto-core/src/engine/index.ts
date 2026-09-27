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
// rust-mode code: it is excluded from coverage (`istanbul ignore file`) and
// from the declaration build (tsconfig.build.json), so neither the nyc gate
// nor the .d.ts snapshot moves (PORTING.md 1.5). It still ships, as
// JavaScript only with no .d.ts (OD-11): tsconfig.build.internal.json
// compiles it into dist/engine/, and scripts/build-esm.js builds it into
// dist/esm*/engine/ in a pass of its own, with the public modules it imports
// kept external, so the `require` calls here never put esbuild's `__require`
// shim into the public modules' shared chunks. The views load it through a
// non-literal `loadEngine`, so a bundle of dist/ leaves it out unless
// something actually calls in.

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
