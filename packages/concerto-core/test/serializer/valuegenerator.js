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

const ValueGeneratorFactory = require('../../src/serializer/valuegenerator');

const chai = require('chai');
const expect = chai.expect;

describe('ValueGenerator', function() {

    describe('Consistent return types', function() {
        /** Array of names of the static factory methods for obtaining ValueGenerator objects. */
        const generatorNames = Object.getOwnPropertyNames(ValueGeneratorFactory)
            .filter((p) => {
                return typeof ValueGeneratorFactory[p] === 'function';
            });

        /**
         * Check that invoking the supplied function name on all of the ValueGenerator implementations returns the expected type.
         * @param {string} functionName name of the function to invoke.
         * @param {string} type expected return type.
         */
        const assertFunctionReturnsType = (functionName, type) => {
            generatorNames.forEach((generatorName) => {
                const generator = ValueGeneratorFactory[generatorName]();
                const returnValue = generator[functionName]();
                expect(returnValue, generatorName + '.' + functionName + '() should return a ' + type)
                    .to.be.a(type);
            });
        };

        it('getDateTime should return a Date', function() {
            assertFunctionReturnsType('getDateTime', 'Object');
        });

        it('getInteger should return a number', function() {
            assertFunctionReturnsType('getInteger', 'number');
        });

        it('getLong should return a number', function() {
            assertFunctionReturnsType('getLong', 'number');
        });

        it('getDouble should return a number', function() {
            assertFunctionReturnsType('getDouble', 'number');
        });

        it('getBoolean should return a boolean', function() {
            assertFunctionReturnsType('getBoolean', 'boolean');
        });

        it('getMap should return a map', function() {
            assertFunctionReturnsType('getMap', 'Map');
        });

        it('getString should return a string', function() {
            assertFunctionReturnsType('getString', 'string');
        });

        it('getRange should return a number', function() {
            assertFunctionReturnsType('getRange', 'number');
        });

        it('getRegex should return a string', function() {
            assertFunctionReturnsType('getRegex', 'string');
        });
    });

    describe('EmptyValueGenerator', function() {
        it('getEnum should return the first value', function() {
            const inputs = ['One', 'Two', 'Three'];
            const output = ValueGeneratorFactory.empty().getEnum(inputs);
            expect(output).to.equal(inputs[0]);
        });

        it('getArray should return empty array', function() {
            const output = ValueGeneratorFactory.empty().getArray(() => '');
            expect(output).to.be.a('Array').that.is.empty;
        });

        it('getRegex should return a string that matches the regex', function() {
            const regex = /\S+\.(zip|docx)$/;
            const output = ValueGeneratorFactory.empty().getRegex(regex);
            expect(regex.test(output)).to.be.true;
        });

        it('getString should return a string with given length constraint', function() {
            [
                [1, 100],
                [null, 100],
                [1, null],
                [1, 1],
                [null, null],
                [100, null],
            ].forEach(([min, max]) => {
                const output = ValueGeneratorFactory.empty().getString(min, max);
                expect(output !== null).to.be.true;
                if (min) {
                    expect(output.length >= min).to.be.true;
                }
                if (max) {
                    expect(output.length <= max).to.be.true;
                }
            });
        });

        it('getRange should return a Long in range', function() {
            const output = ValueGeneratorFactory.empty().getRange(0, 100, 'Long');
            expect(output).to.be.a('number');
            expect(output).to.be.at.least(0);
            expect(output).to.be.at.most(100);

            const output2 = ValueGeneratorFactory.empty().getRange(null, 100, 'Long');
            expect(output2).to.be.a('number');
            expect(output2).to.be.at.least(-Math.pow(2, 32));
            expect(output2).to.be.at.most(100);

            const output3 = ValueGeneratorFactory.empty().getRange(0, null, 'Long');
            expect(output3).to.be.a('number');
            expect(output3).to.be.at.least(0);
            expect(output3).to.be.at.most(Math.pow(2, 32));
        });

        it('getRange should return an Integer in range', function() {
            const output = ValueGeneratorFactory.empty().getRange(0, 100, 'Integer');
            expect(output).to.be.a('number');
            expect(output).to.be.at.least(0);
            expect(output).to.be.at.most(100);

            const output2 = ValueGeneratorFactory.empty().getRange(null, 100, 'Integer');
            expect(output2).to.be.a('number');
            expect(output2).to.be.at.least(-Math.pow(2, 16));
            expect(output2).to.be.at.most(100);

            const output3 = ValueGeneratorFactory.empty().getRange(0, null, 'Integer');
            expect(output3).to.be.a('number');
            expect(output3).to.be.at.least(0);
            expect(output3).to.be.at.most(Math.pow(2, 16));
        });

        it('getRange should return a Double in range', function() {
            const output = ValueGeneratorFactory.empty().getRange(0.0, 100.0, 'Double');
            expect(output).to.be.a('number');
            expect(output).to.be.at.least(0.0);
            expect(output).to.be.at.most(100.0);

            const output2 = ValueGeneratorFactory.empty().getRange(null, 100, 'Double');
            expect(output2).to.be.a('number');
            expect(output2).to.be.at.least(-Math.pow(2, 32));
            expect(output2).to.be.at.most(100.0);

            const output3 = ValueGeneratorFactory.empty().getRange(0, null, 'Double');
            expect(output3).to.be.a('number');
            expect(output3).to.be.at.least(0.0);
            expect(output3).to.be.at.most(Math.pow(2, 32));
        });
    });

    describe('SampleValueGenerator', function() {
        it('getEnum should return one of the input values', function() {
            const inputs = ['One', 'Two', 'Three'];
            const output = ValueGeneratorFactory.sample().getEnum(inputs);
            expect(inputs).to.include(output);
        });

        it('getArray should return array with one element obtained from callback', function() {
            const value = 'TEST_VALUE';
            const output = ValueGeneratorFactory.sample().getArray(() => value);
            expect(output).to.be.a('Array').and.deep.equal([value]);
        });

        it('getRegex should return a string that matches the regex', function() {
            const regex = /\S+\.(zip|docx)$/;
            const output = ValueGeneratorFactory.sample().getRegex(regex);
            expect(regex.test(output)).to.be.true;
        });

        it('getRegex with string length should return a string that matches the regex', function() {
            [
                [1, 100],
                [null, 100],
                [1, null],
                [1, 1],
                [null, null],
                [100, null],
            ].forEach(([min, max]) => {
                const regex = /^[a-zA-Z0-9_]*$/;
                const output = ValueGeneratorFactory.sample().getRegex(regex, min, max);
                expect(regex.test(output)).to.be.true;
                if (min) {
                    expect(output.length >= min).to.be.true;
                }
                if (max) {
                    expect(output.length <= max).to.be.true;
                }
            });
        });

        it('getString with length should return a string that matches the length constraint', function() {
            [
                [1, 100],
                [null, 100],
                [1, null],
                [1, 1],
                [null, null],
                [100, null],
            ].forEach(([min, max]) => {
                const output = ValueGeneratorFactory.sample().getString(min, max);
                expect(output !== null).to.be.true;
                if (min) {
                    expect(output.length >= min).to.be.true;
                }
                if (max) {
                    expect(output.length <= max).to.be.true;
                }
            });
        });

        it('getRange should return a Long in range', function() {
            const output = ValueGeneratorFactory.sample().getRange(0, 100, 'Long');
            expect(output).to.be.a('number');
            expect(output).to.be.at.least(0);
            expect(output).to.be.at.most(100);

            const output2 = ValueGeneratorFactory.sample().getRange(null, 100, 'Long');
            expect(output2).to.be.a('number');
            expect(output2).to.be.at.least(-Math.pow(2, 32));
            expect(output2).to.be.at.most(100);

            const output3 = ValueGeneratorFactory.sample().getRange(0, null, 'Long');
            expect(output3).to.be.a('number');
            expect(output3).to.be.at.least(0);
            expect(output3).to.be.at.most(Math.pow(2, 32));
        });

        it('getRange should return an Integer in range', function() {
            const output = ValueGeneratorFactory.sample().getRange(0, 100, 'Integer');
            expect(output).to.be.a('number');
            expect(output).to.be.at.least(0);
            expect(output).to.be.at.most(100);

            const output2 = ValueGeneratorFactory.sample().getRange(null, 100, 'Integer');
            expect(output2).to.be.a('number');
            expect(output2).to.be.at.least(-Math.pow(2, 16));
            expect(output2).to.be.at.most(100);

            const output3 = ValueGeneratorFactory.sample().getRange(0, null, 'Integer');
            expect(output3).to.be.a('number');
            expect(output3).to.be.at.least(0);
            expect(output3).to.be.at.most(Math.pow(2, 16));

            const output4 = ValueGeneratorFactory.sample().getRange(null, null, 'Integer');
            expect(output4).to.be.a('number');
            expect(output4).to.be.at.least(-Math.pow(2, 16));
            expect(output4).to.be.at.most(Math.pow(2, 16));
        });

        it('getRange should reverse arguments if range is the wrong way around', function() {
            const output = ValueGeneratorFactory.sample().getRange(1.0, 0.0, 'Double');
            expect(output).to.be.a('number');
            expect(output).to.be.at.least(0);
            expect(output).to.be.at.most(1);
        });

        it('getRange should return a Double in range', function() {
            [
                [0.0, 100.0],
                [null, 100.0],
                [0.0, null],
                [0.0, 0.0],
                [null, null],
                [6681493, 6681493],
                [Infinity, Infinity],
                [-Infinity, -Infinity],
                [-Infinity, Infinity],
                [0.0, Infinity],
            ].forEach(([min, max]) => {
                const output = ValueGeneratorFactory.sample().getRange(min, max, 'Double');
                expect(output).to.be.a('number');
                const absoluteMax = Math.pow(2, 8);
                const atLeastValue = min ? Math.min(Math.max(min, -absoluteMax), absoluteMax): -absoluteMax;
                const atMostValue = max ? Math.max(Math.min(max, absoluteMax), -absoluteMax): absoluteMax;
                expect(output).to.be.at.least(atLeastValue);
                expect(output).to.be.at.most(atMostValue);
            });
        });
    });

});
