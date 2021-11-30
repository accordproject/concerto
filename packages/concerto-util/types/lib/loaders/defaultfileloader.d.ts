export = DefaultFileLoader;
/**
 * <p>
 * A default CompositeFileLoader implementation which supports
 * github://, http:// and https:// URLs.
 * </p>
 * @private
 * @class
 * @see See {@link CompositeFileLoader}
 * @memberof module:concerto-util
 */
declare class DefaultFileLoader extends CompositeFileLoader {
    /**
     * Create the DefaultFileLoader.
     * @param {*} processFile - a function to apply to the content of the file
     */
    constructor(processFile: any);
}
import CompositeFileLoader = require("./compositefileloader");
