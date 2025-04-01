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



import chai, { expect } from 'chai';
import { labelToSentence, sentenceToLabel } from '../src/label';

describe('Label', () => {
    describe('#labelToSentence', () => {
        it('should create a sentence', () => {
            expect(labelToSentence('fullName')).to.equal('Full Name');
        });

        it('should create a sentence for a longer label', () => {
            expect(labelToSentence('fullNameOrEmailAddress')).to.equal('Full Name Or Email Address');
        });

        it('should handle null', () => {
            expect(labelToSentence(undefined)).to.equal('');
        });
    });

    describe('#sentenceToLabel', () => {
        it('should create a label', () => {
            expect(sentenceToLabel('Full Name')).to.equal('fullName');
        });

        it('should create a label for a longer sentence', () => {
            expect(sentenceToLabel('Full name or email address')).to.equal('fullNameOrEmailAddress');
        });

        it('should handle null', () => {
            expect(sentenceToLabel(undefined)).to.equal('');
        });
    });

    describe('#roundtrip', () => {
        it('should roundtrip a label', () => {
            const label = 'fullNameOrEmailAddress';
            const sentence = labelToSentence(label);
            const roundtrippedLabel = sentenceToLabel(sentence);
            expect(roundtrippedLabel).to.equal(label);
        });
    });

    describe('#notroundtrip', () => {
        it('should not always roundtrip a sentence', () => {
            const sentence = "It's really not that hard!";
            expect(sentenceToLabel(sentence)).to.not.equal(sentence);
        });
    });
});