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

/**
 * Default levels for the npm configuration.
 */
const levels: { [key: string]: number } = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    verbose: 4,
    debug: 5,
    silly: 6
};

const timestamp = (): string => new Date().toLocaleTimeString();

/**
 * Helper function to format JSON objects
 * @param obj - the input obj to prettify
 * @returns the prettified object
 * @private
 */
const prettifyJson = (obj: any): any => {
    return obj;
};

/**
 * The default transport for logging at multiple levels to the console
 * @param level - the required log level. e.g. error, warn, info, debug, etc.
 * @param args - the arguments to log
 * @private
 */
const defaultTransportShim = (level: string, ...args: any[]): void => {
    let mutatedLevel = level;
    let data = args;
    let first = data.shift();

    if (first && typeof first === 'object' && first.level && first.message) {
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
            .map(obj => (obj instanceof Error ? `${obj.message}\n${obj.stack}` : obj))
            .map(prettifyJson)
    );
};

const defaultTransport: { [key: string]: (...args: any[]) => void } = {};
Object.keys(levels).forEach(level => {
    defaultTransport[level] = (...args) => defaultTransportShim(level, ...args);
});

/**
 * Interface for a logging transport.
 */
interface Transport {
    error?: (...args: any[]) => void;
    warn?: (...args: any[]) => void;
    info?: (...args: any[]) => void;
    debug?: (...args: any[]) => void;
    verbose?: (...args: any[]) => void;
    silly?: (...args: any[]) => void;
    http?: (...args: any[]) => void;
}

/**
 * Interface for a log entry.
 */
interface LogEntry {
    level: 'error' | 'warn' | 'info' | 'debug' | 'verbose' | 'silly' | 'http';
    message: any;
    stack?: string;
    padding?: { [key: string]: string };
}

/**
 * A utility class with functions that print to the console.
 */
class Logger {
    private level: string = 'info';
    private transports: Transport[] = [defaultTransport];

    constructor() {}

    /**
     * Adds a custom transport for logging.
     * @param transport - The transport object should have functions for the usual logging operations e.g. error, warn, info, debug, etc.
     */
    add(transport: Transport): void {
        this.transports.push(transport);
    }

    /**
     * A reusable function for logging at multiple levels.
     * @param level - the required log level. e.g. error, warn, info, debug, etc.
     * @param args - the arguments to log
     * @private
     */
    private dispatch(level: string, ...args: any[]): void {
        if (levels[level] > levels[this.level]) {
            return;
        }

        this.transports.forEach(t => {
            const logMethod = t[level as keyof Transport];
            if (logMethod) {
                logMethod(...args);
            }
        });
    }

    /**
     * Logs a message at the specified level.
     * @param entry - The log entry.
     */
    log(entry: LogEntry): void {
        this.dispatch(entry.level, entry);
    }

    /**
     * Write an error statement to the console.
     * Prints to `stderr` with newline.
     * @param args - The arguments to log.
     */
    error(...args: any[]): void {
        this.dispatch('error', ...args);
    }

    /**
     * Write a warning statement to the console.
     * Prints to `stderr` with newline.
     * @param args - The arguments to log.
     */
    warn(...args: any[]): void {
        this.dispatch('warn', ...args);
    }

    /**
     * Write an info statement to the console.
     * Prints to `stdout` with newline.
     * @param args - The arguments to log.
     */
    info(...args: any[]): void {
        this.dispatch('info', ...args);
    }

    /**
     * Write an http statement to the console.
     * Prints to `stdout` with newline.
     * @param args - The arguments to log.
     */
    http(...args: any[]): void {
        this.dispatch('http', ...args);
    }

    /**
     * Write a verbose log statement to the console.
     * Prints to `stdout` with newline.
     * @param args - The arguments to log.
     */
    verbose(...args: any[]): void {
        this.dispatch('verbose', ...args);
    }

    /**
     * Write a debug statement to the console.
     * Prints to `stdout` with newline.
     * @param args - The arguments to log.
     */
    debug(...args: any[]): void {
        this.dispatch('debug', ...args);
    }

    /**
     * Write a silly level statement to the console.
     * Prints to `stdout` with newline.
     * @param args - The arguments to log.
     */
    silly(...args: any[]): void {
        this.dispatch('silly', ...args);
    }
}

export default new Logger();