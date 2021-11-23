export = DefaultModelFileLoader;
/**
 * <p>
 * A default CompositeModelFileLoader implementation which supports
 * github://, http:// and https:// URLs.
 * </p>
 * @private
 * @class
 * @see See {@link CompositeModelFileLoader}
 * @memberof module:concerto-core
 */
declare class DefaultModelFileLoader extends CompositeModelFileLoader {
    /**
     * Create the DefaultModelFileLoader.
     * @param {ModelManager} modelManager - the model manager to use
     */
    constructor(modelManager: ModelManager);
}
import CompositeModelFileLoader = require("./compositemodelfileloader");
