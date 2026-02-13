export = Logger;
/**
 * A utility class with static function that print to the console
 * @private
 */
declare class Logger {
    /**
    * A reusable function for logging at multiple levels
    * @param {string} level - the required log level. e.g. error, warn, info, debug, etc.
    * @param {any} obj - the input obj to prettify
    * @returns {void} -
    * @private
    */
    private static dispatch;
    /**
    * Add a custom transport for logging
    * @param {Object} transport - The transport object should have function for the usual logging operations e.g. error, warn, info, debug, etc.
    * @returns {void} -
    * @private
    */
    private static add;
    /**
     * Write an error statement to the console.
     *
     * Prints to `stderr` with newline.
     * @param {any|object} data - if this is an object with properties `level` and `message` it will be flattened first
     * @param {any} args -
     * @returns {void} -
     * @private
     */
    private static error;
    /**
     * Write a warning statement to the console.
     *
     * Prints to `stderr` with newline.
     * @param {any|object} data - if this is an object with properties `level` and `message` it will be flattened first
     * @param {any} args -
     * @returns {void} -
     * @private
     */
    private static warn;
    /**
     * Write an info statement to the console.
     *
     * Prints to `stdout` with newline.
     * @param {any|object} data - if this is an object with properties `level` and `message` it will be flattened first
     * @param {any} args -
     * @returns {void} -
     * @private
     */
    private static info;
    /**
     * Write an info statement to the console. Alias for `logger.log`
     *
     * Prints to `stdout` with newline.
     * @param {any|object} data - if this is an object with properties `level` and `message` it will be flattened first
     * @param {any} args -
     * @returns {void} -
     * @private
     */
    private static log;
    /**
     * Write an http statement to the console.
     *
     * Prints to `stdout` with newline.
     * @param {any|object} data - if this is an object with properties `level` and `message` it will be flattened first
     * @param {any} args -
     * @returns {void} -
     * @private
     */
    private static http;
    /**
     * Write a verbose log statement to the console.
     *
     * Prints to `stdout` with newline.
     * @param {any|object} data - if this is an object with properties `level` and `message` it will be flattened first
     * @param {any} args -
     * @returns {void} -
     * @private
     */
    private static verbose;
    /**
     * Write a debug statement to the console.
     *
     * Prints to `stdout` with newline.
     * @param {any|object} data - if this is an object with properties `level` and `message` it will be flattened first
     * @param {any} args -
     * @returns {void} -
     * @private
     */
    private static debug;
    /**
     * Write a silly level statement to the console.
     *
     * Prints to `stdout` with newline.
     * @param {any|object} data - if this is an object with properties `level` and `message` it will be flattened first
     * @param {any} args -
     * @returns {void} -
     * @private
     */
    private static silly;
}
declare namespace Logger {
    let level: string;
    let transports: {}[];
}
