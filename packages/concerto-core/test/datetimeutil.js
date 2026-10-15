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

const DateTimeUtil = require('../src/datetimeutil').default;

const chai = require('chai');

chai.should();
chai.use(require('chai-things'));
chai.use(require('chai-as-promised'));

describe('Initialize current time', () => {
    it('Should succeed for a well-formed date/time', function () {
        const { currentTime } = DateTimeUtil.setCurrentTime('1970-01-01T00:00:00Z', 0);
        return currentTime.format().should.equal('1970-01-01T00:00:00Z', 0);
    });
    it('Should stringify a date time back with its timezone', function () {
        const { currentTime } = DateTimeUtil.setCurrentTime('1970-01-01T00:00:00+05:00', 5);
        return currentTime.format().should.equal('1970-01-01T00:00:00+05:00');
    });
    it('Should fail for a non-well-formed date/time', function () {
        return (() => DateTimeUtil.setCurrentTime('foobar')).should.throw('Current time \'foobar\' is not in standard UTC format');
    });
    it('Should fail for a non-well-formed date/time when strict is false', function () {
        return (() => DateTimeUtil.setCurrentTime('foobar', 0, false)).should.throw('Current time \'foobar\' is not in standard UTC format');
    });
    it('Should fail for an invalid UTC offset', function () {
        return (() => DateTimeUtil.setCurrentTime('1970-01-01T00:00:00+05:00',999999999999)).should.throw('Cannot set current time to \'1970-01-01T00:00:00+05:00\' with UTC offset \'999999999999\'');
    });
    it('Should not fail when currentTime is null', function () {
        const { currentTime } = DateTimeUtil.setCurrentTime(null);
        return currentTime.format().should.not.be.null;
    });
    it('Should not fail when currentTime is undefined', function () {
        const { currentTime } = DateTimeUtil.setCurrentTime(undefined);
        return currentTime.format().should.not.be.null;
    });
    it('Should reject impossible dates by default (strict default)', function () {
        (() => DateTimeUtil.setCurrentTime('2024-02-30T00:00:00Z'))
            .should.throw('Current time \'2024-02-30T00:00:00Z\' is not in standard UTC format');
    });
    it('Should reject impossible dates when strict is explicitly true', function () {
        (() => DateTimeUtil.setCurrentTime('2023-02-29T00:00:00Z', 0, true))
            .should.throw('Current time \'2023-02-29T00:00:00Z\' is not in standard UTC format');
    });
    it('Should reject T24:00:00 by default', function () {
        (() => DateTimeUtil.setCurrentTime('2024-01-01T24:00:00Z'))
            .should.throw('Current time \'2024-01-01T24:00:00Z\' is not in standard UTC format');
    });
    it('Should reject non-ISO string like "1" by default', function () {
        (() => DateTimeUtil.setCurrentTime('1'))
            .should.throw('Current time \'1\' is not in standard UTC format');
    });
    it('Should allow rollover when strict is false (lenient opt-out)', function () {
        const { currentTime } = DateTimeUtil.setCurrentTime('2024-02-30T00:00:00Z', 0, false);
        currentTime.toISOString().should.equal('2024-03-01T00:00:00.000Z');
    });
});

describe('DateTime validation via setCurrentTime', () => {
    it('should validate standard UTC date-time components', () => {
        const { currentTime } = DateTimeUtil.setCurrentTime('2024-02-29T12:30:45Z');
        currentTime.toISOString().should.equal('2024-02-29T12:30:45.000Z');
    });

    it('should validate date-time components with positive offset', () => {
        const { currentTime } = DateTimeUtil.setCurrentTime('2024-05-15T23:59:59+05:30');
        currentTime.toISOString().should.equal('2024-05-15T18:29:59.000Z');
    });

    it('should validate date-time components with negative offset', () => {
        const { currentTime } = DateTimeUtil.setCurrentTime('2024-05-15T00:00:00-08:00');
        currentTime.toISOString().should.equal('2024-05-15T08:00:00.000Z');
    });

    it('should validate years 0 to 99 correctly', () => {
        const { currentTime } = DateTimeUtil.setCurrentTime('0024-02-29T00:00:00Z');
        currentTime.toISOString().should.equal('0024-02-29T00:00:00.000Z');
        (() => DateTimeUtil.setCurrentTime('0023-02-29T00:00:00Z'))
            .should.throw('Current time \'0023-02-29T00:00:00Z\' is not in standard UTC format');
    });

    it('should reject invalid month', () => {
        (() => DateTimeUtil.setCurrentTime('2024-00-15T00:00:00Z'))
            .should.throw('Current time \'2024-00-15T00:00:00Z\' is not in standard UTC format');
        (() => DateTimeUtil.setCurrentTime('2024-13-15T00:00:00Z'))
            .should.throw('Current time \'2024-13-15T00:00:00Z\' is not in standard UTC format');
    });

    it('should reject invalid day', () => {
        (() => DateTimeUtil.setCurrentTime('2024-01-00T00:00:00Z'))
            .should.throw('Current time \'2024-01-00T00:00:00Z\' is not in standard UTC format');
        (() => DateTimeUtil.setCurrentTime('2024-01-32T00:00:00Z'))
            .should.throw('Current time \'2024-01-32T00:00:00Z\' is not in standard UTC format');
    });

    it('should reject impossible dates (Feb 30, non-leap Feb 29, April 31)', () => {
        (() => DateTimeUtil.setCurrentTime('2024-02-30T00:00:00Z'))
            .should.throw('Current time \'2024-02-30T00:00:00Z\' is not in standard UTC format');
        (() => DateTimeUtil.setCurrentTime('2023-02-29T00:00:00Z'))
            .should.throw('Current time \'2023-02-29T00:00:00Z\' is not in standard UTC format');
        (() => DateTimeUtil.setCurrentTime('2024-04-31T00:00:00Z'))
            .should.throw('Current time \'2024-04-31T00:00:00Z\' is not in standard UTC format');
    });

    it('should reject invalid hours (including hour 24)', () => {
        (() => DateTimeUtil.setCurrentTime('2024-01-01T24:00:00Z'))
            .should.throw('Current time \'2024-01-01T24:00:00Z\' is not in standard UTC format');
    });

    it('should reject invalid minutes', () => {
        (() => DateTimeUtil.setCurrentTime('2024-01-01T12:60:00Z'))
            .should.throw('Current time \'2024-01-01T12:60:00Z\' is not in standard UTC format');
    });

    it('should reject invalid seconds', () => {
        (() => DateTimeUtil.setCurrentTime('2024-01-01T12:00:60Z'))
            .should.throw('Current time \'2024-01-01T12:00:60Z\' is not in standard UTC format');
    });

    it('should reject malformed or out-of-range offsets', () => {
        (() => DateTimeUtil.setCurrentTime('2024-01-01T12:00:00+24:00'))
            .should.throw('Current time \'2024-01-01T12:00:00+24:00\' is not in standard UTC format');
        (() => DateTimeUtil.setCurrentTime('2024-01-01T12:00:00+05:60'))
            .should.throw('Current time \'2024-01-01T12:00:00+05:60\' is not in standard UTC format');
    });
});
