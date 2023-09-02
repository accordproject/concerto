export = Declaration;
/**
 * A Declaration is conceptually owned by a ModelFile which
 * defines all the top-level declarations that are part of a namespace.
 * A declaration has decorators, a name and a type.
 *
 * @abstract
 * @class
 * @memberof module:concerto-core
 */
declare class Declaration extends Decorated {
}
import Decorated = require("./decorated");
