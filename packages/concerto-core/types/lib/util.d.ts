export = Util;
/**
 * Internal Utility Class
 * <p><a href="./diagrams-private/util.svg"><img src="./diagrams-private/util.svg" style="height:100%;"/></a></p>
 * @private
 * @class
 * @memberof module:concerto-core
 */
declare class Util {
    /**
     * Returns true if the typeof the object === 'undefined' or
     * the object === null.
     * @param {Object} obj - the object to be tested
     * @returns {boolean} true if the object is null or undefined
     */
    static isNull(obj: any): boolean;
}
