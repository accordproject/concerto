/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// The engine bindings and views the public classes call, with their real
// signatures. Imported with `import type` only, so it adds nothing to the
// JavaScript build, and the public declarations and API snapshot do not
// see it.

import type ModelManager from '../modelmanager';
import type ClassDeclaration from '../introspect/classdeclaration';
import type Property from '../introspect/property';

/**
 * An engine-side ModelManager handle (concerto-wasm `ModelManagerHandle`):
 * the methods concerto-core calls, as wasm-bindgen generates them.
 */
export interface EngineHandle {
    addModel(ast: string, file_name?: string | null): number;
    addModelWithDefinitions(ast: string, definitions: string | null | undefined, file_name: string | null | undefined, validate: boolean): number;
    // BC-52: the arena answers of the retired JsContext bindings.
    classDeclarationGetAssignableClassDeclarations(declaration: number): string[];
    classDeclarationGetDirectSubclasses(declaration: number): string[];
    decoratorValidate(decorator: object, modelFile: object, modelFileId: number, decoratedName: string | undefined, options: object): void;
    declarationId(fqn: string): number | undefined;
    modelUtilIsAssignableTo(modelFile: number, typeName: string, propertyType: string): boolean;
    modelUtilIsEnum(modelFile: number, typeName?: string | null): boolean | undefined;
    modelUtilIsMap(modelFile: number, typeName?: string | null): boolean | undefined;
    modelUtilIsScalar(modelFile: number, typeName?: string | null): boolean | undefined;
    modelUtilIsValidMapKeyScalar(declaration: number): boolean | undefined;
    scalarDeclarationValidate(declaration: number): void;
    commitStagedModelFile(stage: number): number | undefined;
    commitStagedModelFiles(stages: Uint32Array): boolean;
    dcsDecorateModels(target: EngineHandle, decorator_command_sets: any, options: any): any;
    dcsExtract(target: EngineHandle, options: any, action: number): any;
    dcsValidate(decorator_command_set: any): void;
    deleteModelFile(namespace: string): void;
    derivesFrom(fqt1: string, fqt2: string): boolean;
    dropStagedModelFile(stage: number): void;
    fork(): EngineHandle;
    free(): void;
    getNamespaces(): string[];
    getTypeName(qualified_name: string): string;
    isAssignableTo(fqn: string, base_fqn: string): boolean;
    modelFileFilterAst(model_file: number, predicate: Function): string | undefined;
    modelFileFilterStaged(model_file: number, predicate: Function, target: EngineHandle): string | undefined;
    modelFileGetFullyQualifiedTypeName(model_file: number, type_name: string): string | undefined;
    modelFileGetImports(model_file: number): Array<any>;
    modelFileGetTypeName(model_file: number, type_name: string): string | undefined;
    modelFileId(namespace: string): number | undefined;
    modelFileIsLocalType(model_file: number, type_name: string): boolean;
    modelFileResolveType(model_file: number, context: string, type_name: string, file_location: any, view: any): void;
    modelFileSnapshot(model_file: number): string;
    modelFileValidate(model_file: number): void;
    modelFileValidateDetached(ast: string, definitions?: string | null, file_name?: string | null): void;
    modelFileValidateStaged(stage: number): boolean;
    modelManagerGetModelFileByFileName(file_name?: string | null): string | undefined;
    resolveType(context: string, type_name: string): string;
    serializerFromJsonCompact(json_text: string, options_text: string, env: any): string;
    serializerToJson(wire_text: string, options_text: string): string;
    serializerToJsonBytes(bytes: Uint8Array, options_text: string): string;
    serializerFromJsonCompactBytes(bytes: Uint8Array, options_text: string, env: any): string;
    setDangerouslyAllowReservedSystemTypeNamesInUserModels(allow: boolean): void;
    setDecoratorValidation(options: any): void;
    stageModelFileBytes(ast: Uint8Array, definitions: string | null | undefined, file_name: string | null | undefined, flags: number): string;
    throwAlreadyExists(namespace: string, file_name?: string | null): void;
    updateExternalModels(sources: string, model_files: any): void;
    updateModelFile(ast: string, definitions: string | null | undefined, file_name: string | null | undefined, validate: boolean): number;
    validateAndCommitStagedModelFile(stage: number, metamodel?: boolean | null): number | undefined;
    validateAstValue(ast: string): void;
    validateAstStaged(stage: number): boolean;
    updateStagedModelFile(stage: number): number | undefined;
    updateExternalModelsStaged(stages: Uint32Array, model_files: any): boolean;
    stagedModelFileViewSnapshot(stage: number, namespace?: string | null): string | undefined;
    modelFileViewSnapshotOf(model_file: number, namespace?: string | null): string | undefined;
    validateInstance(json_text: string, options_text: string, fqn: string | null | undefined, mode: number): string;
    validateInstanceBytes(bytes: Uint8Array, options_text: string, fqn: string | null | undefined, mode: number): string;
    validateModelFiles(model_files: any): void;
    validatePropertyBinary(bytes: Uint8Array, class_fqn: string, prop_name: string, root_id: string, flags: number): number;
    validationPropertySlot(class_fqn: string, prop_name: string): Uint32Array | undefined;
    validatePropertyById(bytes: Uint8Array, decl_id: number, prop_index: number, epoch: number, root_id: string, flags: number): number | string;
    validateResourceBinary(bytes: Uint8Array, root_id: string, flags: number): number;
}

