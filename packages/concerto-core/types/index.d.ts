
import { EventEmitter } from 'events';

declare module '@accordproject/concerto-core' {

  // Exceptions

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

  class IllegalModelException extends BaseFileException {
    constructor(message: string, modelFile?: ModelFile, fileLocation?: any, component?: string);
    getModelFile(): ModelFile | null;
  }

  class TypeNotFoundException extends BaseException {
    constructor(typeName: string, message?: string, component?: string);
    getTypeName(): string;
  }

  // Decorated

  class Decorated {
    constructor(modelFile: ModelFile, ast: string);
    getModelFile(): ModelFile;
    private accept(visitor: any, parameters: any): any;
    process(): void;
    validate(): void;
    getDecorators(): Decorator[];
    getDecorator(name: string): Decorator;
  }

  class Decorator {
    constructor(parent: ClassDeclaration | Property, ast: any);
    private accept(visitor: any, parameters: any): any;
    getParent(): ClassDeclaration | Property;
    private process(): void;
    private validate(): void;
    getName(): string;
    getArguments(): any[] | null;
  }

  abstract class DecoratorFactory {
    abstract newDecorator(parent: ClassDeclaration | Property, ast: any): Decorator;
  }

  // ClassDeclarations

  export abstract class ClassDeclaration extends Decorated {
    constructor(modelFile: ModelFile, ast: string);
    process(): void;
    private addTimestampField(): void;
    _resolveSuperType(): ClassDeclaration | null;
    validate(): void;
    getSystemType(): string | null;
    isAbstract(): boolean;
    isEnum(): boolean;
    isConcept(): boolean;
    isEvent(): boolean;
    isSystemCoreType(): boolean;
    getName(): string;
    getNamespace(): string;
    getFullyQualifiedName(): string;
    getIdentifierFieldName(): string;
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

  export class AssetDeclaration extends ClassDeclaration { }

  export class ConceptDeclaration extends ClassDeclaration { }

  export class EnumDeclaration extends ClassDeclaration { }

  export class EventDeclaration extends ClassDeclaration { }

  export class ParticipantDeclaration extends ClassDeclaration { }

  export class TransactionDeclaration extends ClassDeclaration { }

  // Properties

  export class Property extends Decorated {
    constructor(parent: ClassDeclaration, ast: any);
    getParent(): ClassDeclaration;
    process(): void;
    validate(classDecl?: ClassDeclaration): void;
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

  // Concept

  export class Concept extends Typed {
    isConcept(): boolean;
  }

  // Identifiables

  abstract class Identifiable extends Typed {
    constructor(modelManager: ModelManager, classDeclaration: ClassDeclaration, ns: string, type: string, id: string);
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

  export class Resource extends Identifiable { }

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

  export class FileWriter extends Writer {
    constructor(outputDirectory: string);
    openFile(fileName: string): void;
    openRelativeFile(relativeDir: string, fileName: string): void;
    writeLine(tabs: number, text: string): void;
    writeBeforeLine(tabs: number, text: string): void;
    closeFile(): void;
  }

  // Factory

  interface NewResourceOptions {
    disableValidation?: boolean;
    generate?: string;
    includeOptionalFields?: boolean;
    allowEmptyId?: boolean;
  }

  interface NewConceptOptions {
    disableValidation?: boolean;
    generate?: string;
    includeOptionalFields?: boolean;
  }

  interface NewTransactionOptions {
    generate?: string;
    includeOptionalFields?: boolean;
    allowEmptyId?: boolean;
  }

  interface NewEventOptions {
    generate?: string;
    includeOptionalFields?: boolean;
    allowEmptyId?: boolean;
  }

  export class Factory {
    constructor(modelManager: ModelManager);
    newResource(ns: string, type: string, id: string, options?: NewResourceOptions): Resource;
    newConcept(ns: string, type: string, options?: NewConceptOptions): Resource;
    newRelationship(ns: string, type: string, id: string): Relationship;
    newTransaction(ns: string, type: string, id?: string, options?: NewTransactionOptions): Resource;
    newEvent(ns: string, type: string, id?: string, options?: NewEventOptions): Resource;
    private initializeNewObject(newObject: Typed, classDeclaration: ClassDeclaration, clientOptions: any): void;
    private parseGenerateOptions(clientOptions: any): any;
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

