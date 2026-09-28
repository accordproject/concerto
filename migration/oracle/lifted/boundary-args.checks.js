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
 * P5-03 #262 lifted checks: non-string arguments to the members whose
 * catch-all fallback #262 removed.
 *
 * The WASM bindings behind `BaseModelManager.getModelFileByFileName`,
 * `derivesFrom`, `resolveType` and `ModelFile.isLocalType` take `&str` or
 * `Option<String>`. A JS number, object or boolean passed to one of them
 * traps the engine (`RuntimeError: memory access out of bounds`), and a JS
 * null becomes `None`. The catch-all used to hide this by running the TS
 * body; with it gone, each wrapper sends only a string (or `undefined`,
 * where the binding takes `Option<String>`) to Rust and runs the TS body
 * for any other argument. `expect` is the frozen v5.0.0 reference's
 * outcome. Run by fallbacks.spec.js.
 */

const ODD = { undefined: undefined, null: null, number: 123, object: {}, boolean: true };

/**
 * A manager holding `test@1.0.0` (no file name; `A`, and `B extends A`) and
 * `n@1.0.0` (file name `x.cto`, importing `A`).
 * @param {object} core the core under test
 * @returns {object} the ModelManager
 */
function manager(core) {
    const mm = new core.ModelManager({ strict: true });
    mm.addCTOModel('namespace test@1.0.0\nconcept A{}\nconcept B extends A{}');
    mm.addCTOModel('namespace n@1.0.0\nimport test@1.0.0.{A}\nconcept C{}', 'x.cto');
    return mm;
}

/**
 * A ModelFile (or a missing one) as a comparable value.
 * @param {object} mf the ModelFile or undefined
 * @returns {string} its namespace, or '<none>'
 */
function ns(mf) {
    return mf ? mf.getNamespace() : '<none>';
}

const CALLS = {
    'getModelFileByFileName(x)': (core, x) => ns(manager(core).getModelFileByFileName(x)),
    'derivesFrom(x, A)': (core, x) => manager(core).derivesFrom(x, 'test@1.0.0.A'),
    'derivesFrom(B, x)': (core, x) => manager(core).derivesFrom('test@1.0.0.B', x),
    'resolveType(n, x)': (core, x) => manager(core).resolveType('n@1.0.0', x),
    'resolveType(x, A)': (core, x) => manager(core).resolveType(x, 'A'),
    'isLocalType(x)': (core, x) => manager(core).getModelFile('n@1.0.0').isLocalType(x),
};

const EXPECT = require('./boundary-args.expect.json');

const checks = [];
let n = 0;
for (const [call, run] of Object.entries(CALLS)) {
    for (const [kind, value] of Object.entries(ODD)) {
        n++;
        const id = `BOUNDARY-ARG-${String(n).padStart(3, '0')}`;
        checks.push({
            id,
            covers: `${call.replace('x', kind)}`,
            run: (core) => run(core, value),
            expect: EXPECT[id],
        });
    }
}

module.exports = checks;
