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
// published): re-exports the ESM loader that concerto-rust's
// concerto-wasm/build.sh writes, from a concerto-rust checkout next to this
// one. See README.md.

export * from '../../../concerto-rust/concerto-wasm/pkg/concerto-engine.mjs';
