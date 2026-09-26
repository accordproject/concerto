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
 * Global chai set-up for per-file unit runs.
 *
 * In the normal single-process suite, mocha loads every test file before
 * running any test, so `chai.should()` and the chai plugins that some files
 * install are in effect for all files. When the recorder runs each file in
 * its own process, files that rely on that (e.g. test/introspect/
 * mapdeclaration.js) need the same global state; this reproduces it.
 */

const path = require('path');
const { CORE_PKG_DIR } = require('../lib/core');

const req = (m) => require(require.resolve(m, { paths: [CORE_PKG_DIR] }));
const chai = req('chai');
chai.should();
chai.use(req('chai-things'));
chai.use(req('chai-as-promised'));
module.exports = { root: path.resolve(CORE_PKG_DIR) };
