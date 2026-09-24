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
 * Deterministic execution envelope shared by the recorder and the JS
 * adapters: during one op, Math.random is a seeded PRNG (mulberry32 with a
 * fixed seed), so sample-value generation is reproducible. Fixtures whose op
 * consumed randomness carry env.random = true; an engine that cannot
 * reproduce this PRNG must treat them as structure-only (README).
 */

const SEED = 0x0c0ffee;

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
 * Install the seeded PRNG as Math.random.
 * @returns {{restore: function(): number}} restore() puts the previous
 * Math.random back and returns how many numbers were drawn
 */
function seededRandom() {
    const previous = Math.random;
    const prng = mulberry32(SEED);
    let count = 0;
    Math.random = function () {
        count++;
        return prng();
    };
    return {
        restore() {
            Math.random = previous;
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
