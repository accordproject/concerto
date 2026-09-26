// ==== astmodelmanager.d.ts ====
import BaseModelManager from './basemodelmanager';
import type { ModelManagerOptions } from './types';
/**
 * Manages the Concerto model files in AST format.
 *
 * The structure of {@link Resource}s (Assets, Transactions, Participants) is modelled
 * in a set of Concerto files. The contents of these files are managed
 * by the {@link ModelManager}. Each Concerto file has a single namespace and contains
 * a set of asset, transaction and participant type definitions.
 *
 * Concerto applications load their Concerto files and then call the {@link ModelManager#addModelFile addModelFile}
 * method to register the Concerto file(s) with the ModelManager.
 *
 * @memberof module:concerto-core
 */
declare class AstModelManager extends BaseModelManager {
    /**
     * Create the ModelManager.
     * @constructor
     * @param {object} [options] - Serializer options
     */
    constructor(options?: ModelManagerOptions);
}
export { AstModelManager };
export default AstModelManager;

// ==== basemodelmanager.d.ts ====
import type { IModel, IModels } from '@accordproject/concerto-metamodel';
import Factory from './factory';
import ModelFile from './introspect/modelfile';
import Serializer from './serializer';
import type { ModelFileSource, ModelManagerOptions } from './types';
type ModelFileInstance = InstanceType<typeof ModelFile>;
type ModelFileInput = string | ModelFileInstance;
import type AssetDeclaration from './introspect/assetdeclaration';
import type MapDeclaration from './introspect/mapdeclaration';
import type ConceptDeclaration from './introspect/conceptdeclaration';
import type DecoratorFactory from './introspect/decoratorfactory';
import type EnumDeclaration from './introspect/enumdeclaration';
import type EventDeclaration from './introspect/eventdeclaration';
import type ParticipantDeclaration from './introspect/participantdeclaration';
import type TransactionDeclaration from './introspect/transactiondeclaration';
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
    modelFiles: Record<string, ModelFileInstance>;
    processFile: (fileName: string | null, modelInput: string | unknown) => ModelFileSource;
    factory: Factory;
    serializer: Serializer;
    decoratorFactories: DecoratorFactory[];
    options: ModelManagerOptions | undefined;
    decoratorValidation: NonNullable<ModelManagerOptions['decoratorValidation']>;
    metamodelModelFile: ModelFileInstance;
    rustHandle: {
        [binding: string]: (...args: any[]) => any;
    } | null;
    _rustMirrorStale: boolean;
    /**
     * Create the ModelManager.
     * @constructor
     * @param {object} [options] - ModelManager options, also passed to Serializer
     * @param {Object} [options.regExp] - An alternative regular expression engine.
     * @param {boolean} [options.metamodelValidation] - When true, modelfiles will be validated
     * @param {boolean} [options.addMetamodel] - When true, the Concerto metamodel is added to the model manager
    * @param {boolean} [options.dangerouslyAllowReservedSystemTypeNamesInUserModels] - Transitional escape hatch; when true, declarations may use reserved system type names
     * @param {object} [options.decoratorValidation] - the decorator validation configuration
     * @param {string} [options.decoratorValidation.missingDecorator] - the validation log level for missingDecorator decorators: off, warning, error
     * @param {string} [options.decoratorValidation.invalidDecorator] - the validation log level for invalidDecorator decorators: off, warning, error
     * @param {*} [processFile] - how to obtain a concerto AST from an input to the model manager
    */
    constructor(options?: ModelManagerOptions, processFile?: (fileName: string | null, modelInput: string | unknown) => ModelFileSource);
    /**
     * Returns true
     * @returns {boolean} true
     */
    isModelManager(): boolean;
    /**
     * Adds root types
     * @private
     */
    addRootModel(): void;
    /**
     * Checks if the import aliasing feature is enabled.
     * @returns {boolean} true
     */
    isAliasedTypeEnabled(): boolean;
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
    validateModelFile(modelFile: any, fileName?: any): void;
    /**
     * Adds decorator types
     * @private
     */
    /**
     * Adds decorator types
     * @private
     */
    addDecoratorModel(): void;
    /**
     * Whether a namespace should be mirrored into `rustHandle` (P4-08):
     * every namespace but the decorator/root system models -- already
     * mirrored by `rustHandle`'s own constructor -- and the transient
     * metamodel file `validateAst` registers and removes around its own
     * deserialisation check.
     * @param {string} namespace - the namespace being added, updated or removed
     * @return {boolean} true if `namespace` should be mirrored
     * @private
     */
    _rustMirrorEligible(namespace: any): boolean;
    /**
     * Runs a rustHandle mirror write, swallowing any error it throws
     * (P4-08; PORTING.md's context-trait fallback for the W tests this
     * group's ledger names): a stub `ModelFile` a white-box test builds
     * with `sinon.createStubInstance` answers `getAst()`/`getDefinitions()`
     * with whatever that test configured, often not a real AST, so mirroring
     * it can fail even though the TS-side write above already succeeded and
     * must not be undone by this best-effort cache sync. `resolveType`,
     * `derivesFrom`, `isAssignableTo` and `getNamespaces` fall back to their
     * TS body themselves when a stale or partial mirror makes rustHandle
     * unusable for a given call.
     *
     * A swallowed failure permanently marks `_rustMirrorStale` (review on
     * P4-08, accordproject/concerto-rust#67): the write that failed may have
     * been an *update* to a namespace rustHandle already had, so the
     * `getNamespaces().length` parity check in `_rustMirrorTrustworthy`
     * alone cannot see it -- that check's count would still match, and
     * every later read would then silently answer from that namespace's old
     * content instead of falling back to TS. Only `clearModelFiles` (a fresh
     * `rustHandle`) clears the flag.
     * @param {Function} fn - the mirror write to run
     * @private
     */
    _mirrorToRust(fn: any): void;
    /**
     * Whether `rustHandle`'s mirror is complete enough to answer a read
     * (P4-08): `_rustMirrorStale` catches a swallowed write failure of any
     * kind (add, update or delete -- see `_mirrorToRust`), and a
     * content-based parity check against `this.modelFiles`, the source of
     * truth `_mirrorToRust` can never make stale, is kept as a
     * belt-and-braces check for any divergence that reaches rustHandle by a
     * path other than `_mirrorToRust` (none exists today, but a read that
     * trusts rustHandle without it could silently answer from an incomplete
     * or differently-shaped model -- wrong, not merely absent, for
     * `isAssignableTo`/`derivesFrom`'s boolean results in particular, which
     * do not otherwise surface a mismatch as a thrown error the caller
     * would catch and fall back from). Comparing the namespace *sets*,
     * not just their sizes, matters for exactly the case a white-box test
     * creates by assigning `this.modelFiles` directly (bypassing
     * `addModelFile`/`_mirrorToRust` entirely): a `rustHandle` that mirrors
     * only the two system models could otherwise coincidentally match the
     * count of a manager whose `modelFiles` was hand-populated with two
     * unrelated stub namespaces, and a length-only check would wrongly
     * call that trustworthy.
     * @return {boolean} true if rustHandle mirrors exactly the namespaces TS has
     * @private
     */
    _rustMirrorTrustworthy(): boolean;
    /**
     * Throws an error with details about the existing namespace.
     * @param {ModelFile} modelFile The model file that is trying to declare an existing namespace
     * @private
     */
    _throwAlreadyExists(modelFile: any): void;
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
    addModelFile(modelFile: ModelFileInstance, cto?: string | null, fileName?: string | null, disableValidation?: boolean): ModelFile;
    /**
     * Check that a modelFile is valid with respect to the metamodel.
     *
     * @param {ModelFile} modelFile - Model as a ModelFile object
     * @throws {MetamodelException} - throws if the ModelFile is invalid
     * @private
     */
    validateAst(modelFile: any): void;
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
    addModel(modelInput: any, cto?: any, fileName?: any, disableValidation?: any): ModelFile;
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
    updateModelFile(modelFile: any, fileName?: any, disableValidation?: any): any;
    /**
     * Remove the Concerto file for a given namespace
     * @param {string} namespace - The namespace of the model file to delete.
     */
    deleteModelFile(namespace: any): void;
    /**
     * Add a set of Concerto files to the model manager.
     * @param {string[]|ModelFile[]} modelFiles - An array of models as strings or ModelFile objects.
     * @param {string[]} [fileNames] - A array of file names to associate with the model files
     * @param {boolean} [disableValidation] - If true then the model files are not validated
     * @returns {Object[]} The newly added model files (internal).
     */
    addModelFiles(modelFiles: ModelFileInput[], fileNames?: string[] | null, disableValidation?: boolean): ModelFile[];
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
    updateExternalModels(options?: RequestInit, fileDownloader?: {
        downloadExternalDependencies(files: ModelFileInstance[], options?: RequestInit): Promise<ModelFileSource[]>;
    }): Promise<ModelFile[]>;
    /**
     * Write all models in this model manager to the specified path in the file system
     *
     * @param {string} path to a local directory
     * @param {Object} [options] - Options object
     * @param {boolean} options.includeExternalModels -
     *  If true, external models are written to the file system. Defaults to true
     */
    writeModelsToFileSystem(path: any, options?: {}): void;
    /**
     * Returns the status of the decorator validation options
     * @returns {object} returns an object that indicates the log levels for defined and undefined decorators
     */
    getDecoratorValidation(): {
        missingDecorator?: string;
        invalidDecorator?: string;
    };
    /**
     * Get the array of model file instances
     * @param {Boolean} [includeConcertoNamespace] - whether to include the concerto namespace
     * (default to false)
     * @return {ModelFile[]} The ModelFiles registered
     * @private
     */
    getModelFiles(includeConcertoNamespace?: boolean): ModelFileInstance[];
    /**
     * Gets all the Concerto models
     * @param {Object} [options] - Options object
     * @param {boolean} options.includeExternalModels -
     *  If true, external models are written to the file system. Defaults to true
     * @return {Array<{name:string, content:string}>} the name and content of each CTO file
     */
    getModels(options?: {
        includeExternalModels?: boolean;
    }): {
        name: string;
        content: string | null | undefined;
    }[];
    /**
     * Check that the type is valid and returns the FQN of the type.
     * @param {string} context - error reporting context
     * @param {string} type - fully qualified type name
     * @return {string} - the resolved type name (fully qualified)
     * @throws {IllegalModelException} - if the type is not defined
     * @private
     */
    resolveType(context: any, type: any): any;
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
    getModelFile(namespace: any): ModelFile;
    /**
     * Get the ModelFile associated with a file name
     *
     * @param {string} fileName - the fileName associated with the ModelFile
     * @return {ModelFile} registered ModelFile for the namespace or null
     * @private
     */
    getModelFileByFileName(fileName: any): ModelFile;
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
    getType(qualifiedName: any): any;
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
    addDecoratorFactory(factory: any): void;
    /**
     * Checks if this fully qualified type name is derived from another.
     * @param {string} fqt1 The fully qualified type name to check.
     * @param {string} fqt2 The fully qualified type name it is may be derived from.
     * @returns {boolean} True if this instance is an instance of the specified fully
     * qualified type name, false otherwise.
     */
    derivesFrom(fqt1: any, fqt2: any): boolean;
    /**
     * Concrete (non-abstract) declarations assignable to baseFqn: the base itself
     * (when concrete) plus all subclasses. Empty array if baseFqn is not in the model.
     * @param {string} baseFqn The fully qualified type name
     * @returns {ClassDeclaration[]} An array of concrete ClassDeclaration that are assignable to baseFqn
     */
    getAssignableConcreteTypes(baseFqn: string): any[];
    /**
     * True when fqn is, or extends, baseFqn (restricted to concrete types).
     * @param {string} fqn The candidate fully qualified type name
     * @param {string} baseFqn The fully qualified type name it may be derived from
     * @returns {boolean} True if fqn is assignable to baseFqn
     */
    isAssignableTo(fqn: string, baseFqn: string): boolean;
    /**
     * Resolve the namespace for names in the metamodel
     * @param {object} metaModel - the MetaModel
     * @return {object} the resolved metamodel
     */
    resolveMetaModel(metaModel: IModel): IModel;
    /**
     * Populates the model manager from a models metamodel AST
     * @param {*} ast the metamodel
     * @param {object} [options] - options for the from ast method
     * @param {object} [options.disableValidation] - option to disable metamodel validation and just fetch the models, to be used only if the metamodel is already validated
     */
    fromAst(ast: IModels, options?: {
        disableValidation?: boolean;
    }): void;
    /**
     * Get the full ast (metamodel instances) for a modelmanager
     * @param {boolean} [resolve] - whether to resolve names
     * @param {boolean} [includeConcertoNamespaces] - whether to include the concerto namespaces
     * @returns {*} the metamodel
     */
    getAst(resolve?: any, includeConcertoNamespaces?: any): IModels;
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
     * @param {Object} [options] - options for the filter method
     * @param {boolean} [options.disableValidation] — If true then the model files are not validated
     * @returns {BaseModelManager} - the filtered ModelManager
     */
    filter(predicate: any, options?: any): BaseModelManager;
}
export { BaseModelManager };
export default BaseModelManager;

// ==== datetimeutil.d.ts ====
import dayjs from './dayjs-setup';
/**
 * Ensures there is a proper current time
 *
 * @param {string} [currentTime] - the definition of 'now'
 * @param {number} [utcOffset] - UTC Offset for this execution
 * @returns {object} if valid, the dayjs object for the current time
 */
declare function setCurrentTime(currentTime?: any, utcOffset?: any): {
    currentTime: dayjs.Dayjs;
    utcOffset: number;
};
export { setCurrentTime };
declare const _default: {
    setCurrentTime: typeof setCurrentTime;
};
export default _default;

// ==== dayjs-setup.d.ts ====
import dayjs from 'dayjs';
export { dayjs };
export default dayjs;

// ==== dcsconverter.d.ts ====
/**
 * converts DCS JSON to YAML string
 * @param {object} dcsJson the DCS JSON as parsed object
 * @returns {string} the DCS YAML string
 */
declare function jsonToYaml(dcsJson: any): string;
/**
 * converts DCS YAML string to JSON format
 * @param {string} yamlString the YAML string to convert
 * @returns {object} the DCS JSON
 */
declare function yamlToJson(yamlString: any): {
    $class: any;
    name: any;
    version: any;
    commands: any;
};
export { jsonToYaml, yamlToJson };
declare const _default: {
    jsonToYaml: typeof jsonToYaml;
    yamlToJson: typeof yamlToJson;
};
export default _default;

// ==== decoratorextractor.d.ts ====
import ModelManager from './modelmanager';
import type { IModels } from '@accordproject/concerto-metamodel';
import type { DecoratorCommandTarget } from './types';
/**
 * Utility functions to work with
 * [DecoratorCommandSet](https://models.accordproject.org/concerto/decorators.cto)
 * @memberof module:concerto-core
 * @private
 */
/**
 * A decorator collected from a model, keyed in the extraction dictionary by
 * the namespace it was found in.
 */
interface ExtractedDecorator {
    declaration: string;
    property: string;
    mapElement: string;
    dcs: string;
}
declare class DecoratorExtractor {
    extractionDictionary: Record<string, ExtractedDecorator[]>;
    removeDecoratorsFromModel: boolean;
    locale: string;
    dcs_version: string;
    sourceModelAst: IModels;
    updatedModelAst: IModels;
    action: number;
    /**
     * The action to be performed to extract all, only vocab or only non-vocab decorators
     */
    static Action: {
        EXTRACT_ALL: number;
        EXTRACT_VOCAB: number;
        EXTRACT_NON_VOCAB: number;
    };
    /**
     * Create the DecoratorExtractor.
     * @constructor
     * @param {boolean} removeDecoratorsFromModel - flag to determine whether to remove decorators from source model
     * @param {string} locale - locale for extracted vocabularies
     * @param {string} dcs_version - version string
     * @param {Object} sourceModelAst - the ast of source models
     * @param {int} [action=DecoratorExtractor.Action.EXTRACT_ALL]  - the action to be performed
     * @param {object} [options] - decorator extractor options
     */
    constructor(removeDecoratorsFromModel: boolean, locale: string, dcs_version: string, sourceModelAst: IModels, action?: number, options?: Record<string, unknown>);
    /**
     * Returns if the decorator is vocab or not
     * @param {string} decoractorName - the name of decorator
     * @returns {boolean} - returns true if the decorator is a vocabulary decorator else false
     * @private
     */
    isVocabDecorator(decoractorName: any): any;
    /**
     * Returns a value safe for embedding in a YAML scalar.
     * String values containing YAML-special characters are wrapped in double quotes.
     * Non-string decorator types (Number, Boolean) are returned as-is.
     * @param {any} value - the value to emit
     * @param {string} [type] - the $class of the decorator argument
     * @returns {string|number|boolean|null} - double-quoted string for string args, raw value for non-string args
     * @private
     */
    quoteStringValue(value: any, type?: string): string | number | boolean | null;
    /**
    * Adds a key-value pair to a dictionary (object) if the key exists,
    * or creates a new key with the provided value.
    *
    * @param {string} key - The key to add or update.
    * @param {any} value - The value to add or update.
    * @param {Object} options - options containing target
    * @param {string} options.declaration - Target declaration
    * @param {string} options.property - Target property
    * @param {string} options.mapElement - Target map element
    * @private
    */
    constructDCSDictionary(key: any, value: any, options: any): void;
    /**
     * Transforms the collected decorators into proper decorator command sets
     * @param {Array<Object>} dcsObjects - the collection of collected decorators
     * @param {string} namespace - the current namespace
     * @param {Array<Object>} decoratorData - the collection of existing decorator command sets
     * @returns {Array<Object>} - the collection of decorator command sets
     * @private
     */
    transformNonVocabularyDecorators(dcsObjects: any, namespace: any, decoratorData: any): any;
    /**
     * Transforms the collected vocabularies into proper vocabulary command sets
     * @param {Array<Object>} vocabObject - the collection of collected vocabularies
     * @param {string} namespace - the current namespace
     * @param {Array<Object>} vocabData - the collection of existing vocabularies command sets
     * @returns {Array<Object>} - the collection of vocabularies command sets
     * @private
     */
    transformVocabularyDecorators(vocabObject: any, namespace: any, vocabData: any): any;
    /**
     * Constructs Target object for a given model
     * @param {string} namespace - the current namespace
     * @param {Object} obj - the ast of the model
     * @returns {Object} - the target object
     * @private
     */
    constructTarget(namespace: any, obj: any): DecoratorCommandTarget & {
        $class: string;
    };
    /**
     * Parses the dict data into an array of decorator jsons
     * @param {Array<Object>} dcsObjects - the array of collected dcs objects
     * @param {Object} dcs - the current dcs json to be parsed
     * @param {String} DCS_VERSION - the version string
     * @param {Object} target - target object for the command
     * @returns {Array<Object>} - the array of collected dcs objects with the current dcs
     * @private
     */
    parseNonVocabularyDecorators(dcsObjects: any, dcs: any, DCS_VERSION: any, target: any): any;
    /**
     * @param {Object} vocabObject - the collection of collected vocabularies
     * @param {Object} vocabTarget - the declaration object
     * @param {Object} dcs - the current dcs json to be parsed
     * @returns {Object} - the collection of collected vocabularies with current dcs
     * @private
     */
    parseVocabularies(vocabObject: any, vocabTarget: any, dcs: any): any;
    /**
    * parses the extracted decorators and generates arrays of decorator command set and vocabularies
    *
    * @returns {Object} - constructed DCS Dict and processed models ast
    * @private
    */
    transformDecoratorsAndVocabularies(): {
        decoratorCommandSet: never[];
        vocabularies: never[];
    };
    /**
     * Filter vocab or non-vocab decorators
     * @param {Object} decorators - the collection of decorators
     * @returns {Object} - the collection of filtered decorators
     * @private
     */
    filterOutDecorators(decorators: any): any;
    /**
    * Process the map declarations to extract the decorators.
    *
    * @param {Object} declaration - The source AST of the model
    * @param {string} namespace - namespace of the model
    * @returns {Object} - processed map declarations ast
    * @private
    */
    processMapDeclaration(declaration: any, namespace: any): any;
    /**
    * Process the properties to extract the decorators.
    *
    * @param {Object} sourceProperties - The source AST of the property
    * @param {string} declarationName - The name of source declaration
    * @param {string} namespace - namespace of the model
    * @returns {Object} - processed properties ast
    * @private
    */
    processProperties(sourceProperties: any, declarationName: any, namespace: any): any;
    /**
    * Process the declarations to extract the decorators.
    *
    * @param {Object} sourceDecl - The source AST of the model
    * @param {string} namespace - namespace of the model
    * @returns {Object} - processed declarations ast
    * @private
    */
    processDeclarations(sourceDecl: any, namespace: any): any;
    /**
    * Process the models to extract the decorators.
    *
    * @private
    */
    processModels(): void;
    /**
    * Collects the decorators and vocabularies and updates the modelManager depending
    * on the options.
    *
    * @returns {Object} - constructed DCS Dict and processed models ast
    * @private
    */
    extract(): {
        updatedModelManager: ModelManager;
        decoratorCommandSet: never[];
        vocabularies: never[];
    };
}
export { DecoratorExtractor };
export default DecoratorExtractor;

