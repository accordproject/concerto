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

// Property lookups, identifier field names and the arena handles of views.

import { rust } from './index';
import type { EngineHandle, EngineState } from './bindings';
import { modelFileModule } from './views';

// ---------------------------------------------------------------------------
// Property lookups: a ClassDeclaration view's `getProperties()` list, and
// `getProperty()`'s name index over it, are cached per view. A miss runs the
// `classDeclarationGetProperties` binding, so every error is raised by the
// same call; the super type's `getProperties()` call it makes comes back
// through here and is recorded, so the entry knows which view and entry
// supplied the inherited part. An entry is reused only while:
// - its manager's engine state is at the same model version;
// - the view's own properties array, its length, `superType` and
//   `modelFile` are unchanged;
// - the super type's view still holds the entry it was built from, and that
//   entry is itself still reusable.
// Only views of files the ModelFile constructor built are cached.
//
// `getProperties()` returns a new array on every call, as TS 5.0.0 did; the
// Property objects in it are the views themselves (BC-23).
// ---------------------------------------------------------------------------

/**
 * `manager`'s engine state (`BaseModelManager._engine`), or
 * undefined for anything else.
 */
function engineStateOf(manager: any): EngineState | undefined {
    return typeof manager === 'object' && manager !== null ? manager._engine : undefined;
}

/** One ClassDeclaration view's cached `getProperties()` list. */
interface PropertyLookup {
    /** Its manager's engine state when it was built. */
    state: EngineState | undefined;
    /** That state's model version then. */
    version: number;
    /** The own properties array (`getOwnProperties()`, `properties`) it was built from. */
    own: any[];
    /** That array's length then. */
    ownLength: number;
    /** The view's `superType` then. */
    superType: any;
    /** The view's `modelFile` then. */
    modelFile: any;
    /** The super type's view that supplied the inherited part, or null. */
    superView: any;
    /** That view's entry the inherited part was copied from, or null. */
    superEntry: PropertyLookup | null;
    /** The list: own properties, then the super type's. Never handed out. */
    list: any[];
    /** The first property of each name in `list`, built on first `getProperty`. */
    byName?: Map<string, any>;
}

const propertyLookups = new WeakMap<object, PropertyLookup>();

/** A `getProperties()` call the binding made while an entry was being built. */
interface LookupCall {
    view: any;
    result: any[];
}

/** The entries being built, innermost last, with the calls each one made. */
const lookupFrames: LookupCall[][] = [];

/**
 * Whether `view`'s property lookups may be cached: its model file was built
 * by the ModelFile constructor (`ModelFile._isConstructed`), which accepts
 * only a BaseModelManager (BC-47).
 */
function lookupCacheable(view: any): boolean {
    return modelFileModule().default._isConstructed(view?.modelFile);
}

/**
 * Whether `entry` is still `view`'s answer (see the section comment).
 * @return {boolean} true if it may be reused
 */
function lookupValid(view: any, entry: PropertyLookup): boolean {
    const state = engineStateOf(view.modelFile?.modelManager);
    if (state !== entry.state || state === undefined || entry.version !== state.version || view.superType !== entry.superType ||
        view.modelFile !== entry.modelFile || view.properties !== entry.own) {
        return false;
    }
    const own = view.getOwnProperties();
    if (own !== entry.own || own.length !== entry.ownLength) {
        return false;
    }
    if (entry.superView === null) {
        return true;
    }
    return propertyLookups.get(entry.superView) === entry.superEntry && lookupValid(entry.superView, entry.superEntry!);
}

/** `view`'s cached entry, if it may be reused, else undefined. */
function validLookup(view: any): PropertyLookup | undefined {
    const entry = propertyLookups.get(view);
    if (entry === undefined) {
        return undefined;
    }
    if (lookupValid(view, entry)) {
        return entry;
    }
    propertyLookups.delete(view);
    return undefined;
}

