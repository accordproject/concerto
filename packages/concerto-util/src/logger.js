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

/* eslint-disable no-console */
/* eslint-disable no-use-before-define */

/**
 * Default levels for the npm configuration.
 * @type {Object}
 */
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6
};

const timestamp = () => (new Date()).toLocaleTimeString();

/**
* Helper function to format JSON objects
* @param {any} obj - the input obj to prettify
* @returns {any} - the prettified object
* @private
*/
const prettifyJson = (obj) => {
    return obj;
};

/**
* The default transport for logging at multiple levels to the console
* @param {string} level - the required log level. e.g. error, warn, info, debug, etc.
* @param {any} obj - the input obj to prettify
* @returns {void} -
* @private
*/
const defaultTransportShim = (level, ...args) => {
    let mutatedLevel = level;
    let data = args;
    let first = data.shift();

    // Flatten log object
    if(first && typeof first === 'object' && first.level && first.message){
        const padding = first.padding && first.padding[first.level];
        if (first.level === 'error' && first.stack) {
            mutatedLevel = 'error';
            first = `${first.message}\n${first.stack}`;
        } else if (Object.keys(levels).includes(first.level)) {
            mutatedLevel = first.level;
            first = first.message;
        }
        first = padding ? `${padding} ${first}` : first;
    }

    data.unshift(first);

    const stream = ['error', 'warn'].includes(mutatedLevel) ? console.error : console.log;

    stream(
        `${timestamp()} - ${mutatedLevel}:`,
        ...data
            .map(obj => obj instanceof Error ? `${obj.message}\n${obj.stack}`: obj)
            .map(prettifyJson)
    );
};
const defaultTransport = {};
Object.keys(levels).forEach(level => {
    defaultTransport[level] = (...args) => defaultTransportShim(level, ...args);
});

/**
 * A utility class with static function that print to the console
 * @private
 */
class Logger {
    /**
    * A reusable function for logging at multiple levels
    * @param {string} level - the required log level. e.g. error, warn, info, debug, etc.
    * @param {any} obj - the input obj to prettify
    * @returns {void} -
    * @private
    */
    static dispatch(level, ...args) {
        if (levels[level] > levels[this.level]){
            return;
        }

        this.transports.forEach(t => {
            if(t[level]){
                t[level](...args);
            }
        });
    }

    /**
    * Add a custom transport for logging
    * @param {Object} transport - The transport object should have function for the usual logging operations e.g. error, warn, info, debug, etc.
    * @returns {void} -
    * @private
    */
    static add(transport) {
        this.transports.push(transport);
    }

    /**
     * Write an error statement to the console.
     *
     * Prints to `stderr` with newline.
     * @param {any|object} data - if this is an object with properties `level` and `message` it will be flattened first
     * @param {any} args -
     * @returns {void} -
     * @private
     */
    static error(...args){ return this.dispatch('error', ...args); }

    /**
     * Write a warning statement to the console.
     *
     * Prints to `stderr` with newline.
     * @param {any|object} data - if this is an object with properties `level` and `message` it will be flattened first
     * @param {any} args -
     * @returns {void} -
     * @private
     */
    static warn(...args){ return this.dispatch('warn', ...args); }

    /**
     * Write an info statement to the console.
     *
     * Prints to `stdout` with newline.
     * @param {any|object} data - if this is an object with properties `level` and `message` it will be flattened first
     * @param {any} args -
     * @returns {void} -
     * @private
     */
    static info(...args){ return this.dispatch('info', ...args); }

    /**
     * Write an info statement to the console. Alias for `logger.log`
     *
     * Prints to `stdout` with newline.
     * @param {any|object} data - if this is an object with properties `level` and `message` it will be flattened first
     * @param {any} args -
     * @returns {void} -
     * @private
     */
    static log(...args){ return this.info(...args); }

    /**
     * Write an http statement to the console.
     *
     * Prints to `stdout` with newline.
     * @param {any|object} data - if this is an object with properties `level` and `message` it will be flattened first
     * @param {any} args -
     * @returns {void} -
     * @private
     */
    static http(...args){ return this.dispatch('http', ...args); }

    /**
     * Write a verbose log statement to the console.
     *
     * Prints to `stdout` with newline.
     * @param {any|object} data - if this is an object with properties `level` and `message` it will be flattened first
     * @param {any} args -
     * @returns {void} -
     * @private
     */
    static verbose(...args){ return this.dispatch('verbose', ...args); }

    /**
     * Write a debug statement to the console.
     *
     * Prints to `stdout` with newline.
     * @param {any|object} data - if this is an object with properties `level` and `message` it will be flattened first
     * @param {any} args -
     * @returns {void} -
     * @private
     */
    static debug(...args){ return this.dispatch('debug', ...args); }

    /**
     * Write a silly level statement to the console.
     *
     * Prints to `stdout` with newline.
     * @param {any|object} data - if this is an object with properties `level` and `message` it will be flattened first
     * @param {any} args -
     * @returns {void} -
     * @private
     */
    static silly(...args){ return this.dispatch('silly', ...args); }
}

// Set the default logging level
Logger.level = 'info';

// A list of user-provided logging tranports
Logger.transports = [ defaultTransport ];

module.exports = Logger;