// ==== decoratormanager.d.ts ====
import ModelManager from './modelmanager';
/**
 * Utility functions to work with
 * [DecoratorCommandSet](https://models.accordproject.org/concerto/decorators.cto)
 * @memberof module:concerto-core
 */
declare class DecoratorManager {
    /**
     * Structural validation of the decoratorCommandSet against the
     * Decorator Command Set model. Note that this only checks the
     * structural integrity of the command set, it cannot check
     * whether the commands are valid with respect to a model manager.
     * Use the options.validateCommands option with decorateModels
     * method to perform semantic validation.
     * @param {*} decoratorCommandSet the DecoratorCommandSet object
     * @param {ModelFile[]} [modelFiles] an optional array of model
     * files that are added to the validation model manager returned
     * @returns {ModelManager} the model manager created for validation
     * @throws {Error} throws an error if the decoratorCommandSet is invalid
     */
    static validate(decoratorCommandSet: any, modelFiles?: any): ModelManager;
    /**
     * Rewrites the $class property on decoratorCommandSet classes.
     * @param {*} decoratorCommandSet the DecoratorCommandSet object
     * @param {string} version the DCS version upgrade target
     * @returns {object} the migrated DecoratorCommandSet object
     */
    static migrateTo(decoratorCommandSet: any, version: any): any;
    /**
     * Checks if the supplied decoratorCommandSet can be migrated.
     * Migrations should only take place across minor versions of the same major version.
     * @param {*} decoratorCommandSet the DecoratorCommandSet object
     * @param {*} DCS_VERSION the DecoratorCommandSet version
     * @returns {boolean} returns true if major versions are equal
     */
    static canMigrate(decoratorCommandSet: any, DCS_VERSION: any): boolean;
    /**
     * Add decorator commands set with index object to the coresponding target map
     * @param {*} targetMap the target map to add the command to
     * @param {targetKey} targetKey the target key to add the command to
     * @param {DcsIndexWrapper} dcsWithIndex the command to add
     * @private
     */
    static addDcsWithIndexToMap(targetMap: any, targetKey: any, dcsWithIndex: any): void;
    /**
     * Creates five different maps to index decorator command sets by target type and returns them
     * @param {*} decoratorCommandSet the DecoratorCommandSet object
     * @returns {Object} object with all the decorator command maps based on the target
     * @private
     */
    static getDecoratorMaps(decoratorCommandSet: any): {
        namespaceCommandsMap: Map<any, any>;
        declarationCommandsMap: Map<any, any>;
        propertyCommandsMap: Map<any, any>;
        mapElementCommandsMap: Map<any, any>;
        typeCommandsMap: Map<any, any>;
    };
    /**
     * Migrate or validate the DecoratorCommandSet object if the options are set as true
     * @param {ModelManager} modelManager the input model manager
     * @param {*} decoratorCommandSet a DecoratorCommandSet object, or an array of DecoratorCommandSet objects
     * @param {boolean} shouldMigrate migrate the decoratorCommandSet $class to match the dcs model version
     * @param {boolean} shouldValidate validate that decorator command set is valid
     * with respect to to decorator command set model
     * @param {boolean} shouldValidateCommands validate the decorator command set targets. Note that
     * the validate option must also be true
     * @private
     */
    static migrateAndValidate(modelManager: any, decoratorCommandSet: any, shouldMigrate: any, shouldValidate: any, shouldValidateCommands: any): void;
    /**
     * Adds decorator commands with index to the array passed
     * @param {DcsIndexWrapper[]} array the array to add the command to
     * @param {*} map the target map to add the command to
     * @param {key} key the target key to add the command to
     * @private
     */
    static pushMapValues(array: any, map: any, key: any): void;
    /**
     * Applies all the decorator commands from the DecoratorCommandSet to the ModelManager
     * @param {ModelManager} modelManager the input model manager
     * @param {*} decoratorCommandSet the DecoratorCommandSet object, or an array of DecoratorCommandSet objects
     * @param {object} [options] - decorator models options
     * @param {boolean} [options.validate] - validate that decorator command set is valid
     * with respect to to decorator command set model
     * @param {boolean} [options.validateCommands] - validate the decorator command set targets. Note that
     * the validate option must also be true
     * @param {boolean} [options.migrate] - migrate the decoratorCommandSet $class to match the dcs model version
     * @param {boolean} [options.defaultNamespace] - the default namespace to use for decorator commands that include a decorator without a namespace
     * @param {boolean} [options.skipValidationAndResolution] - optional flag to disable both metamodel resolution and validation, only use if you are sure that the model manager has fully resolved models
     * @param {boolean} [options.disableMetamodelResolution] - flag to disable metamodel resolution, only use if you are sure that the model manager has fully resolved models
     * @param {boolean} [options.disableMetamodelValidation] - flag to disable metamodel validation, only use if you are sure that the models and decorators are already validated
     * @returns {ModelManager} a new model manager with the decorations applied
     */
    static decorateModels(modelManager: any, decoratorCommandSet: any, options?: any): any;
    /**
     * @typedef ExtractDecoratorsResult
     * @type {object}
     * @property {ModelManager} modelManager - A model manager containing models stripped without decorators
     * @property {*} decoratorCommandSet - Stripped out decorators, formed into decorator command sets
     * @property {string[]} vocabularies - Stripped out vocabularies, formed into vocabulary files
    */
    /**
     * Extracts all the decorator commands from all the models in modelManager
     * @param {ModelManager} modelManager the input model manager
     * @param {object} options - decorator models options
     * @param {boolean} options.removeDecoratorsFromModel - flag to strip out decorators from models
     * @param {string} options.locale - locale for extracted vocabulary set
     * @returns {ExtractDecoratorsResult} - a new model manager with the decorations removed and a list of extracted decorator jsons and vocab yamls
     */
    static extractDecorators(modelManager: any, options: any): {
        modelManager: ModelManager;
        decoratorCommandSet: never[];
        vocabularies: never[];
    };
    /**
     * Extracts all the vocab decorator commands from all the models in modelManager
     * @param {ModelManager} modelManager the input model manager
     * @param {object} options - decorator models options
     * @param {boolean} options.removeDecoratorsFromModel - flag to strip out vocab decorators from models
     * @param {string} options.locale - locale for extracted vocabulary set
     * @returns {ExtractDecoratorsResult} - a new model manager with/without the decorators and vocab yamls
     */
    static extractVocabularies(modelManager: any, options: any): {
        modelManager: ModelManager;
        vocabularies: never[];
    };
    /**
     * Extracts all the non-vocab decorator commands from all the models in modelManager
     * @param {ModelManager} modelManager the input model manager
     * @param {object} options - decorator models options
     * @param {boolean} options.removeDecoratorsFromModel - flag to strip out non-vocab decorators from models
     * @param {string} options.locale - locale for extracted vocabulary set
     * @returns {ExtractDecoratorsResult} - a new model manager with/without the decorators and a list of extracted decorator jsons
     */
    static extractNonVocabDecorators(modelManager: any, options: any): {
        modelManager: ModelManager;
        decoratorCommandSet: never[];
    };
    /**
     * Throws an error if the decoractor command is invalid
     * @param {ModelManager} validationModelManager the validation model manager
     * @param {*} command the decorator command
     */
    static validateCommand(validationModelManager: any, command: any): void;
    /**
     * Applies a new decorator to the Map element
     * @private
     * @param {string} element the element to apply the decorator to
     * @param {string} target the command target
     * @param {*} declaration the map declaration
     * @param {string} type the command type
     * @param {*} newDecorator the decorator to add
     */
    static applyDecoratorForMapElement(element: any, target: any, declaration: any, type: any, newDecorator: any): void;
    /**
     * Compares two arrays. If the first argument is falsy
     * the function returns true.
     * @param {string | string[] | null} test the value to test
     * @param {string[]} values the values to compare
     * @returns {Boolean} true if the test is falsy or the intersection of
     * the test and values arrays is not empty (i.e. they have values in common)
     */
    static falsyOrEqual(test: any, values: any): any;
    /**
     * Applies a decorator to a decorated model element.
     * @param {*} decorated the type to apply the decorator to
     * @param {string} type the command type
     * @param {*} newDecorator the decorator to add
     */
    static applyDecorator(decorated: any, type: any, newDecorator: any): void;
    /**
     * Checks for duplicate decorators added to a decorated model element.
     * @param {*} decoratedAst ast of the property or the declaration to apply the decorator to
     * @throws {IllegalModelException} if the decoratedAst has duplicate decorators
     * @private
     */
    static checkForDuplicateDecorators(decoratedAst: any): void;
    /**
     * Executes a Command against a Model Namespace, adding
     * decorators to the Namespace.
     * @private
     * @param {*} model the model
     * @param {*} command the Command object from the dcs
     */
    static executeNamespaceCommand(model: any, command: any): void;
    /**
     * Executes a Command against a Declaration, adding
     * decorators to the Declaration, or its properties, as required.
     * @param {string} namespace the namespace for the declaration
     * @param {*} declaration the class declaration
     * @param {*} command the Command object from the dcs
     * @param {*} [property] the property of a declaration, optional, to be passed if the command is for a property
     * @param {object} [options] - execute command options
     */
    static executeCommand(namespace: any, declaration: any, command: any, property?: any, options?: any): void;
    /**
     * Executes a Command against a Property, adding
     * decorators to the Property as required.
     * @param {*} property the property
     * @param {*} command the Command object from the
     * org.accordproject.decoratorcommands model
     */
    static executePropertyCommand(property: any, command: any): void;
    /**
     * Applies the decorator on top of the namespace or else on all declarations
     * within the namespace.
     * @private
     * @param {*} declaration the type to apply the decorator to
     * @param {string} type the command type
     * @param {*} decorator the decorator to add
     * @param {*} target the target object for the decorator
     */
    static checkForNamespaceTargetAndApplyDecorator(declaration: any, type: any, decorator: any, target: any): void;
    /**
     * Legacy method. Kept for compatibility. Returns true.
     *  @returns {Boolean} true
     */
    static isNamespaceTargetEnabled(): boolean;
    /**
     * converts DCS JSON object into YAML string
     * validates the input DCS JSON against the DCS model
     * @param {object} jsonInput the DCS JSON as parsed object
     * @return {string} the corresponding YAML string
     */
    static jsonToYaml(jsonInput: any): string;
    /**
     * converts DCS YAML string into JSON object
     * validates the output DCS JSON against the DCS model
     * @param {string} yamlInput the DCS JSON as parsed object
     * @return {object} the corresponding JSON object
     */
    static yamlToJson(yamlInput: any): {
        $class: any;
        name: any;
        version: any;
        commands: any;
    };
}
export { DecoratorManager };
export default DecoratorManager;

// ==== decoratormodelhelper.d.ts ====
/**
 * Gets the decorator 'concerto.decorator' model
 * @returns {object} decoratorModelFile, decoratorModelCto and decoratorModelAst
 */
declare function getDecoratorModel(): {
    decoratorModelFile: string;
    decoratorModelCto: string;
    decoratorModelAst: any;
};
export { getDecoratorModel };
declare const _default: {
    getDecoratorModel: typeof getDecoratorModel;
};
export default _default;

// ==== factory.d.ts ====
import Relationship from './model/relationship';
import Resource from './model/resource';
import type BaseModelManager from './basemodelmanager';
import type ClassDeclaration from './introspect/classdeclaration';
import type Typed from './model/typed';
import type { GenerateOptions, InstanceGeneratorParameters } from './types';
/**
 * Use the Factory to create instances of Resource: transactions, participants
 * and assets.
 *
 * @class
 * @memberof module:concerto-core
 */
declare class Factory {
    modelManager: BaseModelManager;
    /**
     * Create a new ID for an object.
     * @returns {string} a new ID
     */
    static newId(): string;
    /**
     * Create the factory.
     *
     * @param {ModelManager} modelManager - The ModelManager to use for this registry
     */
    constructor(modelManager: BaseModelManager);
    /**
     * Create a new Resource with a given namespace, type name and id
     * @param {String} ns - the namespace of the Resource
     * @param {String} type - the type of the Resource
     * @param {String} [id] - an optional string identifier
     * @param {Object} [options] - an optional set of options
     * @param {boolean} [options.disableValidation] - pass true if you want the factory to
     * return a {@link Resource} instead of a {@link ValidatedResource}. Defaults to false.
     * @param {String} [options.generate] - Pass one of: <dl>
     * <dt>sample</dt><dd>return a resource instance with generated sample data.</dd>
     * <dt>empty</dt><dd>return a resource instance with empty property values.</dd></dl>
     * @param {boolean} [options.includeOptionalFields] - if <code>options.generate</code>
     * is specified, whether optional fields should be generated.
     * @return {Resource} the new instance
     * @throws {TypeNotFoundException} if the type is not registered with the ModelManager
     */
    newResource(ns: any, type: any, id?: any, options?: any): Resource;
    /**
     * Create a new Concept with a given namespace and type name
     * @param {String} ns - the namespace of the Concept
     * @param {String} type - the type of the Concept
     * @param {String} [id] - an optional string identifier
     * @param {Object} [options] - an optional set of options
     * @param {boolean} [options.disableValidation] - pass true if you want the factory to
     * return a {@link Concept} instead of a {@link ValidatedConcept}. Defaults to false.
     * @param {String} [options.generate] - Pass one of: <dl>
     * <dt>sample</dt><dd>return a resource instance with generated sample data.</dd>
     * <dt>empty</dt><dd>return a resource instance with empty property values.</dd></dl>
     * @param {boolean} [options.includeOptionalFields] - if <code>options.generate</code>
     * is specified, whether optional fields should be generated.
     * @return {Resource} the new instance
     * @throws {TypeNotFoundException} if the type is not registered with the ModelManager
     */
    newConcept(ns: any, type: any, id?: any, options?: any): Resource;
    /**
     * Create a new Relationship with a given namespace, type and identifier.
     * A relationship is a typed pointer to an instance. I.e the relationship
     * with `namespace = 'org.example'`, `type = 'Vehicle'` and `id = 'ABC' creates`
     * a pointer that points at an instance of org.example.Vehicle with the id
     * ABC.
     *
     * @param {String} ns - the namespace of the Resource
     * @param {String} type - the type of the Resource
     * @param {String} id - the identifier
     * @return {Relationship} - the new relationship instance
     * @throws {TypeNotFoundException} if the type is not registered with the ModelManager
     */
    newRelationship(ns: any, type: any, id: any): Relationship;
    /**
     * Create a new transaction object. The identifier of the transaction is set to a UUID.
     * @param {String} ns - the namespace of the transaction.
     * @param {String} type - the type of the transaction.
     * @param {String} [id] - an optional string identifier
     * @param {Object} [options] - an optional set of options
     * @param {String} [options.generate] - Pass one of: <dl>
     * <dt>sample</dt><dd>return a resource instance with generated sample data.</dd>
     * <dt>empty</dt><dd>return a resource instance with empty property values.</dd></dl>
     * @param {boolean} [options.includeOptionalFields] - if <code>options.generate</code>
     * is specified, whether optional fields should be generated.
     * @return {Resource} A resource for the new transaction.
     */
    newTransaction(ns: any, type: any, id?: any, options?: any): Resource;
    /**
     * Create a new event object. The identifier of the event is
     * set to a UUID.
     * @param {String} ns - the namespace of the event.
     * @param {String} type - the type of the event.
     * @param {String} [id] - an optional string identifier
     * @param {Object} [options] - an optional set of options
     * @param {String} [options.generate] - Pass one of: <dl>
     * <dt>sample</dt><dd>return a resource instance with generated sample data.</dd>
     * <dt>empty</dt><dd>return a resource instance with empty property values.</dd></dl>
     * @param {boolean} [options.includeOptionalFields] - if <code>options.generate</code>
     * is specified, whether optional fields should be generated.
     * @return {Resource} A resource for the new event.
     */
    newEvent(ns: any, type: any, id?: any, options?: any): Resource;
    /**
     * PRIVATE IMPLEMENTATION. DO NOT CALL FROM OUTSIDE THIS CLASS.
     *
     * Initialize the state of a newly created resource
     * @private
     * @param {Typed} newObject - resource to initialize.
     * @param {ClassDeclaration} classDeclaration - class declaration for the resource.
     * @param {Object} clientOptions - field generation options supplied by the caller.
     */
    initializeNewObject(newObject: Typed, classDeclaration: ClassDeclaration, clientOptions: GenerateOptions): void;
    /**
     * PRIVATE IMPLEMENTATION. DO NOT CALL FROM OUTSIDE THIS CLASS.
     *
     * Parse the client-supplied field generation options and return a corresponding set of InstanceGenerator
     * options that can be used to initialize a resource.
     * @private
     * @param {Object} clientOptions - field generation options supplied by the caller.
     * @return {Object} InstanceGenerator options.
     */
    parseGenerateOptions(clientOptions: GenerateOptions): InstanceGeneratorParameters | null;
}
export { Factory };
export default Factory;

