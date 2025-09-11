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

/* eslint-disable no-console */
/* eslint-disable no-use-before-define */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const colors = require('colors/safe');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const jsonColorize = require('json-colorizer');

/**
 * Default levels for the npm configuration.
 */
const levels: Record<string, number> = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6
};

/**
 * Default levels for the npm configuration.
 */
const colorMap: Record<string, string> = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    verbose: 'cyan',
    debug: 'blue',
    silly: 'magenta'
};

const timestamp = (): string => (new Date()).toLocaleTimeString();
const colorize = (level: string): string => colors[colorMap[level]](level.toUpperCase());

/**
* Helper function to test if a string is a stringified version of a JSON object
* @param str - the input string to test
* @returns true iff the string can be parsed as JSON
* @private
*/
const isJson = (str: any): boolean => {
    try {
        return (JSON.parse(str) && !!str);
    } catch (e) {
        return false;
    }
};

/**
* Helper function to color and format JSON objects
* @param obj - the input obj to prettify
* @returns the prettified object
* @private
*/
const prettifyJson = (obj: any): any => {
    if(typeof obj === 'object' || isJson(obj)) {
        return jsonColorize(obj, { pretty: true, colors });
    }
    return obj;
};

/**
* The default transport for logging at multiple levels to the console
* @param level - the required log level. e.g. error, warn, info, debug, etc.
* @param args - the input args to prettify
* @returns void
* @private
*/
const defaultTransportShim = (level: string, ...args: any[]): void => {
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
        `${timestamp()} - ${colorize(mutatedLevel)}:`,
        ...data
            .map(obj => obj instanceof Error ? `${obj.message}\n${obj.stack}`: obj)
            .map(prettifyJson)
    );
};
const defaultTransport: Record<string, (...args: any[]) => void> = {};
Object.keys(levels).forEach(level => {
    defaultTransport[level] = (...args: any[]) => defaultTransportShim(level, ...args);
});

/**
 * A utility class with static function that print to the console
 * @private
 */
export class Logger {
    static level: string = 'info';
    static transports: any[] = [defaultTransport];

    /**
    * A reusable function for logging at multiple levels
    * @param level - the required log level. e.g. error, warn, info, debug, etc.
    * @param args - the input args to prettify
    * @returns void
    * @private
    */
    static dispatch(level: string, ...args: any[]): void {
        if (levels[level] > levels[this.level]){
            return;
        }

        this.transports.forEach((t: any) => {
            if(t[level]){
                t[level](...args);
            }
        });
    }

    /**
    * Add a custom transport for logging
    * @param transport - The transport object should have function for the usual logging operations e.g. error, warn, info, debug, etc.
    * @returns void
    * @private
    */
    static add(transport: any): void {
        this.transports.push(transport);
    }

    /**
     * Write an error statement to the console.
     *
     * Prints to `stderr` with newline.
     * @param args - if this is an object with properties `level` and `message` it will be flattened first
     * @returns void
     * @private
     */
    static error(...args: any[]): void { return this.dispatch('error', ...args); }

    /**
     * Write a warning statement to the console.
     *
     * Prints to `stderr` with newline.
     * @param args - if this is an object with properties `level` and `message` it will be flattened first
     * @returns void
     * @private
     */
    static warn(...args: any[]): void { return this.dispatch('warn', ...args); }

    /**
     * Write an info statement to the console.
     *
     * Prints to `stdout` with newline.
     * @param args - if this is an object with properties `level` and `message` it will be flattened first
     * @returns void
     * @private
     */
    static info(...args: any[]): void { return this.dispatch('info', ...args); }

    /**
     * Write an info statement to the console. Alias for `logger.log`
     *
     * Prints to `stdout` with newline.
     * @param args - if this is an object with properties `level` and `message` it will be flattened first
     * @returns void
     * @private
     */
    static log(...args: any[]): void { return this.info(...args); }

    /**
     * Write an http statement to the console.
     *
     * Prints to `stdout` with newline.
     * @param args - if this is an object with properties `level` and `message` it will be flattened first
     * @returns void
     * @private
     */
    static http(...args: any[]): void { return this.dispatch('http', ...args); }

    /**
     * Write a verbose log statement to the console.
     *
     * Prints to `stdout` with newline.
     * @param args - if this is an object with properties `level` and `message` it will be flattened first
     * @returns void
     * @private
     */
    static verbose(...args: any[]): void { return this.dispatch('verbose', ...args); }

    /**
     * Write a debug statement to the console.
     *
     * Prints to `stdout` with newline.
     * @param args - if this is an object with properties `level` and `message` it will be flattened first
     * @returns void
     * @private
     */
    static debug(...args: any[]): void { return this.dispatch('debug', ...args); }

    /**
     * Write a silly level statement to the console.
     *
     * Prints to `stdout` with newline.
     * @param args - if this is an object with properties `level` and `message` it will be flattened first
     * @returns void
     * @private
     */
    static silly(...args: any[]): void { return this.dispatch('silly', ...args); }
}

module.exports = Logger;
