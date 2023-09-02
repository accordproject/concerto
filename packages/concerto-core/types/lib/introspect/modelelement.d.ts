export = ModelElement;
/**
 * ModelElement defines an element of a model file. It has a type
 * and provides a set of useful methods for type introspection.
 *
 * @private
 * @abstract
 * @class
 * @memberof module:concerto-core
 */
declare class ModelElement {
    /**
     * Create a ModelElement from an Abstract Syntax Tree. The AST is the
     * result of parsing.
     * @param {ModelFile} modelFile - the ModelFile for this class
     * @param {string} ast - the AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile: ModelFile, ast: string);
    modelFile: ModelFile;
    ast: string;
    type: any;
    name: any;
    fqn: string;
    /**
     * Returns the ModelFile that owns this model element.
     *
     * @public
     * @return {ModelFile} the owning ModelFile
     */
    public getModelFile(): ModelFile;
    /**
     * Return the namespace of this class.
     * @return {string} namespace - a namespace.
     */
    getNamespace(): string;
    /**
     * Returns the metamodel fully-qualified type name for this declaration.
     * @deprecated replaced by getMetaType
     * @return {string} the metamodel fully-qualified type name for this type.
     */
    getType(): string;
    /**
     * Returns the metamodel fully-qualified type name for this declaration.
     *
     * @return {string} the metamodel fully-qualified type name for this type.
     */
    getMetaType(): string;
    /**
     * Returns the name of a mode element
     * @return {string|null} the name of this model element or null
     */
    getName(): string | null;
    /**
     * Returns the fully qualified name of this model element.
     * The name will include the namespace if present.
     *
     * @return {string|null} the fully-qualified name of this model element
     */
    getFullyQualifiedName(): string | null;
    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    private accept;
    /**
     * Returns true if this class is the definition of an enum.
     * @return {boolean} true if the class is an enum
     */
    isEnum(): boolean;
    /**
     * Returns true if this model element is the definition of a class declaration.
     * @deprecated replaced by isDeclaration
     * @return {boolean} true if the class is a class
     */
    isClassDeclaration(): boolean;
    /**
     * Returns true if this model element is the definition of a class declaration,
     * one of: concept, enum, asset, participant, event, transaction, scalar.
     * @return {boolean} true if this is an instance of a declaration
     */
    isDeclaration(): boolean;
    /**
     * Returns the short name of the metamodel type for the model element
     *
     * @return {string} what kind of model element this is
     */
    declarationKind(): string;
    /**
     * Returns true if this model element is the definition of a scalar declaration.
     * @deprecated replaced by isScalar
     * @return {boolean} true if the class is a scalar
     */
    isScalarDeclaration(): boolean;
    /**
     * Returns true if this model element is the definition of a scalar declaration.
     *
     * @return {boolean} true if the model element is a scalar
     */
    isScalar(): boolean;
    /**
     * Returns true if this model element is the definition of an asset.
     *
     * @return {boolean} true if the model element is an asset
     */
    isAsset(): boolean;
    /**
     * Returns true if this model element is the definition of a participant.
     *
     * @return {boolean} true if the model element is an asset
     */
    isParticipant(): boolean;
    /**
     * Returns true if this model element is the definition of a transaction.
     *
     * @return {boolean} true if the model element is an asset
     */
    isTransaction(): boolean;
    /**
     * Returns true if this model element  is the definition of an event.
     *
     * @return {boolean} true if the model element is an asset
     */
    isEvent(): boolean;
    /**
     * Returns true if this model element  is the definition of a concept.
     * @return {boolean} true if the model element  is an concept
     */
    isConcept(): boolean;
    /**
     * Returns true if this model element  is the definition of a map.
     * @deprecated replaced by isMap
     * @return {boolean} true if the model element  is a map
     */
    isMapDeclaration(): boolean;
    /**
     * Returns true if this model element  is the definition of a map.
     *
     * @return {boolean} true if the model element  is a map
     */
    isMap(): boolean;
    /**
     * Returns true if this model element  is the definition of a property.
     *
     * @return {boolean} true if the model element  is a property
     */
    isProperty(): boolean;
    /**
     * Returns true if this model element  is the definition of a relationship property.
     *
     * @return {boolean} true if the model element  is a relationship property
     */
    isRelationship(): boolean;
    /**
     * Returns true if this model element  is the definition of a field. A field
     * is a property that is not a relationship.
     *
     * @return {boolean} true if the model element  is a field
     */
    isField(): boolean;
    /**
     * Returns true if this model element is the definition of an enum value.
     *
     * @return {boolean} true if the model element  is an enum value
     */
    isEnumValue(): boolean;
    /**
     * Returns true if this model element is the definition of a decorator.
     *
     * @return {boolean} true if the class is a decorator
     */
    isDecorator(): boolean;
}
import ModelFile = require("./modelfile");
