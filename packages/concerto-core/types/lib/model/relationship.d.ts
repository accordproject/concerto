export = Relationship;
/**
 * A Relationship is a typed pointer to an instance. I.e the relationship
 * with namespace = 'org.example', type = 'Vehicle' and id = 'ABC' creates
 * a pointer that points at an instance of org.example.Vehicle with the id
 * ABC.
 *
 * Applications should retrieve instances from {@link Factory}
 *
 * @extends Identifiable
 * @see See {@link Identifiable}
 * @class
 * @memberof module:concerto-core
 */
declare class Relationship extends Identifiable {
    /**
     * Contructs a Relationship instance from a URI representation (created using toURI).
     * @param {ModelManager} modelManager - the model manager to bind the relationship to
     * @param {String} uriAsString - the URI as a string, generated using Identifiable.toURI()
     * @param {String} [defaultNamespace] - default namespace to use for backwards compatability
     * @param {String} [defaultType] - default type to use for backwards compatability
     * @return {Relationship} the relationship
     */
    static fromURI(modelManager: ModelManager, uriAsString: string, defaultNamespace?: string, defaultType?: string): Relationship;
    $class: string;
}
import Identifiable = require("./identifiable");