  export class ModelFile {
    constructor(modelManager: ModelManager, definitions: string, fileName?: string, isSystemModelFile?: boolean);
    isExternal(): boolean;
    private getImportURI(namespace: string): string;
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
    getName(): string | null;
    getAssetDeclarations(includeSystemType?: boolean): AssetDeclaration[];
    getTransactionDeclarations(includeSystemType?: boolean): TransactionDeclaration[];
    getEventDeclarations(includeSystemType?: boolean): EventDeclaration[];
    getParticipantDeclarations(includeSystemType?: boolean): ParticipantDeclaration[];
    getConceptDeclarations(includeSystemType?: boolean): ConceptDeclaration[];
    getEnumDeclarations(includeSystemType?: boolean): EnumDeclaration[];
    getDeclarations(type: (...params: any[]) => any, includeSystemType?: boolean): ClassDeclaration[];
    getAllDeclarations(): ClassDeclaration[];
    getDefinitions(): string;
    isSystemModelFile(): boolean;
    static [Symbol.hasInstance](object: any): boolean;
  }

  // ModelManager

  interface IncludeModelsOptions {
    includeExternalModels: boolean;
    includeSystemModels: boolean;
  }

  export class ModelManager {
    constructor();
    private accept(visitor: any, parameters: any): any;
    validateModelFile(modelFile: string, fileName?: string): void;
    private _throwAlreadyExists(modelFile: ModelFile): void;
    addModelFile(modelFile: string, fileName?: string, disableValidation?: boolean): any;
    private getSystemModelTable(): any;
    updateModelFile(modelFile: string, fileName?: string, disableValidation?: boolean): any;
    deleteModelFile(namespace: string): void;
    addModelFiles(modelFiles: string[], fileNames?: string[], disableValidation?: boolean): any[];
    validateModelFiles(): void;
    updateExternalModels(options?: any, modelFileDownloader?: ModelFileDownloader): Promise<ModelFile[]>;
    writeModelsToFileSystem(path: string, options?: IncludeModelsOptions): void;
    private getModelFiles(): ModelFile[];
    private getSystemModelFiles(): ModelFile[];
    getModels(options?: IncludeModelsOptions): { name: string; content: string }[];
    private resolveType(context: string, type: string): string;
    clearModelFiles(): void;
    private getModelFile(namespace: string): ModelFile;
    private getModelFileByFileName(fileName: string): ModelFile;
    getNamespaces(): string[];
    private getType(qualifiedName: string): ClassDeclaration;
    getSystemTypes(): ClassDeclaration[];
    getAssetDeclarations(includeSystemType?: boolean): AssetDeclaration[];
    getTransactionDeclarations(includeSystemType?: boolean): TransactionDeclaration[];
    getEventDeclarations(includeSystemType?: boolean): EventDeclaration[];
    getParticipantDeclarations(includeSystemType?: boolean): ParticipantDeclaration[];
    getEnumDeclarations(includeSystemType?: boolean): EnumDeclaration[];
    getConceptDeclarations(includeSystemType?: boolean): ConceptDeclaration[];
    getFactory(): Factory;
    getSerializer(): Serializer;
    getDecoratorFactories(): DecoratorFactory[];
    addDecoratorFactory(factory: DecoratorFactory): void;
    static [Symbol.hasInstance](object: any): boolean;
  }

  // Serializer

  interface SerializerToJSONOptions {
    validate?: boolean;
    convertResourcesToRelationships?: boolean;
    permitResourcesForRelationships?: boolean;
    deduplicateResources?: boolean;
  }

  interface SerializerFromJSONOptions {
    acceptResourcesForRelationships: boolean;
    validate: boolean;
  }

  export class Serializer {
    constructor(factory: Factory, modelManager: ModelManager);
    setDefaultOptions(newDefaultOptions: any): void;
    toJSON(resource: Resource, options?: SerializerToJSONOptions): any;
    fromJSON(jsonany: any, options?: SerializerFromJSONOptions): Resource;
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
    static getIdentitySystemModelTable(): 'Transaction' | 'Asset' | 'Event' | 'Participant';
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

  class ModelFileDownloader extends JobQueue {
    constructor(mfl: ModelFileLoader, startDelay: number, jobDelay: number);
    downloadExternalDependencies(modelFiles: ModelFile[], options?: any): Promise<ModelFile[]>;
    runJob(job: any): Promise<ModelFile>;
  }

  class JobQueue extends EventEmitter {
    constructor(startDelay: number, jobDelay: number);
    addJob(job: any): void;
    deleteJob(index: number): void;
    processQueue(resetTimer: boolean): void;
    getQueue(): any[];
    runJob(job: any): void;
  }
}