// ==== globalize.d.ts ====
/**
 * Dummy globalize replacement.
 * @param {string} message The message.
 * @return {function} A function for formatting the message.
 * @private
 */
declare function messageFormatter(message: any): (inserts: any) => any;
/**
 * Dummy globalize replacement.
 * @param {string} message The message.
 * @return {function} The formatted message.
 * @private
 */
declare function formatMessage(message: any): any;
/**
 * Dummy globalize replacement.
 * @param {string} locale The locale.
 * @return {Object} A mock globalize instance.
 * @private
 */
declare function Globalize(locale: any): {
    messageFormatter: typeof messageFormatter;
    formatMessage: typeof formatMessage;
};
declare namespace Globalize {
    var messageFormatter: (message: any) => (inserts: any) => any;
    var formatMessage: (message: any) => any;
}
export { Globalize };
export default Globalize;

// ==== index.d.ts ====
import SecurityException from "./securityexception";
import IllegalModelException from "./introspect/illegalmodelexception";
import TypeNotFoundException from "./typenotfoundexception";
import MetamodelException from "./metamodelexception";
import Decorated from "./introspect/decorated";
import Decorator from "./introspect/decorator";
import DecoratorFactory from "./introspect/decoratorfactory";
import DecoratorManager from "./decoratormanager";
import Declaration from "./introspect/declaration";
import ClassDeclaration from "./introspect/classdeclaration";
import IdentifiedDeclaration from "./introspect/identifieddeclaration";
import AssetDeclaration from "./introspect/assetdeclaration";
import ConceptDeclaration from "./introspect/conceptdeclaration";
import EnumValueDeclaration from "./introspect/enumvaluedeclaration";
import EventDeclaration from "./introspect/eventdeclaration";
import ParticipantDeclaration from "./introspect/participantdeclaration";
import TransactionDeclaration from "./introspect/transactiondeclaration";
import ScalarDeclaration from "./introspect/scalardeclaration";
import MapDeclaration from "./introspect/mapdeclaration";
import MapKeyType from "./introspect/mapkeytype";
import MapValueType from "./introspect/mapvaluetype";
import Property from "./introspect/property";
import Field from "./introspect/field";
import EnumDeclaration from "./introspect/enumdeclaration";
import RelationshipDeclaration from "./introspect/relationshipdeclaration";
import Validator from "./introspect/validator";
import NumberValidator from "./introspect/numbervalidator";
import StringValidator from "./introspect/stringvalidator";
import CollectionSizeValidator from "./introspect/collectionsizevalidator";
import Typed from "./model/typed";
import Identifiable from "./model/identifiable";
import Relationship from "./model/relationship";
import Resource from "./model/resource";
import Factory from "./factory";
import Globalize from "./globalize";
import Introspector from "./introspect/introspector";
import ModelFile from "./introspect/modelfile";
import ModelManager from "./modelmanager";
import ModelLoader from "./modelloader";
import Serializer from "./serializer";
import ModelUtil from "./modelutil";
import DateTimeUtil from "./datetimeutil";
import MetaModel from "./introspect/metamodel";
export { SecurityException, IllegalModelException, TypeNotFoundException, MetamodelException, Decorated, Decorator, DecoratorFactory, DecoratorManager, Declaration, ClassDeclaration, IdentifiedDeclaration, AssetDeclaration, ConceptDeclaration, EnumValueDeclaration, EventDeclaration, ParticipantDeclaration, TransactionDeclaration, ScalarDeclaration, MapDeclaration, MapKeyType, MapValueType, Property, Field, EnumDeclaration, RelationshipDeclaration, Validator, NumberValidator, StringValidator, CollectionSizeValidator, Typed, Identifiable, Relationship, Resource, Factory, Globalize, Introspector, ModelFile, ModelManager, Serializer, ModelUtil, ModelLoader, DateTimeUtil, MetaModel };

// ==== introspect/assetdeclaration.d.ts ====
import IdentifiedDeclaration from './identifieddeclaration';
/**
 * AssetDeclaration defines the schema (aka model or class) for
 * an Asset. It extends ClassDeclaration which manages a set of
 * fields, a super-type and the specification of an
 * identifying field.
 *
 * @extends ClassDeclaration
 * @see See {@link ClassDeclaration}
 * @class
 * @memberof module:concerto-core
 */
declare class AssetDeclaration extends IdentifiedDeclaration {
    /**
     * Create an AssetDeclaration.
     * @param {ModelFile} modelFile the ModelFile for this class
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile: any, ast: any);
    /**
     * Returns the kind of declaration
     *
     * @return {string} what kind of declaration this is
     */
    declarationKind(): string;
}
export { AssetDeclaration };
export default AssetDeclaration;

// ==== introspect/classdeclaration.d.ts ====
import Declaration from './declaration';
import type Property from './property';
/**
 * ClassDeclaration defines the structure (model/schema) of composite data.
 * It is composed of a set of Properties, may have an identifying field, and may
 * have a super-type.
 * A ClassDeclaration is conceptually owned by a ModelFile which
 * defines all the classes that are part of a namespace.
 *
 * @abstract
 * @class
 * @memberof module:concerto-core
 */
declare class ClassDeclaration extends Declaration {
    properties: Property[];
    superType: string | null;
    superTypeDeclaration: ClassDeclaration | null;
    idField: string | null;
    timestamped: boolean;
    abstract: boolean;
    type: string;
    /**
     * Returns the kind of declaration
     * @abstract
     * @return {string} the kind of declaration
     */
    declarationKind(): string;
    /**
     * Process the AST and build the model
     *
     * @throws {IllegalModelException}
     * @private
     */
    process(): void;
    /**
     * Adds a required field named 'timestamp' of type 'DateTime' if this class declaration has the 'concerto.Concept'
     * super type.
     * This method should only be called by system code.
     * @private
     */
    addTimestampField(): void;
    /**
     * Adds a required field named '$identifier' of type 'String'
     * This method should only be called by system code.
     * @private
     */
    addIdentifierField(): void;
    /**
     * Resolve the super type on this class and store it as an internal property.
     * @return {ClassDeclaration} The super type, or null if non specified.
     */
    _resolveSuperType(): ClassDeclaration | null;
    /**
     * Semantic validation of the structure of this class. Subclasses should
     * override this method to impose additional semantic constraints on the
     * contents/relations of fields.
     *
     * @throws {IllegalModelException}
     * @protected
     */
    validate(): void;
    /**
     * Returns true if this class is declared as abstract in the model file
     *
     * @return {boolean} true if the class is abstract
     */
    isAbstract(): boolean;
    /**
     * Returns true if this class declaration declares an identifying field
     * (system or explicit)
     * @returns {Boolean} true if the class declaration includes an identifier
     */
    isIdentified(): boolean;
    /**
     * Returns true if this class declaration declares a system identifier
     * $identifier
     * @returns {Boolean} true if the class declaration includes a system identifier
     */
    isSystemIdentified(): boolean;
    /**
     * Returns true if this class declaration declares an explicit identifier
     * @returns {Boolean} true if the class declaration includes an explicit identifier
     */
    isExplicitlyIdentified(): boolean;
    /**
     * Returns the name of the identifying field for this class. Note
     * that the identifying field may come from a super type.
     *
     * @return {string} the name of the id field for this class or null if it does not exist
     */
    getIdentifierFieldName(): string | null;
    /**
     * Returns the field with a given name or null if it does not exist.
     * The field must be directly owned by this class -- the super-type is
     * not introspected.
     *
     * @param {string} name the name of the field
     * @return {Property} the field definition or null if it does not exist
     */
    getOwnProperty(name: string): Property | null;
    /**
     * Returns the fields directly defined by this class.
     *
     * @return {Property[]} the array of fields
     */
    getOwnProperties(): Property[];
    /**
     * Returns the FQN of the super type for this class or null if this
     * class does not have a super type.
     *
     * @return {string} the FQN name of the super type or null
     */
    getSuperType(): string | null;
    /**
     * Get the super type class declaration for this class.
     * @return {ClassDeclaration} the super type declaration, or null if there is no super type.
     */
    getSuperTypeDeclaration(): ClassDeclaration | null;
    /**
     * Get the class declarations for all subclasses of this class, including this class.
     * @return {ClassDeclaration[]} subclass declarations.
     */
    getAssignableClassDeclarations(): ClassDeclaration[];
    /**
     * Get the class declarations for just the direct subclasses of this class, excluding this class.
     * @return {ClassDeclaration[]} direct subclass declarations.
     */
    getDirectSubclasses(): ClassDeclaration[];
    /**
     * Get all the super-type declarations for this type.
     * @return {ClassDeclaration[]} super-type declarations.
     */
    getAllSuperTypeDeclarations(): ClassDeclaration[];
    /**
     * Returns the property with a given name or null if it does not exist.
     * Fields defined in super-types are also introspected.
     *
     * @param {string} name the name of the field
     * @return {Property} the field, or null if it does not exist
     */
    getProperty(name: string): Property | null;
    /**
     * Returns the properties defined in this class and all super classes.
     *
     * @return {Property[]} the array of fields
     */
    getProperties(): Property[];
    /**
     * Get a nested property using a dotted property path
     * @param {string} propertyPath The property name or name with nested structure e.g a.b.c
     * @returns {Property} the property
     * @throws {IllegalModelException} if the property path is invalid or the property does not exist
     */
    getNestedProperty(propertyPath: string): Property;
    /**
     * Returns the string representation of this class
     * @return {String} the string representation of the class
     */
    toString(): string;
    /**
     * Returns true if this class is the definition of an asset.
     *
     * @return {boolean} true if the class is an asset
     */
    isAsset(): boolean;
    /**
     * Returns true if this class is the definition of a participant.
     *
     * @return {boolean} true if the class is an asset
     */
    isParticipant(): boolean;
    /**
     * Returns true if this class is the definition of a transaction.
     *
     * @return {boolean} true if the class is an asset
     */
    isTransaction(): boolean;
    /**
     * Returns true if this class is the definition of an event.
     *
     * @return {boolean} true if the class is an asset
     */
    isEvent(): boolean;
    /**
     * Returns true if this class is the definition of a concept.
     *
     * @return {boolean} true if the class is an asset
     */
    isConcept(): boolean;
    /**
     * Returns true if this class is the definition of a enum.
     *
     * @return {boolean} true if the class is an asset
     */
    isEnum(): boolean;
    /**
     * Returns true if this class is the definition of a map.
     *
     * @return {boolean} true if the class is an asset
     */
    isMapDeclaration(): boolean;
    /**
     * Returns true if this class is the definition of a enum.
     *
     * @return {boolean} true if the class is an asset
     */
    isClassDeclaration(): boolean;
}
export { ClassDeclaration };
export default ClassDeclaration;

// ==== introspect/collectionsizevalidator.d.ts ====
import Validator from './validator';
import type { ValidatedElement } from './validator';
import type { ICollectionSizeValidator } from '@accordproject/concerto-metamodel';
/**
 * A Validator to enforce that a collection (array or map) has a size within a specified range.
 * @private
 * @class
 * @memberof module:concerto-core
 */
declare class CollectionSizeValidator extends Validator {
    validator: ICollectionSizeValidator;
    minSize: number | null;
    maxSize: number | null;
    /**
     * Create a CollectionSizeValidator.
     * @param {Object} field - the field or declarations this validator is attached to
     * @param {Object} validator - The size validation object - [minSize, maxSize] (inclusive).
     *
     * @throws {IllegalModelException}
     */
    constructor(field: ValidatedElement, validator: ICollectionSizeValidator);
    /**
     * Validate the property
     * @param {string} identifier the identifier of the instance being validated
     * @param {number} value the collection size to validate
     * @throws {IllegalModelException}
     * @private
     */
    validate(identifier: string | null, value: number): void;
    /**
     * Returns the minSize for this validator, or null if not specified
     * @returns {number} the min size or null
     */
    getMinSize(): number | null;
    /**
     * Returns the maxSize for this validator, or null if not specified
     * @returns {number} the max size or null
     */
    getMaxSize(): number | null;
    /**
     * Determine if the validator is compatible with another validator. For the
     * validators to be compatible, all values accepted by this validator must
     * be accepted by the other validator.
     * @param {Validator} other the other validator.
     * @returns {boolean} True if this validator is compatible with the other
     * validator, false otherwise.
     */
    compatibleWith(other: Validator | null): boolean;
}
export { CollectionSizeValidator };
export default CollectionSizeValidator;

// ==== introspect/conceptdeclaration.d.ts ====
import ClassDeclaration from './classdeclaration';
/**
 * ConceptDeclaration defines the schema (aka model or class) for
 * an Concept. It extends ClassDeclaration which manages a set of
 * fields, a super-type and the specification of an
 * identifying field.
 *
 * @extends ClassDeclaration
 * @see {@link ClassDeclaration}
 * @class
 * @memberof module:concerto-core
 */
declare class ConceptDeclaration extends ClassDeclaration {
    /**
     * Create a ConceptDeclaration.
     * @param {ModelFile} modelFile the ModelFile for this class
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile: any, ast: any);
    /**
     * Returns the kind of declaration
     *
     * @return {string} what kind of declaration this is
     */
    declarationKind(): string;
}
export { ConceptDeclaration };
export default ConceptDeclaration;

// ==== introspect/declaration.d.ts ====
import Decorated from './decorated';
import type { AstNode } from './decorated';
import type ModelFile from './modelfile';
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
    modelFile: ModelFile;
    name: string;
    fqn: string;
    /**
     * Create a Declaration from an Abstract Syntax Tree. The AST is the
     * result of parsing.
     *
     * @param {ModelFile} modelFile - the ModelFile for this class
     * @param {Object} ast - the AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile: ModelFile, ast: AstNode);
    /**
     * Process the AST and build the model
     *
     * @throws {IllegalModelException}
     * @private
     */
    process(): void;
    /**
     * Semantic validation of the structure of this decorated. Subclasses should
     * override this method to impose additional semantic constraints on the
     * contents/relations of fields.
     *
     * @param {...*} args the validation arguments
     * @throws {IllegalModelException}
     * @protected
     */
    validate(...args: any[]): void;
    /**
     * Determines whether a type name resolves to a reserved type in the Concerto
     * system namespace.
     * @param {ModelFile} modelFile - the current model file
     * @param {string} typeName - local/imported type name
     * @returns {boolean} true if the resolved import is a reserved system type
     */
    private isReservedSystemTypeImport;
    /**
     * Returns the ModelFile that defines this class.
     *
     * @public
     * @return {ModelFile} the owning ModelFile
     */
    getModelFile(): ModelFile;
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
    getIdentifierFieldName(): string | null;
    /**
     * Returns the FQN of the super type for this class or null if this
     * class does not have a super type.
     *
     * @return {string} the FQN name of the super type or null
     */
    getType(): string | null;
    /**
     * Returns the string representation of this class
     * @return {String} the string representation of the class
     */
    toString(): string | null;
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
}
export { Declaration };
export default Declaration;

// ==== introspect/decorated.d.ts ====
import Decorator from './decorator';
import type { IDecorator, IRange } from '@accordproject/concerto-metamodel';
import type ModelFile from './modelfile';
/**
 * The shape shared by every metamodel AST node that the introspect classes
 * consume. The named members are the ones present on every node; the index
 * signature is deliberate: these classes are duck-typed across node kinds
 * (a ClassDeclaration is built from either a concept or an enum declaration,
 * for example), so narrowing `ast` per subclass would mean a type guard at
 * every access site. Callers wanting the precise node types should use the
 * interfaces exported by `@accordproject/concerto-metamodel`.
 */
export interface AstNode {
    $class: string;
    name?: string;
    location?: IRange;
    decorators?: IDecorator[];
    [key: string]: any;
}
/**
 * Decorated defines a model element that may have decorators attached.
 *
 * @private
 * @abstract
 * @class
 * @memberof module:concerto-core
 */
declare class Decorated {
    ast: AstNode;
    decorators: Decorator[];
    /**
     * Create a Decorated from an Abstract Syntax Tree. The AST is the
     * result of parsing.
     *
     * @param {string} ast - the AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(ast: AstNode);
    /**
     * Returns the ModelFile that defines this class.
     *
     * @abstract
     * @protected
     * @return {ModelFile} the owning ModelFile
     */
    getModelFile(): ModelFile;
    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     */
    accept(visitor: any, parameters: any): any;
    /**
     * Process the AST and build the model
     *
     * @throws {IllegalModelException}
     * @private
     */
    process(): void;
    /**
     * Semantic validation of the structure of this decorated. Subclasses should
     * override this method to impose additional semantic constraints on the
     * contents/relations of fields.
     *
     * @param {...*} args the validation arguments
     * @throws {IllegalModelException}
     * @protected
     */
    validate(...args: any[]): void;
    /**
     * Returns the decorators for this class.
     *
     * @return {Decorator[]} the decorators for the class
     */
    getDecorators(): Decorator[];
    /**
     * Returns the decorator for this class with a given name.
     * @param {string} name  - the name of the decorator
     * @return {Decorator} the decorator attached to this class with the given name, or null if it does not exist.
     */
    getDecorator(name: string): Decorator | null;
}
export { Decorated };
export default Decorated;

