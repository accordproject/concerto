export = DoubleScalar;
/**
 * DoubleScalar defines the schema (aka model or class) for
 * a Double scalar. It extends ScalarDeclaration which manages a name.
 *
 * @extends ScalarDeclaration
 * @see See {@link ClassDeclaration}
 * @class
 * @memberof module:concerto-core
 */
declare class DoubleScalar extends ScalarDeclaration {
    /**
     * Returns the kind of declaration
     *
     * @return {string} what kind of declaration this is
     */
    declarationKind(): string;
}
import ScalarDeclaration = require("./scalardeclaration");
