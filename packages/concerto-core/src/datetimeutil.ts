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

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
dayjs.extend(utc);
const quarterOfYear = require('dayjs/plugin/quarterOfYear');
dayjs.extend(quarterOfYear);
const minMax = require('dayjs/plugin/minMax');
dayjs.extend(minMax);
const duration = require('dayjs/plugin/duration');
dayjs.extend(duration);

/**
 * Ensures there is a proper current time
 *
 * @param {string} [currentTime] - the definition of 'now'
 * @param {number} [utcOffset] - UTC Offset for this execution
 * @returns {object} if valid, the dayjs object for the current time
 */
function setCurrentTime(currentTime, utcOffset) {
    // Default UTC offset to local time
    const utcOffsetResolved = typeof utcOffset === 'number' ? utcOffset : dayjs().utcOffset();
    const currentTimeUTC = currentTime ? dayjs.utc(currentTime) : dayjs().utc();
    if (!currentTimeUTC.isValid()) {
        throw new Error(`Current time '${currentTime}' is not in standard UTC format`);
    }
    const currentTimeResolved = currentTimeUTC.utcOffset(utcOffsetResolved);
    if (!currentTimeResolved.isValid()) {
        throw new Error(`Cannot set current time to '${currentTime}' with UTC offset '${utcOffset}'`);
    }
    return {
        currentTime: currentTimeResolved,
        utcOffset: utcOffsetResolved
    };
}

module.exports = { setCurrentTime };
