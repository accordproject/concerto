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

const { labelToSentence, sentenceToLabel } = require('../dist/label');

require('chai').should();

describe('Label', function () {

    describe('#labelToSentence', function() {
        it('should create a sentence', function() {
            labelToSentence('fullName').should.equal('Full Name');
        });

        it('should create a sentence for a longer label', function() {
            labelToSentence('fullNameOrEmailAddress').should.equal('Full Name Or Email Address');
        });

        it('should handle null', function() {
            labelToSentence().should.equal('');
        });

    });

    describe('#sentenceToLabel', function() {
        it('should create a label', function() {
            sentenceToLabel('Full Name').should.equal('fullName');
        });

        it('should create a label for a longer sentence', function() {
            sentenceToLabel('Full name or email address').should.equal('fullNameOrEmailAddress');
        });

        it('should handle null', function() {
            sentenceToLabel().should.equal('');
        });

    });

    describe('#roundtrip', function() {
        it('should rountrip a label', function() {
            const label = 'fullNameOrEmailAddress';
            sentenceToLabel(label).should.equal(label);
        });
    });

    describe('#notroundtrip', function() {
        it('should not always rountrip a sentence', function() {
            const sentence = 'It\'s really not that hard!';
            sentenceToLabel(sentence).should.not.equal(sentence);
        });
    });
});
