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

import RandExp from 'randexp';
import dayjs from '../dayjs-setup';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type { Dayjs } from 'dayjs';
/* eslint-enable no-unused-vars */

const LOREM_WORDS = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'et', 'magna', 'aliqua', 'enim', 'ad', 'minim', 'veniam', 'quis', 'nostrud', 'exercitation', 'ullamco', 'laboris', 'nisi', 'aliquip', 'ex', 'ea', 'commodo'];

/**
 * Generate a random lorem-ipsum-like sentence of one to five words. The
 * trailing period preserves visible word boundaries when getString
 * concatenates multiple sentences to satisfy a length constraint.
 * @return {string} a non-empty sentence.
 * @private
 */
const generateSentence = () => {
    const wordCount = Math.floor(Math.random() * 5) + 1;
    const words: string[] = [];
    for (let i = 0; i < wordCount; i++) {
        words.push(LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)]);
    }
    const sentence = words.join(' ');
    return sentence.charAt(0).toUpperCase() + sentence.substring(1) + '.';
};

/**
 * Generate a random number within a given range with
 * a prescribed precision and inside a global range
 * @param {*} userMin - Lower bound on the range, inclusive. Defaults to systemMin
 * @param {*} userMax - Upper bound on the range, inclusive. Defaults to systemMax
 * @param {*} precision - The precision of values returned, e.g. a value of `1` returns only whole numbers
 * @param {*} systemMin - Global minimum on the range, takes precidence over the userMin
 * @param {*} systemMax - Global maximum on the range, takes precidence over the userMax
 * @return {number} a number
 */
const randomNumberInRangeWithPrecision = function (userMin, userMax, precision, systemMin, systemMax) {
    if (userMin === null) {
        userMin = systemMin;
    }
    userMin = Math.min(Math.max(userMin, systemMin), systemMax);
    if (userMax === null || userMax > systemMax) {
        userMax = systemMax;
    }
    userMax = Math.max(Math.min(userMax, systemMax), systemMin);
    userMax += precision;
    userMax = userMax / precision;
    userMin = userMin / precision;
    let randomNumber = (Math.random() * (userMax - userMin) + userMin);
    return randomNumber / (1 / precision);
};

/**
 * Get a random value from the range.
 * @param {number} lowerBound the lower bound on the range, inclusive.
 * @param {number} upperBound the upper bound on the range, inclusive.
 * @param {string} type the number type for the range,
 *  `'Long'`, `'Double'`, or `'Integer'`
 * @return {number} a number.
 * @private
 */
const getRange = (lowerBound, upperBound, type) => {
    let min = lowerBound;
    let max = upperBound;
    if (max !== null && min !== null && max < min) {
        min = upperBound;
        max = lowerBound;
    }
    switch(type){
    case 'Long':
        return Math.floor(
            randomNumberInRangeWithPrecision(min, max, 1, -Math.pow(2, 32), Math.pow(2, 32))
        );
    case 'Integer': {
        return Math.floor(
            randomNumberInRangeWithPrecision(min, max, 1, -Math.pow(2, 16), Math.pow(2, 16))
        );
    }
    case 'Double': {
        // IEEE 754 numbers can be larger,
        // but we don't need the whole range when generating a sample random number
        return Number(
            randomNumberInRangeWithPrecision(min, max, 0.0001, -Math.pow(2, 8), Math.pow(2, 8))
                .toFixed(3)
        );
    }
    default:
        return 0;
    }
};

/**
 * Get a randomly generated sample String value with lower and upper bound.
 * @param {string} seedString a String value.
 * @param {number} minLength the lower bound on the range, inclusive.
 * @param {number} maxLength the upper bound on the range, inclusive.
 * @param {Function}  stringGenFunc String gen function
 * @return {string} a String value.
 * @private
 */
const generateString = (seedString, minLength, maxLength, stringGenFunc) => {
    minLength ??= 0; //set to 0 if null or underfined
    maxLength ??= null; //set to null if null or undefined.
    const stringLength = getRange(minLength, maxLength, 'Integer');
    while(seedString.length < stringLength) {
        seedString += stringGenFunc();
    }
    return seedString.substring(0, stringLength);
};

