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

// Property lookups, identifier field names and the arena handles of views
// (P5-14, P5-19, P5-106): split out of views.ts (P5-104, review M7), which
// re-exports them.

import { rust } from './index';
import type { EngineHandle, EngineState } from './bindings';
import { modelFileModule } from './views';

// ---------------------------------------------------------------------------
// Property lookups (P5-14, accordproject/concerto-rust#308): a
// ClassDeclaration view's `getProperties()` list, and the name lookup
// `getProperty()` makes over it, are cached once per view, so repeated calls
// do not cross into the engine again.
//
// A miss runs the `classDeclarationGetProperties` binding exactly as before,
// so every error is raised by the same call. While it runs, the super type's
// `getProperties()` call it makes (TS: `classDecl.getProperties()`) comes
// back through this module and is recorded, so the entry knows which view
// supplied the inherited part and which of that view's entries it copied.
// An entry is reused only while:
// - the view's ModelManager is the one it was built for, at the same model
//   version (`EngineState.version`, P5-100: moved by BaseModelManager at
//   every change of its `modelFiles` map or rustHandle, the points where
//   TS 5.0.0 could resolve a super type differently);
// - the view's own properties array, its length, its `superType` and its
//   `modelFile` are the ones it was built from;
// - the super type's view still holds the entry it was built from, and
//   that entry is itself still reusable.
// Only views of model files the ModelFile constructor built for a real
// BaseModelManager are cached (a stub collaborator's answers can change
// without a model change); anything else calls the binding every time, as
// before.
//
// `getProperties()` returns a new array on every call, as TS 5.0.0 did
// whenever it concatenated a super type's properties, and as the binding did
// on every call: mutating it reaches neither the cache nor the engine. The
// Property objects in it are the views themselves, so identity is unchanged
// (BC-23).
// ---------------------------------------------------------------------------

/**
 * `manager`'s engine state (`BaseModelManager._engine`, P5-100), or
 * undefined for anything else.
 * @param {object} manager the ModelManager
 * @return {object|undefined} its engine state
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
 * only a BaseModelManager (P5-35, BC-47).
 * @param {object} view the ClassDeclaration view
 * @return {boolean} true if cacheable
 */
function lookupCacheable(view: any): boolean {
    return modelFileModule().default._isConstructed(view?.modelFile);
}

