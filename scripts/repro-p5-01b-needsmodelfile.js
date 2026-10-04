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
 * P5-01b (accordproject/concerto-rust#233) repro.
 *
 * ModelFile.validate()'s rustHandle branch (src/introspect/modelfile.ts)
 * must not attach `this` to an IllegalModelException the engine itself
 * never attaches a file to in TS -- the duplicate-class-name scan
 * ("Duplicate class name <fqn>", thrown with no second constructor argument
 * at all) -- while still attaching one to the general case (every other
 * check ModelFile.validate() runs, e.g. an unresolved super type). Before
 * concerto 45a9cb8cf / concerto-rust 9ab8455, rust mode could not tell the
 * two apart: modelFileValidateDetached (the binding this branch calls) has
 * no JS ModelFile to attach either way, so both cases threw with the same
 * (absent) file name, and the branch's `e.getFileName() !== this.getName()`
 * check re-wrapped both -- wrongly adding a "File '<name>': " prefix TS
 * itself never puts on the duplicate-class-name message.
 *
 * Runs against the engine mode already selected by CONCERTO_ENGINE (ts, the
 * default, or rust) when this process started -- the flag is read once, at
 * module load (src/engine/index.ts) -- so a full check runs this script
 * twice:
 *
 *   node scripts/repro-p5-01b-needsmodelfile.js
 *   CONCERTO_ENGINE=rust node scripts/repro-p5-01b-needsmodelfile.js
 *
 * The rust run needs a built @accordproject/concerto-engine: `sh
 * concerto-wasm/build.sh` in a concerto-rust checkout linked at
 * packages/concerto-engine (see that package's README), or set
 * CONCERTO_ENGINE_MODULE to point at a built concerto-engine.cjs directly.
 *
 * Both runs assert the identical outcome: this is a same-engine-either-way
 * regression check, not a TS-vs-rust comparison (the oracle already covers
 * that, at much greater scale -- see the op-scoped `replay.js` commands in
 * the PR/commit description).
 */

const assert = require('assert');
const { getSrcCore } = require('../migration/oracle/lib/core.js');

const core = getSrcCore();
const { ModelManager } = core;
const { IllegalModelException } = core.req('introspect/illegalmodelexception');

const engine = process.env.CONCERTO_ENGINE === 'rust' ? 'rust' : 'ts';
const checks = [];

/**
 * Register a named check.
 * @param {string} name what the check covers
 * @param {Function} fn the check body; throws to fail
 */
function check(name, fn) {
    checks.push([name, fn]);
}

check('a duplicate class name gets no file, matching TS exactly', () => {
    const modelManager = new ModelManager();
    const cto = `namespace org.example@1.0.0
concept Person {
  o String name
}
concept Person {
  o String name
}`;
    let caught;
    try {
        modelManager.addCTOModel(cto, 'dup.cto');
    } catch (e) {
        caught = e;
    }
    assert.ok(caught instanceof IllegalModelException, `expected an IllegalModelException, got ${caught}`);
    assert.strictEqual(caught.getShortMessage(), 'Duplicate class name org.example@1.0.0.Person', `message: ${caught.message}`);
    assert.strictEqual(caught.getFileName(), null, `getFileName(): ${caught.getFileName()}`);
    assert.ok(!caught.message.includes("File '"), `message wrongly carries a file prefix: ${caught.message}`);
});

check('an unresolved super type still gets the file, as TS always did', () => {
    const modelManager = new ModelManager();
    const cto = `namespace org.example@1.0.0
concept Orphan extends Ghost {
}`;
    let caught;
    try {
        modelManager.addCTOModel(cto, 'broken.cto');
    } catch (e) {
        caught = e;
    }
    assert.ok(caught instanceof IllegalModelException, `expected an IllegalModelException, got ${caught}`);
    assert.strictEqual(caught.getFileName(), 'broken.cto', `getFileName(): ${caught.getFileName()}`);
    assert.ok(caught.message.includes("File 'broken.cto':"), `message missing its file prefix: ${caught.message}`);
});

let failures = 0;
for (const [name, fn] of checks) {
    try {
        fn();
        console.log(`ok   [${engine}] ${name}`);
    } catch (err) {
        failures++;
        console.error(`FAIL [${engine}] ${name}\n     ${err.message}`);
    }
}

if (failures > 0) {
    console.error(`\n${failures} of ${checks.length} P5-01b repro checks failed (engine=${engine})`);
    process.exit(1);
}
console.log(`\n${checks.length} P5-01b repro checks passed (engine=${engine})`);
