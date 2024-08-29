export = BaseModelManager;
/**
 * Manages the Concerto model files.
 *
 * The structure of {@link Resource}s (Assets, Transactions, Participants) is modelled
 * in a set of Concerto files. The contents of these files are managed
 * by the {@link ModelManager}. Each Concerto file has a single namespace and contains
 * a set of asset, transaction and participant type definitions.
 *
 * Concerto applications load their Concerto files and then call the {@link ModelManager#addModelFile addModelFile}
 * method to register the Concerto file(s) with the ModelManager.
 *
 * Use the {@link Concerto} class to validate instances.
 *
 * @memberof module:concerto-core
 */
declare class BaseModelManager {
    /**
     * Create the ModelManager.
     * @constructor
     * @param {object} [options] - ModelManager options, also passed to Serializer
     * @param {boolean} [options.strict] - require versioned namespaces and imports
     * @param {Object} [options.regExp] - An alternative regular expression engine.
     * @param {boolean} [options.metamodelValidation] - When true, modelfiles will be validated
     * @param {boolean} [options.addMetamodel] - When true, the Concerto metamodel is added to the model manager
     * @param {boolean} [options.enableMapType] - When true, the Concerto Map Type feature is enabled
     * @param {boolean} [options.importAliasing] - When true, the Concerto Aliasing feature is enabled
     * @param {*} [processFile] - how to obtain a concerto AST from an input to the model manager
     */
    constructor(options?: {
        strict?: boolean;
        regExp?: any;
        metamodelValidation?: boolean;
        addMetamodel?: boolean;
        enableMapType?: boolean;
        importAliasing?: boolean;
    }, processFile?: any);
    processFile: any;
    modelFiles: {};
    factory: any;
    serializer: any;
    decoratorFactories: any[];
    strict: boolean;
    options: {
        strict?: boolean;
        regExp?: any;
        metamodelValidation?: boolean;
        addMetamodel?: boolean;
        enableMapType?: boolean;
        importAliasing?: boolean;
    };
    enableMapType: boolean;
    importAliasing: string | boolean;
    metamodelModelFile: any;
    /**
     * Returns true
     * @returns {boolean} true
     */
    isModelManager(): boolean;
    /**
     * Returns the value of the strict option
     * @returns {boolean} true if the strict has been set
     */
    isStrict(): boolean;
    /**
     * Checks if the import aliasing feature is enabled.
     * @returns {boolean} true if the importAliasing has been set
     */
    isAliasedTypeEnabled(): boolean;
    /**
     * Adds root types
     * @private
     */
    private addRootModel;
    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     */
    accept(visitor: any, parameters: any): any;
    /**
     * Validates a Concerto file (as a string) to the ModelManager.
     * Concerto files have a single namespace.
     *
     * Note that if there are dependencies between multiple files the files
     * must be added in dependency order, or the addModelFiles method can be
     * used to add a set of files irrespective of dependencies.
     * @param {string|ModelFile} modelFile - The Concerto file as a string
     * @param {string} [fileName] - a file name to associate with the model file
     * @throws {IllegalModelException}
     */
    validateModelFile(modelFile: string | ModelFile, fileName?: string): void;
    /**
     * Throws an error with details about the existing namespace.
     * @param {ModelFile} modelFile The model file that is trying to declare an existing namespace
     * @private
     */
    private _throwAlreadyExists;
    /**
     * Adds a Concerto file (as an AST) to the ModelManager.
     * Concerto files have a single namespace. If a Concerto file with the
     * same namespace has already been added to the ModelManager then it
     * will be replaced.
     * Note that if there are dependencies between multiple files the files
     * must be added in dependency order, or the addModelFiles method can be
     * used to add a set of files irrespective of dependencies.
     * @param {ModelFile} modelFile - Model as a ModelFile object
     * @param {string} [cto] - an optional cto string
     * @param {string} [fileName] - an optional file name to associate with the model file
     * @param {boolean} [disableValidation] - If true then the model files are not validated
     * @throws {IllegalModelException}
     * @return {Object} The newly added model file (internal).
     */
    addModelFile(modelFile: ModelFile, cto?: string, fileName?: string, disableValidation?: boolean): any;
    /**
     * Check that a modelFile is valid with respect to the metamodel.
     *
     * @param {ModelFile} modelFile - Model as a ModelFile object
     * @throws {MetamodelException} - throws if the ModelFile is invalid
     * @private
     */
    private validateAst;
    /**
     * Adds a model to the ModelManager.
     * Concerto files have a single namespace. If a Concerto file with the
     * same namespace has already been added to the ModelManager then it
     * will be replaced.
     * Note that if there are dependencies between multiple files the files
     * must be added in dependency order, or the addModel method can be
     * used to add a set of files irrespective of dependencies.
     * @param {*} modelInput - Model (as a string or object)
     * @param {string} [cto] - an optional cto string
     * @param {string} [fileName] - an optional file name to associate with the model file
     * @param {boolean} [disableValidation] - If true then the model files are not validated
     * @throws {IllegalModelException}
     * @return {ModelFile} The newly added model file (internal).
     */
    addModel(modelInput: any, cto?: string, fileName?: string, disableValidation?: boolean): ModelFile;
    /**
     * Updates a Concerto file (as a string) on the ModelManager.
     * Concerto files have a single namespace. If a Concerto file with the
     * same namespace has already been added to the ModelManager then it
     * will be replaced.
     * @param {string|ModelFile} modelFile - Model as a string or object
     * @param {string} [fileName] - a file name to associate with the model file
     * @param {boolean} [disableValidation] - If true then the model files are not validated
     * @throws {IllegalModelException}
     * @returns {Object} The newly added model file (internal).
     */
    updateModelFile(modelFile: string | ModelFile, fileName?: string, disableValidation?: boolean): any;
    /**
     * Remove the Concerto file for a given namespace
     * @param {string} namespace - The namespace of the model file to delete.
     */
    deleteModelFile(namespace: string): void;
    /**
     * Add a set of Concerto files to the model manager.
     * @param {string[]|ModelFile[]} modelFiles - An array of models as strings or ModelFile objects.
     * @param {string[]} [fileNames] - A array of file names to associate with the model files
     * @param {boolean} [disableValidation] - If true then the model files are not validated
     * @returns {Object[]} The newly added model files (internal).
     */
    addModelFiles(modelFiles: string[] | ModelFile[], fileNames?: string[], disableValidation?: boolean): any[];
    /**
     * Validates all models files in this model manager
     */
    validateModelFiles(): void;
    /**
     * Downloads all ModelFiles that are external dependencies and adds or
     * updates them in this ModelManager.
     * @param {Object} [options] - Options object passed to ModelFileLoaders
     * @param {FileDownloader} [fileDownloader] - an optional FileDownloader
     * @throws {IllegalModelException} if the models fail validation
     * @return {Promise} a promise when the download and update operation is completed.
     */
    updateExternalModels(options?: any, fileDownloader?: FileDownloader): Promise<any>;
    /**
     * Write all models in this model manager to the specified path in the file system
     *
     * @param {string} path to a local directory
     * @param {Object} [options] - Options object
     * @param {boolean} options.includeExternalModels -
     *  If true, external models are written to the file system. Defaults to true
     */
    writeModelsToFileSystem(path: string, options?: {
        includeExternalModels: boolean;
    }): void;
    /**
     * Get the array of model file instances
     * @param {Boolean} [includeConcertoNamespace] - whether to include the concerto namespace
     * (default to false)
     * @return {ModelFile[]} The ModelFiles registered
     * @private
     */
    private getModelFiles;
    /**
     * Gets all the Concerto models
     * @param {Object} [options] - Options object
     * @param {boolean} options.includeExternalModels -
     *  If true, external models are written to the file system. Defaults to true
     * @return {Array<{name:string, content:string}>} the name and content of each CTO file
     */
    getModels(options?: {
        includeExternalModels: boolean;
    }): Array<{
        name: string;
        content: string;
    }>;
    /**
     * Check that the type is valid and returns the FQN of the type.
     * @param {string} context - error reporting context
     * @param {string} type - fully qualified type name
     * @return {string} - the resolved type name (fully qualified)
     * @throws {IllegalModelException} - if the type is not defined
     * @private
     */
    private resolveType;
    /**
     * Remove all registered Concerto files
     */
    clearModelFiles(): void;
    /**
     * Get the ModelFile associated with a namespace
     *
     * @param {string} namespace - the namespace containing the ModelFile
     * @return {ModelFile} registered ModelFile for the namespace or null
     */
    getModelFile(namespace: string): ModelFile;
    /**
     * Get the ModelFile associated with a file name
     *
     * @param {string} fileName - the fileName associated with the ModelFile
     * @return {ModelFile} registered ModelFile for the namespace or null
     * @private
     */
    private getModelFileByFileName;
    /**
     * Get the namespaces registered with the ModelManager.
     * @return {string[]} namespaces - the namespaces that have been registered.
     */
    getNamespaces(): string[];
    /**
     * Look up a type in all registered namespaces.
     *
     * @param {string} qualifiedName - fully qualified type name.
     * @return {ClassDeclaration} - the class declaration for the specified type.
     * @throws {TypeNotFoundException} - if the type cannot be found or is a primitive type.
     */
    getType(qualifiedName: string): ClassDeclaration;
    /**
     * Get the AssetDeclarations defined in this model manager
     * @return {AssetDeclaration[]} the AssetDeclarations defined in the model manager
     */
    getAssetDeclarations(): AssetDeclaration[];
    /**
     * Get the TransactionDeclarations defined in this model manager
     * @return {TransactionDeclaration[]} the TransactionDeclarations defined in the model manager
     */
    getTransactionDeclarations(): TransactionDeclaration[];
    /**
     * Get the EventDeclarations defined in this model manager
     * @return {EventDeclaration[]} the EventDeclaration defined in the model manager
     */
    getEventDeclarations(): EventDeclaration[];
    /**
     * Get the ParticipantDeclarations defined in this model manager
     * @return {ParticipantDeclaration[]} the ParticipantDeclaration defined in the model manager
     */
    getParticipantDeclarations(): ParticipantDeclaration[];
    /**
     * Get the MapDeclarations defined in this model manager
     * @return {MapDeclaration[]} the MapDeclaration defined in the model manager
     */
    getMapDeclarations(): MapDeclaration[];
    /**
     * Get the EnumDeclarations defined in this model manager
     * @return {EnumDeclaration[]} the EnumDeclaration defined in the model manager
     */
    getEnumDeclarations(): EnumDeclaration[];
    /**
     * Get the Concepts defined in this model manager
     * @return {ConceptDeclaration[]} the ConceptDeclaration defined in the model manager
     */
    getConceptDeclarations(): ConceptDeclaration[];
    /**
     * Get a factory for creating new instances of types defined in this model manager.
     * @return {Factory} A factory for creating new instances of types defined in this model manager.
     */
    getFactory(): Factory;
    /**
     * Get a serializer for serializing instances of types defined in this model manager.
     * @return {Serializer} A serializer for serializing instances of types defined in this model manager.
     */
    getSerializer(): Serializer;
    /**
     * Get the decorator factories for this model manager.
     * @return {DecoratorFactory[]} The decorator factories for this model manager.
     */
    getDecoratorFactories(): DecoratorFactory[];
    /**
     * Add a decorator factory to this model manager.
     * @param {DecoratorFactory} factory The decorator factory to add to this model manager.
     */
    addDecoratorFactory(factory: DecoratorFactory): void;
    /**
     * Checks if this fully qualified type name is derived from another.
     * @param {string} fqt1 The fully qualified type name to check.
     * @param {string} fqt2 The fully qualified type name it is may be derived from.
     * @returns {boolean} True if this instance is an instance of the specified fully
     * qualified type name, false otherwise.
     */
    derivesFrom(fqt1: string, fqt2: string): boolean;
    /**
     * Resolve the namespace for names in the metamodel
     * @param {object} metaModel - the MetaModel
     * @return {object} the resolved metamodel
     */
    resolveMetaModel(metaModel: object): object;
    /**
     * Populates the model manager from a models metamodel AST
     * @param {*} ast the metamodel
     */
    fromAst(ast: any): void;
    /**
     * Get the full ast (metamodel instances) for a modelmanager
     * @param {boolean} [resolve] - whether to resolve names
     * @returns {*} the metamodel
     */
    getAst(resolve?: boolean): any;
    /**
     * A function type definition for use as an argument to the filter function
     * @callback FilterFunction
     * @param {Declaration} declaration
     * @returns {boolean} true, if the declaration satisfies the filter function
     */
    /**
     * Returns a new ModelManager with only the types for which the
     * filter function returns true.
     *
     * ModelFiles with no declarations after filtering will be removed.
     *
     * @param {FilterFunction} predicate - the filter function over a Declaration object
     * @returns {BaseModelManager} - the filtered ModelManager
     */
    filter(predicate: (declaration: Declaration) => boolean): BaseModelManager;
}
import ModelFile = require("./introspect/modelfile");
import { FileDownloader } from "@accordproject/concerto-util";
import ClassDeclaration = require("./introspect/classdeclaration");
import AssetDeclaration = require("./introspect/assetdeclaration");
import TransactionDeclaration = require("./introspect/transactiondeclaration");
import EventDeclaration = require("./introspect/eventdeclaration");
import ParticipantDeclaration = require("./introspect/participantdeclaration");
import MapDeclaration = require("./introspect/mapdeclaration");
import EnumDeclaration = require("./introspect/enumdeclaration");
import ConceptDeclaration = require("./introspect/conceptdeclaration");
import Factory = require("./factory");
import Serializer = require("./serializer");
import DecoratorFactory = require("./introspect/decoratorfactory");
import Declaration = require("./introspect/declaration");
