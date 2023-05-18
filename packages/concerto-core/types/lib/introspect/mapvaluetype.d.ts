export = MapValueType;
/**
 * MapValueType defines a Value type of MapDeclaration.
 *
 * @extends Decorated
 * @see See {@link Decorated}
 * @class
 * @memberof module:concerto-core
 */
declare class MapValueType extends Decorated {
    /**
     * Create an MapValueType.
     * @param {MapDeclaration} parent - The owner of this property
     * @param {Object} ast - The AST created by the parser
     * @param {ModelFile} modelFile - the ModelFile for the Map class
     * @throws {IllegalModelException}
     */
    constructor(parent: MapDeclaration, ast: any);
    parent: MapDeclaration;
    type: any;
    /**
     * Semantic validation of the structure of this class.
     *
     * @throws {IllegalModelException}
     * @protected
     */
    protected validate(): void;
    /**
     * Returns the name of the MapValue. This name does not include the
     * namespace from the owning ModelFile.
     *
     * @return {string} the short name of this class
     */
    getName(): string;
    /**
     * Returns the Type of the MapValue. This name does not include the
     * namespace from the owning ModelFile.
     *
     * @return {string} the short name of this class
     */
    getType(): string;
}
import Decorated = require("./decorated");
