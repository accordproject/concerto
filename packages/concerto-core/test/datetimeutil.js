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
    it('Should support options object with utcOffset', function () {
        const { currentTime, utcOffset } = DateTimeUtil.setCurrentTime('1970-01-01T00:00:00Z', { utcOffset: 2 });
        utcOffset.should.equal(2);
        currentTime.format().should.equal('1970-01-01T02:00:00+02:00');
    });
    it('Should support options object with strict: true', function () {
        const { currentTime } = DateTimeUtil.setCurrentTime('2024-02-29T12:00:00Z', { strict: true });
        currentTime.toISOString().should.equal('2024-02-29T12:00:00.000Z');
    });
    it('Should reject impossible dates when strict is true (options object)', function () {
        (() => DateTimeUtil.setCurrentTime('2024-02-30T00:00:00Z', { strict: true }))
            .should.throw('Current time \'2024-02-30T00:00:00Z\' is not in standard UTC format');
    });
    it('Should reject impossible dates when strict is true (positional boolean)', function () {
        (() => DateTimeUtil.setCurrentTime('2023-02-29T00:00:00Z', 0, true))
            .should.throw('Current time \'2023-02-29T00:00:00Z\' is not in standard UTC format');
    });
    it('Should reject T24:00:00 when strict is true', function () {
        (() => DateTimeUtil.setCurrentTime('2024-01-01T24:00:00Z', { strict: true }))
            .should.throw('Current time \'2024-01-01T24:00:00Z\' is not in standard UTC format');
    });
    it('Should reject non-ISO string like "1" when strict is true', function () {
        (() => DateTimeUtil.setCurrentTime('1', { strict: true }))
            .should.throw('Current time \'1\' is not in standard UTC format');
    });
    it('Should allow rollover when strict is false (lenient default)', function () {
        const { currentTime } = DateTimeUtil.setCurrentTime('2024-02-30T00:00:00Z');
        currentTime.toISOString().should.equal('2024-03-01T00:00:00.000Z');
    });
});

describe('isValidDateTime helper', () => {
    const isValidDateTime = DateTimeUtil.isValidDateTime;

    it('should validate standard UTC date-time components', () => {
        isValidDateTime(2024, 2, 29, 12, 30, 45, 'Z').should.be.true;
    });

    it('should validate date-time components with positive offset', () => {
        isValidDateTime('2024', '05', '15', '23', '59', '59', '+05:30').should.be.true;
    });

    it('should validate date-time components with negative offset', () => {
        isValidDateTime('2024', '05', '15', '00', '00', '00', '-08:00').should.be.true;
    });

    it('should validate years 0 to 99 correctly', () => {
        isValidDateTime(24, 2, 29, 0, 0, 0, 'Z').should.be.true; // 0024 is leap year
        isValidDateTime(23, 2, 29, 0, 0, 0, 'Z').should.be.false; // 0023 is not leap year
    });

    it('should reject non-integer inputs', () => {
        isValidDateTime('abc', 1, 1, 0, 0, 0).should.be.false;
        isValidDateTime(2024, 'xyz', 1, 0, 0, 0).should.be.false;
    });

    it('should reject invalid month', () => {
        isValidDateTime(2024, 0, 15, 0, 0, 0).should.be.false;
        isValidDateTime(2024, 13, 15, 0, 0, 0).should.be.false;
    });

    it('should reject invalid day', () => {
        isValidDateTime(2024, 1, 0, 0, 0, 0).should.be.false;
        isValidDateTime(2024, 1, 32, 0, 0, 0).should.be.false;
    });

    it('should reject impossible dates (Feb 30, non-leap Feb 29, April 31)', () => {
        isValidDateTime(2024, 2, 30, 0, 0, 0).should.be.false;
        isValidDateTime(2023, 2, 29, 0, 0, 0).should.be.false;
        isValidDateTime(2024, 4, 31, 0, 0, 0).should.be.false;
    });

    it('should reject invalid hours (including hour 24)', () => {
        isValidDateTime(2024, 1, 1, -1, 0, 0).should.be.false;
        isValidDateTime(2024, 1, 1, 24, 0, 0).should.be.false;
    });

    it('should reject invalid minutes', () => {
        isValidDateTime(2024, 1, 1, 12, -1, 0).should.be.false;
        isValidDateTime(2024, 1, 1, 12, 60, 0).should.be.false;
    });

    it('should reject invalid seconds', () => {
        isValidDateTime(2024, 1, 1, 12, 0, -1).should.be.false;
        isValidDateTime(2024, 1, 1, 12, 0, 60).should.be.false;
    });

    it('should reject malformed or out-of-range offsets', () => {
        isValidDateTime(2024, 1, 1, 12, 0, 0, 'invalid').should.be.false;
        isValidDateTime(2024, 1, 1, 12, 0, 0, '+24:00').should.be.false;
        isValidDateTime(2024, 1, 1, 12, 0, 0, '+05:60').should.be.false;
    });
});
