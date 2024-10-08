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

const chai = require('chai');
chai.use(require('chai-as-promised'));
chai.use(require('chai-things'));
const NullUtil = require('../lib/null');

describe('NullUtil', function () {

    describe('#NullUtil', function() {
        it('isNull null should be true', function() {
            NullUtil.isNull(null).should.be.true;
        });

        it('isNull undefined should be true', function() {
            NullUtil.isNull(undefined).should.be.true;
        });

        it('isNull "value" should be false', function() {
            NullUtil.isNull('value').should.be.false;
        });

        it('isNull 10 should be false', function() {
            NullUtil.isNull(10).should.be.false;
        });
    });
});