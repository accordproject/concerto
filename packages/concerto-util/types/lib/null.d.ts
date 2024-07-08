export = NullUtil;
/**
 * Internal Utility Class
 * @class
 * @memberof module:concerto-util
 */
declare class NullUtil {
    /**
     * Returns true if the typeof the object === 'undefined' or
     * the object === null.
     * @param {Object} obj - the object to be tested
     * @returns {boolean} true if the object is null or undefined
     */
    static isNull(obj: any): boolean;
}
