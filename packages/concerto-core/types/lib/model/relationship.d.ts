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
    /**
     * Create an asset. Use the Factory to create instances.
     * <p>
     * <strong>Note: Only to be called by framework code. Applications should
     * retrieve instances from {@link Factory}</strong>
     * </p>
     *
     * @param {ModelManager} modelManager - The ModelManager for this instance
     * @param {ClassDeclaration} classDeclaration - The class declaration for this instance.
     * @param {string} ns - The namespace this instance.
     * @param {string} type - The type this instance.
     * @param {string} id - The identifier of this instance.
     * @param {string} timestamp - The timestamp of this instance
     * @private
     */
    private constructor();
    $class: string;
}
import Identifiable = require("./identifiable");
import ModelManager = require("../modelmanager");
