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
     * @return {string} the Map key property
     */
    getKey(): string;
    /**
     * Returns the type of the Map Value property.
     *
     * @return {string} the Map Value property
     */
    getValue(): string;
    /**
     * Returns the MapDeclaration properties
     *
     * @return {array} the MapDeclaration properties
     */
    getProperties(): any[];
    /**
     * Returns the string representation of this class
     * @return {String} the string representation of the class
     */
    toString(): string;
    /**
     * Returns the kind of declaration
     *
     * @return {string} what kind of declaration this is
     */
    declarationKind(): string;
    /**
     * Returns true if this class is the definition of a class declaration.
     *
     * @return {boolean} true if the class is a class
     */
    isMapDeclaration(): boolean;
}
import ModelFile = require("./modelfile");
import MapKeyType = require("./mapkeytype");
import MapValueType = require("./mapvaluetype");