/**
 * The entry for a list the binding just returned, or undefined when it
 * cannot be cached: the own properties are not the view's `properties`
 * array, or, with a super type, the inherited part did not come from
 * exactly one recorded `getProperties()` call of a cached view.
 * @param {any[]} own the own properties array before the call
 * @param {object} state the view's `superType` and `modelFile`, and its
 * manager's engine state and that state's model version, before the call
 * @param {object[]} calls the `getProperties()` calls it made
 */
function newLookup(view: any, own: any, state: { superType: any; modelFile: any; engine: EngineState | undefined; version: number },
    list: any, calls: LookupCall[]): PropertyLookup | undefined {
    if (!Array.isArray(own) || view.properties !== own || view.superType !== state.superType ||
        view.modelFile !== state.modelFile || !Array.isArray(list) || state.engine === undefined ||
        state.engine !== engineStateOf(view.modelFile.modelManager) || state.version !== state.engine.version) {
        return undefined;
    }
    const ownLength = own.length;
    let superView: any = null;
    let superEntry: PropertyLookup | null = null;
    if (state.superType !== null) {
        superView = calls[0].view;
        superEntry = propertyLookups.get(superView) ?? null;
    }
    // The binding returns `own`, then, with a super type, what its one
    // recorded call (the super type's view; a circular chain is rejected at
    // load) returned. A super type view with no entry of its own makes this
    // entry invalid at its next use.
    return {
        state: state.engine,
        version: state.version,
        own,
        ownLength,
        superType: state.superType,
        modelFile: state.modelFile,
        superView,
        superEntry,
        list: list.slice(),
    };
}

/**
 * `ClassDeclaration.getProperties`: a copy of the cached list, or the
 * `classDeclarationGetProperties` binding's answer, cached when it can be.
 * Throws what the binding throws.
 * @return {object[]} the properties, own first, then the super type's
 */
function classDeclarationGetProperties(view: any): any[] {
    const parent = lookupFrames.length > 0 ? lookupFrames[lookupFrames.length - 1] : undefined;
    const result = propertiesOf(view);
    parent?.push({ view, result });
    return result;
}

/**
 * The body of `classDeclarationGetProperties`, without recording the call
 * in the enclosing frame.
 */
function propertiesOf(view: any): any[] {
    if (!lookupCacheable(view)) {
        return rust.classDeclarationGetProperties(view);
    }
    const cached = validLookup(view);
    if (cached !== undefined) {
        return cached.list.slice();
    }
    const own = view.properties;
    const engine = engineStateOf(view.modelFile.modelManager);
    const state = {
        superType: view.superType,
        modelFile: view.modelFile,
        engine,
        version: engine?.version ?? 0,
    };
    const calls: LookupCall[] = [];
    lookupFrames.push(calls);
    let list;
    try {
        list = rust.classDeclarationGetProperties(view);
    } finally {
        lookupFrames.pop();
    }
    const entry = newLookup(view, own, state, list, calls);
    if (entry !== undefined) {
        propertyLookups.set(view, entry);
    }
    return list;
}

/**
 * `ClassDeclaration.getProperty`: the first property of that name in the
 * cached `getProperties()` list (the own property, else the super type's),
 * or null. When the list cannot be cached or built, the
 * `classDeclarationGetProperty` binding answers and throws what it throws.
 * @return {object|null} the property, or null
 */
function classDeclarationGetProperty(view: any, name: any): any {
    if (typeof name === 'string' && lookupCacheable(view)) {
        let entry = validLookup(view);
        if (entry === undefined) {
            try {
                propertiesOf(view);
                entry = propertyLookups.get(view);
            } catch (e) {
                // The binding below raises its own error, if any.
                entry = undefined;
            }
        }
        if (entry !== undefined) {
            let byName = entry.byName;
            if (byName === undefined) {
                byName = new Map();
                for (const property of entry.list) {
                    const key = property.getName();
                    if (!byName.has(key)) {
                        byName.set(key, property);
                    }
                }
                entry.byName = byName;
            }
            const property = byName.get(name);
            return property === undefined ? null : property;
        }
    }
    return rust.classDeclarationGetProperty(view, name);
}

