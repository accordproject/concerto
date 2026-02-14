export = MonetaryUtil;
/**
 * Utilities for monetary and number formatting.
 * @class
 * @memberof module:concerto-util
 */
declare class MonetaryUtil {
    /**
     * Converts a number to its written word representation.
     * @param {number} number - The number to convert (e.g. 100)
     * @param {string} [lang='en'] - The language code (default 'en')
     * @returns {string} The written string (e.g. "one hundred")
     */
    static toWords(number: number, lang?: string): string;
}
