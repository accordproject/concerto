/**
 * Internal Utility Class
 * @class
 * @memberof module:concerto-util
 */
declare class NullUtil {
    /**
     * Returns true if the typeof the object === 'undefined' or
     * the object === null.
     * @param obj - the object to be tested
     * @returns true if the object is null or undefined
     */
    static isNull(obj: unknown): boolean;
}
export = NullUtil;
