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

const timestamp = () => (new Date()).toLocaleTimeString();

/**
* Helper function to format JSON objects
* @param obj - the input obj to prettify
* @returns - the prettified object
*/
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prettifyJson = (obj: any): any => {
    return obj;
};

/**
* The default transport for logging at multiple levels to the console
* @param level - the required log level. e.g. error, warn, info, debug, etc.
* @param args - the input obj to prettify
*/
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const defaultTransportShim = (level: string, ...args: any[]): void => {
    let mutatedLevel = level;
    const data = args;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const defaultTransport: Record<string, any> = {};
Object.keys(levels).forEach(level => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    defaultTransport[level] = (...args: any[]) => defaultTransportShim(level, ...args);
});

/**
 * A utility class with static function that print to the console
 */
class Logger {
    static level = 'info';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static transports: any[] = [ defaultTransport ];

    /**
    * A reusable function for logging at multiple levels
    * @param level - the required log level. e.g. error, warn, info, debug, etc.
    * @param args - the input obj to prettify
    */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static dispatch(level: string, ...args: any[]): void {
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
    * @param transport - The transport object should have function for the usual logging operations e.g. error, warn, info, debug, etc.
    */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static add(transport: any): void {
        this.transports.push(transport);
    }

    /**
     * Write an error statement to the console.
     *
     * Prints to `stderr` with newline.
     * @param args - args
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static error(...args: any[]): void{ this.dispatch('error', ...args); }

    /**
     * Write a warning statement to the console.
     *
     * Prints to `stderr` with newline.
     * @param args - args
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static warn(...args: any[]): void{ this.dispatch('warn', ...args); }

    /**
     * Write an info statement to the console.
     *
     * Prints to `stdout` with newline.
     * @param args - args
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static info(...args: any[]): void{ this.dispatch('info', ...args); }

    /**
     * Write an info statement to the console. Alias for `logger.log`
     *
     * Prints to `stdout` with newline.
     * @param args - args
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static log(...args: any[]): void{ this.info(...args); }

    /**
     * Write an http statement to the console.
     *
     * Prints to `stdout` with newline.
     * @param args - args
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static http(...args: any[]): void{ this.dispatch('http', ...args); }

    /**
     * Write a verbose log statement to the console.
     *
     * Prints to `stdout` with newline.
     * @param args - args
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static verbose(...args: any[]): void{ this.dispatch('verbose', ...args); }

    /**
     * Write a debug statement to the console.
     *
     * Prints to `stdout` with newline.
     * @param args - args
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static debug(...args: any[]): void{ this.dispatch('debug', ...args); }

    /**
     * Write a silly level statement to the console.
     *
     * Prints to `stdout` with newline.
     * @param args - args
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static silly(...args: any[]): void{ this.dispatch('silly', ...args); }
}

export = Logger;