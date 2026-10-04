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
import { modelFileModule } from './views-modules';

// Property lookups: a ClassDeclaration view's `getProperties()` list and
// `getProperty()`'s name index are cached per view of a constructed file. A
// miss runs `classDeclarationGetProperties`, so errors come from the same
// call, and records the super type's `getProperties()` call it makes. An
// entry is reused only while the model version, the view's properties
// array and length, `superType` and `modelFile` are unchanged and the super
// type's entry is itself still valid. `getProperties()` returns a new array
// each call, of the views themselves (BC-23).

/** `manager`'s engine state (`BaseModelManager._engine`), or undefined. */
function engineStateOf(manager: any): EngineState | undefined {
    return typeof manager === 'object' && manager !== null ? manager._engine : undefined;
}

/** One ClassDeclaration view's cached `getProperties()` list and what it was built from. */
interface PropertyLookup {
    state: EngineState | undefined;
    version: number;
    own: any[];
    ownLength: number;
    superType: any;
    modelFile: any;
    /** The super type's view and entry that supplied the inherited part, or null. */
    superView: any;
    superEntry: PropertyLookup | null;
    /** Own properties, then the super type's. Never handed out. */
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

/** Whether `view`'s lookups may be cached: its file was built by the ModelFile constructor (BC-47). */
function lookupCacheable(view: any): boolean {
    return modelFileModule().default._isConstructed(view?.modelFile);
}

/** Whether `entry` is still `view`'s answer (see the section comment). */
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
 * cannot be cached: the own properties are not the view's `properties`, or
 * the inherited part did not come from one recorded call of a cached view.
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
    // A super type view with no entry makes this entry invalid at next use.
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

/** `ClassDeclaration.getProperties`: a copy of the cached list, or the binding's answer. */
function classDeclarationGetProperties(view: any): any[] {
    const parent = lookupFrames.length > 0 ? lookupFrames[lookupFrames.length - 1] : undefined;
    const result = propertiesOf(view);
    parent?.push({ view, result });
    return result;
}

/** `classDeclarationGetProperties` without recording the call in the enclosing frame. */
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
 * cached list, or null; the binding answers when the list cannot be cached.
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

// Identifier field names: `getIdentifierFieldName()` is cached per view.
// A miss runs `classDeclarationGetIdentifierFieldNameWalk`, which returns
// every declaration it read; the answer is kept only if the walk did not
// call back. It is reused while every manager on the way is at the same
// model version and each declaration's `idField`, `superType`,
// `superTypeDeclaration`, `modelFile` and manager are unchanged. Replacing
// a ClassDeclaration method the walk reaches is not supported (BC-50).

/** One declaration of a cached identifier walk, as it was read. */
interface IdentifierLevel {
    view: any;
    idField: any;
    superType: any;
    superTypeDeclaration: any;
    modelFile: any;
    manager: any;
    state: EngineState;
    version: number;
}

/** One ClassDeclaration view's cached `getIdentifierFieldName()` answer. */
interface IdentifierEntry {
    levels: IdentifierLevel[];
    value: any;
}

const identifierEntries = new WeakMap<object, IdentifierEntry>();

/** `view` as the walk read it. */
function identifierLevel(view: any): IdentifierLevel {
    // The walk's declarations all belong to the asking view's manager.
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

/** Whether `entry` is still its view's answer. */
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

/** `ClassDeclaration.getIdentifierFieldName`: the cached answer, or the walk binding's. */
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

// Arena handles of views (BC-52). `ModelUtil.isAssignableTo`, `isEnum`,
// `isMap`, `isScalar`, `isValidMapKeyScalar`, `ScalarDeclaration.validate`,
// `Decorator.validate`, `getAssignableClassDeclarations` and
// `getDirectSubclasses` are answered from the arena by handle, so replaced
// `getType`/`getSuperType`/`getModelFiles` are not called. A file has a
// handle when it is its manager's registered file for the namespace; a
// declaration when its file has one and it is that file's
// `getLocalType(name)`, cached per model version in `_engineId`. Outside
// the arena, file lookups find no type and declaration members throw
// `notInArena`.

/** A view's arena handle, with the engine state, version and handle it was looked up at. */
interface EngineId {
    state: EngineState;
    version: number;
    handle: EngineHandle;
    /** Undefined when the view has none. */
    id: number | undefined;
}

/** An arena handle and the engine handle it belongs to. */
interface ArenaRef {
    handle: EngineHandle;
    id: number;
}

/** A ModelFile view's arena handle, when it is its manager's registered file. */
function modelFileArenaRef(modelFile: any): ArenaRef | undefined {
    if (typeof modelFile?._rustHandleId !== 'function') {
        return undefined;
    }
    const id = modelFile._rustHandleId();
    return id === undefined ? undefined : { handle: modelFile.modelManager.rustHandle, id };
}

/** A view's cached handle, or `lookup`'s, cached for the current version and handle. */
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

/** A declaration view's arena handle, when its file is registered and it is its own declaration. */
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

/** The error a BC-52 member raises for an element with no arena handle. */
function notInArena(member: string): TypeError {
    return new TypeError(`${member} expects model elements of a ModelFile registered in its ModelManager`);
}

/** The declaration views for engine-returned names, as `ModelFile.getType` maps them. */
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
