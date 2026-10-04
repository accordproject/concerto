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
 * P5-67 lifted checks (accordproject/concerto-rust#404; BC-51, R1):
 * `DateTimeUtil.setCurrentTime(currentTime)` accepts only a strict
 * `DateTime` string, by the rule the Rust engine applies to a `DateTime`
 * field (P5-24, BC-07/BC-42: the `strictQualifiedDateTimes` regex, then a
 * real calendar instant). `setCurrentTime` stays TS (PORTING.md 3.3) and no
 * engine binding exposes the check, so TS reuses `isStrictDateTime`
 * (datetimeutil.ts).
 *
 * Each check sends one string to both: `setCurrentTime(s, 0)` in TS, and
 * `Serializer.fromJSON` of a `DateTime` field in the engine. Each side
 * reports the instant it read (epoch ms) or the class of what it threw, so
 * the check shows the two agree on which strings are accepted and on the
 * instant they name. `expect` is the workspace outcome; `reference` is
 * v5.0.0's, whose `setCurrentTime` and non-strict `fromJSON` both parsed
 * with `dayjs.utc` (lenient). Run by fallbacks.spec.js.
 */

const NS = 'org.acme.lifted.p567@1.0.0';

const MODEL = `namespace ${NS}
concept C {
  o DateTime t
}
`;

/**
 * The epoch ms `run` gives, or the class of the error it throws.
 * @param {Function} run the probe
 * @returns {number|string} the instant, or the thrown class's name
 */
function attempt(run) {
    try {
        return run().valueOf();
    } catch (e) {
        return e.constructor.name;
    }
}

/**
 * The check body for one input: `[setCurrentTime, engine fromJSON]`.
 * @param {string} s the currentTime string
 * @returns {Function} the check body
 */
function both(s) {
    return (core) => {
        const dtu = core.dateTimeUtilModule.default ?? core.dateTimeUtilModule;
        const mm = new core.ModelManager();
        mm.addCTOModel(MODEL, 'p567.cto');
        const ser = new core.Serializer(new core.Factory(mm), mm);
        return [
            attempt(() => dtu.setCurrentTime(s, 0).currentTime),
            attempt(() => ser.fromJSON({ $class: `${NS}.C`, t: s }, { utcOffset: 0 }).t),
        ];
    };
}

// Both sides reject: `setCurrentTime` throws its `Error` ("... is not in
// standard UTC format"), the engine the strict-mode `ValidationException`.
const REJECTED = ['Error', 'ValidationException'];

// [id, what, input, workspace outcome, v5.0.0 outcome]; an accepted input
// gives the same epoch ms on both sides.
const INPUTS = [
    // Strict strings: both accept, at the same instant, as v5.0.0 did.
    ['DTU-001', 'a strict UTC string', '1970-01-01T00:00:00Z', [0, 0], [0, 0]],
    ['DTU-002', 'a strict string with an offset and milliseconds, on a leap day', '2024-02-29T23:59:59.999+05:30', [1709231399999, 1709231399999], [1709231399999, 1709231399999]],
    ['DTU-003', 'a strict string with a nanosecond fraction (truncated to ms)', '2020-01-01T00:00:00.123456789Z', [1577836800123, 1577836800123], [1577836800123, 1577836800123]],
    ['DTU-004', 'the largest positive offset', '2020-01-01T00:00:00+23:59', [1577750460000, 1577750460000], [1577750460000, 1577750460000]],
    ['DTU-005', 'the largest negative offset', '2020-01-01T00:00:00-23:59', [1577923140000, 1577923140000], [1577923140000, 1577923140000]],
    ['DTU-006', 'the last second of year 9999', '9999-12-31T23:59:59Z', [253402300799000, 253402300799000], [253402300799000, 253402300799000]],
    // Lenient forms v5.0.0 accepted (BC-07, BC-51): both reject.
    ['DTU-007', 'a date only', '2020-01-01', REJECTED, [1577836800000, 1577836800000]],
    ['DTU-008', 'a date-time with no offset', '2020-01-01T00:00:00', REJECTED, [1577836800000, 1577836800000]],
    ['DTU-009', 'a V8 legacy form', 'Nov 28 2022', REJECTED, [1669593600000, 1669593600000]],
    ['DTU-010', 'a bare number string', '1', REJECTED, [978307200000, 978307200000]],
    ['DTU-011', 'a space separator', '2020-01-01 00:00:00Z', REJECTED, [1577836800000, 1577836800000]],
    ['DTU-012', 'a lower-case t and z', '2020-01-01t00:00:00z', REJECTED, [1577836800000, 1577836800000]],
    ['DTU-013', 'an expanded year', '+002022-11-28T00:00:00Z', REJECTED, [1669593600000, 1669593600000]],
    // Impossible instants v5.0.0 rolled over (BC-42, BC-51): both reject.
    ['DTU-014', 'February 30th', '2024-02-30T00:00:00Z', REJECTED, [1709251200000, 1709251200000]],
    ['DTU-015', 'February 29th in a common year', '2023-02-29T00:00:00Z', REJECTED, [1677628800000, 1677628800000]],
    ['DTU-016', 'hour 24', '2020-01-01T24:00:00Z', REJECTED, [1577923200000, 1577923200000]],
    // Rejected by v5.0.0 too.
    ['DTU-017', 'a leap second', '2016-12-31T23:59:60Z', REJECTED, REJECTED],
    ['DTU-018', 'an offset of 24 hours', '2020-01-01T00:00:00+24:00', REJECTED, REJECTED],
    ['DTU-019', 'an offset with 60 minutes', '2020-01-01T00:00:00+05:60', REJECTED, REJECTED],
    ['DTU-020', 'not a date', 'foobar', REJECTED, REJECTED],
];

module.exports = INPUTS.map(([id, what, s, expect, reference]) => ({
    id,
    covers: `datetimeutil.ts setCurrentTime and the engine's DateTime field agree: ${what} (${JSON.stringify(s)})`,
    run: both(s),
    expect: { ok: expect },
    reference: { ok: reference },
}));