/**
 * Get a randomly generated sample String value with lower and upper bound.
 * @param {number} minLength the lower bound on the range, inclusive.
 * @param {number} maxLength the upper bound on the range, inclusive.
 * @return {string} a String value.
 * @private
 */
const getString = (minLength, maxLength) => {
    let stringValue = generateSentence();

    if (minLength || maxLength) {
        stringValue = generateString(stringValue, minLength, maxLength, () => generateSentence());
    }
    return stringValue;
};


/**
 * Determine whether the length of a value is within the given bounds. A null or
 * undefined bound is not enforced.
 * @param {string} value the value to test.
 * @param {number} minLength the lower bound on the range, inclusive.
 * @param {number} maxLength the upper bound on the range, inclusive.
 * @return {boolean} true if the length of the value is within the bounds.
 * @private
 */
const isLengthInRange = (value, minLength, maxLength) => {
    if (minLength !== null && minLength !== undefined && value.length < minLength) {
        return false;
    }
    if (maxLength !== null && maxLength !== undefined && value.length > maxLength) {
        return false;
    }
    return true;
};

/**
 * Get a randomly generated sample regex String value with lower and upper bound.
 * @param {RegExp} regex A regular expression.
 * @param {number} minLength the lower bound on the range, inclusive.
 * @param {number} maxLength the upper bound on the range, inclusive.
 * @return {string} a String value.
 * @private
 */
const getRegexString = (regex, minLength, maxLength) => {
    if (!regex) {
        return '';
    }
    const randexp = new RandExp(regex.source, regex.flags);
    let stringValue = randexp.gen();
    // Padding or truncating the generated value to a random length in the range would
    // stop it matching the regex, so only reshape it when it is outside the range.
    // isLengthInRange treats a null or undefined bound as unenforced, so no
    // separate truthiness gate: that would also skip a legitimate bound of 0.
    if (!isLengthInRange(stringValue, minLength, maxLength)) {
        stringValue = generateString(stringValue, minLength, maxLength, () => randexp.gen());
    }
    return stringValue;
};



/**
 * Empty value generator.
 * @private
 */
class EmptyValueGenerator {
    currentDate: Dayjs;
    /**
     * This constructor should not be called directly.
     * @private
     */
    constructor() {
        this.currentDate = dayjs.utc();
    }

    /**
     * Get a default DateTime value.
     * @return {object} a date value.
     */
    getDateTime() {
        return this.currentDate;
    }

    /**
     * Get a default Integer value.
     * @return {number} an Integer value.
     */
    getInteger() {
        return 0;
    }

    /**
     * Get a default Long value.
     * @return {number} a Long value.
     */
    getLong() {
        return 0;
    }

    /**
     * Get a default Double value.
     * @return {number} a Double value.
     */
    getDouble() {
        return 0.000;
    }

    /**
     * Get a default Boolean value.
     * @return {boolean} a Boolean value.
     */
    getBoolean() {
        return false;
    }

    /**
     * Get a randomly generated sample String value with lower and upper bound.
     * @param {number} minLength the lower bound on the range, inclusive.
     * @param {number} maxLength the upper bound on the range, inclusive.
     * @return {string} a String value.
     */
    getString(minLength, maxLength) {
        if (minLength || maxLength) {
            return getString(minLength, maxLength);
        }
        return '';
    }

    /**
     * Get the first enum value from the supplied array.
     * @param {Array} enumValues Array of possible enum values.
     * @return {*} an enum value.
     */
    getEnum(enumValues) {
        return enumValues[0];
    }

    /**
     * Get an instance of an empty map.
     * @return {*} an map value.
     */
    getMap() {
        return new Map();
    }

    /**
     * Get an array using the supplied callback to obtain array values.
     * @param {Function} valueSupplier - callback to obtain values.
     * @return {Array} an array
     */
        getArray<T>(valueSupplier: () => T): T[] {
            return [];
    }

