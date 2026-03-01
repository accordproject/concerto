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
const expect = chai.expect;
const { MonetaryUtil } = require('../index');

describe('MonetaryUtil', () => {
    describe('#toWords', () => {
        it('should convert number to words', () => {
            const result = MonetaryUtil.toWords(120);
            expect(result).to.equal('one hundred and twenty');
        });

        it('should handle large numbers', () => {
            const result = MonetaryUtil.toWords(1234);
            // Removed the comma after "thousand" to match n2words output
            expect(result).to.equal('one thousand two hundred and thirty-four');
        });

        it('should handle other languages (fr)', () => {
            const result = MonetaryUtil.toWords(120, 'fr');
            expect(result).to.equal('cent vingt');
        });
    });
});