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

const uuid = require('uuid');

/**
 * Deterministic execution envelope shared by the recorder and the JS
 * adapters: during one op, Math.random is a seeded PRNG (mulberry32 with a
 * fixed seed), so sample-value generation is reproducible. Fixtures whose op
 * consumed randomness carry env.random = true; an engine that cannot
 * reproduce this PRNG must treat them as structure-only (README).
 *
 * `uuid.v4()` (Factory's default identifier for an identified resource with
 * no id given, factory.ts) is *also* seeded here (accordproject/concerto-rust#113):
 * it draws from Node's `crypto` RNG, not `Math.random`, so it was never
 * covered by the envelope above and produced a different id -- and so a
 * different fixture -- on every recording. It uses its own PRNG seed so it
 * stays decoupled from whatever the op's own Math.random draws are.
 */

const SEED = 0x0c0ffee;
const UUID_SEED = 0x5eedc0de;

/**
 * @param {number} a seed
 * @returns {function} PRNG in [0, 1)
 */
function mulberry32(a) {
    return function () {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * A deterministic replacement for uuid.v4(), built from a PRNG in the shape
 * of a real v4 uuid (variant and version bits set), so callers that merely
 * check the format still see a plausible value.
 * @param {function} prng a mulberry32 instance
 * @returns {function} takes no args, returns a uuid string
 */
function fakeUuidV4(prng) {
    return function () {
        const bytes = [];
        for (let i = 0; i < 16; i++) {
            bytes.push(Math.floor(prng() * 256));
        }
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = bytes.map((b) => b.toString(16).padStart(2, '0'));
        return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
    };
}

// uuid.v4 is exposed as a getter (ESM interop shim), so a plain assignment
// silently no-ops; the descriptor is swapped instead, and restored from this
// saved copy.
const uuidV4Descriptor = Object.getOwnPropertyDescriptor(uuid, 'v4');

/**
 * Install the seeded PRNG as Math.random, and a seeded replacement for
 * uuid.v4.
 * @returns {{restore: function(): number}} restore() puts Math.random and
 * uuid.v4 back and returns how many Math.random numbers were drawn
 */
function seededRandom() {
    const previous = Math.random;
    const prng = mulberry32(SEED);
    let count = 0;
    Math.random = function () {
        count++;
        return prng();
    };
    const previousV4 = uuidV4Descriptor && Object.getOwnPropertyDescriptor(uuid, 'v4');
    if (uuidV4Descriptor) {
        const fake = fakeUuidV4(mulberry32(UUID_SEED));
        Object.defineProperty(uuid, 'v4', { configurable: true, enumerable: true, get: () => fake });
    }
    return {
        restore() {
            Math.random = previous;
            if (uuidV4Descriptor && previousV4) {
                Object.defineProperty(uuid, 'v4', previousV4);
            }
            return count;
        },
    };
}

/**
 * Make sure the clock has moved past every recent date-time that occurs in
 * the op's inputs, so a timestamp generated during the op can never coincide
 * with a supplied one (canonicalisation tells them apart by instant).
 * Spins for at most a few milliseconds.
 * @param {{instants: Set<number>}} facts inputFacts() of the op inputs
 */
function waitPastInputInstants(facts) {
    const now = Date.now();
    let latest = -Infinity;
    for (const t of facts.instants) {
        if (t <= now + 5 && t > latest) {
            latest = t;
        }
    }
    while (Date.now() <= latest) {
        // spin
    }
}

module.exports = { seededRandom, mulberry32, SEED, waitPastInputInstants };
