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
 * Engine adapters.
 *
 * An adapter is an object
 *
 *   { name: string, run(op: string, inputs: object): {outcome, window?} }
 *
 * `inputs` are the fixture inputs with every blob resolved. `outcome` is
 * {ok: <encoded result>} or {error: {class, message, location, component}},
 * plus optional `effects`, in the output encoding of lib/codec.js. `window`
 * ({start, end}, wall-clock ms around the op itself) lets the judge
 * normalise generated timestamps; when absent the judge times run() itself.
 * The judge canonicalises the outcome; adapters need not sort keys.
 *
 * Throwing codec.HarnessError means "this fixture could not be set up" and is
 * reported as a harness error, never as a pass or an expected error.
 *
 * run() may return a promise of the same {outcome, window} for an async op
 * (task accordproject/concerto-rust#94): the outcome is what the op's promise
 * settles to. Such an op runs inside the environment its inputs carry:
 * `inputs.fs` (relative path -> file contents) is written to a fresh
 * directory that is the working directory for the op, and `inputs.net`
 * (URL -> {status, body}) answers every fetch the op makes. The recorder
 * puts every URL the reference fetched in `net`, so a fetch of any other URL
 * is the engine's own divergence (a failure); a malformed `fs` or `net` is a
 * harness error.
 *
 * coreAdapter() below runs any JS build of concerto-core (the frozen npm
 * reference, or the workspace src/ through ts-node) through the same public
 * API the recorder observed. A Rust/WASM engine gets its own adapter with the
 * same run() contract.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const codec = require('./codec');
const { opTable } = require('./ops');
const { seededRandom } = require('./env');

const { HarnessError, encodePlain, encodeError } = codec;

/**
 * Enter the environment of an async op: its files and its network.
 * @param {object} inputs resolved fixture inputs
 * @returns {{leave: function(): (string|null)}} leave() restores the process
 * and returns the first URL fetched that the fixture does not carry, if any
 * @throws {HarnessError} when inputs.fs or inputs.net is malformed
 */
function enterEnvironment(inputs) {
    const savedCwd = process.cwd();
    const savedFetch = global.fetch;
    let dir = null;
    let missing = null;
    if (inputs.fs !== undefined) {
        if (!inputs.fs || typeof inputs.fs !== 'object') {
            throw new HarnessError('inputs.fs is not an object');
        }
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'oracle-fs-'));
        for (const [rel, content] of Object.entries(inputs.fs)) {
            if (path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..') || typeof content !== 'string') {
                fs.rmSync(dir, { recursive: true, force: true });
                throw new HarnessError('inputs.fs entry is not a relative file: ' + rel);
            }
            const file = path.join(dir, rel);
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, content);
        }
        process.chdir(dir);
    }
    const net = inputs.net === undefined ? {} : inputs.net;
    const malformed = !net || typeof net !== 'object' || Array.isArray(net) ||
        Object.values(net).some((e) => !e || typeof e.status !== 'number' || typeof e.body !== 'string');
    if (malformed) {
        if (dir) {
            process.chdir(savedCwd);
            fs.rmSync(dir, { recursive: true, force: true });
        }
        throw new HarnessError('inputs.net is malformed');
    }
    global.fetch = async (url) => {
        const key = String(url && typeof url === 'object' && 'href' in url ? url.href : (url && typeof url === 'object' && 'url' in url ? url.url : url));
        if (!Object.prototype.hasOwnProperty.call(net, key)) {
            missing = missing || key;
            throw new TypeError('fetch failed');
        }
        return new Response(net[key].body, { status: net[key].status });
    };
    return {
        leave() {
            global.fetch = savedFetch;
            if (dir) {
                process.chdir(savedCwd);
                fs.rmSync(dir, { recursive: true, force: true });
            }
            return missing;
        },
    };
}

/**
 * @param {object} core module set from lib/core.js
 * @param {string} name adapter name
 * @returns {object} adapter
 */
