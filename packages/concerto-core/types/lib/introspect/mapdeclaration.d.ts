export = MapDeclaration;
/**
 * MapDeclaration defines a Map data structure, which allows storage of a collection
 * of values, where each value is associated and indexed with a unique key.
 *
 * @extends Decorated
 * @see See {@link Decorated}
 * @class
 * @memberof module:concerto-core
 */
declare class MapDeclaration {
    /**
     * Create an MapDeclaration.
     * @param {ModelFile} modelFile - the ModelFile for this class
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile: ModelFile, ast: any);
    modelFile: ModelFile;
    /**
     * Process the AST and build the model
     *
     * @throws {IllegalModelException}
     * @private
     */
    private process;
    name: any;
    key: MapKeyType;
    value: MapValueType;
    fqn: string;
    /**
     * Semantic validation of the structure of this class.
     *
     * @throws {IllegalModelException}
     * @protected
     */
    protected validate(): void;
    /**
     * Returns the fully qualified name of this class.
     * The name will include the namespace if present.
     *
     * @return {string} the fully-qualified name of this class
     */
    getFullyQualifiedName(): string;
    /**
     * Returns the ModelFile that defines this class.
     *
     * @public
     * @return {ModelFile} the owning ModelFile
     */
    public getModelFile(): ModelFile;
    /**
     * Returns the short name of a class. This name does not include the
     * namespace from the owning ModelFile.
     *
     * @return {string} the short name of this class
     */
    getName(): string;
    /**
     * Returns the type of the Map key property.
     *
     * @return {MapKeyType} the Map key property
     */
    getKey(): MapKeyType;
    /**
     * Returns the type of the Map Value property.
     *
     * @return {MapValueType} the Map Value property
     */
    getValue(): MapValueType;
    /**
     * Returns the string representation of this class
     * @return {String} the string representation of the class
     */
    toString(): string;
}
import ModelFile = require("./modelfile");
import MapKeyType = require("./mapkeytype");
import MapValueType = require("./mapvaluetype");