/**
 * Whether `entry` is still `view`'s answer (see the section comment).
 * @param {object} view the ClassDeclaration view
 * @param {object} entry its cached entry
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

/**
 * `view`'s cached entry, if it may be reused, else undefined.
 * @param {object} view the ClassDeclaration view
 * @return {object|undefined} the entry
 */
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
 * @param {object} view the ClassDeclaration view
 * @param {any[]} own the own properties array before the call
 * @param {object} state the view's `superType` and `modelFile`, and its
 * manager's engine state and that state's model version, before the call
 * @param {any[]} list what the binding returned
 * @param {object[]} calls the `getProperties()` calls it made
 * @return {object|undefined} the entry
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
    // P5-103: the binding returns `own` (the view's own `getOwnProperties()`)
    // then, for a view with a super type, what its one recorded call (the
    // super type's view, never this one: a circular chain is rejected at
    // load) returned, and makes no call for a view without one; it is
    // pinned in lockstep with this shim, so that is not checked again here.
    // A super type's view with no entry of its own (`superEntry` null) makes
    // this entry invalid at its next use (`lookupValid`).
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
 * `ClassDeclaration.getProperties` (P5-14): a copy of the cached list, or
 * the `classDeclarationGetProperties` binding's answer, cached when it can
 * be. Throws what the binding throws.
 * @param {object} view the ClassDeclaration view
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
 * @param {object} view the ClassDeclaration view
 * @return {object[]} the properties
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
 * `ClassDeclaration.getProperty` (P5-14): the first property of that name in
 * the cached `getProperties()` list, which is the property the binding
 * returns (the own property of that name, else the super type's answer),
 * or null. The list is built (with the binding, as `getProperties()` builds
 * it) when it is not cached; when that is not possible, or it throws, the
 * `classDeclarationGetProperty` binding answers, as before, and throws what
 * it throws.
 * @param {object} view the ClassDeclaration view
 * @param {string} name the property name
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
// Identifier field names (P5-19, accordproject/concerto-rust#317): the
// answer of `ClassDeclaration.getIdentifierFieldName()` is kept per view,
// keyed on the model epoch P5-14 introduced (per manager since F-2), so the
// repeated calls Factory, Serializer and ResourceValidator make
// (`isIdentified()`, `isSystemIdentified()`, `getIdentifierFieldName()`) do
// not cross into the engine again.
//
// A miss runs the `classDeclarationGetIdentifierFieldNameWalk` binding,
// which walks the super types in one call and returns every declaration it
// read, and whether the walk ran without calling back (see the binding's doc
// comment in concerto-wasm). Its answer is kept only when it did, for views
// of model files built for a real BaseModelManager (as P5-14's property
// lookups), and is reused only while:
// - each manager on the way is at the model version it was at
//   (`EngineState.version`, P5-100);
// - every declaration in the chain still has the `idField`, `superType`,
//   `superTypeDeclaration` and `modelFile` it had, and its model file the
//   same manager.
// Anything else calls the binding every time. A call that throws keeps
// nothing. P5-36 (BC-50, accordproject/concerto-rust#346): the walk always
// inlines the ClassDeclaration methods, and replacing a method the walk
// reaches (on the object or its prototype) is not supported, so the cache no
// longer compares them.
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

/**
 * `view` as the walk read it.
 * @param {object} view a declaration of the chain
 * @return {object|undefined} the level
 */
function identifierLevel(view: any): IdentifierLevel {
    // The walk's declarations are views of the model files of the asking
    // view's manager, a BaseModelManager, so each may be cached.
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
 * @param {object} entry the cached entry
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
 * `ClassDeclaration.getIdentifierFieldName` (P5-19): the cached answer, or
 * the `classDeclarationGetIdentifierFieldNameWalk` binding's, cached when it
 * can be. Throws what the binding throws.
 * @param {object} view the ClassDeclaration view
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
// Arena handles of views (P5-106, BC-52; accordproject/concerto-rust#460)
//
// `ModelUtil.isAssignableTo`, `isEnum`, `isMap`, `isScalar` and
// `isValidMapKeyScalar`, `ScalarDeclaration.validate`, `Decorator.validate`
// and `ClassDeclaration.getAssignableClassDeclarations`/`getDirectSubclasses`
// are answered by the engine from its own arena, by the handle of the model
// file or declaration they are given (concerto-wasm "Arena answers"),
// rather than by calling the views' methods back from the engine. A replaced `getType`, `getSuperType` or `getModelFiles` method (on
// a view, a manager or a prototype, e.g. a sinon stub) is therefore not
// called (BC-52). A model file has a handle when it is the one its manager
// has registered for its namespace (`ModelFile._rustHandleId`), and a
// declaration when its model file has one and it is that file's own
// `getLocalType(name)`. A declaration view keeps its handle for as long as
// its manager's model version holds, in a non-enumerable `_engineId` field.
//
// A model file outside the arena (one not registered in its manager, or a
// stand-in such as a sinon stub instance) resolves no type: `isEnum`,
// `isMap` and `isScalar` answer undefined for a field of one, and
// `isAssignableTo` finds no type in one. A declaration outside the arena
// has no answer: `isValidMapKeyScalar`, `ScalarDeclaration.validate`, the
// subclass queries and `Decorator.validate` (with decorator validation on)
// throw a TypeError for it (`notInArena`).
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
 * @param {object} modelFile the ModelFile view
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
 * @param {object} view the declaration view
 * @param {object} manager its ModelManager
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
 * @param {object} declaration the declaration view
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
 * The error a BC-52 member raises for a declaration or model file that has
 * no arena handle: one that is not part of a model file registered in its
 * ModelManager (a detached ModelFile's, or a stand-in object such as a sinon
 * stub instance).
 * @param {string} member the member, e.g. `ModelUtil.isAssignableTo`
 * @return {TypeError} the error
 */
function notInArena(member: string): TypeError {
    return new TypeError(`${member} expects model elements of a ModelFile registered in its ModelManager`);
}

/**
 * The views of declarations the engine named by fully qualified name, each
 * looked up in the model file `manager` registered for its namespace, as
 * `ModelFile.getType` maps the names `modelFileGetTypeName` returns.
 * @param {object} manager the ModelManager
 * @param {string[]} names the fully qualified names
 * @return {object[]} the declaration views
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
