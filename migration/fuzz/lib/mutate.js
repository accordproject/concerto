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
 * Deterministic, seeded mutation of a plain JSON value (a Concerto AST or an
 * instance's JSON), for task P5-05 (differential fuzzing).
 *
 * A mutation is fully determined by a 32-bit integer seed, so every case is
 * reproducible from {seedFixture, seed} alone: that pair is the "minimised
 * seed" a divergence report names.
 *
 * This deliberately knows nothing about Concerto's grammar. It mutates JSON
 * shape generically (drop/add/rename keys, flip booleans, retype scalars,
 * reslice arrays, duplicate nodes). That is enough to reach the kind of
 * malformed-but-plausible model and instance documents the plan's §2.5 asks
 * for, while staying agnostic of which op the fixture came from.
 */

// mulberry32: small, fast, deterministic PRNG from a 32-bit seed.
function mulberry32(seed) {
    let a = seed >>> 0;
    return function next() {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const JUNK_STRINGS = ['', '__proto__', 'constructor', '\u0000', 'a'.repeat(5000), 'NaN', '-0', '💥emoji', '../../etc', 'null', 'undefined'];
const JUNK_NUMBERS = [0, -0, 1, -1, 0.1, -0.1, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, 2 ** 53, -(2 ** 53), 1e308];

/**
 * Collect every {parent, key} addressable slot of a JSON value, depth-first,
 * so a mutation can target any node uniformly.
 * @param {*} root value
 * @returns {Array<{parent:*, key:(string|number)}>} slots (excludes the root itself)
 */
function collectSlots(root) {
    const slots = [];
    const walk = (node) => {
        if (Array.isArray(node)) {
            node.forEach((v, i) => { slots.push({ parent: node, key: i }); walk(v); });
        } else if (node && typeof node === 'object') {
            // Recipe scaffolding (an `@@oracle`-marked handle) is left
            // structurally alone below this point: it can still be picked
            // as a whole slot (replaced, deleted, retyped) by its parent,
            // but mutating *inside* it would corrupt the recipe rather than
            // the model/instance content the fixture actually carries, and
            // would surface as a harness error instead of a real divergence.
            if (Object.prototype.hasOwnProperty.call(node, '@@oracle')) {
                return;
            }
            for (const k of Object.keys(node)) { slots.push({ parent: node, key: k }); walk(node[k]); }
        }
    };
    walk(root);
    return slots;
}

function randomScalar(rnd) {
    const kinds = ['string', 'number', 'bool', 'null', 'array', 'object'];
    switch (kinds[Math.floor(rnd() * kinds.length)]) {
    case 'string': return JUNK_STRINGS[Math.floor(rnd() * JUNK_STRINGS.length)];
    case 'number': return JUNK_NUMBERS[Math.floor(rnd() * JUNK_NUMBERS.length)];
    case 'bool': return rnd() < 0.5;
    case 'null': return null;
    case 'array': return [];
    default: return {};
    }
}

const EDITS = [
    // delete the slot
    (parent, key) => {
        if (Array.isArray(parent)) { parent.splice(key, 1); } else { delete parent[key]; }
    },
    // retype the slot to an unrelated scalar/shape
    (parent, key, rnd) => { parent[key] = randomScalar(rnd); },
    // flip a boolean
    (parent, key) => { if (typeof parent[key] === 'boolean') { parent[key] = !parent[key]; } else { parent[key] = true; } },
    // duplicate the slot under a mangled key/index (name collisions)
    (parent, key) => {
        if (Array.isArray(parent)) { parent.splice(key, 0, deepClone(parent[key])); } else { parent[key + '_dup'] = deepClone(parent[key]); }
    },
    // mutate a string in place (truncate, append junk, case-flip)
    (parent, key, rnd) => {
        if (typeof parent[key] === 'string') {
            const s = parent[key];
            const choice = Math.floor(rnd() * 4);
            parent[key] = choice === 0 ? s.slice(0, Math.floor(s.length / 2))
                : choice === 1 ? s + JUNK_STRINGS[Math.floor(rnd() * JUNK_STRINGS.length)]
                    : choice === 2 ? s.toUpperCase() : s + s;
        } else {
            parent[key] = JUNK_STRINGS[Math.floor(rnd() * JUNK_STRINGS.length)];
        }
    },
    // perturb a number toward an edge case
    (parent, key, rnd) => {
        parent[key] = typeof parent[key] === 'number'
            ? parent[key] + JUNK_NUMBERS[Math.floor(rnd() * JUNK_NUMBERS.length)]
            : JUNK_NUMBERS[Math.floor(rnd() * JUNK_NUMBERS.length)];
    },
    // wrap the value in a single-element array, or unwrap a one-element array
    (parent, key) => {
        const v = parent[key];
        parent[key] = Array.isArray(v) && v.length === 1 ? v[0] : [v];
    },
    // shuffle an array's elements (order-sensitivity probe)
    (parent, key, rnd) => {
        const v = parent[key];
        if (Array.isArray(v) && v.length > 1) {
            for (let i = v.length - 1; i > 0; i--) {
                const j = Math.floor(rnd() * (i + 1));
                [v[i], v[j]] = [v[j], v[i]];
            }
        }
    },
];

function deepClone(v) {
    return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

/**
 * @param {*} value plain JSON value (AST or instance document)
 * @param {number} seed 32-bit integer seed
 * @returns {*} a new, mutated value; `value` is never modified
 */
function mutate(value, seed) {
    const rnd = mulberry32(seed);
    const out = deepClone(value);
    const editCount = 1 + Math.floor(rnd() * 4); // 1..4 edits per case
    for (let i = 0; i < editCount; i++) {
        const slots = collectSlots(out);
        if (slots.length === 0) {
            break;
        }
        const { parent, key } = slots[Math.floor(rnd() * slots.length)];
        const edit = EDITS[Math.floor(rnd() * EDITS.length)];
        try {
            edit(parent, key, rnd);
        } catch (e) {
            // A slot a prior edit already removed (e.g. array reindexed). Skip.
        }
    }
    return out;
}

module.exports = { mutate, mulberry32, collectSlots };