    /**
     * Get a randomly generated sample regex String value with lower and upper bound.
     * @param {RegExp} regex A regular expression.
     * @param {number} minLength the lower bound on the range, inclusive.
     * @param {number} maxLength the upper bound on the range, inclusive.
     * @return {string} a String value.
     */
    getRegex(regex, minLength, maxLength) {
        return getRegexString(regex, minLength, maxLength);
    }

    /**
     * Get a random value from the range.
     * @param {number} lowerBound the lower bound on the range, inclusive.
     * @param {number} upperBound the upper bound on the range, inclusive.
     * @param {string} type the number type for the range,
     *  `'Long'`, `'Double'`, or `'Integer'`
     * @return {number} a number.
     */
    getRange(lowerBound, upperBound, type) {
        return getRange(lowerBound, upperBound, type);
    }
}

/**
 * Sample data value generator.
 * @private
 */
class SampleValueGenerator extends EmptyValueGenerator {
    /**
     * This constructor should not be called directly.
     * @private
     */
    constructor() {
        super();
    }

    /**
     * Get a randomly generated sample Integer value.
     * @return {number} an Integer value.
     */
    getInteger() {
        return Math.round(Math.random() * Math.pow(2, 16));
    }

    /**
     * Get a randomly generated sample Long value.
     * @return {number} a Long value.
     */
    getLong() {
        return Math.round(Math.random() * Math.pow(2, 32));
    }

    /**
     * Get a randomly generated sample Double value.
     * @return {number} a Double value.
     */
    getDouble() {
        return Number((Math.random() * Math.pow(2, 8)).toFixed(3));
    }

    /**
     * Get a randomly generated sample Boolean value.
     * @return {boolean} a Boolean value.
     */
    getBoolean() {
        return Math.round(Math.random()) === 1;
    }

    /**
     * Get a randomly generated sample String value with lower and upper bound.
     * @param {number} minLength the lower bound on the range, inclusive.
     * @param {number} maxLength the upper bound on the range, inclusive.
     * @return {string} a String value.
     */
    getString(minLength, maxLength) {
        return getString(minLength, maxLength);
    }


    /**
     * Get a randomly selected enum value from the supplied array.
     * @param {Array} enumValues Array of possible enum values.
     * @return {*} an enum value.
     */
    getEnum(enumValues) {
        return enumValues[Math.floor(Math.random() * enumValues.length)];
    }

    /**
     * Get a map instance with randomly generated values for key & value.
     * @return {*} a map value.
     */
    getMap() {
        return new Map([[this.getString(1,10), this.getString(1,10)]]);
    }

    /**
     * Get an array using the supplied callback to obtain array values.
     * @param {Function} valueSupplier - callback to obtain values.
     * @return {Array} an array
     */
    getArray<T>(valueSupplier: () => T): T[] {
        return [valueSupplier()];
    }

    /**
     * Get a randomly generated sample regex String value with lower and upper bound.
     * @param {RegExp} regex A regular expression.
     * @param {number} minLength the lower bound on the range, inclusive.
     * @param {number} maxLength the upper bound on the range, inclusive.
     * @return {string} a String value.
     */
    getRegex(regex, minLength, maxLength) {
        return getRegexString(regex, minLength, maxLength);
    }

    /**
     * Get a random value from the range.
     * @param {number} lowerBound the lower bound on the range, inclusive.
     * @param {number} upperBound the upper bound on the range, inclusive.
     * @param {string} type the number type for the range,
     *  `'Long'`, `'Double'`, or `'Integer'`
     * @return {number} a number.
     */
    getRange(lowerBound, upperBound, type) {
        return getRange(lowerBound, upperBound, type);
    }
}

/**
 * Factory providing static methods to create ValueGenerator instances.
 * @private
 */
class ValueGeneratorFactory {
    /**
     * Create a value generator that supplies empty values.
     * @return {ValueGenerator} a value generator.
     */
    static empty() {
        return new EmptyValueGenerator();
    }

    /**
     * Create a value generator that supplies randomly generated sample values.
     * @return {ValueGenerator} a value generator.
     */
    static sample() {
        return new SampleValueGenerator();
    }
}

export { ValueGeneratorFactory, EmptyValueGenerator, SampleValueGenerator };
export default ValueGeneratorFactory;
