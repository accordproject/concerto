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

const loremIpsum = require('lorem-ipsum');
const Moment = require('moment-mini');
const RandExp = require('randexp');

const getRange = (lowerBound, upperBound, type) => {
    let max = upperBound;
    let min = lowerBound;
    if (max && min && max < min){
        min = upperBound;
        max = lowerBound;
    }
    switch(type){
    case 'Long':
        if (min === null) {
            min = -Math.pow(2, 32);
        }
        if (max === null) {
            max = Math.pow(2, 32);
        }
        return Math.floor(Math.random() * (max - min + 1) + min);
    case 'Integer': {
        if (min === null) {
            min = -Math.pow(2, 16);
        }
        if (max === null) {
            max = Math.pow(2, 16);
        }
        return Math.floor(Math.random() * (max - min + 1) + min);
    }
    case 'Double': {
        if (min === null) {
            min = -Math.pow(2, 8);
        }
        if (max === null) {
            max = Math.pow(2, 8);
        }
        return Number((Math.random() * (max - min) + min).toFixed(3));
    }
    default:
        return 0;
    }
};

/**
 * Empty value generator.
 * @private
 */
class EmptyValueGenerator {
    /**
     * This constructor should not be called directly.
     * @private
     */
    constructor() {
        this.currentDate = new Moment();
    }

    /**
     * Get a default DateTime value.
     * @return {Moment} a date value.
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
     * Get a default String value.
     * @return {string} a String value.
     */
    getString() {
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
     * Get an array using the supplied callback to obtain array values.
     * @param {Function} valueSupplier - callback to obtain values.
     * @return {Array} an array
     */
    getArray(valueSupplier) {
        return [];
    }

    /**
     * Get a default Regex value.
     * @param {RegExp} regex A regular expression.
     * @return {string} a String value.
     */
    getRegex(regex) {
        return regex ? new RandExp(regex).gen() : '';
    }

    /**
     * Get a default range value.
     * @param {number} lowerBound the lower bound on the range.
     * @param {number} upperBound the upper bound on the range.
     * @param {string} type the number type for the range
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
     * Get a randomly generated sample String value.
     * @return {string} a String value.
     */
    getString() {

        return loremIpsum({
            count: 1                        // Number of words, sentences, or paragraphs to generate.
            , units: 'sentences'            // Generate words, sentences, or paragraphs.
            , sentenceLowerBound: 1         // Minimum words per sentence.
            , sentenceUpperBound: 5         // Maximum words per sentence.

        });
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
     * Get an array using the supplied callback to obtain array values.
     * @param {Function} valueSupplier - callback to obtain values.
     * @return {Array} an array
     */
    getArray(valueSupplier) {
        return [valueSupplier()];
    }

    /**
     * Get a default Regex value.
     * @param {RegExp} regex A regular expression.
     * @return {string} a String value.
     */
    getRegex(regex) {
        return regex ? new RandExp(regex).gen() : '';
    }

    /**
     * Get a default range value.
     * @param {number} lowerBound the lower bound on the range.
     * @param {number} upperBound the upper bound on the range.
     * @param {string} type the number type for the range
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

module.exports = ValueGeneratorFactory;
