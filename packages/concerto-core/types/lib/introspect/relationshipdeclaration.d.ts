export = RelationshipDeclaration;
/**
 * Class representing a relationship between model elements
 * @extends Property
 * @see See  {@link Property}
 *
 * @class
 * @memberof module:concerto-core
 */
declare class RelationshipDeclaration extends Property {
    /**
     * Returns true if this class is the definition of a relationship.
     *
     * @return {boolean} true if the class is a relationship
     */
    isRelationship(): boolean;
}
import Property = require("./property");
