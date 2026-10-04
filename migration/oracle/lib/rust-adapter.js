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

'use strict';

/**
 * The Rust/WASM engine adapter (PORTING.md 6.2, "Through WASM").
 *
 *   CONCERTO_ENGINE_MODULE=<concerto-rust>/concerto-wasm/pkg/concerto-engine.cjs \
 *     node migration/oracle/bin/replay.js --engine migration/oracle/lib/rust-adapter.js --op ModelUtil.getShortName
 *
 * It runs the workspace src/ (ts-node) with CONCERTO_ENGINE=rust, so every
 * converted member delegates to the WASM engine through its view, and the
 * rest of concerto-core stays TS. The fixtures are replayed through the same
 * public API as the reference adapter, so an op passes only if the view, the
 * binding and the Rust port together reproduce the recorded outcome.
 *
 * P0-04b trial scaffold: P4-02 owns the engine adapters.
 */

const { coreAdapter } = require('./adapter');

/**
 * @returns {object} adapter
 */
function createAdapter() {
    if (!process.env.CONCERTO_ENGINE_MODULE) {
        throw new Error('rust-adapter: set CONCERTO_ENGINE_MODULE to the built concerto-engine.cjs');
    }
    // The flag is read once, when concerto-core's modules load.
    process.env.CONCERTO_ENGINE = 'rust';
    const { getSrcCore } = require('./core');
    return coreAdapter(getSrcCore(), 'rust-wasm');
}

module.exports = { createAdapter };
