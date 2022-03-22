export = Resource;
/**
 *
 * Resource is an instance that has a type. The type of the resource
 * specifies a set of properites (which themselves have types).
 *
 *
 * Type information in Concerto is used to validate the structure of
 * Resource instances and for serialization.
 *
 *
 * Resources are used in Concerto to represent Assets, Participants, Transactions and
 * other domain classes that can be serialized for long-term persistent storage.
 *
 * @extends Identifiable
 * @see See {@link Resource}
 * @class
 * @memberof module:concerto-core
 * @public
 */
declare class Resource extends Identifiable {
    /**
     * Determine if this identifiable is a concept.
     * @return {boolean} True if this identifiable is a concept,
     * false if not.
     */
    isConcept(): boolean;
    /**
     * Determine if this object is identifiable.
     * @return {boolean} True if this object has an identifiying field
     * false if not.
     */
    isIdentifiable(): boolean;
    /**
     * Serialize this resource into a JavaScript object suitable for serialization to JSON,
     * using the default options for the serializer. If you need to set additional options
     * for the serializer, use the {@link Serializer#toJSON} method instead.
     * @return {Object} A JavaScript object suitable for serialization to JSON.
     */
    toJSON(): any;
}
import Identifiable = require("./identifiable");