function coreAdapter(core, name) {
    const ops = opTable(core);
    const encodeOut = codec.makeOutputEncoder(core);

    const lookup = (op) => {
        const spec = ops.get(op);
        if (!spec) {
            throw new HarnessError('unknown op ' + op);
        }
        return spec;
    };

    const decodeInputs = (spec, inputs) => {
        if (!inputs || !Array.isArray(inputs.args)) {
            throw new HarnessError('fixture inputs have no args array');
        }
        if (spec.kind === 'method' && !('target' in inputs)) {
            throw new HarnessError('method op without target');
        }
        const dctx = { mms: new Map() };
        const target = spec.kind === 'method' ? decode(inputs.target, dctx) : undefined;
        const args = inputs.args.map((a) => decode(a, dctx));
        return { target, args };
    };

    const runDerived = (op, inputs) => {
        const spec = lookup(op);
        const { target, args } = decodeInputs(spec, inputs);
        const rnd = seededRandom();
        try {
            return spec.exec(core, target, args);
        } finally {
            rnd.restore();
        }
    };

    const decode = codec.makeDecoder(core, runDerived);

    const adapter = {
        name,
        core,
        /**
         * @param {string} op op name
         * @param {object} inputs resolved fixture inputs
         * @returns {{outcome: object, window: {start:number,end:number}}|Promise} result
         * (a promise for an async op)
         */
        run(op, inputs) {
            const spec = lookup(op);
            const { target, args } = decodeInputs(spec, inputs);
            const plainBefore = args.map((a) => {
                try {
                    return JSON.stringify(encodePlain(a));
                } catch (e) {
                    return null;
                }
            });
            let result;
            let error;
            let threw = false;
            const envr = spec.async ? enterEnvironment(inputs) : null;
            const rnd = seededRandom();
            const start = Date.now();
            try {
                result = spec.exec(core, target, args);
            } catch (e) {
                threw = true;
                error = e;
            }
            const settle = (settledThrew, value, end) => {
                rnd.restore();
                const missing = envr ? envr.leave() : null;
                if (missing) {
                    const err = new Error('state divergence: fetched ' + missing + ', which the reference did not fetch');
                    err.divergence = true;
                    throw err;
                }
                return { outcome: adapter.outcomeOf(spec, target, args, plainBefore, settledThrew, value), window: { start, end } };
            };
            if (spec.async && !threw && result && typeof result.then === 'function') {
                return Promise.resolve(result).then(
                    (v) => settle(false, v, Date.now()),
                    (e) => settle(true, e, Date.now()));
            }
            return settle(threw, threw ? error : result, Date.now());
        },

        /**
         * The outcome of a finished op.
         * @param {object} spec op spec
         * @param {*} target receiver
         * @param {Array} args arguments
         * @param {Array} plainBefore JSON of each plain argument before the op
         * @param {boolean} threw whether the op threw (or its promise rejected)
         * @param {*} value result or thrown value
         * @returns {object} outcome
         */
        outcomeOf(spec, target, args, plainBefore, threw, value) {
            const result = threw ? undefined : value;
            const error = threw ? value : undefined;
            const outcome = threw ? { error: encodeError(error) } : { ok: encodeOut(result) };
            const effects = {};
            if (spec.mutatesTarget && (target instanceof core.Typed || target instanceof core.BaseModelManager)) {
                effects.target = encodeOut(target);
            }
            args.forEach((a, i) => {
                if (plainBefore[i] === null) {
                    return;
                }
                let after = null;
                try {
                    after = JSON.stringify(encodePlain(a));
                } catch (e) {
                    after = null;
                }
                if (after !== plainBefore[i]) {
                    effects.args = effects.args || {};
                    effects.args[i] = after === null ? { [codec.M]: 'nonplain-after' } : JSON.parse(after);
                }
            });
            if (Object.keys(effects).length > 0) {
                outcome.effects = effects;
            }
            return outcome;
        },
    };
    return adapter;
}

/**
 * The frozen reference: @accordproject/concerto-core@5.0.0 from npm.
 * @returns {object} adapter
 */
function referenceAdapter() {
    const { getRefCore } = require('./core');
    return coreAdapter(getRefCore(), 'reference@5.0.0');
}

/**
 * The workspace src/ (TypeScript via ts-node); used for coverage.
 * @returns {object} adapter
 */
function srcAdapter() {
    const { getSrcCore, loadEntryPoint } = require('./core');
    const core = getSrcCore();
    // Through the entry point, like the reference adapter (task P2-11b).
    loadEntryPoint(core);
    return coreAdapter(core, 'src');
}

module.exports = { coreAdapter, referenceAdapter, srcAdapter };
