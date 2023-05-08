export = MapDeclaration;
/**
 * MapDeclaration defines an MapType of Key & Value pair.
 *
 * @extends Decorated
 * @see See {@link Decorated}
 * @class
 * @memberof module:concerto-core
 */
declare class MapDeclaration extends Decorated {
    /**
     * Create an MapDeclaration.
     * @param {ModelFile} modelFile the ModelFile for this class
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile: ModelFile, ast: any);
    modelFile: ModelFile;
    name: any;
    key: MapKeyType;
    value: MapPropertyType;
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
     * Returns the short name of a class. This name does not include the
     * namespace from the owning ModelFile.
     *
     * @return {string} the short name of this class
     */
    getName(): string;
    /**
     * Returns the type of the Map key property.
     *
     * @return {string} the short name of this class
     */
    getKey(): string;
    /**
     * Returns the type of the Map Value property.
     *
     * @return {string} the short name of this class
     */
    getValue(): string;
    /**
     * Returns the MapDeclaration properties
     *
     * @return {array} the short name of this class
     */
    getProperties(): any[];
    /**
     * Returns the kind of declaration
     *
     * @return {string} what kind of declaration this is
     */
    declarationKind(): string;
    /**
     * Returns true if this class is abstract.
     *
     * @return {boolean} true if the class is abstract
     */
    isAbstract(): boolean;
    /**
     * Returns true if this class is the definition of an asset.
     *
     * @return {boolean} true if the class is an asset
     */
    isAsset(): boolean;
    /**
     * Returns true if this class is the definition of a participant.
     *
     * @return {boolean} true if the class is a participant
     */
    isParticipant(): boolean;
    /**
     * Returns true if this class is the definition of a transaction.
     *
     * @return {boolean} true if the class is a transaction
     */
    isTransaction(): boolean;
    /**
     * Returns true if this class is the definition of an event.
     *
     * @return {boolean} true if the class is an event
     */
    isEvent(): boolean;
    /**
     * Returns true if this class is the definition of a concept.
     *
     * @return {boolean} true if the class is a concept
     */
    isConcept(): boolean;
    /**
     * Returns true if this class is the definition of an enum.
     *
     * @return {boolean} true if the class is an enum
     */
    isEnum(): boolean;
    /**
     * Returns true if this class is the definition of a scalar declaration.
     *
     * @return {boolean} true if the class is a scalar
     */
    isScalarDeclaration(): boolean;
    /**
     * Returns true if this class is the definition of a class declaration.
     *
     * @return {boolean} true if the class is a class
     */
    isMapDeclaration(): boolean;
}
import Decorated = require("./decorated");
import ModelFile = require("./modelfile");
import MapKeyType = require("./mapkeytype");
import MapPropertyType = require("./mapvaluetype");
