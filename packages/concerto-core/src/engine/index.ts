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
// The engine flag of the migration (P4-02; P0-04b trial scaffold).
//
// CONCERTO_ENGINE=ts (the default) or rust selects, once at load, whether the
// converted members run their TS body or delegate to the Rust engine. In ts
// mode `rust` is null and nothing else in src/engine/ is loaded, so ts mode
// behaves exactly as before. The whole directory is rust-mode code: it is
// excluded from coverage (`istanbul ignore file`) and from the declaration
// build (tsconfig.build.json), so neither the nyc gate nor the .d.ts snapshot
// moves (PORTING.md 1.5). It still ships, as JavaScript only with no .d.ts
// (OD-11): tsconfig.build.internal.json compiles it into dist/engine/, and
// scripts/build-esm.js builds it into dist/esm*/engine/ in a pass of its own,
// with the public modules it imports kept external, so the `require` calls
// here never put esbuild's `__require` shim into the public modules' shared
// chunks. The views load it through a non-literal `loadEngine`, so a ts-mode
// bundle of dist/ leaves it out.

import type { RustEngine } from './rust';

/**
 * Loads the Rust engine when CONCERTO_ENGINE=rust.
 * @return {RustEngine|null} the engine, or null in ts mode
 */
function selectEngine(): RustEngine | null {
    const env = typeof process === 'undefined' ? undefined : process.env;
    if (env?.CONCERTO_ENGINE !== 'rust') {
        return null;
    }
    return require('./rust').loadRustEngine();
}

const rust = selectEngine();

export { rust };