// ---------------------------------------------------------------------------
// Identifier field names: `ClassDeclaration.getIdentifierFieldName()` is
// cached per view, for the calls Factory, Serializer and ResourceValidator
// repeat. A miss runs `classDeclarationGetIdentifierFieldNameWalk`, which
// walks the super types in one call and returns every declaration it read
// and whether it ran without calling back; only then is the answer kept,
// for views of constructed model files. It is reused only while each
// manager on the way is at the same model version and every declaration in
// the chain has the same `idField`, `superType`, `superTypeDeclaration`,
// `modelFile` and manager. A call that throws keeps nothing. Replacing a
// ClassDeclaration method the walk reaches is not supported (BC-50).
// ---------------------------------------------------------------------------

/** One declaration of a cached identifier walk, as it was read. */
interface IdentifierLevel {
    view: any;
    idField: any;
    superType: any;
    superTypeDeclaration: any;
    modelFile: any;
    manager: any;
    /** The manager's engine state then, and its model version. */
    state: EngineState;
    version: number;
}

/** One ClassDeclaration view's cached `getIdentifierFieldName()` answer. */
interface IdentifierEntry {
    /** The declarations the walk read, the view first. */
    levels: IdentifierLevel[];
    value: any;
}

const identifierEntries = new WeakMap<object, IdentifierEntry>();

/** `view` as the walk read it. */
function identifierLevel(view: any): IdentifierLevel {
    // The walk's declarations are views of files of the asking view's
    // BaseModelManager.
    const manager = view.modelFile.modelManager;
    const state = engineStateOf(manager)!;
    return {
        view,
        idField: view.idField,
        superType: view.superType,
        superTypeDeclaration: view.superTypeDeclaration,
        modelFile: view.modelFile,
        manager,
        state,
        version: state.version,
    };
}

/**
 * Whether `entry` is still its view's answer (see the section comment).
 * @return {boolean} true if it may be reused
 */
function identifierValid(entry: IdentifierEntry): boolean {
    for (const level of entry.levels) {
        const view = level.view;
        if (level.version !== level.state.version || view.idField !== level.idField || view.superType !== level.superType ||
            view.superTypeDeclaration !== level.superTypeDeclaration || view.modelFile !== level.modelFile ||
            level.modelFile.modelManager !== level.manager || level.manager._engine !== level.state) {
            return false;
        }
    }
    return true;
}

/**
 * `ClassDeclaration.getIdentifierFieldName`: the cached answer, or the
 * `classDeclarationGetIdentifierFieldNameWalk` binding's, cached when it can
 * be. Throws what the binding throws.
 * @return {string|null} the name of the identifying field, or null
 */
function classDeclarationGetIdentifierFieldName(view: any): any {
    const cacheable = lookupCacheable(view);
    if (cacheable) {
        const entry = identifierEntries.get(view);
        if (entry !== undefined) {
            if (identifierValid(entry)) {
                return entry.value;
            }
            identifierEntries.delete(view);
        }
    }
    const state = engineStateOf(view.modelFile?.modelManager);
    const version = state?.version;
    const result = rust.classDeclarationGetIdentifierFieldNameWalk(view);
    const value = result[0];
    if (cacheable && result[1] === true && state !== undefined && version === state.version) {
        const levels: IdentifierLevel[] = [];
        for (let n = 2; n < result.length; n++) {
            levels.push(identifierLevel(result[n]));
        }
        identifierEntries.set(view, { levels, value });
    }
    return value;
}

// ---------------------------------------------------------------------------
// Arena handles of views (BC-52)
//
// `ModelUtil.isAssignableTo`, `isEnum`, `isMap`, `isScalar`,
// `isValidMapKeyScalar`, `ScalarDeclaration.validate`, `Decorator.validate`
// and `ClassDeclaration.getAssignableClassDeclarations`/`getDirectSubclasses`
// are answered from the engine's arena by the handle of the model file or
// declaration given, so a replaced `getType`, `getSuperType` or
// `getModelFiles` is not called. A model file has a handle when it is the one
// its manager registered for its namespace, and a declaration when its file
// has one and it is that file's `getLocalType(name)`; a declaration keeps it
// for the model version, in a non-enumerable `_engineId` field.
//
// A model file outside the arena resolves no type (`isEnum`, `isMap` and
// `isScalar` answer undefined, `isAssignableTo` finds none); for a
// declaration outside it the other members throw a TypeError (`notInArena`).
// ---------------------------------------------------------------------------