/** One BaseModelManager's engine state (`BaseModelManager._engine`). */
export interface EngineState {
    /** The model version, moved by every change; every cached answer is valid only at its version. */
    version: number;
    readMemo: {
        version: number;
        typeNames: Map<string, string>;
        /** `resolveType` answers by type (the context only words an error). */
        resolvedTypes: Map<string, string>;
        /** `ModelFile.getType` answers, by namespace and then type. */
        fileTypeNames: Map<string, Map<string, string | undefined>>;
    } | undefined;
    /** The namespaces in `getNamespaces()` order, or undefined when the engine must be asked. */
    namespaces: string[] | undefined;
    /** The class lookups of the serializer fast path (engine/serializer.ts). */
    serializerCache: { version: number; handle: EngineHandle; types: unknown } | undefined;
    /**
     * The `validatePropertyById` slots of `handle` (engine/validate-resource.ts),
     * `[declId, propIndex, epoch]` by type and property, for one model version.
     */
    propertySlots: { version: number; handle: EngineHandle; byType: Map<string, Map<string, Uint32Array | null>> } | undefined;
}

/** The concerto-wasm bindings the public classes call. */
export interface EngineBindings {
    // ModelUtil
    modelUtilGetShortName(fqn: string): string;
    modelUtilGetNamespace(fqn: string): string;
    /** The parsed namespace, packed as `N<name>`, or `V`/`I` then `@`-separated parts. */
    modelUtilParseNamespaceChecked(ns: string, options?: object): string;
    modelUtilImportFullyQualifiedNames(imp: object): string[];
    modelUtilIsPrimitiveType(typeName: string): boolean;
    modelUtilCapitalizeFirstLetter(value: string): string;
    modelUtilIsValidIdentifier(name: unknown): boolean;
    modelUtilGetFullyQualifiedName(namespace: string, type: string): string;
    modelUtilRemoveNamespaceVersionFromFullyQualifiedName(fqn: string): string;
    modelUtilIsSystemProperty(propertyName: string): boolean;
    modelUtilIsPrivateSystemProperty(propertyName: string): boolean;
    modelUtilIsValidMapKey(key: object): boolean;
    modelUtilIsValidMapValue(value: object): boolean;

    // DecoratorManager
    decoratorManagerMigrateTo(decoratorCommandSet: object): object;

    // ModelManager / ModelFile
    ModelManagerHandle: new () => EngineHandle;
    modelFileIsCompatibleVersion(modelFile: object): void;
    modelFileEnforceImportVersioning(imp: object): void;
    modelFileFromAstHeader(modelFile: object, ast: object): void;