// ==== introspect/decorator.d.ts ====
import type Decorated from './decorated';
import type { AstNode } from './decorated';
/**
 * A decorator argument that references a type, produced from a
 * `DecoratorTypeReference` node in the metamodel AST.
 */
export interface DecoratorTypeReferenceArgument {
    type: 'Identifier';
    name: string;
    array: boolean;
}
/**
 * The values a decorator can be given: a literal, or a reference to a type.
 */
export type DecoratorArgument = string | number | boolean | DecoratorTypeReferenceArgument;
/**
 * Decorator encapsulates a decorator (annotation) on a class or property.
 * @class
 * @memberof module:concerto-core
 */
declare class Decorator {
    ast: AstNode;
    parent: Decorated;
    arguments: DecoratorArgument[];
    name: string;
    /**
     * Create a Decorator.
     * @param {ClassDeclaration | Property} parent - the owner of this property
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(parent: Decorated, ast: AstNode);
    /**
    * Handles a validation error, logging and throwing as required
    * @param {string} level the log level
    * @param {string | Error} err the message to log, or the error that was caught
    * @private
    */
    handleError(level: string | undefined, err: string | Error): void;
    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     */
    accept(visitor: any, parameters: any): any;
    /**
     * Returns the owner of this property
     * @return {ClassDeclaration|Property} the parent class or property declaration
     */
    getParent(): Decorated;
    /**
     * Process the AST and build the model
     * @throws {IllegalModelException}
     * @private
     */
    process(): void;
    /**
     * Validate the decorator
     * @throws {IllegalModelException}
     * @private
     */
    validate(): void;
    /**
     * Returns the name of a decorator
     * @return {string} the name of this decorator
     */
    getName(): string;
    /**
     * Returns the arguments for this decorator
     * @return {object[]} the arguments for this decorator
     */
    getArguments(): DecoratorArgument[];
    /**
     * Returns true if this class is the definition of a decorator.
     *
     * @return {boolean} true if the class is a decorator
     */
    isDecorator(): boolean;
}
export { Decorator };
export default Decorator;

// ==== introspect/decoratorfactory.d.ts ====
import type Decorated from './decorated';
import type { AstNode } from './decorated';
import type Decorator from './decorator';
/**
 * An interface for a class that processes a decorator and returns a specific
 * implementation class for that decorator.
 * @class
 * @memberof module:concerto-core
 */
declare class DecoratorFactory {
    /**
     * Process the decorator, and return a specific implementation class for that
     * decorator, or return null if this decorator is not handled by this processor.
     * @abstract
     * @param {ClassDeclaration | Property} parent - the owner of this property
     * @param {Object} ast - The AST created by the parser
     * @return {Decorator} The decorator.
     */
    newDecorator(parent: Decorated, ast: AstNode): Decorator | null;
}
export { DecoratorFactory };
export default DecoratorFactory;

// ==== introspect/enumdeclaration.d.ts ====
import ClassDeclaration from './classdeclaration';
/**
 * EnumDeclaration defines an enumeration of static values.
 *
 * @extends ClassDeclaration
 * @see See {@link ClassDeclaration}
 * @class
 * @memberof module:concerto-core
 */
