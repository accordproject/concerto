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
 * Forwarding note (accordproject/concerto-rust#252): the core loader moved to
 * packages/concerto-core/test-lifted/lib/core.js, next to the lifted checks
 * that use it. This file only re-exports it, so the oracle (recorder,
 * drivers, adapters) keeps working until migration/ is removed. Edit the
 * moved file, not this one.
 */

const path = require('path');

const moved = require(path.resolve(__dirname, '..', '..', '..', 'packages', 'concerto-core', 'test-lifted', 'lib', 'core'));

module.exports = { ...moved, ORACLE_DIR: path.resolve(__dirname, '..') };
