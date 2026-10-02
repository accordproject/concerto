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

// P5-84 (accordproject/concerto-rust#430): the engine bindings and views the
// public classes call, with their real signatures.
//
// Until P5-84 every caller typed the binding table as
// `{ [binding: string]: (...args: any[]) => never }` (PORTING.md, "Why
// never"). That kept the inferred return types of the TS bodies while both
// paths existed, but once P5-02 removed the TS bodies, every public method
// that returned a binding's result directly was declared as returning
// `never` in the published .d.ts. Naming each binding here, with its real
// signature, gives those methods a real type, and a misspelt or missing
// binding is now a compile error.
//
// This is a declaration file, imported with `import type` only, so it adds
// nothing to the JavaScript build and emits no .d.ts of its own: the public
// declaration build (tsconfig.build.json, which excludes src/engine) and the
// API snapshot stay as they were.

import type ModelManager from '../modelmanager';
import type ClassDeclaration from '../introspect/classdeclaration';
import type Property from '../introspect/property';

/**
 * An engine-side ModelManager handle (concerto-wasm `ModelManagerHandle`).
 */
export interface EngineHandle {
    [binding: string]: (...args: any[]) => any;
}

/**
 * The bindings of the concerto-wasm module (concerto-rust
 * concerto-wasm/src/lib.rs) that the public classes call, as
 * `loadEngine('./engine').rust` exposes them.
 */
export interface EngineBindings {
    // ModelUtil
    modelUtilGetShortName(fqn: string): string;
    modelUtilGetNamespace(fqn: string): string;
    /** The parsed namespace, packed as `N<name>`, or `V`/`I` then `@`-separated parts. */
    modelUtilParseNamespaceChecked(ns: string, options?: object): string;
    modelUtilImportFullyQualifiedNames(imp: object): string[];
    modelUtilIsPrimitiveType(typeName: string): boolean;
    modelUtilIsAssignableTo(modelFile: object, typeName: string, property: object): boolean;
    modelUtilCapitalizeFirstLetter(value: string): string;
    modelUtilIsEnum(field: object): boolean;
    modelUtilIsMap(field: object): boolean;
    modelUtilIsScalar(field: object): boolean;
    modelUtilIsValidIdentifier(name: unknown): boolean;
    modelUtilGetFullyQualifiedName(namespace: string, type: string): string;
    modelUtilRemoveNamespaceVersionFromFullyQualifiedName(fqn: string): string;
    modelUtilIsSystemProperty(propertyName: string): boolean;
    modelUtilIsPrivateSystemProperty(propertyName: string): boolean;
    modelUtilIsValidMapKey(key: object): boolean;
    modelUtilIsValidMapKeyScalar(decl: object): boolean;
    modelUtilIsValidMapValue(value: object): boolean;

    // DecoratorManager
    decoratorManagerMigrateTo(decoratorCommandSet: object): object;
    decoratorManagerFalsyOrEqual(test: string | string[] | null, values: string[]): boolean;
    /** The property's decorators after the command, to assign onto it. */
    decoratorManagerExecutePropertyCommand(property: object, command: object): object;

    // ModelManager / ModelFile
    ModelManagerHandle: new () => EngineHandle;
    modelFileIsCompatibleVersion(modelFile: object): void;
    modelFileEnforceImportVersioning(imp: object): void;
    modelFileFromAstHeader(modelFile: object, ast: object): void;

    // Serializer fast paths (JSON text in, JSON text out)
    populatorConvertPrimitive(type: string, valueJson: string, optionsJson: string, path: string): string;
    generatorConvertPrimitive(type: string, valueJson: string, optionsJson: string): string;
    resourceValidatorPrimitiveValid(type: string, valueJson: string): boolean;

    // Introspection
    decoratedFindDuplicateName(names: string[]): string | null;
    /** The decorator's processed arguments, to assign onto it. */
    decoratorProcess(ast: object, decorator: object): object;
    decoratorValidate(decorator: object, modelFile: object, decoratedName: string | undefined): void;
    enumDeclarationToString(fqn: string): string;
    classDeclarationResolveSuperType(classDeclaration: object): ClassDeclaration | null;
    classDeclarationIdentifierRedeclareConflict(systemIdentified: boolean, superSystemIdentified: boolean, superExplicitlyIdentified: boolean): boolean;
    classDeclarationGetSuperType(classDeclaration: object): string | null;
    classDeclarationGetSuperTypeDeclaration(classDeclaration: object): ClassDeclaration | null;
    classDeclarationGetAssignableClassDeclarations(classDeclaration: object): ClassDeclaration[];
    classDeclarationGetDirectSubclasses(classDeclaration: object): ClassDeclaration[];
    classDeclarationGetAllSuperTypeDeclarations(classDeclaration: object): ClassDeclaration[];
    classDeclarationGetNestedProperty(classDeclaration: object, propertyPath: string): Property;
    classDeclarationToString(fqn: string, superType: string | null | undefined, abstract: boolean): string;
    classDeclarationIsKind(type: string, kind: string): boolean;
    scalarDeclarationValidate(scalarDeclaration: object): void;
    scalarDeclarationToString(scalarDeclaration: object): string;
    fieldToString(field: object): string;
    propertyValidate(property: object, classDeclaration: object): void;
    relationshipDeclarationValidate(relationship: object, classDeclaration: object): void;
    mapKeyTypeValidate(mapKeyType: object): void;
    mapValueTypeValidate(mapValueType: object): void;

    // Validators: `*New` returns the validator's fields, to assign onto it.
    numberValidatorNew(validator: object, ast: object): object;
    numberValidatorValidate(validator: object, identifier: string | null, value: unknown): void;
    numberValidatorToString(validator: object): string;
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
}

/**
 * The DecoratorManager.extract* result shapes, exactly as the published
 * concerto-core 5.0.0 declared them (its compiler inferred `never[]` from the
 * TS bodies' `[]` initialisers, so the arrays keep that element type).
 */
export interface ExtractDecoratorsResult {
    modelManager: ModelManager;
    decoratorCommandSet: never[];
    vocabularies: never[];
}

/**
 * The rust-mode view functions (src/engine/views.ts) DecoratorManager calls,
 * as `loadEngine('./engine/views')` exposes them.
 */
export interface EngineViews {
    decoratorManagerValidate(validationModelManager: object, decoratorCommandSet: object, modelFiles?: object[]): void;
    decoratorManagerDecorateModels(modelManager: object, decoratorCommandSets: object[], options?: object): ModelManager;
    decoratorManagerExtractDecorators(modelManager: object, options: object): ExtractDecoratorsResult;
    decoratorManagerExtractVocabularies(modelManager: object, options: object): { modelManager: ModelManager; vocabularies: never[] };
    decoratorManagerExtractNonVocabDecorators(modelManager: object, options: object): { modelManager: ModelManager; decoratorCommandSet: never[] };
}