    // Introspection
    /** The decorator's processed arguments, to assign onto it. */
    decoratorProcess(ast: object, decorator: object): object;
    declarationValidate(declaration: object): void;
    declarationIsReservedSystemTypeImport(modelFile: object, typeName: string): boolean;
    classDeclarationResolveSuperType(classDeclaration: object): ClassDeclaration | null;
    classDeclarationGetSuperType(classDeclaration: object): string | null;
    classDeclarationGetSuperTypeDeclaration(classDeclaration: object): ClassDeclaration | null;
    classDeclarationGetAllSuperTypeDeclarations(classDeclaration: object): ClassDeclaration[];
    classDeclarationGetNestedProperty(classDeclaration: object, propertyPath: string): Property;
    propertyValidate(property: object, classDeclaration: object): void;
    relationshipDeclarationValidate(relationship: object, classDeclaration: object): void;
    mapKeyTypeValidate(mapKeyType: object): void;
    mapValueTypeValidate(mapValueType: object): void;

    // Validators: `*New` returns the validator's fields, to assign onto it.
    numberValidatorNew(validator: object, ast: object): object;
    numberValidatorValidate(validator: object, identifier: string | null, value: unknown): void;
    numberValidatorCompatibleWith(validator: object, other: unknown, ctor: Function): boolean;
    stringValidatorNew(validator: object, ast: unknown, lengthAst: unknown): object;
    stringValidatorValidate(validator: object, identifier: string | null, value: unknown): void;
    stringValidatorCompatibleWith(validator: object, other: unknown, ctor: Function): boolean;
    collectionSizeValidatorNew(validator: object, ast: unknown): object;
    collectionSizeValidatorValidate(validator: object, identifier: string | null, value: unknown): void;
    collectionSizeValidatorCompatibleWith(validator: object, other: unknown, ctor: Function): boolean;

    // ResourceId
    resourceIdFromURI(uri: string, legacyNamespace?: string, legacyType?: string): { namespace: string, type: string, id: string };
    resourceIdToURI(namespace: string, type: string, id: string): string;
    // Many at once, flat, with `undefined` where one fails.
    resourceIdsFromURIs(uris: string[], legacyNamespace?: string, legacyType?: string): (string | undefined)[];
    resourceIdsToURIs(fields: unknown[]): (string | undefined)[];
}

/** An engine-side DCS input manager (concerto-wasm `DcsManagerHandle`). */
export interface EngineDcsHandle {
    free(): void;
    decorateModels(target: EngineHandle, decoratorCommandSets: any, options: any): any;
    extract(target: EngineHandle, options: any, action: number): any;
}

/** The bindings only src/engine/ calls. */
export interface EngineInternals {
    setHost(errorFactory: Function): void;
    DcsManagerHandle: new (models: any) => EngineDcsHandle;
    scalarDeclarationProcess(declaration: object): any;
    classDeclarationProcess(declaration: object): any;
    propertyProcess(view: object): any;
    fieldProcess(view: object): any;
    fieldGetScalarField(view: object): any;
    mapDeclarationProcess(view: object): void;
    mapKeyTypeProcess(view: object): any;
    mapValueTypeProcess(view: object): any;
    classDeclarationGetProperties(declaration: object): any[];
    classDeclarationGetProperty(declaration: object, name: unknown): any;
    classDeclarationGetIdentifierFieldNameWalk(declaration: object): any[];
    modelFileViewSnapshot(ast: string, namespace?: string | null): string | undefined;
    validateErrorMessage(): string;
    validateTakeError(): any;
    /** Validates a wire-encoded metamodel instance on the engine's resident metamodel manager. */
    validateMetaModelInstance(jsonText: string, preset: 'strict' | 'default' | 'serializer'): void;
    checkAstShape(ast: string): void;
    systemModelFileHeader(ast: string): string | undefined;
}

/** The extract* result shapes as concerto-core 5.0.0 declared them (`never[]`). */
export interface ExtractDecoratorsResult {
    modelManager: ModelManager;
    decoratorCommandSet: never[];
    vocabularies: never[];
}

