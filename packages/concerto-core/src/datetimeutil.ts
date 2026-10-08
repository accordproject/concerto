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
 * Validates that the year, month, day, hour, minute, second, and optional offset components
 * represent a real, valid calendar date and time without rollover (e.g., rejecting Feb 30 or T24:00).
 *
 * @param {string|number} yearStr - The 4-digit year
 * @param {string|number} monthStr - The 2-digit month (01-12)
 * @param {string|number} dayStr - The 2-digit day (01-31)
 * @param {string|number} hourStr - The 2-digit hour (00-23)
 * @param {string|number} minuteStr - The 2-digit minute (00-59)
 * @param {string|number} secondStr - The 2-digit second (00-59)
 * @param {string} [offsetStr] - The timezone offset (Z or [+-]HH:mm)
 * @returns {boolean} true if the components form a valid instant without rollover
 */
function isValidDateTime(
    yearStr: string | number,
    monthStr: string | number,
    dayStr: string | number,
    hourStr: string | number,
    minuteStr: string | number,
    secondStr: string | number,
    offsetStr?: string
): boolean {
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    const hour = Number(hourStr);
    const minute = Number(minuteStr);
    const second = Number(secondStr);

    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) ||
        !Number.isInteger(hour) || !Number.isInteger(minute) || !Number.isInteger(second)) {
        return false;
    }

    if (month < 1 || month > 12) {
        return false;
    }
    if (day < 1 || day > 31) {
        return false;
    }
    if (hour < 0 || hour > 23) {
        return false;
    }
    if (minute < 0 || minute > 59) {
        return false;
    }
    if (second < 0 || second > 59) {
        return false;
    }

    if (offsetStr && offsetStr !== 'Z') {
        const offsetMatch = offsetStr.match(/^[+-](\d{2}):(\d{2})$/);
        if (!offsetMatch) {
            return false;
        }
        const offsetHour = Number(offsetMatch[1]);
        const offsetMinute = Number(offsetMatch[2]);
        if (offsetHour > 23 || offsetMinute > 59) {
            return false;
        }
    }

    const d = new Date(Date.UTC(year, month - 1, day));
    if (year >= 0 && year < 100) {
        d.setUTCFullYear(year);
    }
    if (d.getUTCFullYear() !== year || (d.getUTCMonth() + 1) !== month || d.getUTCDate() !== day) {
        return false;
    }

    return true;
}

/**
 * Ensures there is a proper current time
 *
 * @param {string} [currentTime] - the definition of 'now'
 * @param {number|object} [utcOffset] - UTC Offset for this execution, or options object { utcOffset, strict }
 * @param {boolean} [strict=false] - whether to strictly validate the date-time format and reject impossible dates
 * @returns {object} if valid, the dayjs object for the current time
 */
function setCurrentTime(currentTime?: string | null, utcOffset?: number | { utcOffset?: number; strict?: boolean }, strict = false) {
    let resolvedUtcOffset: number | undefined;
    let resolvedStrict = strict;

    if (typeof utcOffset === 'object' && utcOffset !== null) {
        resolvedUtcOffset = utcOffset.utcOffset;
        if (utcOffset.strict !== undefined) {
            resolvedStrict = utcOffset.strict;
        }
    } else {
        resolvedUtcOffset = utcOffset;
    }

    if (resolvedStrict && currentTime) {
        const match = typeof currentTime === 'string' && currentTime.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/);
        if (!match || !isValidDateTime(match[1], match[2], match[3], match[4], match[5], match[6], match[7])) {
            throw new Error(`Current time '${currentTime}' is not in standard UTC format`);
        }
    }

    // Default UTC offset to local time
    const utcOffsetResolved = typeof resolvedUtcOffset === 'number' ? resolvedUtcOffset : dayjs().utcOffset();
    const currentTimeUTC = currentTime ? dayjs.utc(currentTime) : dayjs().utc();
    if (!currentTimeUTC.isValid()) {
        throw new Error(`Current time '${currentTime}' is not in standard UTC format`);
    }
    const currentTimeResolved = currentTimeUTC.utcOffset(utcOffsetResolved);
    if (!currentTimeResolved.isValid()) {
        throw new Error(`Cannot set current time to '${currentTime}' with UTC offset '${resolvedUtcOffset}'`);
    }
    return {
        currentTime: currentTimeResolved,
        utcOffset: utcOffsetResolved
    };
}

export { setCurrentTime, isValidDateTime };
export default { setCurrentTime, isValidDateTime };
