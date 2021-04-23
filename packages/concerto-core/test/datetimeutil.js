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

const DateTimeUtil = require('../lib/datetimeutil');

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
        return (() => DateTimeUtil.setCurrentTime('foobar')).should.throw('Cannot set current time to \'foobar\' with UTC offset \'undefined\'');
    });
    it('Should not fail when currentTime is null', function () {
        const { currentTime } = DateTimeUtil.setCurrentTime(null);
        return currentTime.format().should.not.be.null;
    });
    it('Should not fail when currentTime is undefined', function () {
        const { currentTime } = DateTimeUtil.setCurrentTime(null);
        return currentTime.format().should.not.be.null;
    });
});
