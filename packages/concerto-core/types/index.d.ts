declare module '@accordproject/concerto-core' {
  // Exceptions
  interface FileLocation {
    start: {
      line: string;
      column: string;
    }
    end: {
      line: string;
      column: string;
    }
  }

  export class BaseException extends Error {
    constructor(message: string, component?: string);
  }

  export class BaseFileException extends BaseException {
    constructor(message: string, fileLocation?: string, fullMessage?: string, fileName?: string, component?: string);
    getFileLocation(): string | null;
    getShortMessage(): string;
    getFileName(): string | null;
  }

  export class ParseException extends BaseFileException {
    constructor(message: string, fileLocation?: string, fileName?: string, fullMessageOverride?: string, component?: string);
  }

  export class SecurityException extends BaseException {
    constructor(message: string);
  }

  export class IllegalModelException extends BaseFileException {
    constructor(message: string, modelFile?: ModelFile, fileLocation?: FileLocation, component?: string);
    getModelFile(): ModelFile | null;
  }

  export class TypeNotFoundException extends BaseException {
    constructor(typeName: string, message?: string, component?: string);
    getTypeName(): string;
  }

  // Decorated
  class Decorated {
    constructor(modelFile: ModelFile, ast: string);
    getModelFile(): ModelFile;
    private accept(visitor: any, parameters: any): any;
    private process(): void;
    private validate(): void;
    getDecorators(): Decorator[];
    getDecorator(name: string): Decorator | null;
  }

  export class Decorator {
    constructor(parent: ClassDeclaration | Property, ast: any);
    private accept(visitor: any, parameters: any): any;
    getParent(): ClassDeclaration | Property;
    private process(): void;
    private validate(): void;
    getName(): string;
    getArguments(): any[];
  }

  export abstract class DecoratorFactory {
    abstract newDecorator(parent: ClassDeclaration | Property, ast: any): Decorator;
  }

  // ClassDeclarations
  export abstract class ClassDeclaration extends Decorated {
    constructor(modelFile: ModelFile, ast: any);
    private process(): void;
    private addTimestampField(): void;
    private addIdentifierField(): void;
    _resolveSuperType(): ClassDeclaration | null;
    private validate(): void;
    isAbstract(): boolean;
    isEnum(): boolean;
    isConcept(): boolean;
    isEvent(): boolean;
    getName(): string;
    getNamespace(): string;
    getFullyQualifiedName(): string;
    isIdentified(): boolean;
    isSystemIdentified(): boolean;
    isExplicitlyIdentified(): boolean;
    getIdentifierFieldName(): string | null;
    getOwnProperty(name: string): Property | null;
    getOwnProperties(): Property[];
    getSuperType(): string | null;
    getSuperTypeDeclaration(): ClassDeclaration | null;
    getAssignableClassDeclarations(): ClassDeclaration[];
    getAllSuperTypeDeclarations(): ClassDeclaration[];
    getProperty(name: string): Property | null;
    getProperties(): Property[];
    getNestedProperty(propertyPath: string): Property;
    toString(): string;
    static [Symbol.hasInstance](object: any): boolean;
  }

  export class IdentifiedDeclaration extends ClassDeclaration { }

  export class AssetDeclaration extends IdentifiedDeclaration { }

  export class ConceptDeclaration extends ClassDeclaration { }

  export class EnumDeclaration extends ClassDeclaration { }

  export class EventDeclaration extends IdentifiedDeclaration { }

  export class ParticipantDeclaration extends IdentifiedDeclaration { }

  export class TransactionDeclaration extends IdentifiedDeclaration { }

  // Properties
  export class Property extends Decorated {
    constructor(parent: ClassDeclaration, ast: any);
    getParent(): ClassDeclaration;
    private process(): void;
    private validate(classDecl?: ClassDeclaration): void;
    getName(): string;
    getType(): string;
    isOptional(): boolean;
    getFullyQualifiedTypeName(): string;
    getFullyQualifiedName(): string;
    getNamespace(): string;
    isArray(): boolean;
    isTypeEnum(): boolean;
    isPrimitive(): boolean;
    static [Symbol.hasInstance](object: any): boolean;
  }

  export class Field extends Property {
    getValidator(): string | null;
    getDefaultValue(): string | null;
    toString(): string;
  }

  export class EnumValueDeclaration extends Property { }

  export class RelationshipDeclaration extends Property {
    toString(): string;
  }

  // Typed
  export abstract class Typed {
    constructor(modelManager: ModelManager, classDeclaration: ClassDeclaration, ns: string, type: string);
    private accept(visitor: any, parameters: any): any;
    private getModelManager(): ModelManager;
    getType(): string;
    getFullyQualifiedType(): string;
    getNamespace(): string;
    private getClassDeclaration(): ClassDeclaration;
    setPropertyValue(propName: string, value: string): void;
    addArrayValue(propName: string, value: string): void;
    private assignFieldDefaults(): void;
    instanceOf(fqt: string): boolean;
    private toJSON(): any;
    [propertyName: string]: any;
  }

  // Identifiables
  abstract class Identifiable extends Typed {
    constructor(modelManager: ModelManager, classDeclaration: ClassDeclaration, ns: string, type: string, id: string, timestamp: string);
    getTimestamp(): string;
    getIdentifier(): string;
    setIdentifier(id: string): void;
    getFullyQualifiedIdentifier(): string;
    toString(): string;
    isRelationship(): boolean;
    isResource(): boolean;
    toURI(): string;
  }

  export class Relationship extends Identifiable {
    static fromURI(modelManager: ModelManager, uriAsstring: string, defaultNamespace?: string, defaultType?: string): Relationship;
  }

  export class Resource extends Identifiable {
    isConcept(): boolean;
    isIdentifiable(): boolean;
  }

  // Writers
  export class Writer {
    constructor();
    writeBeforeLine(tabs: number, text: string): void;
    writeLine(tabs: number, text: string): void;
    getLineCount(): number;
    writeIndented(tabs: number, text: string): void;
    write(msg: string): void;
    getBuffer(): string;
    clearBuffer(): void;
  }

  // Factory
  interface NewResourceOptions {
    disableValidation?: boolean;
    generate?: string;
    includeOptionalFields?: boolean;
  }

  interface NewConceptOptions {
    disableValidation?: boolean;
    generate?: string;
    includeOptionalFields?: boolean;
  }

  interface NewTransactionOptions {
    generate?: string;
    includeOptionalFields?: boolean;
  }

  interface NewEventOptions {
    generate?: string;
    includeOptionalFields?: boolean;
  }

  export class Factory {
    constructor(modelManager: ModelManager);
    newResource(ns: string, type: string, id: string, options?: NewResourceOptions): Resource;
    newConcept(ns: string, type: string, id: string, options?: NewConceptOptions): Resource;
    newRelationship(ns: string, type: string, id: string): Relationship;
    newTransaction(ns: string, type: string, id?: string, options?: NewTransactionOptions): Resource;
    newEvent(ns: string, type: string, id?: string, options?: NewEventOptions): Resource;
    private initializeNewObject(newObject: Typed, classDeclaration: ClassDeclaration, clientOptions: any): void;
    private parseGenerateOptions(clientOptions: any): any;
    static [Symbol.hasInstance](object: any): boolean;
  }

  // Globalize
  export function Globalize(locale: string): any;

  export namespace Globalize {
    function messageFormatter(message: string): any;
    function formatMessage(message: string): any;
  }

  // Introspector
  export class Introspector {
    constructor(modelManager: ModelManager);
    private accept(visitor: any, parameters: any): any;
    getClassDeclarations(): ClassDeclaration[];
    getClassDeclaration(fullyQualifiedTypeName: string): ClassDeclaration;
    private getModelManager(): ModelManager;
  }

  // ModelFile
  export class ModelFile {
    constructor(modelManager: ModelManager, definitions: string, fileName?: string);
    private fromAst(ast: any): void;
    isSystemModelFile(): boolean;
    isExternal(): boolean;
    private getImportURI(namespace: string): string | null;
    private getExternalImports(): any;
    private accept(visitor: any, parameters: any): any;
    getModelManager(): ModelManager;
    getImports(): string[];
    private validate(): void;
    private resolveType(context: string, type: string, fileLocation: FileLocation): void;
    private isLocalType(type: string): boolean;
    private isImportedType(type: string): boolean;
    private resolveImport(type: string): string;
    isDefined(type: string): boolean;
    private getType(type: string): string | ClassDeclaration;
    private getFullyQualifiedTypeName(type: string): string;
    getLocalType(type: string): ClassDeclaration | null;
    getAssetDeclaration(name: string): AssetDeclaration | null;
    getTransactionDeclaration(name: string): TransactionDeclaration | null;
    getEventDeclaration(name: string): EventDeclaration | null;
    getParticipantDeclaration(name: string): ParticipantDeclaration | null;
    getNamespace(): string;
    getName(): string;
    getAssetDeclarations(): AssetDeclaration[];
    getTransactionDeclarations(): TransactionDeclaration[];
    getEventDeclarations(): EventDeclaration[];
    getParticipantDeclarations(): ParticipantDeclaration[];
    getConceptDeclarations(): ConceptDeclaration[];
    getEnumDeclarations(): EnumDeclaration[];
    getDeclarations(type: (...params: any[]) => any): ClassDeclaration[];
    getAllDeclarations(): ClassDeclaration[];
    getDefinitions(): string;
    getConcertoVersion(): string;
    static [Symbol.hasInstance](object: any): boolean;
  }

  // ModelManager
  interface IncludeModelsOptions {
    includeExternalModels: boolean;
    includeSystemModels: boolean;
  }

  export class ModelManager {
    constructor(options?: any);
    private addRootModel(): void;
    accept(visitor: any, parameters: any): any;
    validateModelFile(modelFile: string, fileName?: string): void;
    private _throwAlreadyExists(modelFile: ModelFile): void;
    addModelFile(modelFile: string, fileName?: string, disableValidation?: boolean): any;
    updateModelFile(modelFile: string, fileName?: string, disableValidation?: boolean): any;
    deleteModelFile(namespace: string): void;
    addModelFiles(modelFiles: (string|ModelFile)[], fileNames?: string[], disableValidation?: boolean): any[];
    validateModelFiles(): void;
    updateExternalModels(options?: any, modelFileDownloader?: ModelFileDownloader): Promise<ModelFile[]>;
    writeModelsToFileSystem(path: string, options?: IncludeModelsOptions): void;
    private getModelFiles(): ModelFile[];
    private getSystemModelFiles(): ModelFile[];
    getModels(options?: IncludeModelsOptions): { name: string; content: string }[];
    private resolveType(context: string, type: string): string;
    clearModelFiles(): void;
    getModelFile(namespace: string): ModelFile | null;
    private getModelFileByFileName(fileName: string): ModelFile | null;
    getNamespaces(): string[];
    getType(qualifiedName: string): ClassDeclaration;
    getSystemTypes(): ClassDeclaration[];
    getAssetDeclarations(): AssetDeclaration[];
    getTransactionDeclarations(): TransactionDeclaration[];
    getEventDeclarations(): EventDeclaration[];
    getParticipantDeclarations(): ParticipantDeclaration[];
    getEnumDeclarations(): EnumDeclaration[];
    getConceptDeclarations(): ConceptDeclaration[];
    getFactory(): Factory;
    getSerializer(): Serializer;
    getDecoratorFactories(): DecoratorFactory[];
    addDecoratorFactory(factory: DecoratorFactory): void;
    derivesFrom(fqt1: string, fqt2: string): boolean;
    static [Symbol.hasInstance](object: any): boolean;
  }

  // Serializer
  interface SerializerToJSONOptions {
    validate?: boolean;
    convertResourcesToRelationships?: boolean;
    permitResourcesForRelationships?: boolean;
    deduplicateResources?: boolean;
    convertResourcesToId?: boolean;
    utcOffset: number;
  }

  interface SerializerFromJSONOptions {
    acceptResourcesForRelationships: boolean;
    validate: boolean;
    utcOffset: number;
  }

  export class Serializer {
    constructor(factory: Factory, modelManager: ModelManager, options?: any);
    setDefaultOptions(newDefaultOptions: any): void;
    toJSON(resource: Resource, options?: SerializerToJSONOptions): any;
    fromJSON(jsonObject: any, options?: SerializerFromJSONOptions): Resource;
    static [Symbol.hasInstance](object: any): boolean;
  }

  // ModelUtil
  export class ModelUtil {
    private static getShortName(fqn: string): string;
    private static isWildcardName(fqn: string): boolean;
    private static isRecursiveWildcardName(fqn: string): boolean;
    private static isMatchingType(type: Typed, fqn: string): boolean;
    private static getNamespace(fqn: string): string;
    private static isPrimitiveType(typeName: string): boolean;
    private static isAssignableTo(modelFile: ModelFile, typeName: string, property: Property): boolean;
    private static capitalizeFirstLetter(string: string): string;
    private static isEnum(field: Field): boolean;
    static getFullyQualifiedName(namespace: string, type: string): string;
  }

  // ModelFileLoaders
  interface ModelFileLoader {
    accepts(url: string): boolean;
    load(url: string, options: any): Promise<ModelFile>;
  }

  class CompositeModelFileLoader implements ModelFileLoader {
    constructor();
    addModelFileLoader(modelFileLoader: ModelFileLoader): void;
    private getModelFileLoaders(): ModelFileLoader[];
    clearModelFileLoaders(): void;
    accepts(url: string): boolean;
    load(url: string, options: any): Promise<ModelFile>;
  }

  export class DefaultModelFileLoader extends CompositeModelFileLoader {
    constructor(modelManager: ModelManager);
  }

  export class ModelFileDownloader {
    constructor(modelFileLoader: ModelFileLoader, concurrency: number);
    downloadExternalDependencies(modelFiles: ModelFile[], options?: any): Promise<ModelFile[]>;
    runJob(job: any, modelFileLoader: ModelFileLoader): Promise<ModelFile>;
  }

  // ModelLoader
  export class ModelLoader {
    private addModel(modelFileLoader: ModelFileLoader, modelManager: ModelManager, ctoFile: string): ModelManager;
    static loadModelManager(ctoFiles: string[], options?: any): Promise<ModelManager>;
    static loadModelManagerFromModelFiles(modelFiles: ModelFile[], fileNames?: string[], options?: any): Promise<ModelManager>;
  }

  // Logger
  export class Logger {
    private static dispatch(level, ...args: any[]): void;
    private static add(transport: any): void;
    private static error(...args: any[]): void;
    private static info(...args: any[]): void;
    private static log(...args: any[]): void;
    private static http(...args: any[]): void;
    private static verbose(...args:any[]): void;
    private static debug(...args:any[]): void;
    private static silly(...args:any[]): void;
    level: string;
    transports: any[];
  }

  // DateTimeUtil
  interface CurrentTime {
    currentTime: any,
    utcOffset: number
  }

  export namespace DateTimeUtil {
    function setCurrentTime(currentTime?: string, utcOffset?: number): CurrentTime;
  }

  // TypedStack
  export class TypedStack {
    constructor(resource: any);
    push(obj: any, expectedType: any): void;
    pop(expectedType: obj): any?;
    peek(expectedType: obj): any?;
    clear(): void;
  }

  // Concerto
  class Concerto {
    constructor(modelManager: ModelManager);
    validate(obj: any, options?: any): void;
    getModelManager(): ModelManager;
    isObject(obj: any): boolean;
    getTypeDeclaration(obj: any): ClassDeclaration;
    getIdentifier(obj: any): string;
    isIdentifiable(obj: any): boolean;
    isRelationship(obj: aby): boolean;
    setIdentifier(obj: any, id: string): any;
    getFullyQualifiedIdentifier(obj: any): string;
    toURI(obj: any): string;
    fromURI(uri: string): any;
    getType(obj: any): string;
    getNamespace(obj: any): string;
  }

  // MetaModel
  export namespace MetaModel {
    const metaModelCto: string;
    function modelFileToMetaModel(modelFile: ModelFile, validate?: boolean): any;
    function ctoToMetaModel(model: string, validate?: boolean): any;
    function ctoToMetaModelAndResolve(modelManager: ModelManager, model: string, validate?: boolean);
    function ctoFromMetaModel(metaModel: any, validate?: boolean): string;
  }
  
  // version
  export const version: any;
}
