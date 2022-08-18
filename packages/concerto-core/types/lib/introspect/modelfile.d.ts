export = ModelFile;
/**
 * Class representing a Model File. A Model File contains a single namespace
 * and a set of model elements: assets, transactions etc.
 *
 * @class
 * @memberof module:concerto-core
 */
declare class ModelFile extends Decorated {
    /**
     * Create a ModelFile. This should only be called by framework code.
     * Use the ModelManager to manage ModelFiles.
     * @param {ModelManager} modelManager - the ModelManager that manages this
     * ModelFile
     * @param {object} ast - The abstract syntax tree of the model as a JSON object.
     * @param {string} [definitions] - The optional CTO model as a string.
     * @param {string} [fileName] - The optional filename for this modelfile
     * @throws {IllegalModelException}
     */
    constructor(modelManager: ModelManager, ast: object, definitions?: string, fileName?: string);
    modelManager: ModelManager;
    external: boolean;
    declarations: any[];
    localTypes: Map<any, any>;
    imports: any[];
    importShortNames: Map<any, any>;
    importWildcardNamespaces: any[];
    importUriMap: {};
    fileName: string;
    concertoVersion: any;
    version: string;
    ast: any;
    definitions: string;
    /**
     * Returns true
     * @returns {boolean} true
     */
    isModelFile(): boolean;
    /**
     * Returns the semantic version
     * @returns {string} the semantic version or null if the namespace for the model file is
     * unversioned
     */
    getVersion(): string;
    /**
     * Returns true if the ModelFile is a system namespace
     * @returns {Boolean} true if this is a system model file
     */
    isSystemModelFile(): boolean;
    /**
     * Returns true if this ModelFile was downloaded from an external URI.
     * @return {boolean} true iff this ModelFile was downloaded from an external URI
     */
    isExternal(): boolean;
    /**
     * Returns the URI for an import, or null if the namespace was not associated with a URI.
     * @param {string} namespace - the namespace for the import
     * @return {string} the URI or null if the namespace was not associated with a URI.
     * @private
     */
    private getImportURI;
    /**
     * Returns an object that maps from the import declarations to the URIs specified
     * @return {Object} keys are import declarations, values are URIs
     * @private
     */
    private getExternalImports;
    /**
     * Returns the ModelManager associated with this ModelFile
     *
     * @return {ModelManager} The ModelManager for this ModelFile
     */
    getModelManager(): ModelManager;
    /**
     * Returns the types that have been imported into this ModelFile.
     *
     * @return {string[]} The array of imports for this ModelFile
     */
    getImports(): string[];
    /**
     * Validates the ModelFile.
     *
     * @throws {IllegalModelException} if the model is invalid
     * @protected
     */
    protected validate(): void;
    /**
     * Check that the type is valid.
     * @param {string} context - error reporting context
     * @param {string} type - a short type name
     * @param {Object} [fileLocation] - location details of the error within the model file.
     * @param {String} fileLocation.start.line - start line of the error location.
     * @param {String} fileLocation.start.column - start column of the error location.
     * @param {String} fileLocation.end.line - end line of the error location.
     * @param {String} fileLocation.end.column - end column of the error location.
     * @throws {IllegalModelException} - if the type is not defined
     * @private
     */
    private resolveType;
    /**
     * Returns true if the type is defined in this namespace.
     * @param {string} type - the short name of the type
     * @return {boolean} - true if the type is defined in this ModelFile
     * @private
     */
    private isLocalType;
    /**
     * Returns true if the type is imported from another namespace
     * @param {string} type - the short name of the type
     * @return {boolean} - true if the type is imported from another namespace
     * @private
     */
    private isImportedType;
    /**
     * Returns the FQN for a type that is imported from another namespace
     * @param {string} type - the short name of the type
     * @return {string} - the FQN of the resolved import
     * @throws {Error} - if the type is not imported
     * @private
     */
    private resolveImport;
    /**
     * Returns true if the type is defined in the model file
     * @param {string} type the name of the type
     * @return {boolean} true if the type (asset or transaction) is defined
     */
    isDefined(type: string): boolean;
    /**
     * Returns the FQN of the type or null if the type could not be resolved.
     * For primitive types the type name is returned.
     * @param {string} type - a FQN or short type name
     * @return {string | ClassDeclaration} the class declaration for the type or null.
     * @private
     */
    private getType;
    /**
     * Returns the FQN of the type or null if the type could not be resolved.
     * For primitive types the short type name is returned.
     * @param {string} type - a FQN or short type name
     * @return {string} the FQN type name or null
     * @private
     */
    private getFullyQualifiedTypeName;
    /**
     * Returns the type with the specified name or null
     * @param {string} type the short OR FQN name of the type
     * @return {ClassDeclaration} the ClassDeclaration, or null if the type does not exist
     */
    getLocalType(type: string): ClassDeclaration;
    /**
     * Get the AssetDeclarations defined in this ModelFile or null
     * @param {string} name the name of the type
     * @return {AssetDeclaration} the AssetDeclaration with the given short name
     */
    getAssetDeclaration(name: string): AssetDeclaration;
    /**
     * Get the TransactionDeclaration defined in this ModelFile or null
     * @param {string} name the name of the type
     * @return {TransactionDeclaration} the TransactionDeclaration with the given short name
     */
    getTransactionDeclaration(name: string): TransactionDeclaration;
    /**
     * Get the EventDeclaration defined in this ModelFile or null
     * @param {string} name the name of the type
     * @return {EventDeclaration} the EventDeclaration with the given short name
     */
    getEventDeclaration(name: string): EventDeclaration;
    /**
     * Get the ParticipantDeclaration defined in this ModelFile or null
     * @param {string} name the name of the type
     * @return {ParticipantDeclaration} the ParticipantDeclaration with the given short name
     */
    getParticipantDeclaration(name: string): ParticipantDeclaration;
    /**
     * Get the Namespace for this model file.
     * @return {string} The Namespace for this model file
     */
    getNamespace(): string;
    /**
     * Get the filename for this model file. Note that this may be null.
     * @return {string} The filename for this model file
     */
    getName(): string;
    /**
     * Get the AssetDeclarations defined in this ModelFile
     * @return {AssetDeclaration[]} the AssetDeclarations defined in the model file
     */
    getAssetDeclarations(): AssetDeclaration[];
    /**
     * Get the TransactionDeclarations defined in this ModelFile
     * @return {TransactionDeclaration[]} the TransactionDeclarations defined in the model file
     */
    getTransactionDeclarations(): TransactionDeclaration[];
    /**
     * Get the EventDeclarations defined in this ModelFile
     * @return {EventDeclaration[]} the EventDeclarations defined in the model file
     */
    getEventDeclarations(): EventDeclaration[];
    /**
     * Get the ParticipantDeclarations defined in this ModelFile
     * @return {ParticipantDeclaration[]} the ParticipantDeclaration defined in the model file
     */
    getParticipantDeclarations(): ParticipantDeclaration[];
    /**
     * Get the ConceptDeclarations defined in this ModelFile
     * @return {ConceptDeclaration[]} the ParticipantDeclaration defined in the model file
     */
    getConceptDeclarations(): ConceptDeclaration[];
    /**
     * Get the EnumDeclarations defined in this ModelFile
     * @return {EnumDeclaration[]} the EnumDeclaration defined in the model file
     */
    getEnumDeclarations(): EnumDeclaration[];
    /**
     * Get the instances of a given type in this ModelFile
     * @param {Function} type - the type of the declaration
     * @return {ClassDeclaration[]} the ClassDeclaration defined in the model file
     */
    getDeclarations(type: Function): ClassDeclaration[];
    /**
     * Get all declarations in this ModelFile
     * @return {ClassDeclaration[]} the ClassDeclarations defined in the model file
     */
    getAllDeclarations(): ClassDeclaration[];
    /**
     * Get the definitions for this model.
     * @return {string} The definitions for this model.
     */
    getDefinitions(): string;
    /**
     * Get the ast for this model.
     * @return {object} The definitions for this model.
     */
    getAst(): object;
    /**
     * Get the expected concerto version
     * @return {string} The semver range for compatible concerto versions
     */
    getConcertoVersion(): string;
    /**
     * Check whether this modelfile is compatible with the concerto version
     */
    isCompatibleVersion(): void;
    /**
     * Verifies that an import is versioned if the versionedNamespacesStrict
     * option has been set on the Model Manager
     * @param {*} imp - the import to validate
     */
    enforceImportVersioning(imp: any): void;
    /**
     * Populate from an AST
     * @param {object} ast - the AST obtained from the parser
     * @private
     */
    private fromAst;
    namespace: any;
}
import Decorated = require("./decorated");
import ModelManager = require("../modelmanager");
import ClassDeclaration = require("./classdeclaration");
import AssetDeclaration = require("./assetdeclaration");
import TransactionDeclaration = require("./transactiondeclaration");
import EventDeclaration = require("./eventdeclaration");
import ParticipantDeclaration = require("./participantdeclaration");
import ConceptDeclaration = require("./conceptdeclaration");
import EnumDeclaration = require("./enumdeclaration");
