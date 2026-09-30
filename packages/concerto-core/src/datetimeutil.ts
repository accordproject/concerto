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

import dayjs from './dayjs-setup';

/**
 * Whether a value is a strict `DateTime` string (P5-24, BC-07/BC-42/BC-43,
 * R1): the `strictQualifiedDateTimes` format, whose date and time fields
 * name a real instant (`Date.parse` rolls `2024-02-30` and `T24:00:00` over
 * and rejects a leap second, so reading the fields back must give the same
 * fields). The Rust engine's rule (`instance::dayjs::strict_instant`): the
 * same regex, then chrono's RFC 3339 calendar checks. The lifted checks in
 * migration/oracle/lifted/datetimeutil-strict.checks.js compare the two.
 * @param {*} value the value
 * @returns {boolean} true for a strict `DateTime` string
 * @internal
 */
export function isStrictDateTime(value): boolean {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
        return false;
    }
    const fields = value.slice(0, 19);
    return dayjs.utc(value).isValid() && dayjs.utc(`${fields}Z`).format('YYYY-MM-DDTHH:mm:ss') === fields;
}

/**
 * Ensures there is a proper current time
 *
 * P5-67 (BC-51, R1): a given `currentTime` must be a strict `DateTime`
 * string (`YYYY-MM-DDTHH:mm:ss`, an optional fraction, then `Z` or
 * `±HH:mm`, naming a real instant), as for every other `DateTime` string;
 * the lenient dayjs and V8 forms are rejected with the same error an
 * unparseable one throws. An omitted (falsy) `currentTime` still means now.
 *
 * @param {string} [currentTime] - the definition of 'now', a strict
 * `DateTime` string
 * @param {number} [utcOffset] - UTC Offset for this execution
 * @returns {object} if valid, the dayjs object for the current time
 */
function setCurrentTime(currentTime?, utcOffset?) {
    // Default UTC offset to local time
    const utcOffsetResolved = typeof utcOffset === 'number' ? utcOffset : dayjs().utcOffset();
    if (currentTime && !isStrictDateTime(currentTime)) {
        throw new Error(`Current time '${currentTime}' is not in standard UTC format`);
    }
    // A strict DateTime string always parses, and so does now.
    const currentTimeUTC = currentTime ? dayjs.utc(currentTime) : dayjs().utc();
    const currentTimeResolved = currentTimeUTC.utcOffset(utcOffsetResolved);
    if (!currentTimeResolved.isValid()) {
        throw new Error(`Cannot set current time to '${currentTime}' with UTC offset '${utcOffset}'`);
    }
    return {
        currentTime: currentTimeResolved,
        utcOffset: utcOffsetResolved
    };
}

export { setCurrentTime };
export default { setCurrentTime };
