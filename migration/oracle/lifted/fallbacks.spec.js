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
 * Lifted behavioural checks for the TS fallbacks that stay after P5-02
 * (task P5-02b, accordproject/concerto-rust#251; the P2-10 pattern).
 *
 * P5-02 made the Rust engine the only path. A few TS bodies stay as
 * fallbacks (PORTING.md 1.5 / D7): the visitor path behind
 * `EngineFastPathUnsupported` in the serializer (the caller-supplied custom
 * `regExp` in `StringValidator` was one until P5-52, BC-28, made the option
 * ignored), and the TS bodies for a model file
 * detached from its manager (P5-35, BC-47, removed the collaborator
 * fallback for managers that are not engine-backed). The frozen unit suite
 * (packages/concerto-core/test/**, which is never edited) no longer reaches
 * most of them, so each `*.checks.js` file in this directory drives them
 * through the public API instead.
 *
 * Every check is `{ id, covers, run(core), expect }`:
 * - `run(core)` uses only the public classes on `core` (see
 *   migration/oracle/lib/core.js `loadCore`) and returns plain data;
 * - `expect` is the outcome the frozen v5.0.0 reference gives, either
 *   `{ ok: <value> }` or `{ throws: { name, message } }`;
 * - `reference`, only on a check that covers an intended breaking change
 *   (a BREAKING-CHANGES-PLAN.md row, e.g. P5-24's strict `DateTime`, BC-07),
 *   is what v5.0.0 gives instead: `expect` is then the workspace outcome.
 *
 * Each check runs twice: against the workspace `src/` (this is what
 * counts towards concerto-core's nyc gate: packages/concerto-core's `test`
 * script and migration/bin/status.mjs add this spec to the suite), and
 * against the reference (migration/oracle/reference, `npm ci` there),
 * which confirms `expect` is what v5.0.0 does. The reference run is skipped
 * (pending) when the reference is not installed.
 *
 * Unlike drivers/lifted.spec.js this never records fixtures: it asserts.
 * No file here is named `*.scenarios.js`, so the recorder never sees them.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { getSrcCore, getRefCore, REF_PKG_DIR } = require('../lib/core');

const LIFTED_DIR = __dirname;

/**
 * JSON-safe copy of a check's return value, so src and the reference can
 * be compared structurally (and `undefined` survives inside arrays).
 * @param {*} v the value
 * @returns {*} a plain copy
 */
function plain(v) {
    if (v === undefined) {
        return '<undefined>';
    }
    return JSON.parse(JSON.stringify(v, (k, x) => (x === undefined ? '<undefined>' : x)));
}

/**
 * The outcome of `run(core)`: its value, or the error it threw.
 * @param {Function} run the check body
 * @param {object} core a loaded core
 * @returns {object} `{ ok }` or `{ throws: { name, message } }`
 */
function outcome(run, core) {
    try {
        return { ok: plain(run(core)) };
    } catch (e) {
        return { throws: { name: e && e.constructor ? e.constructor.name : typeof e, message: e && e.message } };
    }
}

/**
 * The outcome of an `async` check's `run(core)`, whose promise settles with
 * its value or rejects with the error it threw (P5-11,
 * accordproject/concerto-rust#287: `updateExternalModels` is async).
 * @param {Function} run the check body, returning a promise
 * @param {object} core a loaded core
 * @returns {Promise<object>} `{ ok }` or `{ throws: { name, message } }`
 */
async function settle(run, core) {
    try {
        return { ok: plain(await run(core)) };
    } catch (e) {
        return { throws: { name: e && e.constructor ? e.constructor.name : typeof e, message: e && e.message } };
    }
}

/**
 * The outcome of a check against `core`: `settle` for an `async` check,
 * `outcome` for any other.
 * @param {object} check the check
 * @param {object} core a loaded core
 * @returns {Promise<object>} the outcome
 */
async function outcomeOf(check, core) {
    return check.async ? settle(check.run, core) : outcome(check.run, core);
}

const checkFiles = fs
    .readdirSync(LIFTED_DIR)
    .filter((f) => f.endsWith('.checks.js'))
    .sort();

const referenceInstalled = fs.existsSync(path.join(REF_PKG_DIR, 'package.json'));

describe('lifted fallback checks (P5-02b)', function () {
    this.timeout(30000);

    for (const file of checkFiles) {
        describe(file, () => {
            const checks = require(path.join(LIFTED_DIR, file));
            const ids = new Set();
            for (const check of checks) {
                assert.ok(!ids.has(check.id), `duplicate check id ${check.id}`);
                ids.add(check.id);

                it(`${check.id} (src)`, async () => {
                    assert.deepStrictEqual(await outcomeOf(check, getSrcCore()), check.expect);
                });

                it(`${check.id} (reference@5.0.0)`, async function () {
                    if (!referenceInstalled) {
                        this.skip();
                    }
                    assert.deepStrictEqual(await outcomeOf(check, getRefCore()), check.reference ?? check.expect);
                });
            }
        });
    }
});

module.exports = { outcome, settle, outcomeOf, plain };
