export = Declaration;
/**
 * Declaration defines the structure (model/schema) of composite data.
 * It is composed of a set of Properties, may have an identifying field, and may
 * have a super-type.
 * A Declaration is conceptually owned by a ModelFile which
 * defines all the classes that are part of a namespace.
 *
 * @abstract
 * @class
 * @memberof module:concerto-core
 */
declare class Declaration extends Decorated {
    /**
     * Create a Declaration from an Abstract Syntax Tree. The AST is the
     * result of parsing.
     *
     * @param {ModelFile} modelFile - the ModelFile for this class
     * @param {IDeclaration} ast - the AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile: ModelFile, ast: IDeclaration);
    modelFile: ModelFile;
    name: any;
    fqn: string;
    /**
     * Returns the short name of a class. This name does not include the
     * namespace from the owning ModelFile.
     *
     * @return {string} the short name of this class
     */
    getName(): string;
    /**
     * Return the namespace of this class.
     * @return {string} namespace - a namespace.
     */
    getNamespace(): string;
    /**
     * Returns the fully qualified name of this class.
     * The name will include the namespace if present.
     *
     * @return {string} the fully-qualified name of this class
     */
    getFullyQualifiedName(): string;
    /**
     * Returns false as scalars are never identified.
     * @returns {Boolean} false as scalars are never identified
     */
    isIdentified(): boolean;
    /**
     * Returns false as scalars are never identified.
     * @returns {Boolean} false as scalars are never identified
     */
    isSystemIdentified(): boolean;
    /**
     * Returns the name of the identifying field for this class. Note
     * that the identifying field may come from a super type.
     *
     * @return {string} the name of the id field for this class or null if it does not exist
     */
    getIdentifierFieldName(): string;
    /**
     * Returns the FQN of the super type for this class or null if this
     * class does not have a super type.
     *
     * @return {string} the FQN name of the super type or null
     */
    getType(): string;
    /**
     * Returns true if this class is the definition of an enum.
     *
     * @return {boolean} true if the class is an enum
     */
    isEnum(): boolean;
    /**
     * Returns true if this class is the definition of a class declaration.
     *
     * @return {boolean} true if the class is a class
     */
    isClassDeclaration(): boolean;
    /**
     * Returns true if this class is the definition of a scalar declaration.
     *
     * @return {boolean} true if the class is a scalar
     */
    isScalarDeclaration(): boolean;
    /**
     * Returns true if this class is the definition of a map-declaration.
     *
     * @return {boolean} true if the class is a map-declaration
     */
    isMapDeclaration(): boolean;
}
import Decorated = require("./decorated");
import ModelFile = require("./modelfile");
import {IDeclaration} from "../../../../concerto-types/src/generated/unions/concerto.metamodel@1.0.0"