declare class EnumDeclaration extends ClassDeclaration {
    /**
     * Create an EnumDeclaration.
     * @param {ModelFile} modelFile the ModelFile for this class
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile: any, ast: any);
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
}
export { EnumDeclaration };
export default EnumDeclaration;

// ==== introspect/enumvaluedeclaration.d.ts ====
import Property from './property';
/**
 * Class representing a value from a set of enumerated values
 *
 * @extends Property
 * @see See {@link Property}
 * @class
 * @memberof module:concerto-core
 */
declare class EnumValueDeclaration extends Property {
    /**
     * Create a EnumValueDeclaration.
     * @param {ClassDeclaration} parent - The owner of this property
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(parent: any, ast: any);
    /**
     * Validate the property
     * @param {ClassDeclaration} classDecl the class declaration of the property
     * @throws {IllegalModelException}
     * @private
     */
    validate(classDecl: any): void;
    /**
     * Returns true if this class is the definition of a enum value.
     *
     * @return {boolean} true if the class is an enum value
     */
    isEnumValue(): boolean;
}
export { EnumValueDeclaration };
export default EnumValueDeclaration;

// ==== introspect/eventdeclaration.d.ts ====
import IdentifiedDeclaration from './identifieddeclaration';
/** Class representing the definition of an Event.
 * @extends ClassDeclaration
 * @see See  {@link ClassDeclaration}
 * @class
 * @memberof module:concerto-core
 */
declare class EventDeclaration extends IdentifiedDeclaration {
    /**
     * Create an EventDeclaration.
     * @param {ModelFile} modelFile the ModelFile for this class
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile: any, ast: any);
    /**
     * Process the AST and build the model
     *
     * @throws {IllegalModelException}
     * @private
     */
    process(): void;
    /**
     * Returns the kind of declaration
     *
     * @return {string} what kind of declaration this is
     */
    declarationKind(): string;
}
export { EventDeclaration };
export default EventDeclaration;

// ==== introspect/field.d.ts ====
import Property from './property';
import type ClassDeclaration from './classdeclaration';
import type Validator from './validator';
import type { AstNode } from './decorated';
/**
 * Class representing the definition of a Field. A Field is owned
 * by a ClassDeclaration and has a name, type and additional metadata
 * (see below).
 * @private
 * @extends Property
 * @see See  {@link  Property}
 * @class
 * @memberof module:concerto-core
 */
declare class Field extends Property {
    validator: Validator | null;
    defaultValue: string | number | boolean | null;
    scalarField: Field | null;
    /**
     * Create a Field.
     * @param {ClassDeclaration} parent - The owner of this property
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(parent: ClassDeclaration, ast: AstNode);
    /**
     * Process the AST and build the model
     * @throws {IllegalModelException}
     * @private
     */
    process(): void;
    /**
     * Returns the validator string for this field
     * @return {Validator} the validator for the field or null
     */
    getValidator(): Validator | null;
    /**
     * Returns the default value for the field or null if there is no default value
     * @return {string | number} the default value for the field or null
     */
    getDefaultValue(): string | number | boolean | null;
    /**
     * Returns a string representation of this property§
     * @return {String} the string version of the property.
     */
    toString(): string;
    /**
     * Returns true if this class is the definition of a field.
     *
     * @return {boolean} true if the class is a field
     */
    isField(): boolean;
    /**
     * Returns true if the field's type is a scalar
     * @returns {boolean} true if the field is a scalar type
     */
    isTypeScalar(): boolean;
    /**
     * Unboxes a field that references a scalar type to an
     * underlying Field definition.
     * @throws {Error} throws an error if this field is not a scalar type.
     * @returns {Field} the primitive field for this scalar
     */
    getScalarField(): Field;
}
export { Field };
export default Field;

// ==== introspect/identifieddeclaration.d.ts ====
import ClassDeclaration from './classdeclaration';
/**
 * IdentifiedDeclaration
 *
 * @extends ClassDeclaration
 * @see See {@link ClassDeclaration}
 * @class
 * @memberof module:concerto-core
 * @abstract
 */
declare class IdentifiedDeclaration extends ClassDeclaration {
    /**
     * Create an IdentifiedDeclaration.
     * @param {ModelFile} modelFile the ModelFile for this class
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile: any, ast: any);
}
export { IdentifiedDeclaration };
export default IdentifiedDeclaration;

// ==== introspect/illegalmodelexception.d.ts ====
import { BaseFileException } from '@accordproject/concerto-util';
/**
 * Exception throws when a composer file is semantically invalid
 * @extends BaseFileException
 * @see See  {@link BaseFileException}
 * @class
 * @memberof module:concerto-core
 */
declare class IllegalModelException extends BaseFileException {
    /**
     * Create an IllegalModelException.
     * @param {string} message - the message for the exception
     * @param {ModelFile} [modelFile] - the modelfile associated with the exception
     * @param {Object} [fileLocation] - location details of the error within the model file.
     * @param {number} fileLocation.start.line - start line of the error location.
     * @param {number} fileLocation.start.column - start column of the error location.
     * @param {number} fileLocation.end.line - end line of the error location.
     * @param {number} fileLocation.end.column - end column of the error location.
     * @param {string} [component] - the component which throws this error
     */
    constructor(message: any, modelFile?: any, fileLocation?: any, component?: any);
}
export { IllegalModelException };
export default IllegalModelException;

// ==== introspect/introspector.d.ts ====
import type ClassDeclaration from './classdeclaration';
import type BaseModelManager from '../basemodelmanager';
/**
 *
 * Provides access to the structure of transactions, assets and participants.
 *
 * @class
 * @memberof module:concerto-core
 */
declare class Introspector {
    modelManager: BaseModelManager;
    /**
     * Create the Introspector.
     * @param {ModelManager} modelManager - the ModelManager that backs this Introspector
     */
    constructor(modelManager: BaseModelManager);
    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     */
    accept(visitor: any, parameters: any): any;
    /**
     * Returns all the class declarations for the business network.
     * @return {ClassDeclaration[]} the array of class declarations
     */
    getClassDeclarations(): ClassDeclaration[];
    /**
     * Returns the class declaration with the given fully qualified name.
     * Throws an error if the class declaration does not exist.
     * @param {String} fullyQualifiedTypeName  - the fully qualified name of the type
     * @return {ClassDeclaration} the class declaration
     * @throws {Error} if the class declaration does not exist
     */
    getClassDeclaration(fullyQualifiedTypeName: string): ClassDeclaration;
    /**
     * Returns the backing ModelManager
     * @return {ModelManager} the backing ModelManager
     * @private
     */
    getModelManager(): BaseModelManager;
}
export { Introspector };
export default Introspector;

// ==== introspect/mapdeclaration.d.ts ====
import Declaration from './declaration';
import MapValueType from './mapvaluetype';
import MapKeyType from './mapkeytype';
import type ModelFile from './modelfile';
import type { AstNode } from './decorated';
/**
 * MapDeclaration defines a Map data structure, which allows storage of a collection
 * of values, where each value is associated and indexed with a unique key.
 *
 * @extends Decorated
 * @see See {@link Decorated}
 * @class
 * @memberof module:concerto-core
 */
declare class MapDeclaration extends Declaration {
    key: MapKeyType;
    value: MapValueType;
    /**
     * Create an MapDeclaration.
     * @param {ModelFile} modelFile - the ModelFile for this class
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile: ModelFile, ast: AstNode);
    /**
     * Process the AST and build the model
     *
     * @throws {IllegalModelException}
     * @private
     */
    process(): void;
    /**
     * Semantic validation of the structure of this class.
     *
     * @throws {IllegalModelException}
     * @protected
     */
    validate(): void;
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
export { MapDeclaration };
export default MapDeclaration;

// ==== introspect/mapkeytype.d.ts ====
import Decorated from './decorated';
import type ModelFile from './modelfile';
import type MapDeclaration from './mapdeclaration';
import type { AstNode } from './decorated';
/**
 * MapKeyType defines a Key type of an MapDeclaration.
 *
 * @extends Decorated
 * @see See {@link Decorated}
 * @class
 * @memberof module:concerto-core
 */
declare class MapKeyType extends Decorated {
    parent: MapDeclaration;
    modelFile: ModelFile;
    type: string;
    /**
     * Create an MapKeyType.
     * @param {MapDeclaration} parent - The owner of this property
     * @param {Object} ast - The AST created by the parser
     * @param {ModelFile} modelFile - the ModelFile for the Map class
     * @throws {IllegalModelException}
     */
    constructor(parent: MapDeclaration, ast: AstNode);
    /**
     * Process the AST and build the model
     *
     * @throws {IllegalModelException}
     * @private
     */
    process(): void;
    /**
     * Semantic validation of the structure of this class.
     *
     * @throws {IllegalModelException}
     * @protected
     */
    validate(): void;
    /**
     * Sets the Type name for the Map Key
     *
     * @param {Object} ast - The AST created by the parser
     * @private
     */
    processType(ast: AstNode): void;
    /**
     * Returns the ModelFile that defines this class.
     *
     * @public
     * @return {ModelFile} the owning ModelFile
     */
    getModelFile(): ModelFile;
    /**
    * Returns the owner of this property
     * @public
     * @return {MapDeclaration} the parent map declaration
     */
    getParent(): MapDeclaration;
    /**
     * Returns the Type of the MapKey. This name does not include the
     * namespace from the owning ModelFile.
     *
     * @return {string} the short name of this class
     */
    getType(): string;
    /**
     * Returns the string representation of this class
     * @return {String} the string representation of the class
     */
    toString(): string;
    /**
     * Returns true if this class is the definition of a Map Key.
     *
     * @return {boolean} true if the class is a Map Key
     */
    isKey(): boolean;
    /**
     * Returns true if this class is the definition of a Map Value.
     *
     * @return {boolean} true if the class is a Map Value
     */
    isValue(): boolean;
    /**
     * Return the namespace of this map key.
     * @return {string} namespace - a namespace.
     */
    getNamespace(): string;
}
export { MapKeyType };
export default MapKeyType;

// ==== introspect/mapvaluetype.d.ts ====
import Decorated from './decorated';
import type ModelFile from './modelfile';
import type MapDeclaration from './mapdeclaration';
import type { AstNode } from './decorated';
/**
 * MapValueType defines a Value type of MapDeclaration.
 *
 * @extends Decorated
 * @see See {@link Decorated}
 * @class
 * @memberof module:concerto-core
 */
declare class MapValueType extends Decorated {
    parent: MapDeclaration;
    modelFile: ModelFile;
    type: string;
    /**
     * Create an MapValueType.
     * @param {MapDeclaration} parent - The owner of this property
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(parent: MapDeclaration, ast: AstNode);
    /**
     * Process the AST and build the model
     *
     * @throws {IllegalModelException}
     * @private
     */
    process(): void;
    /**
     * Semantic validation of the structure of this class.
     *
     * @throws {IllegalModelException}
     * @protected
     */
    validate(): void;
    /**
     * Sets the Type name for the Map Value
     *
     * @param {Object} ast - The AST created by the parser
     * @private
     */
    processType(ast: AstNode): void;
    /**
     * Returns the ModelFile that defines this class.
     *
     * @public
     * @return {ModelFile} the owning ModelFile
     */
    getModelFile(): ModelFile;
    /**
    * Returns the owner of this property
     * @public
     * @return {MapDeclaration} the parent map declaration
     */
    getParent(): MapDeclaration;
    /**
     * Returns the Type of the MapValue. This name does not include the
     * namespace from the owning ModelFile.
     *
     * @return {string} the short name of this class
     */
    getType(): string;
    /**
     * Returns the string representation of this class
     * @return {String} the string representation of the class
     */
    toString(): string;
    /**
     * Returns true if this class is the definition of a Map Key.
     *
     * @return {boolean} true if the class is a Map Key
     */
    isKey(): boolean;
    /**
     * Returns true if this class is the definition of a Map Value.
     *
     * @return {boolean} true if the class is a Map Value
     */
    isValue(): boolean;
    /**
     * Return the namespace of this map value.
     * @return {string} namespace - a namespace.
     */
    getNamespace(): string;
}
export { MapValueType };
export default MapValueType;

// ==== introspect/metamodel.d.ts ====
import ModelManager from '../modelmanager';
/**
 * Create a metamodel manager (for validation against the metamodel)
 * @return {ModelManager} the metamodel manager
 */
declare function newMetaModelManager(): ModelManager;
/**
 * Validate metamodel instance against the metamodel
 * @param {object} input - the metamodel instance in JSON
 * @return {object} the validated metamodel instance in JSON
 */
declare function validateMetaModel(input: any): any;
/**
 * Import metamodel to a model manager
 * @param {object} metaModel - the metamodel
 * @param {boolean} [validate] - whether to perform validation
 * @return {ModelManager} the metamodel for this model manager
 */
declare function modelManagerFromMetaModel(metaModel: any, validate?: boolean): ModelManager;
export { newMetaModelManager, validateMetaModel, modelManagerFromMetaModel };
declare const _default: {
    newMetaModelManager: typeof newMetaModelManager;
    validateMetaModel: typeof validateMetaModel;
    modelManagerFromMetaModel: typeof modelManagerFromMetaModel;
};
export default _default;

// ==== introspect/modelfile.d.ts ====
import AssetDeclaration from './assetdeclaration';
import EnumDeclaration from './enumdeclaration';
import ClassDeclaration from './classdeclaration';
import ConceptDeclaration from './conceptdeclaration';
import ScalarDeclaration from './scalardeclaration';
import ParticipantDeclaration from './participantdeclaration';
import TransactionDeclaration from './transactiondeclaration';
import EventDeclaration from './eventdeclaration';
import MapDeclaration from './mapdeclaration';
import Decorated from './decorated';
import type BaseModelManager from '../basemodelmanager';
import type Declaration from './declaration';
import type { AstNode } from './decorated';
import type { IModel } from '@accordproject/concerto-metamodel';
/**
 * A predicate over a Declaration, used by ModelFile#filter.
 */
export type FilterFunction = (declaration: Declaration) => boolean;
/**
 * Class representing a Model File. A Model File contains a single namespace
 * and a set of model elements: assets, transactions etc.
 *
 * @class
 * @memberof module:concerto-core
 */
declare class ModelFile extends Decorated {
    modelManager: BaseModelManager;
    definitions: string | null | undefined;
    fileName: string | null | undefined;
    external: boolean;
    declarations: Declaration[];
    localTypes: Map<string, Declaration> | null;
    imports: AstNode[];
    importShortNames: Map<string, string>;
    importWildcardNamespaces: string[];
    importUriMap: Record<string, string>;
    concertoVersion: string | null;
    version: string | null | undefined;
    namespace: string;
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
    constructor(modelManager: BaseModelManager, ast: AstNode, definitions?: string | null, fileName?: string | null);
    /**
     * Returns the ModelFile that defines this class.
     *
     * @protected
     * @return {ModelFile} the owning ModelFile
     */
    getModelFile(): ModelFile;
    /**
     * Returns true
     * @returns {boolean} true
     */
    isModelFile(): boolean;
    /**
     * The handle of this ModelFile's own namespace in `this.modelManager`'s
     * `rustHandle` (P4-08), when that mirror is trustworthy
     * (`BaseModelManager#_rustMirrorTrustworthy`) and already holds this
     * namespace. `undefined` otherwise -- including for a `ModelFile` built
     * by a white-box test on a stubbed `modelManager`, whose
     * `_rustMirrorTrustworthy` is itself undefined and so falsy here.
     * @return {number | undefined} the handle, or undefined to fall back to TS
     * @private
     */
    _rustHandleId(): number | undefined;
    /**
     * Returns the semantic version
     * @returns {string} the semantic version or null if the namespace for the model file is
     * unversioned
     */
    getVersion(): string | null | undefined;
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
    getImportURI(namespace: string): string | null;
    /**
     * Returns an object that maps from the import declarations to the URIs specified
     * @return {Object} keys are import declarations, values are URIs
     * @private
     */
    getExternalImports(): Record<string, string>;
    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     */
    accept(visitor: any, parameters: any): any;
    /**
     * Returns the ModelManager associated with this ModelFile
     *
     * @return {ModelManager} The ModelManager for this ModelFile
     */
    getModelManager(): BaseModelManager;
    /**
     * Returns the types that have been imported into this ModelFile.
     *
     * @return {string[]} The array of fully-qualified names for types imported by
     * this ModelFile
     */
    getImports(): string[];
    /**
     * Validates the ModelFile.
     *
     * @throws {IllegalModelException} if the model is invalid
     * @protected
     */
    validate(): void;
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
    resolveType(context: any, type: any, fileLocation?: any): void;
    /**
     * Returns true if the type is defined in this namespace.
     * @param {string} type - the short name of the type
     * @return {boolean} - true if the type is defined in this ModelFile
     * @private
     */
    isLocalType(type: any): any;
    /**
     * Returns true if the type is imported from another namespace
     * @param {string} type - the short name of the type
     * @return {boolean} - true if the type is imported from another namespace
     * @private
     */
    isImportedType(type: any): boolean;
    /**
     * Returns the FQN for a type that is imported from another namespace
     * @param {string} type - the short name of the type
     * @return {string} - the FQN of the resolved import
     * @throws {Error} - if the type is not imported
     * @private
     */
    resolveImport(type: string): string;
    /**
     * Returns the actual imported name from another namespace
     * @param {string} type - the short name of the type
     * @returns {string} - the actual imported name. If not aliased then returns the same string
     */
    getImportedType(type: string): string;
    /**
     * Returns true if the type is defined in the model file
     * @param {string} type the name of the type
     * @return {boolean} true if the type (asset or transaction) is defined
     */
    isDefined(type: any): boolean;
    /**
     * Returns the FQN of the type or null if the type could not be resolved.
     * For primitive types the type name is returned.
     * @param {string} type - a FQN or short type name
     * @return {string | ClassDeclaration} the class declaration for the type or null.
     * @private
     */
    getType(type: any): any;
    /**
     * Returns the FQN of the type or null if the type could not be resolved.
     * For primitive types the short type name is returned.
     * @param {string} type - a FQN or short type name
     * @return {string} the FQN type name or null
     * @private
     */
    getFullyQualifiedTypeName(type: any): any;
    /**
     * Returns the type with the specified name or null
     * @param {string} type the short OR FQN name of the type
     * @return {ClassDeclaration} the ClassDeclaration, or null if the type does not exist
     */
    getLocalType(type: string): Declaration | null;
    /**
     * Get the AssetDeclarations defined in this ModelFile or null
     * @param {string} name the name of the type
     * @return {AssetDeclaration} the AssetDeclaration with the given short name
     */
    getAssetDeclaration(name: any): Declaration | null;
    /**
     * Get the TransactionDeclaration defined in this ModelFile or null
     * @param {string} name the name of the type
     * @return {TransactionDeclaration} the TransactionDeclaration with the given short name
     */
    getTransactionDeclaration(name: any): Declaration | null;
    /**
     * Get the EventDeclaration defined in this ModelFile or null
     * @param {string} name the name of the type
     * @return {EventDeclaration} the EventDeclaration with the given short name
     */
    getEventDeclaration(name: any): Declaration | null;
    /**
     * Get the ParticipantDeclaration defined in this ModelFile or null
     * @param {string} name the name of the type
     * @return {ParticipantDeclaration} the ParticipantDeclaration with the given short name
     */
    getParticipantDeclaration(name: any): Declaration | null;
    /**
     * Get the Namespace for this model file.
     * @return {string} The Namespace for this model file
     */
    getNamespace(): string;
    /**
     * Get the filename for this model file. Note that this may be null.
     * @return {string} The filename for this model file
     */
    getName(): string | null | undefined;
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
     * Get the ClassDeclarations defined in this ModelFile
     * @return {ClassDeclaration[]} the ClassDeclarations defined in the model file
     */
    getClassDeclarations(): ClassDeclaration[];
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
     * Get the MapDeclarations defined in this ModelFile
     * @return {MapDeclaration[]} the MapDeclarations defined in the model file
     */
    getMapDeclarations(): MapDeclaration[];
    /**
     * Get the ScalarDeclaration defined in this ModelFile
     * @return {ScalarDeclaration[]} the ScalarDeclaration defined in the model file
     */
    getScalarDeclarations(): ScalarDeclaration[];
    /**
     * Get the instances of a given type in this ModelFile
     * @param {Function} type - the type of the declaration
     * @return {Object[]} the ClassDeclaration defined in the model file
     */
    getDeclarations<T extends Declaration>(type: new (...args: any[]) => T): T[];
    /**
     * Get all declarations in this ModelFile
     * @return {ClassDeclaration[]} the ClassDeclarations defined in the model file
     */
    getAllDeclarations(): Declaration[];
    /**
     * Get the definitions for this model.
     * @return {string} The definitions for this model.
     */
    getDefinitions(): string | null | undefined;
    /**
     * Get the ast for this model.
     * @return {object} The definitions for this model.
     */
    getAst(): IModel;
    /**
     * Get the expected concerto version
     * @return {string} The semver range for compatible concerto versions
     */
    getConcertoVersion(): string | null;
    /**
     * Check whether this modelfile is compatible with the concerto version.
     * Models targeting an older major version are considered backward-compatible
     * with newer runtimes (e.g. a model declaring "^3.0.0" loads under v4).
     */
    isCompatibleVersion(): void;
    /**
     * Verifies that an import is versioned if the strict
     * option has been set on the Model Manager
     * @param {*} imp - the import to validate
     * @private
     */
    enforceImportVersioning(imp: any): void;
    /**
     * Populate from an AST
     * @param {object} ast - the AST obtained from the parser
     * @private
     */
    fromAst(ast: AstNode): void;
    /**
     * A function type definition for use as an argument to the filter function
     * @callback FilterFunction
     * @param {Declaration} declaration
     * @returns {boolean} true, if the declaration satisfies the filter function
     */
    /**
     * Returns a new ModelFile with only the types for which the
     * filter function returns true.
     *
     * Will return null if the filtered ModelFile doesn't contain any declarations.
     *
     * The predicate is also invoked on declarations from imported files to
     * determine whether each import should be retained. It must be
     * side-effect-free and total across all reachable namespaces.
     *
     * @param {FilterFunction} predicate - the filter function over a Declaration object
     * @param {ModelManager} modelManager - the target ModelManager for the filtered ModelFile
     * @returns {ModelFile?} - the filtered ModelFile
     * @private
     */
    filter(predicate: FilterFunction, modelManager: BaseModelManager): ModelFile | null;
}
export { ModelFile };
export default ModelFile;

// ==== introspect/numbervalidator.d.ts ====
import Validator from './validator';
import type { ValidatedElement, NumberDomainValidatorAst } from './validator';
/**
 * A Validator to enforce that non null numeric values are between two values.
 * @private
 * @class
 * @memberof module:concerto-core
 */
declare class NumberValidator extends Validator {
    validator: NumberDomainValidatorAst;
    lowerBound: number | null;
    upperBound: number | null;
    /**
     * Create a NumberValidator.
     * @param {Object} field - the field or scalar declaration this validator is attached to
     * @param {Object} ast - The ast for the range defined as [lower,upper] (inclusive).
     *
     * @throws {IllegalModelException}
     */
    constructor(field: ValidatedElement, ast: NumberDomainValidatorAst);
    /**
     * Returns the lower bound for this validator, or null if not specified
     * @returns {number} the lower bound or null
     */
    getLowerBound(): number | null;
    /**
     * Returns the upper bound for this validator, or null if not specified
     * @returns {number} the upper bound or null
     */
    getUpperBound(): number | null;
    /**
     * Validate the property
     * @param {string} identifier the identifier of the instance being validated
     * @param {Object} value the value to validate
     * @throws {IllegalModelException}
     * @private
     */
    validate(identifier: string | null, value: number): void;
    /**
     * Returns a string representation
     * @return {string} the string representation
     * @private
     */
    toString(): string;
    /**
     * Determine if the validator is compatible with another validator. For the
     * validators to be compatible, all values accepted by this validator must
     * be accepted by the other validator.
     * @param {Validator} other the other validator.
     * @returns {boolean} True if this validator is compatible with the other
     * validator, false otherwise.
     */
    compatibleWith(other: Validator | null): boolean;
}
export { NumberValidator };
export default NumberValidator;

// ==== introspect/participantdeclaration.d.ts ====
import IdentifiedDeclaration from './identifieddeclaration';
/** Class representing the definition of a Participant.
 * @extends ClassDeclaration
 * @see See  {@link ClassDeclaration}
 *
 * @class
 * @memberof module:concerto-core
 */
declare class ParticipantDeclaration extends IdentifiedDeclaration {
    /**
     * Create an ParticipantDeclaration.
     * @param {ModelFile} modelFile the ModelFile for this class
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile: any, ast: any);
    /**
     * Returns the kind of declaration
     *
     * @return {string} what kind of declaration this is
     */
    declarationKind(): string;
}
export { ParticipantDeclaration };
export default ParticipantDeclaration;

// ==== introspect/property.d.ts ====
import Decorated from './decorated';
import CollectionSizeValidator from './collectionsizevalidator';
import type ClassDeclaration from './classdeclaration';
import type ModelFile from './modelfile';
import type { AstNode } from './decorated';
/**
 * Property representing an attribute of a class declaration,
 * either a Field or a Relationship.
 *
 * @class
 * @memberof module:concerto-core
 */
declare class Property extends Decorated {
    parent: ClassDeclaration;
    name: string;
    type: string | null;
    array: boolean;
    sizeValidator: CollectionSizeValidator | null;
    optional: boolean;
    /**
     * Create a Property.
     * @param {ClassDeclaration} parent - the owner of this property
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(parent: ClassDeclaration, ast: AstNode);
    /**
     * Returns the ModelFile that defines this class.
     *
     * @public
     * @return {ModelFile} the owning ModelFile
     */
    getModelFile(): ModelFile;
    /**
     * Returns the owner of this property
     * @return {ClassDeclaration} the parent class declaration
     */
    getParent(): ClassDeclaration;
    /**
     * Process the AST and build the model
     * @throws {IllegalModelException}
     * @private
     */
    process(): void;
    /**
     * Validate the property
     * @param {ClassDeclaration} classDecl the class declaration of the property
     * @throws {IllegalModelException}
     * @protected
     */
    validate(classDecl: ClassDeclaration): void;
    /**
     * Returns the name of a property
     * @return {string} the name of this field
     */
    getName(): string;
    /**
     * Returns the type of a property
     * @return {string} the type of this field
     */
    getType(): string | null;
    /**
     * Returns true if the field is optional
     * @return {boolean} true if the field is optional
     */
    isOptional(): boolean;
    /**
     * Returns the fully qualified type name of a property
     * @return {string} the fully qualified type of this property
     */
    getFullyQualifiedTypeName(): string;
    /**
     * Returns the fully name of a property (ns + class name + property name)
     * @return {string} the fully qualified name of this property
     */
    getFullyQualifiedName(): string;
    /**
     * Returns the namespace of the parent of this property
     * @return {string} the namespace of the parent of this property
     */
    getNamespace(): string;
    /**
     * Returns true if the field is declared as an array type
     * @return {boolean} true if the property is an array type
     */
    isArray(): boolean;
    /**
     * Returns the collection size validator for this property, if one exists.
     * @return {CollectionSizeValidator|null} the validator or null
     */
    getSizeValidator(): CollectionSizeValidator | null;
    /**
     * Returns true if the field is declared as an enumerated value
     * @return {boolean} true if the property is an enumerated value
     */
    isTypeEnum(): boolean;
    /**
     * Returns true if this property is a primitive type.
     * @return {boolean} true if the property is a primitive type.
     */
    isPrimitive(): boolean;
}
export { Property };
export default Property;

// ==== introspect/relationshipdeclaration.d.ts ====
import Property from './property';
import type { AstNode } from './decorated';
import type ClassDeclaration from './classdeclaration';
/**
 * Class representing a relationship between model elements
 * @extends Property
 * @see See  {@link Property}
 *
 * @class
 * @memberof module:concerto-core
 */
declare class RelationshipDeclaration extends Property {
    /**
     * Create a Relationship.
     * @param {ClassDeclaration} parent - The owner of this property
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(parent: ClassDeclaration, ast: AstNode);
    /**
     * Validate the property
     * @param {ClassDeclaration} classDecl the class declaration of the property
     * @throws {IllegalModelException}
     * @protected
     */
    validate(classDecl: ClassDeclaration): void;
    /**
     * Returns a string representation of this property
     * @return {String} the string version of the property.
     */
    toString(): string;
    /**
     * Returns true if this class is the definition of a relationship.
     *
     * @return {boolean} true if the class is a relationship
     */
    isRelationship(): boolean;
}
export { RelationshipDeclaration };
export default RelationshipDeclaration;

// ==== introspect/scalardeclaration.d.ts ====
import Declaration from './declaration';
import type Validator from './validator';
import type ClassDeclaration from './classdeclaration';
/**
 * ScalarDeclaration defines the structure (model/schema) of composite data.
 * It is composed of a set of Properties, may have an identifying field, and may
 * have a super-type.
 * A ScalarDeclaration is conceptually owned by a ModelFile which
 * defines all the classes that are part of a namespace.
 *
 * @abstract
 * @class
 * @memberof module:concerto-core
 */
declare class ScalarDeclaration extends Declaration {
    superType: string | null;
    superTypeDeclaration: ClassDeclaration | null;
    idField: string | null;
    timestamped: boolean;
    abstract: boolean;
    validator: Validator | null;
    type: string | null;
    defaultValue: string | number | boolean | null;
    /**
     * Process the AST and build the model
     *
     * @throws {IllegalModelException}
     * @private
     */
    process(): void;
    /**
     * Semantic validation of the structure of this class. Subclasses should
     * override this method to impose additional semantic constraints on the
     * contents/relations of fields.
     *
     * @throws {IllegalModelException}
     * @protected
     */
    validate(): void;
    /**
     * Returns false as scalars are never identified.
     * @returns {Boolean} false as scalars are never identified
     * @deprecated
     */
    isIdentified(): boolean;
    /**
     * Returns false as scalars are never identified.
     * @returns {Boolean} false as scalars are never identified
     * @deprecated
     */
    isSystemIdentified(): boolean;
    /**
     * Returns null as scalars are never identified.
     * @return {string} as scalars are never identified
     * @deprecated
     */
    getIdentifierFieldName(): string | null;
    /**
     * Returns the FQN of the super type for this class or null if this
     * class does not have a super type.
     *
     * @return {string} the FQN name of the super type or null
     */
    getType(): string | null;
    /**
     * Returns the FQN of the super type for this class or null if this
     * class does not have a super type.
     *
     * @return {string} the FQN name of the super type or null
     * @deprecated
     */
    getSuperType(): string | null;
    /**
     * Get the super type class declaration for this class.
     * @return {ClassDeclaration} the super type declaration, or null if there is no super type.
     * @deprecated
     */
    getSuperTypeDeclaration(): ClassDeclaration | null;
    /**
     * Returns the validator string for this scalar definition
     * @return {Validator} the validator for the field or null
     */
    getValidator(): Validator | null;
    /**
     * Returns the default value for the field or null
     * @return {string | number | null} the default value for the field or null
     */
    getDefaultValue(): string | number | boolean | null;
    /**
     * Returns the string representation of this class
     * @return {String} the string representation of the class
     */
    toString(): string;
    /**
     * Returns true if this class is abstract.
     *
     * @return {boolean} true if the class is abstract
     * @deprecated
     */
    isAbstract(): boolean;
    /**
     * Returns true if this class is the definition of a scalar declaration.
     *
     * @return {boolean} true if the class is a scalar
     */
    isScalarDeclaration(): boolean;
    /**
     * Returns true if this class is the definition of an asset.
     *
     * @return {boolean} true if the class is an asset
     * @deprecated
     */
    isAsset(): boolean;
    /**
     * Returns true if this class is the definition of a participant.
     *
     * @return {boolean} true if the class is a participant
     * @deprecated
     */
    isParticipant(): boolean;
    /**
     * Returns true if this class is the definition of a transaction.
     *
     * @return {boolean} true if the class is a transaction
     * @deprecated
     */
    isTransaction(): boolean;
    /**
     * Returns true if this class is the definition of an event.
     *
     * @return {boolean} true if the class is an event
     * @deprecated
     */
    isEvent(): boolean;
    /**
     * Returns true if this class is the definition of a concept.
     *
     * @return {boolean} true if the class is a concept
     * @deprecated
     */
    isConcept(): boolean;
}
export { ScalarDeclaration };
export default ScalarDeclaration;

// ==== introspect/stringvalidator.d.ts ====
import Validator from './validator';
import type { ValidatedElement } from './validator';
import type { IStringLengthValidator, IStringRegexValidator } from '@accordproject/concerto-metamodel';
/**
 * A Validator to enforce that a string matches a regex
 * @private
 * @class
 * @memberof module:concerto-core
 */
declare class StringValidator extends Validator {
    validator: IStringRegexValidator | undefined;
    minLength: number | null | undefined;
    maxLength: number | null | undefined;
    regex: RegExp | null;
    /**
     * Create a StringValidator.
     * @param {Object} field - the field or scalar declaration this validator is attached to
     * @param {Object} validator - The validation string. This must be a regex
     * @param {Object} lengthValidator - The length validation string - [minLength,maxLength] (inclusive).
     *
     * @throws {IllegalModelException}
     */
    constructor(field: ValidatedElement, validator?: IStringRegexValidator, lengthValidator?: IStringLengthValidator);
    /**
     * Validate the property
     * @param {string} identifier the identifier of the instance being validated
     * @param {Object} value the value to validate
     * @throws {IllegalModelException}
     * @private
     */
    validate(identifier: string | null, value: string): void;
    /**
     * Tests a value against the validation regex. Returns true when no regex is
     * specified.
     * @param {string} value the value to test
     * @returns {boolean} true if the value matches the validation regex
     */
    matchesRegex(value: any): boolean;
    /**
     * Returns the minLength for this validator, or null if not specified
     * @returns {number} the min length or null
     */
    getMinLength(): number | null | undefined;
    /**
     * Returns the maxLength for this validator, or null if not specified
     * @returns {number} the max length or null
     */
    getMaxLength(): number | null | undefined;
    /**
     * Returns the RegExp object associated with the string validator, or null if not specified
     * @returns {RegExp} the RegExp object
     */
    getRegex(): RegExp | null;
    /**
     * Determine if the validator is compatible with another validator. For the
     * validators to be compatible, all values accepted by this validator must
     * be accepted by the other validator.
     * @param {Validator} other the other validator.
     * @returns {boolean} True if this validator is compatible with the other
     * validator, false otherwise.
     */
    compatibleWith(other: Validator | null): boolean;
}
export { StringValidator };
export default StringValidator;

// ==== introspect/transactiondeclaration.d.ts ====
import IdentifiedDeclaration from './identifieddeclaration';
/** Class representing the definition of an Transaction.
 * @extends ClassDeclaration
 * @see See  {@link ClassDeclaration}
 *
 * @class
 * @memberof module:concerto-core
 */
declare class TransactionDeclaration extends IdentifiedDeclaration {
    /**
     * Create an TransactionDeclaration.
     * @param {ModelFile} modelFile the ModelFile for this class
     * @param {Object} ast - The AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile: any, ast: any);
    /**
     * Returns the kind of declaration
     *
     * @return {string} what kind of declaration this is
     */
    declarationKind(): string;
}
export { TransactionDeclaration };
export default TransactionDeclaration;

// ==== introspect/validator.d.ts ====
import type Property from './property';
import type ScalarDeclaration from './scalardeclaration';
import type { ICollectionSizeValidator, IDoubleDomainValidator, IIntegerDomainValidator, ILongDomainValidator, IStringLengthValidator, IStringRegexValidator } from '@accordproject/concerto-metamodel';
/**
 * The numeric range validators, which share a shape across the three numeric
 * primitive types.
 */
export type NumberDomainValidatorAst = IIntegerDomainValidator | ILongDomainValidator | IDoubleDomainValidator;
/**
 * The metamodel nodes a Validator is built from. Subclasses narrow this to the
 * single node kind they handle.
 */
export type ValidatorAst = ICollectionSizeValidator | IStringRegexValidator | IStringLengthValidator | NumberDomainValidatorAst;
/**
 * The model elements a Validator can be attached to: a Property (in practice a
 * Field) or a ScalarDeclaration.
 */
export type ValidatedElement = Property | ScalarDeclaration;
/**
 * An Abstract field validator. Extend this class and override the
 * validate method.
 * @private
 * @class
 * @abstract
 * @memberof module:concerto-core
 */
declare class Validator {
    validator: ValidatorAst | undefined;
    field: ValidatedElement;
    /**
     * Create a Property.
     * @param {Object} field - the field or scalar declaration this validator is attached to
     * @param {Object} validator - The validation string
     * @throws {IllegalModelException}
     */
    constructor(field: ValidatedElement, validator: ValidatorAst | undefined);
    /**
     * @param {string} id the identifier of the instance
     * @param {string} msg the exception message
     * @param {string} errorType the type of error
     * @throws {Error} throws an error to report the message
     */
    reportError(id: string | null, msg: string, errorType?: string): never;
    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     */
    accept(visitor: any, parameters: any): any;
    /**
     * Returns the field or scalar declaration that this validator applies to
     * @return {Object} the field
     */
    getFieldOrScalarDeclaration(): ValidatedElement;
    /**
     * Validate the property against a value
     * @param {string} identifier the identifier of the instance being validated
     * @param {Object} value the value to validate
     * @throws {IllegalModelException}
     * @private
     */
    validate(identifier: string | null, value: any): void;
    /**
     * Determine if the validator is compatible with another validator. For the
     * validators to be compatible, all values accepted by this validator must
     * be accepted by the other validator.
     * @param {Validator} other the other validator.
     * @returns {boolean} True if this validator is compatible with the other
     * validator, false otherwise.
     */
    compatibleWith(other: Validator | null): boolean;
}
export { Validator };
export default Validator;

// ==== metamodelexception.d.ts ====
import { BaseException } from '@accordproject/concerto-util';
/**
* Class representing an invalid Metamodel instance (JSON AST)
* @extends BaseException
* @see See {@link BaseException}
* @class
* @memberof module:concerto-core
*/
declare class MetamodelException extends BaseException {
    /**
     * Create the MetamodelException.
     * @param {string} message - The exception message.
     */
    constructor(message: any);
}
export { MetamodelException };
export default MetamodelException;

// ==== model/identifiable.d.ts ====
import Typed from './typed';
import type BaseModelManager from '../basemodelmanager';
import type ClassDeclaration from '../introspect/classdeclaration';
import type { Dayjs } from 'dayjs';
/**
 * Identifiable is an entity with a namespace, type and an identifier.
 * Applications should retrieve instances from {@link Factory}
 * This class is abstract.
 * @extends Typed
 * @abstract
 * @class
 * @memberof module:concerto-core
 */
declare class Identifiable extends Typed {
    $identifierFieldName: string;
    $identifier: string | undefined;
    $timestamp?: Dayjs | null;
    /**
     * Create an instance.
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
     * @param {Dayjs} [timestamp] - The timestamp of this instance
     * @protected
     */
    constructor(modelManager: BaseModelManager, classDeclaration: ClassDeclaration, ns: string, type: string, id?: string, timestamp?: Dayjs | null);
    /**
     * Get the timestamp of this instance
     * @return {Dayjs} The timestamp for this object
     */
    getTimestamp(): Dayjs | null | undefined;
    /**
     * Get the identifier of this instance
     * @return {string} The identifier for this object
     */
    getIdentifier(): any;
    /**
     * Set the identifier of this instance
     * @param {string} id - the new identifier for this object
     */
    setIdentifier(id: any): void;
    /**
     * Get the fully qualified identifier of this instance.
     * (namespace '.' type '#' identifier).
     * @return {string} the fully qualified identifier of this instance
     */
    getFullyQualifiedIdentifier(): string;
    /**
     * Returns the string representation of this class
     * @return {String} the string representation of the class
     */
    toString(): string;
    /**
     * Determine if this identifiable is a relationship.
     * @return {boolean} True if this identifiable is a relationship,
     * false if not.
     */
    isRelationship(): boolean;
    /**
     * Determine if this identifiable is a resource.
     * @return {boolean} True if this identifiable is a resource,
     * false if not.
     */
    isResource(): boolean;
    /**
     * Returns a URI representation of a reference to this identifiable
     * @return {String} the URI for the identifiable
     */
    toURI(): string;
}
export { Identifiable };
export default Identifiable;

// ==== model/relationship.d.ts ====
import Identifiable from './identifiable';
import type BaseModelManager from '../basemodelmanager';
import type ClassDeclaration from '../introspect/classdeclaration';
import type { Dayjs } from 'dayjs';
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
    $class: 'Relationship';
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
     * @param {Dayjs} [timestamp] - The timestamp of this instance
     * @private
     */
    constructor(modelManager: BaseModelManager, classDeclaration: ClassDeclaration, ns: string, type: string, id: string, timestamp?: Dayjs | null);
    /**
     * Returns the string representation of this class
     * @return {String} the string representation of the class
     */
    toString(): string;
    /**
     * Determine if this identifiable is a relationship.
     * @return {boolean} True if this identifiable is a relationship,
     * false if not.
     */
    isRelationship(): boolean;
    /**
     * Constructs a Relationship instance from a URI representation (created using toURI).
     * @param {ModelManager} modelManager - the model manager to bind the relationship to
     * @param {String} uriAsString - the URI as a string, generated using Identifiable.toURI()
     * @param {String} [defaultNamespace] - default namespace to use for backwards compatibility
     * @param {String} [defaultType] - default type to use for backwards compatibility
     * @return {Relationship} the relationship
     */
    static fromURI(modelManager: any, uriAsString: any, defaultNamespace?: any, defaultType?: any): Relationship;
}
export { Relationship };
export default Relationship;

// ==== model/resource.d.ts ====
import Identifiable from './identifiable';
import type BaseModelManager from '../basemodelmanager';
import type ClassDeclaration from '../introspect/classdeclaration';
import type { Dayjs } from 'dayjs';
/**
 *
 * Resource is an instance that has a type. The type of the resource
 * specifies a set of properites (which themselves have types).
 *
 *
 * Type information in Concerto is used to validate the structure of
 * Resource instances and for serialization.
 *
 *
 * Resources are used in Concerto to represent Assets, Participants, Transactions and
 * other domain classes that can be serialized for long-term persistent storage.
 *
 * @extends Identifiable
 * @see See {@link Resource}
 * @class
 * @memberof module:concerto-core
 * @public
 */
declare class Resource extends Identifiable {
    /**
     * This constructor should not be called directly.
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
     * @param {Dayjs} [timestamp] - The timestamp of this instance
     * @private
     */
    constructor(modelManager: BaseModelManager, classDeclaration: ClassDeclaration, ns: string, type: string, id?: string, timestamp?: Dayjs | null);
    /**
     * Returns the string representation of this class
     * @return {String} the string representation of the class
     */
    toString(): string;
    /**
     * Determine if this identifiable is a resource.
     * @return {boolean} True if this identifiable is a resource,
     * false if not.
     */
    isResource(): boolean;
    /**
     * Determine if this identifiable is a concept.
     * @return {boolean} True if this identifiable is a concept,
     * false if not.
     */
    isConcept(): boolean;
    /**
     * Determine if this object is identifiable.
     * @return {boolean} True if this object has an identifiying field
     * false if not.
     */
    isIdentifiable(): boolean;
    /**
     * Serialize this resource into a JavaScript object suitable for serialization to JSON,
     * using the default options for the serializer. If you need to set additional options
     * for the serializer, use the {@link Serializer#toJSON} method instead.
     * @return {Object} A JavaScript object suitable for serialization to JSON.
     */
    toJSON(): any;
}
export { Resource };
export default Resource;

// ==== model/resourceid.d.ts ====
/**
 * All the identifying properties of a resource.
 * @private
 * @class
 * @memberof module:concerto-core
 * @property {String} namespace
 * @property {String} type
 * @property {String} id
 */
declare class ResourceId {
    namespace: string;
    type: string;
    id: string;
    /**
     * <strong>Note: only for use by internal framework code.</strong>
     * @param {String} namespace - Namespace containing the type.
     * @param {String} type - Short type name.
     * @param {String} id - Instance identifier.
     * @private
     */
    constructor(namespace: any, type: any, id: any);
    /**
     * Parse a URI into an identifier.
     * <p>
     * Three formats are allowable:
     * <ol>
     *   <li>Valid resource URI argument: <em>resource:qualifiedTypeName#ID</em></li>
     *   <li>Valid resource URI argument with missing URI scheme: <em>qualifiedTypeName#ID</em></li>
     *   <li>URI argument containing only an ID, with legacy namespace and type arguments supplied.</li>
     * </ol>
     * @param {String} uri - Resource URI.
     * @param {String} [legacyNamespace] - Namespace to use for legacy resource identifiers.
     * @param {String} [legacyType] - Type to use for legacy resource identifiers.
     * @return {Identifier} - An identifier.
     * @throws {Error} - On an invalid resource URI.
     */
    static fromURI(uri: any, legacyNamespace?: any, legacyType?: any): ResourceId;
    /**
     * URI representation of this identifier.
     * @return {String} A URI.
     */
    toURI(): string;
}
export { ResourceId };
export default ResourceId;

// ==== model/typed.d.ts ====
import type ClassDeclaration from '../introspect/classdeclaration';
import type BaseModelManager from '../basemodelmanager';
/**
 * Object is an instance with a namespace and a type.
 *
 * This class is abstract.
 * @abstract
 * @class
 * @memberof module:concerto-core
 */
declare class Typed {
    $modelManager: BaseModelManager;
    $classDeclaration: ClassDeclaration;
    $namespace: string;
    $type: string;
    /**
     * Create an instance.
     * <p>
     * <strong>Note: Only to be called by framework code. Applications should
     * retrieve instances from {@link Factory}</strong>
     * </p>
     *
     * @param {ModelManager} modelManager - The ModelManager for this instance
     * @param {ClassDeclaration} classDeclaration - The class declaration for this instance.
     * @param {string} ns - The namespace this instance.
     * @param {string} type - The type this instance.
     * @protected
     */
    constructor(modelManager: BaseModelManager, classDeclaration: ClassDeclaration, ns: string, type: string);
    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    accept(visitor: any, parameters: any): any;
    /**
     * Get the ModelManager for this instance
     * @return {ModelManager} The ModelManager for this object
     * @private
     */
    getModelManager(): BaseModelManager;
    /**
     * Get the type of the instance (a short name, not including namespace).
     * @return {string} The type of this object
     */
    getType(): string;
    /**
     * Get the fully-qualified type name of the instance (including namespace).
     * @return {string} The fully-qualified type name of this object
     */
    getFullyQualifiedType(): string;
    /**
     * Get the namespace of the instance.
     * @return {string} The namespace of this object
     */
    getNamespace(): string;
    /**
     * Returns the class declaration for this instance object.
     *
     * @return {ClassDeclaration} - the class declaration for this instance
     * @private
     */
    getClassDeclaration(): ClassDeclaration;
    /**
     * Sets a property on this Resource
     * @param {string} propName - the name of the field
     * @param {string} value - the value of the property
     */
    setPropertyValue(propName: any, value: any): void;
    /**
     * Adds a value to an array property on this Resource
     * @param {string} propName - the name of the field
     * @param {string} value - the value of the property
     */
    addArrayValue(propName: any, value: any): void;
    /**
     * Sets the fields to their default values, based on the model
     * @private
     */
    assignFieldDefaults(): void;
    /**
     * Check to see if this instance is an instance of the specified fully qualified
     * type name.
     * @param {String} fqt The fully qualified type name.
     * @returns {boolean} True if this instance is an instance of the specified fully
     * qualified type name, false otherwise.
     */
    instanceOf(fqt: string): boolean;
    /**
     * Overridden to prevent people accidentally converting a resource to JSON
     * without using the Serializer.
     * @protected
     */
    toJSON(): void;
}
export { Typed };
export default Typed;

// ==== model/validatedresource.d.ts ====
import Resource from './resource';
import type ResourceValidator from '../serializer/resourcevalidator';
/**
 * ValidatedResource is a Resource that can validate that property
 * changes (or the whole instance) do not violate the structure of
 * the type information associated with the instance.
 * @extends Resource
 * @see See {@link Resource}
 * @class
 * @memberof module:concerto-core
 */
declare class ValidatedResource extends Resource {
    $validator: ResourceValidator;
    /**
     * This constructor should not be called directly.
     * Use the Factory class to create instances.
     *
     * <p>
     * <strong>Note: Only to be called by framework code. Applications should
     * retrieve instances from {@link Factory}</strong>
     * </p>
     * @param {ModelManager} modelManager - The ModelManager for this instance
     * @param {ClassDeclaration} classDeclaration - The class declaration for this instance.
     * @param {string} ns - The namespace this instance.
     * @param {string} type - The type this instance.
     * @param {string} id - The identifier of this instance.
     * @param {string} timestamp - The timestamp of this instance
     * @param {ResourceValidator} resourceValidator - The validator to use for this instance
     * @private
     */
    constructor(modelManager: any, classDeclaration: any, ns: any, type: any, id: any, timestamp: any, resourceValidator: any);
    /**
     * Sets a property, validating that it does not violate the model
     * @param {string} propName - the name of the field
     * @param {string} value - the value of the property
     * @throws {Error} if the value is not compatible with the model definition for the field
     */
    setPropertyValue(propName: any, value: any): void;
    /**
     * Adds an array property value, validating that it does not violate the model
     * @param {string} propName - the name of the field
     * @param {string} value - the value of the property
     * @throws {Error} if the value is not compatible with the model definition for the field
     */
    addArrayValue(propName: any, value: any): void;
    /**
     * Validates the instance against its model.
     *
     * @throws {Error} - if the instance if invalid with respect to the model
     */
    validate(): void;
}
export { ValidatedResource };
export default ValidatedResource;

// ==== modelloader.d.ts ====
import type { FileLoader } from '@accordproject/concerto-util';
import type { ModelManagerOptions } from './types';
import ModelFile from './introspect/modelfile';
import ModelManager from './modelmanager';
type ModelLoaderOptions = ModelManagerOptions & {
    offline?: boolean;
};
/**
 * Create a ModelManager from model files, with an optional system model.
 *
 * If a ctoFile is not provided, the Accord Project system model is used.
 *
 * @class
 * @memberof module:concerto-core
 */
declare class ModelLoader {
    /**
     * Add model file
     *
     * @param {object} modelFileLoader - the model loader
     * @param {object} modelManager - the model manager
     * @param {string} ctoFile - the model file
     * @return {Promise<ModelManager>} the model manager
     * @private
     */
    static addModel(modelFileLoader: FileLoader<ModelFile>, modelManager: ModelManager, ctoFile: string): Promise<ModelManager>;
    /**
     * Load models in a new model manager
     *
     * @param {string[]} ctoFiles - the CTO files (can be local file paths or URLs)
     * @param {object} options - optional parameters
     * @param {boolean} [options.offline] - do not resolve external models
    * @param {number} [options.utcOffset] - UTC Offset for this execution
     * @return {Promise<ModelManager>} the model manager
     */
    static loadModelManager(ctoFiles: string[], options?: ModelLoaderOptions): Promise<ModelManager>;
    /**
     * Load system and models in a new model manager from model files objects
     *
     * @param {object[]} modelFiles - An array of Concerto files as strings or ModelFile objects.
     * @param {string[]} [fileNames] - An optional array of file names to associate with the model files
     * @param {object} options - optional parameters
     * @param {boolean} [options.offline] - do not resolve external models
     * @param {number} [options.utcOffset] - UTC Offset for this execution
     * @return {Promise<ModelManager>} the model manager
     */
    static loadModelManagerFromModelFiles(modelFiles: Array<string | ModelFile>, fileNames?: string[], options?: ModelLoaderOptions): Promise<ModelManager>;
}
export { ModelLoader };
export default ModelLoader;

// ==== modelmanager.d.ts ====
import BaseModelManager from './basemodelmanager';
import type { ModelManagerOptions } from './types';
import type ModelFile from './introspect/modelfile';
/**
 * Manages the Concerto model files in CTO format.
 *
 * The structure of {@link Resource}s (Assets, Transactions, Participants) is modelled
 * in a set of Concerto files. The contents of these files are managed
 * by the {@link ModelManager}. Each Concerto file has a single namespace and contains
 * a set of asset, transaction and participant type definitions.
 *
 * Concerto applications load their Concerto files and then call the {@link ModelManager#addModelFile addModelFile}
 * method to register the Concerto file(s) with the ModelManager.
 *
 * @memberof module:concerto-core
 */
declare class ModelManager extends BaseModelManager {
    /**
     * Create the ModelManager.
     * @constructor
     * @param {object} [options] - ModelManager options, also passed to Serializer
     * @param {Object} [options.regExp] - An alternative regular expression engine.
     * @param {boolean} [options.dangerouslyAllowReservedSystemTypeNamesInUserModels] - Transitional escape hatch; when true, declarations may use reserved system type names
     */
    constructor(options?: ModelManagerOptions);
    /**
     * Adds a model in CTO format to the ModelManager.
     * This is a convenience function equivalent to `addModel` but useful since it avoids having to copy the input CTO.
     * @param {string} cto - a cto string
     * @param {string} [fileName] - an optional file name to associate with the model file
     * @param {boolean} [disableValidation] - If true then the model files are not validated
     * @throws {IllegalModelException}
     * @return {ModelFile} The newly added model file (internal).
     */
    addCTOModel(cto: string, fileName?: string, disableValidation?: boolean): ModelFile;
}
export { ModelManager };
export default ModelManager;

// ==== modelutil.d.ts ====
import semver from 'semver';
/**
 * Internal Model Utility Class
 * <p><a href="./diagrams-private/modelutil.svg"><img src="./diagrams-private/modelutil.svg" style="height:100%;"/></a></p>
 * @private
 * @class
 * @memberof module:concerto-core
 */
declare class ModelUtil {
    /**
     * Returns everything after the last dot, if present, of the source string
     * @param {string} fqn - the source string
     * @return {string} - the string after the last dot
     */
    static getShortName(fqn: any): any;
    /**
     * Returns the namespace for the fully qualified name of a type
     * @param {string} fqn - the fully qualified identifier of a type
     * @return {string} - namespace of the type (everything before the last dot)
     * or the empty string if there is no dot
     */
    static getNamespace(fqn: any): string;
    /**
     * @typedef ParseNamespaceResult
     * @property {string} name the name of the namespace
     * @property {string} escapedNamespace the escaped namespace
     * @property {string} version the version of the namespace
     * @property {object} versionParsed the parsed semantic version of the namespace
     */
    /**
     * Parses a versioned namespace into
     * its name and version parts. The version of the namespace
     * is parsed using semver.parse.
     * @param {string} ns the namespace to parse
     * @param {object} [options] optional parsing options
     * @param {boolean} [options.disableVersionParsing] if false, the version will be parsed
     * @returns {ParseNamespaceResult} the result of parsing
     */
    static parseNamespace(ns: string, options?: {
        disableVersionParsing?: boolean;
    }): {
        name: string;
        escapedNamespace?: undefined;
        version?: undefined;
        versionParsed?: undefined;
    } | {
        name: string;
        escapedNamespace: string;
        version: string | null;
        versionParsed: string | semver.SemVer | null;
    };
    /**
     * Return the fully qualified name for an import
     * @param {object} imp - the import
     * @return {string[]} - the fully qualified names for that import
     * @private
     */
    static importFullyQualifiedNames(imp: any): string[];
    /**
     * Returns true if the type is a primitive type
     * @param {string} typeName - the name of the type
     * @return {boolean} - true if the type is a primitive
     * @private
     */
    static isPrimitiveType(typeName: any): boolean;
    /**
     * Returns true if the type is assignable to the propertyType.
     *
     * @param {ModelFile} modelFile - the ModelFile that owns the Property
     * @param {string} typeName - the FQN of the type we are trying to assign
     * @param {Property} property - the property that we'd like to store the
     * type in.
     * @return {boolean} - true if the type can be assigned to the property
     * @private
     */
    static isAssignableTo(modelFile: any, typeName: any, property: any): any;
    /**
     * Returns the passed string with the first character capitalized
     * @param {string} string - the string
     * @return {string} the string with the first letter capitalized
     * @private
     */
    static capitalizeFirstLetter(string: any): any;
    /**
     * Returns true if the given field is an enumerated type
     * @param {Field} field - the string
     * @return {boolean} true if the field is declared as an enumeration
     * @private
     */
    static isEnum(field: any): any;
    /**
     * Returns true if the given field is an map type
     * @param {Field} field - the string
     * @return {boolean} true if the field is declared as an map
     * @private
     */
    static isMap(field: any): any;
    /**
     * Returns true if the given field is a Scalar type
     * @param {Field} field - the Field to test
     * @return {boolean} true if the field is declared as an scalar
     * @private
     */
    static isScalar(field: any): any;
    /**
     * Return true if the name is a valid Concerto identifier
     * @param {string} name - the name of the identifier to test.
     * @returns {boolean} true if the identifier is valid.
     */
    static isValidIdentifier(name: string | undefined): name is string;
    /**
     * Get the fully qualified name of a type.
     * @param {string} namespace - namespace of the type.
     * @param {string} type - short name of the type.
     * @returns {string} the fully qualified type name.
     */
    static getFullyQualifiedName(namespace: any, type: any): any;
    /**
     * Converts a fully qualified type name to a FQN without a namespace version.
     * If the FQN is a primitive type it is returned unchanged.
     * @param {string} fqn fully qualified name of a type
     * @returns {string} the fully qualified name minus the namespace version
     */
    static removeNamespaceVersionFromFullyQualifiedName(fqn: any): any;
    /**
     * Returns true if the property is a system property.
     * System properties are not declared in the model.
     * @param {String} propertyName - the name of the property
     * @return {Boolean} true if the property is a system property
     * @private
     */
    static isSystemProperty(propertyName: any): boolean;
    /**
     * Returns true if the property is an system property that can be set in serialized JSON.
     * System properties are not declared in the model.
     * @param {String} propertyName - the name of the property
     * @return {Boolean} true if the property is a system property
     * @private
     */
    static isPrivateSystemProperty(propertyName: any): boolean;
    /**
     * Returns true if this Key is a valid Map Key.
     *
     * @param {Object} key - the Key of the Map Declaration
     * @return {boolean} true if the Key is a valid Map Key
    */
    static isValidMapKey(key: any): boolean;
    /**
     * Returns true if this Key is a valid Map Key Scalar Value.
     *
     * @param {Object} decl - the Map Key Scalar declaration
     * @return {boolean} true if the Key is a valid Map Key Scalar type
    */
    static isValidMapKeyScalar(decl: any): any;
    /**
     * Returns true if this Value is a valid Map Value.
     *
     * @param {Object} value - the Value of the Map Declaration
     * @return {boolean} true if the Value is a valid Map Value
     */
    static isValidMapValue(value: any): boolean;
}
export { ModelUtil };
export default ModelUtil;

// ==== rootmodelhelper.d.ts ====
/**
 * Gets the root 'concerto' model
 * @returns {object} rootModelFile, rootModelCto and rootModelAst
 */
declare function getRootModel(): {
    rootModelFile: string;
    rootModelCto: string;
    rootModelAst: any;
};
export { getRootModel };
declare const _default: {
    getRootModel: typeof getRootModel;
};
export default _default;

// ==== securityexception.d.ts ====
import { BaseException } from '@accordproject/concerto-util';
/**
* Class representing a security exception
* @extends BaseException
* @see See {@link BaseException}
* @class
* @memberof module:concerto-core
*/
declare class SecurityException extends BaseException {
    /**
     * Create the SecurityException.
     * @param {string} message - The exception message.
     */
    constructor(message: any);
}
export { SecurityException };
export default SecurityException;

// ==== serializer.d.ts ====
import type Factory from './factory';
import type BaseModelManager from './basemodelmanager';
import type { SerializerOptions } from './types';
/**
 * Serialize Resources instances to/from various formats for long-term storage
 * (e.g. on the blockchain).
 *
 * @class
 * @memberof module:concerto-core
 */
declare class Serializer {
    factory: Factory;
    modelManager: BaseModelManager;
    defaultOptions: SerializerOptions;
    /**
     * Create a Serializer.
     * @param {Factory} factory - The Factory to use to create instances
     * @param {ModelManager} modelManager - The ModelManager to use for validation etc.
     * @param {object} [options] - Serializer options
     */
    constructor(factory: Factory, modelManager: BaseModelManager, options?: SerializerOptions);
    /**
     * Set the default options for the serializer.
     * @param {Object} newDefaultOptions The new default options for the serializer.
     */
    setDefaultOptions(newDefaultOptions: SerializerOptions): void;
    /**
     * <p>
     * Convert a {@link Resource} to a JavaScript object suitable for long-term
     * peristent storage.
     * </p>
     * @param {Resource} resource - The instance to convert to JSON
     * @param {Object} [options] - the optional serialization options.
     * @param {boolean} [options.validate] - validate the structure of the Resource
     * with its model prior to serialization (default to true)
     * @param {boolean} [options.convertResourcesToRelationships] - Convert resources that
     * are specified for relationship fields into relationships, false by default.
     * @param {boolean} [options.permitResourcesForRelationships] - Permit resources in the
     * place of relationships (serializing them as resources), false by default.
     * @param {boolean} [options.deduplicateResources] - Generate $id for resources and
     * if a resources appears multiple times in the object graph only the first instance is
     * serialized in full, subsequent instances are replaced with a reference to the $id
     * @param {boolean} [options.convertResourcesToId] - Convert resources that
     * are specified for relationship fields into their id, false by default.
     * @param {number} [options.utcOffset] - UTC Offset for DateTime values.
     * @return {Object} - The Javascript Object that represents the resource
     * @throws {Error} - throws an exception if resource is not an instance of
     * Resource or fails validation.
     */
    toJSON(resource: any, options?: any): any;
    /**
     * Create a {@link Resource} from a JavaScript Object representation.
     * The JavaScript Object should have been created by calling the
     * {@link Serializer#toJSON toJSON} API.
     *
     * The Resource is populated based on the JavaScript object.
     *
     * @param {Object} jsonObject The JavaScript Object for a Resource
     * @param {Object} [options] - the optional serialization options
     * @param {boolean} options.acceptResourcesForRelationships - handle JSON objects
     * in the place of strings for relationships, defaults to false.
     * @param {boolean} options.validate - validate the structure of the Resource
     * with its model prior to serialization (default to true)
     * @param {number} [options.utcOffset] - UTC Offset for DateTime values.
     * @param {boolean} [options.strictQualifiedDateTimes] - Only allow fully-qualified date-times with offsets.
     * @return {Resource} The new populated resource
     */
    fromJSON(jsonObject: any, options?: any): any;
}
export { Serializer };
export default Serializer;

// ==== serializer/instancegenerator.d.ts ====
/**
 * Generate sample instance data for the specified class declaration
 * and resource instance. The specified resource instance will be
 * updated with either default values or generated sample data.
 * @private
 * @class
 * @memberof module:concerto-core
 */
declare class InstanceGenerator {
    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visit(thing: any, parameters: any): any;
    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitClassDeclaration(classDeclaration: any, parameters: any): any;
    /**
     * Visitor design pattern
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitField(field: any, parameters: any): any;
    /**
     * Get a value for the specified field.
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {*} A value for the specified field.
     */
    getFieldValue(field: any, parameters: any): any;
    /**
     * Find a concrete type that extends the provided type. If the supplied type argument is
     * not abstract then it will be returned.
     * TODO: work out whether this has to be a leaf node or whether the closest type can be used
     * It depends really since the closest type will satisfy the model but whether it satisfies
     * any transaction code which attempts to use the generated resource is another matter.
     * @param {ClassDeclaration} declaration the class declaration.
     * @return {ClassDeclaration} the closest extending concrete class definition.
     * @throws {Error} if no concrete subclasses exist.
     */
    findConcreteSubclass(declaration: any): any;
    /**
     * Visitor design pattern
     * @param {RelationshipDeclaration} relationshipDeclaration - the object being visited
     * @param {Object} parameters - the parameter
     * @return {Relationship} the result of visiting
     * @private
     */
    visitRelationshipDeclaration(relationshipDeclaration: any, parameters: any): any;
    /**
     * Visitor design pattern
     * @param {MapDeclaration} mapDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitMapDeclaration(mapDeclaration: any, parameters: any): any;
    /**
     * Generate a random ID for a given type.
     * @private
     * @param {ClassDeclaration} classDeclaration - class declaration for a type.
     * @return {String} an ID.
     */
    generateRandomId(classDeclaration: any): string;
}
export { InstanceGenerator };
export default InstanceGenerator;

// ==== serializer/jsongenerator.d.ts ====
/**
 * Converts the contents of a Resource to JSON. The parameters
 * object should contain the keys
 * 'stack' - the TypedStack of objects being processed. It should
 * start with a Resource.
 * 'modelManager' - the ModelManager to use.
 * @private
 * @class
 * @memberof module:concerto-core
 */
declare class JSONGenerator {
    convertResourcesToRelationships: boolean | undefined;
    permitResourcesForRelationships: boolean | undefined;
    deduplicateResources: boolean | undefined;
    convertResourcesToId: boolean | undefined;
    utcOffset: number;
    /**
     * Constructor.
     * @param {boolean} [convertResourcesToRelationships] Convert resources that
     * are specified for relationship fields into relationships, false by default.
     * @param {boolean} [permitResourcesForRelationships] Permit resources in the
     * place of relationships (serializing them as resources), false by default.
     * @param {boolean} [deduplicateResources] If resources appear several times
     * in the object graph only the first instance is serialized, with only the $id
     * written for subsequent instances, false by default.
     * @param {boolean} [convertResourcesToId] Convert resources that
     * @param {boolean} [ergo] - Deprecated - This is a dummy parameter to avoid breaking any consumers. It will be removed in a future release.
     * are specified for relationship fields into their id, false by default.
     * @param {number} [utcOffset] UTC Offset for DateTime values.
     */
    constructor(convertResourcesToRelationships?: boolean, permitResourcesForRelationships?: boolean, deduplicateResources?: boolean, convertResourcesToId?: boolean, ergo?: boolean, utcOffset?: number);
    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visit(thing: any, parameters: any): any;
    /**
     * Visitor design pattern
     * @param {MapDeclaration} mapDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitMapDeclaration(mapDeclaration: any, parameters: any): any;
    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitClassDeclaration(classDeclaration: any, parameters: any): string | Record<string, unknown>;
    /**
     * Visitor design pattern
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitField(field: any, parameters: any): any;
    /**
     * Converts to JSON safe format.
     *
     * @param {Field} field - the field declaration of the object
     * @param {Object} obj - the object to convert to text
     * @return {Object} the text JSON safe representation
     */
    convertToJSON(field: any, obj: any): any;
    /**
     * Visitor design pattern
     * @param {RelationshipDeclaration} relationshipDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitRelationshipDeclaration(relationshipDeclaration: any, parameters: any): any;
    /**
     * Returns the persistent format for a relationship.
     * @param {RelationshipDeclaration} relationshipDeclaration - the relationship being persisted
     * @param {Identifiable} relationshipOrResource - the relationship or the resource
     * @returns {string} the text to use to persist the relationship
     */
    getRelationshipText(relationshipDeclaration: any, relationshipOrResource: any): any;
}
export { JSONGenerator };
export default JSONGenerator;

// ==== serializer/jsonpopulator.d.ts ====
import { TypedStack } from '@accordproject/concerto-util';
import type Factory from '../factory';
import type BaseModelManager from '../basemodelmanager';
import type ClassDeclaration from '../introspect/classdeclaration';
import type MapDeclaration from '../introspect/mapdeclaration';
import type Resource from '../model/resource';
type Stack<T> = {
    push(value: T, expectedType?: unknown): void;
    pop(expectedType?: unknown): T;
    peek?(expectedType?: unknown): T;
    stack: T[];
};
export type JsonPopulatorParameters = {
    jsonStack: Stack<String | {
        [key: string]: unknown;
        $class: string;
    } | {
        [key: string]: unknown;
        $class: string;
    }[]>;
    resourceStack: Stack<Resource>;
    path?: TypedStack<string>;
    factory: Factory;
    modelManager: BaseModelManager;
    acceptResourcesForRelationships?: boolean;
    utcOffset?: number;
    strictQualifiedDateTimes?: boolean;
};
/**
 * Populates a Resource with data from a JSON object graph. The JSON objects
 * should be the result of calling Serializer.toJSON and then JSON.parse.
 * The parameters object should contain the keys
 * 'stack' - the TypedStack of objects being processed. It should
 * start with the root object from JSON.parse.
 * 'factory' - the Factory instance to use for creating objects.
 * 'modelManager' - the ModelManager instance to use to resolve classes
 * @private
 * @class
 * @memberof module:concerto-core
 */
declare class JSONPopulator {
    acceptResourcesForRelationships: boolean | undefined;
    utcOffset: number;
    strictQualifiedDateTimes: boolean;
    /**
     * Constructor.
     * @param {boolean} [acceptResourcesForRelationships] Permit resources in the
     * place of relationships, false by default.
     * @param {boolean} [ergo] - Deprecated - This is a dummy parameter to avoid breaking any consumers. It will be removed in a future release.
     * @param {number} [utcOffset] - UTC Offset for DateTime values.
     * @param {boolean} [strictQualifiedDateTimes=true] - Only allow fully-qualified date-times with offsets.
     */
    constructor(acceptResourcesForRelationships: any, ergo: any, utcOffset: any, strictQualifiedDateTimes: any);
    /**
     * Visitor design pattern
     * @param {Object} thing - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visit(thing: any, parameters: JsonPopulatorParameters): any;
    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitClassDeclaration(classDeclaration: ClassDeclaration, parameters: JsonPopulatorParameters): Resource;
    /**
     * Visitor design pattern
     * @param {MapDeclaration} mapDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitMapDeclaration(mapDeclaration: MapDeclaration, parameters: JsonPopulatorParameters): Map<any, any>;
    /**
     * Visitor design pattern
     * @param {MapDeclaration} mapDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @param {Object} value - the key or value belonging to the Map Entry.
     * @param {Object} type - the Type associated with the Key or Value Map Entry.
     * @return {Object} value - the key or value belonging to the Map Entry.
     * @private
     */
    processMapType(mapDeclaration: any, parameters: JsonPopulatorParameters, value: any, type: any): any;
    /**
     * Visitor design pattern
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitField(field: any, parameters: JsonPopulatorParameters): any;
    /**
     *
     * @param {Field} field - the field of the item being converted
     * @param {Object} jsonItem - the JSON object of the item being converted
     * @param {Object} parameters - the parameters
     * @return {Object} - the populated object.
     */
    convertItem(field: any, jsonItem: any, parameters: any): null;
    /**
     * Converts a primtive object to JSON text.
     *
     * @param {Field} field - the field declaration of the object
     * @param {Object} json - the JSON object to convert to a Concerto Object
     * @param {Object} parameters - the parameters
     * @return {string} the text representation
     */
    convertToObject(field: any, json: any, parameters: JsonPopulatorParameters): any;
    /**
     * Visitor design pattern
     * @param {RelationshipDeclaration} relationshipDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitRelationshipDeclaration(relationshipDeclaration: any, parameters: JsonPopulatorParameters): any;
}
export { JSONPopulator };
export default JSONPopulator;

// ==== serializer/resourcevalidator.d.ts ====
import type { SerializerOptions } from '../types';
/**
 * <p>
 * Validates a Resource or Field against the models defined in the ModelManager.
 * This class is used with the Visitor pattern and visits the class declarations
 * (etc) for the model, checking that the data in a Resource / Field is consistent
 * with the model.
 * </p>
 * The parameters for the visit method must contain the following properties:
 * <ul>
 *  <li> 'stack' - the TypedStack of objects being processed. It should
 * start as [Resource] or [Field]</li>
 * <li> 'rootResourceIdentifier' - the identifier of the resource being validated </li>
 * <li> 'modelManager' - the ModelManager instance to use for type checking</li>
 * </ul>
 * @private
 * @class
 * @memberof module:concerto-core
 */
declare class ResourceValidator {
    options: SerializerOptions;
    /**
     * ResourceValidator constructor
     * @param {Object} options - the optional serialization options.
     * @param {boolean} options.validate - validate the structure of the Resource
     * with its model prior to serialization (default to true)
     * @param {boolean} options.convertResourcesToRelationships - Convert resources that
     * are specified for relationship fields into relationships, false by default.
     * @param {boolean} options.permitResourcesForRelationships - Permit resources in the
     */
    constructor(options?: SerializerOptions);
    /**
     * Visitor design pattern.
     *
     * @param {Object} thing - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visit(thing: any, parameters: any): null | undefined;
    /**
     * Visitor design pattern
     *
     * @param {EnumDeclaration} enumDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitEnumDeclaration(enumDeclaration: any, parameters: any): null;
    /**
     * Check a Type that is declared as a Map Type.
     * @param {Object} type - the type in scope for validation, can be MapTypeKey or MapTypeValue
     * @param {Object} value - the object being validated
     * @param {Object} parameters  - the parameter
     * @param {Map} mapDeclaration - the object being visited
     * @private
     */
    checkMapType(type: any, value: any, parameters: any, mapDeclaration: any): void;
    /**
     * Visitor design pattern
     *
     * @param {MapDeclaration} mapDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     *
     * @private
     */
    visitMapDeclaration(mapDeclaration: any, parameters: any): null;
    /**
     * Visitor design pattern
     * @param {ClassDeclaration} classDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitClassDeclaration(classDeclaration: any, parameters: any): null;
    /**
     * Visitor design pattern
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitField(field: any, parameters: any): null;
    /**
     * Check a Field that is declared as an Array.
     * @param {Object} obj - the object being validated
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    checkEnum(obj: any, field: any, parameters: any): void;
    /**
     * Check a Field that is declared as an Array.
     * @param {Object} obj - the object being validated
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    checkArray(obj: any, field: any, parameters: any): void;
    /**
     * Check a single (non-array) field.
     * @param {Object} obj - the object being validated
     * @param {Field} field - the object being visited
     * @param {Object} parameters  - the parameter
     * @private
     */
    checkItem(obj: any, field: any, parameters: any): void;
    /**
     * Visitor design pattern
     * @param {RelationshipDeclaration} relationshipDeclaration - the object being visited
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    visitRelationshipDeclaration(relationshipDeclaration: any, parameters: any): null;
    /**
     * Check a single relationship
     * @param {Object} parameters  - the parameter
     * @param {relationshipDeclaration} relationshipDeclaration - the object being visited
     * @param {Object} obj - the object being validated
     * @private
     */
    checkRelationship(parameters: any, relationshipDeclaration: any, obj: any): void;
    /**
     * Throw a new error for a model violation.
     * @param {string} id - the identifier of this instance.
     * @param {string} propName - the name of the field.
     * @param {*} value - the value of the field.
     * @param {Field} field - the field
     * @throws {ValidationException} the exception
     * @private
     */
    static reportFieldTypeViolation(id: any, propName: any, value: any, field: any): void;
    /**
     * Throw a new error for a model violation.
     * @param {string} id - the identifier of this instance.
     * @param {ClassDeclaration} classDeclaration - the declaration of the class
     * @param {Object} value - the value of the field.
     * @private
     */
    static reportNotResouceViolation(id: any, classDeclaration: any, value: any): void;
    /**
     * Throw a new error for a model violation.
     * @param {string} id - the identifier of this instance.
     * @param {RelationshipDeclaration} relationshipDeclaration - the declaration of the class
     * @param {Object} value - the value of the field.
     * @private
     */
    static reportNotRelationshipViolation(id: any, relationshipDeclaration: any, value: any): void;
    /**
     * Throw a new error for a missing, but required field.
     * @param {string} id - the identifier of this instance.
     * @param {Field} field - the field/
     * @private
     */
    static reportMissingRequiredProperty(id: any, field: any): void;
    /**
     * Throw a new error for a missing, but required field.
     * @param {string} id - the identifier of this instance.
     * @param {Field} field - the field/
     * @private
     */
    static reportEmptyIdentifier(id: any): void;
    /**
     * Throw a new error for a missing, but required field.
     * @param {string} id - the identifier of this instance.
     * @param {Field} field - the field
     * @param {string} obj - the object value
     * @private
     */
    static reportInvalidEnumValue(id: any, field: any, obj: any): void;
    /**
     * Throw a validation exception for an abstract class
     * @param {ClassDeclaration} classDeclaration - the class declaration
     * @throws {ValidationException} the validation exception
     * @private
     */
    static reportAbstractClass(classDeclaration: any): void;
    /**
     * Throw a validation exception for an abstract class
     * @param {string} resourceId - the id of the resource being validated
     * @param {string} propertyName - the name of the property that is not declared
     * @param {string} fullyQualifiedTypeName - the fully qualified type being validated
     * @throws {ValidationException} the validation exception
     * @private
     */
    static reportUndeclaredField(resourceId: any, propertyName: any, fullyQualifiedTypeName: any): void;
    /**
     * Throw a validation exception for an invalid field assignment
     * @param {string} resourceId - the id of the resource being validated
     * @param {string} propName - the name of the property that is being assigned
     * @param {*} obj - the Field
     * @param {Field} field - the Field
     * @throws {ValidationException} the validation exception
     * @private
     */
    static reportInvalidFieldAssignment(resourceId: any, propName: any, obj: any, field: any): void;
}
export { ResourceValidator };
export default ResourceValidator;

// ==== serializer/validationexception.d.ts ====
import { BaseException } from '@accordproject/concerto-util';
/**
 * Exception thrown when a resource fails to model against the model
 * @extends BaseException
 * @see See {@link  BaseException}
 * @class
 * @memberof module:concerto-core
 * @private
 */
declare class ValidationException extends BaseException {
    /**
     * Create a ValidationException
     * @param {string} message - the message for the exception
     * @param {string} component - the optional component which throws this error
     */
    constructor(message: any, component?: any);
}
export { ValidationException };
export default ValidationException;

// ==== serializer/valuegenerator.d.ts ====
import dayjs from '../dayjs-setup';
import type { Dayjs } from 'dayjs';
/**
 * Empty value generator.
 * @private
 */
declare class EmptyValueGenerator {
    currentDate: Dayjs;
    /**
     * This constructor should not be called directly.
     * @private
     */
    constructor();
    /**
     * Get a default DateTime value.
     * @return {object} a date value.
     */
    getDateTime(): dayjs.Dayjs;
    /**
     * Get a default Integer value.
     * @return {number} an Integer value.
     */
    getInteger(): number;
    /**
     * Get a default Long value.
     * @return {number} a Long value.
     */
    getLong(): number;
    /**
     * Get a default Double value.
     * @return {number} a Double value.
     */
    getDouble(): number;
    /**
     * Get a default Boolean value.
     * @return {boolean} a Boolean value.
     */
    getBoolean(): boolean;
    /**
     * Get a randomly generated sample String value with lower and upper bound.
     * @param {number} minLength the lower bound on the range, inclusive.
     * @param {number} maxLength the upper bound on the range, inclusive.
     * @return {string} a String value.
     */
    getString(minLength: any, maxLength: any): string;
    /**
     * Get the first enum value from the supplied array.
     * @param {Array} enumValues Array of possible enum values.
     * @return {*} an enum value.
     */
    getEnum(enumValues: any): any;
    /**
     * Get an instance of an empty map.
     * @return {*} an map value.
     */
    getMap(): Map<any, any>;
    /**
     * Get an array using the supplied callback to obtain array values.
     * @param {Function} valueSupplier - callback to obtain values.
     * @return {Array} an array
     */
    getArray<T>(valueSupplier: () => T): T[];
    /**
     * Get a randomly generated sample regex String value with lower and upper bound.
     * @param {RegExp} regex A regular expression.
     * @param {number} minLength the lower bound on the range, inclusive.
     * @param {number} maxLength the upper bound on the range, inclusive.
     * @return {string} a String value.
     */
    getRegex(regex: any, minLength: any, maxLength: any): string;
    /**
     * Get a random value from the range.
     * @param {number} lowerBound the lower bound on the range, inclusive.
     * @param {number} upperBound the upper bound on the range, inclusive.
     * @param {string} type the number type for the range,
     *  `'Long'`, `'Double'`, or `'Integer'`
     * @return {number} a number.
     */
    getRange(lowerBound: any, upperBound: any, type: any): number;
}
/**
 * Sample data value generator.
 * @private
 */
declare class SampleValueGenerator extends EmptyValueGenerator {
    /**
     * This constructor should not be called directly.
     * @private
     */
    constructor();
    /**
     * Get a randomly generated sample Integer value.
     * @return {number} an Integer value.
     */
    getInteger(): number;
    /**
     * Get a randomly generated sample Long value.
     * @return {number} a Long value.
     */
    getLong(): number;
    /**
     * Get a randomly generated sample Double value.
     * @return {number} a Double value.
     */
    getDouble(): number;
    /**
     * Get a randomly generated sample Boolean value.
     * @return {boolean} a Boolean value.
     */
    getBoolean(): boolean;
    /**
     * Get a randomly generated sample String value with lower and upper bound.
     * @param {number} minLength the lower bound on the range, inclusive.
     * @param {number} maxLength the upper bound on the range, inclusive.
     * @return {string} a String value.
     */
    getString(minLength: any, maxLength: any): string;
    /**
     * Get a randomly selected enum value from the supplied array.
     * @param {Array} enumValues Array of possible enum values.
     * @return {*} an enum value.
     */
    getEnum(enumValues: any): any;
    /**
     * Get a map instance with randomly generated values for key & value.
     * @return {*} a map value.
     */
    getMap(): Map<string, string>;
    /**
     * Get an array using the supplied callback to obtain array values.
     * @param {Function} valueSupplier - callback to obtain values.
     * @return {Array} an array
     */
    getArray<T>(valueSupplier: () => T): T[];
    /**
     * Get a randomly generated sample regex String value with lower and upper bound.
     * @param {RegExp} regex A regular expression.
     * @param {number} minLength the lower bound on the range, inclusive.
     * @param {number} maxLength the upper bound on the range, inclusive.
     * @return {string} a String value.
     */
    getRegex(regex: any, minLength: any, maxLength: any): string;
    /**
     * Get a random value from the range.
     * @param {number} lowerBound the lower bound on the range, inclusive.
     * @param {number} upperBound the upper bound on the range, inclusive.
     * @param {string} type the number type for the range,
     *  `'Long'`, `'Double'`, or `'Integer'`
     * @return {number} a number.
     */
    getRange(lowerBound: any, upperBound: any, type: any): number;
}
/**
 * Factory providing static methods to create ValueGenerator instances.
 * @private
 */
declare class ValueGeneratorFactory {
    /**
     * Create a value generator that supplies empty values.
     * @return {ValueGenerator} a value generator.
     */
    static empty(): EmptyValueGenerator;
    /**
     * Create a value generator that supplies randomly generated sample values.
     * @return {ValueGenerator} a value generator.
     */
    static sample(): SampleValueGenerator;
}
export { ValueGeneratorFactory, EmptyValueGenerator, SampleValueGenerator };
export default ValueGeneratorFactory;

// ==== typenotfoundexception.d.ts ====
import { BaseException } from '@accordproject/concerto-util';
/**
 * Error thrown when a Concerto type does not exist.
 * @extends BaseException
 * @see see {@link BaseException}
 * @class
 * @memberof module:concerto-core
 */
declare class TypeNotFoundException extends BaseException {
    typeName: string;
    /**
     * Constructor. If the optional 'message' argument is not supplied, it will be set to a default value that
     * includes the type name.
     * @param {string} typeName - fully qualified type name.
     * @param {string|undefined} message - error message.
     * @param {string} component - the optional component which throws this error
     * @param {string} errorType - the error code related to the error
     */
    constructor(typeName: string, message?: string, component?: string, errorType?: string);
    /**
     * Get the name of the type that was not found.
     * @returns {string} fully qualified type name.
     */
    getTypeName(): string;
}
export { TypeNotFoundException };
export default TypeNotFoundException;

// ==== types.d.ts ====
import type { IDecorator } from '@accordproject/concerto-metamodel';
import type { TypedStack } from '@accordproject/concerto-util';
import type BaseModelManager from './basemodelmanager';
import type Factory from './factory';
import type Typed from './model/typed';
import type { EmptyValueGenerator } from './serializer/valuegenerator';
export interface ModelManagerOptions {
    regExp?: RegExp;
    metamodelValidation?: boolean;
    addMetamodel?: boolean;
    dangerouslyAllowReservedSystemTypeNamesInUserModels?: boolean;
    decoratorValidation?: {
        missingDecorator?: string;
        invalidDecorator?: string;
    };
    skipLocationNodes?: boolean;
    offline?: boolean;
    utcOffset?: number;
}
export interface ModelFileSource {
    ast: unknown;
    definitions: string | null;
    fileName: string;
}
/**
 * Options accepted by Serializer#toJSON, Serializer#fromJSON and the
 * visitors they drive.
 */
export interface SerializerOptions {
    /** validate the structure of the Resource against its model. Defaults to true. */
    validate?: boolean;
    /** convert resources supplied for relationship fields into relationships. */
    convertResourcesToRelationships?: boolean;
    /** permit resources in the place of relationships, serializing them as resources. */
    permitResourcesForRelationships?: boolean;
    /** accept JSON objects in the place of relationships when deserializing. */
    acceptResourcesForRelationships?: boolean;
    /** serialize repeated resources once, writing only $id for later instances. */
    deduplicateResources?: boolean;
    /** convert resources supplied for relationship fields into their id. */
    convertResourcesToId?: boolean;
    /** UTC offset, in minutes, for DateTime values. */
    utcOffset?: number;
    /** only allow fully-qualified date-times with offsets. */
    strictQualifiedDateTimes?: boolean;
}
/** Whether to upsert or append the decorator. */
export type DecoratorCommandType = 'UPSERT' | 'APPEND';
/** Map declaration elements that can be targeted by a decorator command. */
export type DecoratorCommandMapElement = 'KEY' | 'VALUE' | 'KEY_VALUE';
/**
 * Which model elements to add the decorator to. Any absent element is a
 * wildcard. Mirrors `CommandTarget` in the decorator command set model.
 */
export interface DecoratorCommandTarget {
    $class?: string;
    namespace?: string;
    declaration?: string;
    property?: string;
    /** mutually exclusive with `property` */
    properties?: string[];
    type?: string;
    mapElement?: DecoratorCommandMapElement;
}
/**
 * Applies a decorator to a given target. Mirrors `Command` in the decorator
 * command set model.
 */
export interface DecoratorCommand {
    $class?: string;
    target: DecoratorCommandTarget;
    decorator: IDecorator;
    type: DecoratorCommandType;
    decoratorNamespace?: string;
}
/**
 * A named and versioned set of decorator commands. Mirrors
 * `DecoratorCommandSet` in the decorator command set model.
 */
export interface DecoratorCommandSet {
    $class?: string;
    name: string;
    version: string;
    includes?: Array<{
        name: string;
        version: string;
    }>;
    commands: DecoratorCommand[];
}
/**
 * Field generation options accepted by Factory#newResource and friends.
 */
export interface GenerateOptions {
    /** skip validation of the created instance. */
    disableValidation?: boolean;
    /** 'sample' for realistic values, 'empty' for empty ones. */
    generate?: string;
    /** also generate values for optional fields. */
    includeOptionalFields?: boolean;
}
/**
 * The parameters an InstanceGenerator walks a declaration with, assembled by
 * Factory#parseGenerateOptions.
 */
export interface InstanceGeneratorParameters {
    modelManager: BaseModelManager;
    factory: Factory;
    valueGenerator: EmptyValueGenerator;
    includeOptionalFields: boolean;
    stack?: TypedStack<Typed>;
    seen?: string[];
}
