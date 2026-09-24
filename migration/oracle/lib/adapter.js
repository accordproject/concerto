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
 * coreAdapter() below runs any JS build of concerto-core (the frozen npm
 * reference, or the workspace src/ through ts-node) through the same public
 * API the recorder observed. A Rust/WASM engine gets its own adapter with the
 * same run() contract.
 */

const codec = require('./codec');
const { opTable } = require('./ops');
const { seededRandom } = require('./env');

const { HarnessError, encodePlain, encodeError } = codec;

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

    return {
        name,
        core,
        /**
         * @param {string} op op name
         * @param {object} inputs resolved fixture inputs
         * @returns {{outcome: object, window: {start:number,end:number}}} result
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
            const rnd = seededRandom();
            const start = Date.now();
            try {
                result = spec.exec(core, target, args);
            } catch (e) {
                threw = true;
                error = e;
            }
            const end = Date.now();
            rnd.restore();
            const outcome = threw ? { error: encodeError(error) } : { ok: encodeOut(result) };
            const effects = {};
            if (spec.mutatesTarget && target instanceof core.Typed) {
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
            return { outcome, window: { start, end } };
        },
    };
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
    const { getSrcCore } = require('./core');
    return coreAdapter(getSrcCore(), 'src');
}

module.exports = { coreAdapter, referenceAdapter, srcAdapter };
