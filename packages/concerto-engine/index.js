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

// @accordproject/concerto-engine, linked locally (decision D9: not
// published): re-exports the CommonJS loader that concerto-rust's
// concerto-wasm/build.sh writes, from a concerto-rust checkout next to this
// one. See README.md.

const path = require('path');

const loader = path.resolve(__dirname, '../../../concerto-rust/concerto-wasm/pkg/concerto-engine.cjs');

try {
    module.exports = require(loader);
} catch (err) {
    if (err && err.code === 'MODULE_NOT_FOUND' && err.message.includes(loader)) {
        throw new Error(`@accordproject/concerto-engine: ${loader} not found. Build it with \`sh concerto-wasm/build.sh\` in a concerto-rust checkout next to this one, or set CONCERTO_ENGINE_MODULE.`);
    }
    throw err;
}
