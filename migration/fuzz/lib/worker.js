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
 * Differential-fuzz engine worker (task P5-05). Run once per batch, as its
 * own process — the TS/Rust engine choice is read from env once at module
 * load (see rust-adapter.js), so the two sides can never share a process.
 *
 *   ENGINE=ts|rust FIXTURES_DIR=<...>/migration/oracle/fixtures \
 *     node migration/fuzz/lib/worker.js
 *
 * Protocol: newline-delimited JSON on stdin/stdout.
 *   in:  {"id": string, "op": string, "inputs": <raw @@oracle-encoded inputs>}
 *   out: {"id": string, "ok": true, "canon": <canonical outcome>}
 *      | {"id": string, "ok": false, "error": "<message>"}
 * One line in, one line out, in order. The parent process pairs outputs back
 * up by `id`.
 */

process.env.TZ = 'UTC';

const readline = require('readline');
const path = require('path');

const ORACLE_LIB = path.resolve(__dirname, '..', '..', 'oracle', 'lib');
const { blobStore } = require(path.join(ORACLE_LIB, 'store'));
const { canonicalise } = require(path.join(ORACLE_LIB, 'canon'));

const engineKind = process.env.ENGINE;
if (engineKind !== 'ts' && engineKind !== 'rust') {
    console.error('worker.js: set ENGINE=ts|rust');
    process.exit(2);
}
const fixturesDir = process.env.FIXTURES_DIR;
if (!fixturesDir) {
    console.error('worker.js: set FIXTURES_DIR to the canonical corpus (migration/oracle/fixtures)');
    process.exit(2);
}

// Silence the engines' own console noise (decorator warnings etc.), same as
// bin/replay.js, so stdout stays a clean line-per-case protocol.
if (!process.env.ORACLE_VERBOSE) {
    for (const k of ['log', 'info', 'warn', 'error', 'debug']) {
        console[k] = () => {};
    }
}

const adapter = engineKind === 'rust'
    ? require(path.join(ORACLE_LIB, 'rust-adapter')).createAdapter()
    : require(path.join(ORACLE_LIB, 'adapter')).srcAdapter();

const store = blobStore(fixturesDir);

/**
 * @param {string} op op name
 * @param {object} rawInputs raw (still @@oracle-encoded) fixture inputs
 * @returns {object} {ok:true, canon} | {ok:false, error}
 */
function runOne(op, rawInputs) {
    let inputs;
    let facts;
    try {
        facts = store.facts(rawInputs);
        inputs = store.unpack(rawInputs);
    } catch (e) {
        return { ok: false, error: 'harness: ' + e.message };
    }
    let res;
    try {
        res = adapter.run(op, inputs);
    } catch (e) {
        // A thrown, uncaught error at the adapter boundary itself (not one
        // the op's outcome carries) is a harness problem, not a divergence:
        // report it as such so the parent does not compare it as a verdict.
        return { ok: false, error: 'run threw: ' + (e && e.constructor ? e.constructor.name : '') + ': ' + (e && e.message) };
    }
    if (res && typeof res.then === 'function') {
        return { ok: false, error: 'async ops are out of scope for this harness' };
    }
    const outcome = res && res.outcome ? res.outcome : res;
    const window = res && res.window ? res.window : { start: 0, end: 0 };
    try {
        const canon = canonicalise(JSON.parse(JSON.stringify(outcome)), facts, window);
        return { ok: true, canon };
    } catch (e) {
        return { ok: false, error: 'outcome not canonicalisable: ' + e.message };
    }
}

const rl = readline.createInterface({ input: process.stdin, terminal: false });
rl.on('line', (line) => {
    if (!line.trim()) {
        return;
    }
    let req;
    try {
        req = JSON.parse(line);
    } catch (e) {
        process.stdout.write(JSON.stringify({ id: null, ok: false, error: 'bad request JSON: ' + e.message }) + '\n');
        return;
    }
    let out;
    try {
        out = Object.assign({ id: req.id }, runOne(req.op, req.inputs));
    } catch (e) {
        out = { id: req.id, ok: false, error: 'worker crash: ' + (e && e.message) };
    }
    process.stdout.write(JSON.stringify(out) + '\n');
});