/** The view functions the public modules call, through `engineViews()`. */
export interface EngineViewsModule {
    // ModelFile load path
    markSystemModelAst(ast: object): void;
    checkAstShape(modelFile: object): string | object | undefined;
    stageModelFile(modelFile: object, checkedText?: string | object): boolean;
    adoptSharedView(modelFile: object, source: object, stage?: object, committed?: object): boolean;
    filteredViewAst(modelFile: object): object;
    systemViewHeader(ast: object): unknown[] | undefined;
    adoptSystemView(modelFile: object, header: unknown[]): boolean;
    copyImportNames(modelFile: object, source: object): void;
    applyStagedHeaders(modelFile: object, ast: object): boolean;
    recordImportNames(modelFile: object, names: string[]): void;
    recordedImportNames(modelFile: object): string[] | undefined;
    deferDeclarations(modelFile: object): void;
    beginModelFile(modelFile: object, ast: object): object | null;
    endModelFile(saved: object | null): void;
    builtDeclaration(modelFile: object, index: number, node: object): any;
    localType(modelFile: object, type: string): any;
    commitStaged(modelFile: object, handle: EngineHandle): number | undefined;
    commitStagedAll(modelFiles: object[], handle: EngineHandle): ArrayLike<number> | undefined;
    validateAndCommitStaged(modelFile: object, handle: EngineHandle, metamodel?: boolean): number | undefined;
    dropStaged(modelFile: object, handle: EngineHandle): void;
    updateStaged(modelFile: object, handle: EngineHandle): number | undefined;
    validateAstStaged(modelFile: object, handle: EngineHandle): boolean;
    updateExternalStaged(modelFiles: object[], handle: EngineHandle, next: object): boolean;
    validateLoaded(modelFile: object, handle: EngineHandle): boolean;
    // BC-52: arena handles of views
    modelFileArenaRef(modelFile: unknown): { handle: EngineHandle; id: number } | undefined;
    declarationArenaRef(declaration: unknown): { handle: EngineHandle; id: number } | undefined;
    declarationViews(manager: object, names: string[]): any[];
    notInArena(member: string): TypeError;
    // Declarations and properties
    declarationIsValidIdentifier(view: object): boolean;
    declarationFullyQualifiedName(view: object): string;
    classDeclarationProcess(view: object): { superType?: string | null; idField?: string | null } | any;
    classDeclarationGetProperties(view: object): any[];
    classDeclarationGetProperty(view: object, name: string): any;
    classDeclarationGetIdentifierFieldName(view: object): string | null;
    scalarDeclarationProcess(declaration: object): void;
    propertyProcess(property: object): void;
    fieldProcess(field: object): void;
    fieldGetScalarField(field: object): any;
    mapDeclarationProcess(view: object, buildKey: () => any, buildValue: () => any): void;
    mapKeyTypeProcess(view: object): string;
    mapValueTypeProcess(view: object): string;
    // Decorators
    installLazyField(proto: object, key: string, initial?: () => any, buildOnWrite?: boolean): void;
    deferDecorators(element: object): boolean;
    decoratorFactories(modelFile: object): any[] | undefined;
    // DecoratorManager
    decoratorManagerValidate(validationModelManager: object, decoratorCommandSet: object): void;
    decoratorManagerDecorateModels(modelManager: object, decoratorCommandSets: object[], options?: object): ModelManager;
    decoratorManagerExtractDecorators(modelManager: object, options: object): ExtractDecoratorsResult;
    decoratorManagerExtractVocabularies(modelManager: object, options: object): { modelManager: ModelManager; vocabularies: never[] };
    decoratorManagerExtractNonVocabDecorators(modelManager: object, options: object): { modelManager: ModelManager; decoratorCommandSet: never[] };
}

/** src/engine/serializer.ts, as `engineSerializer()` exposes it. */
export interface EngineSerializerModule {
    fastFromJson(modelManager: object, jsonObject: unknown, options: object): any;
    fastToJson(modelManager: object, resource: unknown, options: object): any;
    validateMetaModel(input: unknown): void;
}

/** src/engine/validate-resource.ts, as `engineValidateResource()` exposes it. */
export interface EngineValidateResourceModule {
    validateResource(resource: object, rootId: string): boolean;
    validateProperty(resource: object, propName: string, value: unknown, rootId: string, field?: object): boolean;
}

/** src/engine/validate-instance.ts, as `engineValidateInstance()` exposes it. */
export interface EngineValidateInstanceModule {
    validateInstance(modelManager: object, json: unknown, options?: object, fqn?: string): any;
    validateInstanceOrThrow(modelManager: object, json: unknown, options?: object, fqn?: string): any;
}

/** src/engine/handles.ts, as `engineHandles()` exposes it. */
export interface EngineHandlesModule {
    releaseHandle(handle: { free(): void }): void;
    withEngineCallbacks<T>(fn: () => T): T;
}