/** A view's arena handle, as its manager's engine held it at one version. */
interface EngineId {
    /** The manager's engine state when the handle was looked up. */
    state: EngineState;
    /** That state's model version then. */
    version: number;
    /** The manager's engine handle then. */
    handle: EngineHandle;
    /** The view's handle in it, or undefined when it has none. */
    id: number | undefined;
}

/** An arena handle and the engine handle it belongs to. */
interface ArenaRef {
    handle: EngineHandle;
    id: number;
}

/**
 * The handle of a ModelFile view in its manager's engine handle: defined
 * when the file is the one its manager registered for its namespace.
 * @return {object|undefined} the engine handle and the file's handle
 */
function modelFileArenaRef(modelFile: any): ArenaRef | undefined {
    if (typeof modelFile?._rustHandleId !== 'function') {
        return undefined;
    }
    const id = modelFile._rustHandleId();
    return id === undefined ? undefined : { handle: modelFile.modelManager.rustHandle, id };
}

/**
 * A view's cached handle, or `lookup`'s, cached for the manager's current
 * model version and engine handle.
 * @param {function} lookup finds the handle, or undefined
 * @return {object|undefined} the engine handle and the view's handle
 */
function cachedArenaRef(view: any, manager: any, lookup: () => number | undefined): ArenaRef | undefined {
    const state: EngineState = manager._engine;
    const handle: EngineHandle = manager.rustHandle;
    let entry: EngineId | undefined = view._engineId;
    if (!entry || entry.state !== state || entry.version !== state.version || entry.handle !== handle) {
        entry = { state, version: state.version, handle, id: lookup() };
        Object.defineProperty(view, '_engineId', { value: entry, writable: true, enumerable: false, configurable: true });
    }
    return entry.id === undefined ? undefined : { handle, id: entry.id };
}

/**
 * The handle of a declaration view in its manager's engine handle: defined
 * when its model file is registered (`modelFileArenaRef`) and the view is
 * that file's own declaration of its name.
 * @return {object|undefined} the engine handle and the declaration's handle
 */
function declarationArenaRef(declaration: any): ArenaRef | undefined {
    const modelFile = declaration?.modelFile;
    if (modelFileArenaRef(modelFile) === undefined) {
        return undefined;
    }
    const manager = modelFile.modelManager;
    return cachedArenaRef(declaration, manager, () => (
        typeof declaration.name === 'string' && modelFile.getLocalType(declaration.name) === declaration
            ? manager.rustHandle.declarationId(declaration.fqn)
            : undefined));
}

/**
 * The error a BC-52 member raises for a declaration or model file with no
 * arena handle (a detached ModelFile's, or a stand-in object).
 * @param {string} member the member, e.g. `ModelUtil.isAssignableTo`
 */
function notInArena(member: string): TypeError {
    return new TypeError(`${member} expects model elements of a ModelFile registered in its ModelManager`);
}

/**
 * The views of declarations the engine named by fully qualified name, each
 * looked up in the model file `manager` registered for its namespace, as
 * `ModelFile.getType` maps the names `modelFileGetTypeName` returns.
 */
function declarationViews(manager: any, names: string[]): any[] {
    return names.map((name) => manager.modelFiles[name.substring(0, name.lastIndexOf('.'))].getLocalType(name));
}

export {
    classDeclarationGetIdentifierFieldName,
    classDeclarationGetProperties,
    classDeclarationGetProperty,
    declarationArenaRef,
    declarationViews,
    modelFileArenaRef,
    notInArena,
};
