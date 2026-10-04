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
 * Frozen clock for a whole recording run (accordproject/concerto-rust#131).
 *
 * The seeded envelope above only covers one op. A value an op takes from the
 * wall clock can also escape it: data.spec.js's `Serializer.fromJSON` defaults
 * a missing `$timestamp` to "now", and the populated resource is then the
 * *input* of later recorded ops (`Resource.validate`, `toJSON`, ...), where
 * canonicalisation rightly keeps it as supplied data. So the recorder freezes
 * the clock for the whole process: `Date.now()`, `new Date()` and `Date()`
 * read a virtual instant that starts at FROZEN_EPOCH and never moves on its
 * own. Everything else about `Date` (constructing from arguments, `parse`,
 * `UTC`, the prototype) is the real one, and timers are untouched.
 *
 * The one thing that moves the virtual clock is waitPastInputInstants() below:
 * it used to spin until the wall clock passed the op's latest recent input
 * instant, which would never end on a frozen clock. On the frozen clock it
 * steps the virtual instant to 1 ms past that instant instead. The steps
 * depend only on the sequence of recorded ops and their inputs, so two
 * recordings of the same commit read the same instants at the same points.
 *
 * FROZEN_EPOCH is an arbitrary instant chosen not to be a round value that
 * test data is likely to use itself (2020-01-01T00:00:00Z, say), so that the
 * clock rarely has to step at all.
 */
const FROZEN_EPOCH = Date.UTC(2023, 5, 15, 9, 26, 53, 417); // 2023-06-15T09:26:53.417Z

const clock = { frozen: false, now: FROZEN_EPOCH, RealDate: null };

/**
 * Replace the global Date with one whose "now" is the frozen virtual instant,
 * for the rest of the process. Idempotent. Must run before anything that
 * should see the frozen clock captures a reference to `Date`.
 * @returns {{now: function(): number}} a view of the virtual clock
 */
function freezeClock() {
    if (!clock.frozen) {
        const RealDate = Date;
        /**
         * Date with a frozen "now".
         * @param {...*} args Date constructor arguments
         * @returns {Date|string} as the real Date would
         */
        function FrozenDate(...args) {
            if (!new.target) {
                return new RealDate(clock.now).toString();
            }
            return Reflect.construct(RealDate, args.length === 0 ? [clock.now] : args, new.target);
        }
        FrozenDate.prototype = RealDate.prototype;
        FrozenDate.now = () => clock.now;
        FrozenDate.parse = RealDate.parse;
        FrozenDate.UTC = RealDate.UTC;
        Object.defineProperty(FrozenDate, 'name', { value: 'Date' });
        clock.RealDate = RealDate;
        clock.frozen = true;
        global.Date = FrozenDate;
    }
    return { now: () => clock.now };
}

/**
 * Make sure the clock has moved past every recent date-time that occurs in
 * the op's inputs, so a timestamp generated during the op can never coincide
 * with a supplied one (canonicalisation tells them apart by instant).
 * On the real clock this spins for at most a few milliseconds; on the frozen
 * clock (freezeClock) it steps the virtual instant past them instead, since
 * spinning would never end.
 * @param {{instants: Set<number>}} facts inputFacts() of the op inputs
 */
function waitPastInputInstants(facts) {
    const now = clock.frozen ? clock.now : Date.now();
    let latest = -Infinity;
    for (const t of facts.instants) {
        if (t <= now + 5 && t > latest) {
            latest = t;
        }
    }
    if (clock.frozen) {
        if (clock.now <= latest) {
            clock.now = latest + 1;
        }
        return;
    }
    while (Date.now() <= latest) {
        // spin
    }
}

module.exports = { seededRandom, mulberry32, SEED, waitPastInputInstants, freezeClock, FROZEN_EPOCH };
