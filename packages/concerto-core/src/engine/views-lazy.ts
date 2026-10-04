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

// The lazily built parts of a lazy file's views: its `declarations` and
// `localTypes`, a declaration view built alone (`localType`), and each
// element's decorators, validators and map key and value, deferred to
// their first read. Also the fuzz harness's hook (`installLazyViewsCheck`).

import { rust } from './index';
import { batchOf, computeBatch, withBatch } from './views-batch';
import { collectionSizeValidatorModule, decoratorModule, numberValidatorModule, stringValidatorModule } from './views-modules';
import { deferredOf, fileState, isLazy, stateOf } from './views-state';

/** The hook the fuzz harness installs to build every deferred part eagerly. */
interface LazyViewsCheck {
    /** After `applyStagedFileHeader` applied a staged header. */
    stagedFileHeader(modelFile: any, ast: any): void;
    /** After a staged header recorded the import names. */
    importNames(modelFile: any): void;
    /** After `deferDeclarations` deferred the declaration views. */
    deferred(modelFile: any): void;
}

/** The installed check, or null (always, outside the fuzz harness). */
let lazyViewsCheck: LazyViewsCheck | null = null;

/** The installed check, or null. */
function installedLazyViewsCheck(): LazyViewsCheck | null {
    return lazyViewsCheck;
}

/** Installs (or, with null, removes) the fuzz harness's lazy-views check. */
/* istanbul ignore next: the fuzz harness's hook (migration/fuzz/lib/lazy-views-check.js); the library never installs it */
function installLazyViewsCheck(check: LazyViewsCheck | null): void {
    lazyViewsCheck = check;
}

/**
 * Builds a lazy file's `declarations` and `localTypes` as its constructor
 * would; if that throws, both are deferred again so every access throws.
 */
function materialise(modelFile: any): void {
    const thunks = pendingFields.get(modelFile)!;
    thunks.delete('declarations');
    thunks.delete('localTypes');
    defineOwn(modelFile, 'declarations', []);
    defineOwn(modelFile, 'localTypes', null);
    const state = stateOf(modelFile)!;
    const deferred = state.deferred!;
    deferred.building = true;
    try {
        if (modelFile.ast.declarations) {
            modelFile._fromAstDeclarations(modelFile.ast);
        }
    } catch (e) {
        // Defensive: the engine's load rejects every model whose declarations'
        // TS construction throws (the fuzz harness checks it).
        deferModelFileFields(modelFile);
        throw e;
    } finally {
        deferred.building = false;
    }
    state.deferred = undefined;
    const localTypes = new Map();
    const namespace = modelFile.getNamespace();
    for (const declaration of modelFile.declarations) {
        localTypes.set(namespace + '.' + declaration.getName(), declaration);
    }
    modelFile.localTypes = localTypes;
}

/**
 * The pending builder of a lazy file's `declarations`, called with the file as `this`.
 * @this {object} the ModelFile
 */
function buildModelFileDeclarations(this: any): any {
    materialise(this);
    return this.declarations;
}

/**
 * The pending builder of a lazy file's `localTypes`.
 * @this {object} the ModelFile
 */
function buildModelFileLocalTypes(this: any): any {
    materialise(this);
    return this.localTypes;
}

/** Defers a ModelFile's `declarations` and `localTypes` (`installLazyField`). */
function deferModelFileFields(modelFile: any): void {
    deferField(modelFile, 'declarations', buildModelFileDeclarations);
    deferField(modelFile, 'localTypes', buildModelFileLocalTypes);
}

/** Defers the declaration views of a file `stageModelFile` staged. */
function deferDeclarations(modelFile: any): void {
    fileState(modelFile).deferred = { byName: undefined, built: undefined, building: false, batch: undefined };
    deferModelFileFields(modelFile);
    lazyViewsCheck?.deferred(modelFile);
}

/** The metamodel classes `ModelFile._declarationView` builds a view for. */
const DECLARATION_CLASSES = new Set([
    'AssetDeclaration', 'TransactionDeclaration', 'EventDeclaration', 'ParticipantDeclaration',
    'EnumDeclaration', 'MapDeclaration', 'ConceptDeclaration', 'BooleanScalar', 'IntegerScalar',
    'LongScalar', 'DoubleScalar', 'StringScalar', 'DateTimeScalar',
].map((name) => `concerto.metamodel@1.0.0.${name}`));

/**
 * The `localTypes` key of each declaration, or null when one is not a plain
 * declaration with a string name and known class (every view is then built).
 */
function declarationIndex(ast: any, namespace: string): Map<string, number> | null {
    const declarations = ast?.declarations;
    const byName = new Map<string, number>();
    if (declarations === undefined || declarations === null) {
        return byName;
    }
    if (!Array.isArray(declarations)) {
        return null;
    }
    for (let i = 0; i < declarations.length; i++) {
        const node = declarations[i];
        if (!node || typeof node !== 'object' || typeof node.name !== 'string' ||
            !DECLARATION_CLASSES.has(node.$class)) {
            return null;
        }
        // A later declaration of the same name replaces an earlier one.
        byName.set(namespace + '.' + node.name, i);
    }
    return byName;
}

/**
 * `ModelFile.getLocalType` for a lazy file: builds only the view asked for,
 * once. Null when the file declares no such type; undefined when the caller
 * must answer itself. Throws as `getLocalType` does during construction.
 */
function localType(modelFile: any, type: string): any {
    const deferred = deferredOf(modelFile);
    if (!deferred) {
        return undefined;
    }
    if (deferred.building) {
        throw new Error('Internal error: local types are not yet initialized. Do not try to resolve types inside `process`.');
    }
    const namespace = modelFile.getNamespace();
    if (deferred.byName === undefined) {
        deferred.byName = declarationIndex(modelFile.ast, namespace);
    }
    if (deferred.byName === null) {
        return undefined;
    }
    const key = type.startsWith(namespace) ? type : namespace + '.' + type;
    const index = deferred.byName.get(key);
    if (index === undefined) {
        return null;
    }
    const node = modelFile.ast.declarations[index];
    const cached = deferred.built?.get(index);
    if (cached && cached.node === node) {
        return cached.view;
    }
    if (deferred.batch === undefined) {
        deferred.batch = computeBatch(modelFile, modelFile.ast);
    }
    deferred.building = true;
    let view;
    try {
        view = withBatch(deferred.batch, () => modelFile._declarationView(node));
    } finally {
        deferred.building = false;
    }
    (deferred.built ??= new Map()).set(index, { node, view });
    return view;
}

/** The view `localType` already built for declaration `index` from `node`, if any. */
function builtDeclaration(modelFile: any, index: number, node: any): any {
    const cached = deferredOf(modelFile)?.built?.get(index);
    return cached && cached.node === node ? cached.view : undefined;
}

// Lazily built parts of a lazy file's views: decorators, validators, a
// MapDeclaration's `key` and `value`. Each is deferred only when the view
// snapshot proves building it cannot throw; anything else is built where TS
// 5.0.0 builds it. A read replaces the prototype accessor with an own field;
// a builder that throws stays pending, so every later read throws again.

/** The pending builders of each element's deferred parts, by field name. */
const pendingFields = new WeakMap<object, Map<string, (this: any) => any>>();

/** Stores `value` as `target`'s own plain field `key`. */
function defineOwn(target: any, key: string, value: any): void {
    Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
}

/**
 * Installs the accessor for `key` on `proto`: a read builds the deferred
 * value (or keeps `initial()`), a write stores an own field. With
 * `buildOnWrite`, a write to a pending field builds it first.
 */
function installLazyField(proto: object, key: string, initial?: () => any, buildOnWrite?: boolean): void {
    Object.defineProperty(proto, key, {
        configurable: true,
        enumerable: false,
        get(this: any) {
            if (this === proto) {
                return undefined;
            }
            const thunks = pendingFields.get(this);
            const thunk = thunks?.get(key);
            if (thunk === undefined) {
                if (!initial) {
                    return undefined;
                }
                const value = initial();
                defineOwn(this, key, value);
                return value;
            }
            thunks!.delete(key);
            let value;
            try {
                value = thunk.call(this);
            } catch (e) {
                if (Object.prototype.hasOwnProperty.call(this, key)) {
                    delete this[key];
                }
                thunks!.set(key, thunk);
                throw e;
            }
            defineOwn(this, key, value);
            return value;
        },
        set(this: any, value: any) {
            if (buildOnWrite && pendingFields.get(this)?.has(key) === true) {
                void this[key];
            }
            pendingFields.get(this)?.delete(key);
            defineOwn(this, key, value);
        },
    });
}

/** Defers `target`'s field `key`: `build` makes its value on first read. */
function deferField(target: any, key: string, build: (this: any) => any): void {
    // Clear an own field left by an earlier `process()`.
    delete target[key];
    let thunks = pendingFields.get(target);
    if (!thunks) {
        thunks = new Map();
        pendingFields.set(target, thunks);
    }
    thunks.set(key, build);
}

/** A Decorator rebuilt from its `decoratorProcess` snapshot `{n, a}`. */
function decoratorFromSnapshot(element: any, ast: any, entry: any): any {
    const { Decorator } = decoratorModule();
    const decorator = Object.create(Decorator.prototype);
    decorator.ast = ast;
    decorator.parent = element;
    decorator.arguments = entry.a.map((a: any) => (a !== null && typeof a === 'object'
        ? { type: a.type, name: a.name, array: a.array }
        : a));
    decorator.name = entry.n;
    return decorator;
}

/** `Decorated.process`'s decorator loop for a deferred `decorators`. */
function buildDecorators(element: any, nodes: any[], snapshot: any[] | undefined): any[] {
    const list: any[] = [];
    defineOwn(element, 'decorators', list);
    for (let n = 0; n < nodes.length; n++) {
        const thing = nodes[n];
        let decorator;
        const entry = snapshot?.[n];
        if (entry) {
            decorator = decoratorFromSnapshot(element, thing, entry);
        } else {
            const { Decorator } = decoratorModule();
            decorator = new Decorator(element, thing);
        }
        list.push(decorator);
    }
    return list;
}

/**
 * Defers an element's `decorators` when its file is lazy and every node is
 * an object; false when the caller builds them now.
 */
function deferDecorators(element: any): boolean {
    const nodes = element.ast.decorators;
    if (!Array.isArray(nodes) || nodes.length === 0) {
        return false;
    }
    for (let n = 0; n < nodes.length; n++) {
        const node = nodes[n];
        if (node === null || typeof node !== 'object') {
            return false;
        }
    }
    let modelFile;
    try {
        modelFile = element.getModelFile();
    } catch (e) {
        // The caller's own call raises it, at the same point.
        return false;
    }
    if (!isLazy(modelFile)) {
        return false;
    }
    const snapshot = batchOf(modelFile)?.decorators.get(nodes);
    deferField(element, 'decorators', () => buildDecorators(element, nodes, snapshot));
    return true;
}

/** `getDecoratorFactories()` for an element: none for a lazy file. */
function decoratorFactories(modelFile: any): any[] | undefined {
    if (isLazy(modelFile)) {
        return [];
    }
    return modelFile.getModelManager()?.getDecoratorFactories();
}

/** Whether `element`'s model file is lazily built. */
function inLazyFile(element: any): boolean {
    const modelFile = element.modelFile ?? element.parent?.modelFile;
    return modelFile !== undefined && isLazy(modelFile);
}

/** A NumberValidator rebuilt from its snapshot `{lowerBound, upperBound}`. */
function numberValidatorFromSnapshot(element: any, snapshot: any): any {
    const { NumberValidator } = numberValidatorModule();
    const validator = Object.create(NumberValidator.prototype);
    validator.validator = element.ast.validator;
    validator.field = element;
    validator.lowerBound = snapshot.lowerBound;
    validator.upperBound = snapshot.upperBound;
    return validator;
}

/** A StringValidator rebuilt from its snapshot `{minLength, maxLength}`. */
function stringValidatorFromSnapshot(element: any, regexAst: any, snapshot: any): any {
    const { StringValidator } = stringValidatorModule();
    const validator = Object.create(StringValidator.prototype);
    validator.validator = regexAst;
    validator.field = element;
    validator.minLength = snapshot.minLength;
    validator.maxLength = snapshot.maxLength;
    validator.regex = regexAst ? new RegExp(regexAst.pattern, regexAst.flags) : null;
    return validator;
}

/** A CollectionSizeValidator rebuilt from its snapshot `{minSize, maxSize}`. */
function sizeValidatorFromSnapshot(property: any, ast: any, snapshot: any): any {
    const { default: CollectionSizeValidator } = collectionSizeValidatorModule();
    const validator = Object.create(CollectionSizeValidator.prototype);
    validator.validator = ast;
    validator.field = property;
    validator.minSize = snapshot.minSize;
    validator.maxSize = snapshot.maxSize;
    return validator;
}

/**
 * `MapDeclaration.process`'s key and value types: deferred in a lazy file
 * when the snapshot has the map; else built now, after the
 * `mapDeclarationProcess` check when the snapshot lacks it.
 */
function mapDeclarationProcess(view: any, buildKey: () => any, buildValue: () => any): void {
    const current = batchOf(view.modelFile);
    if (!current || !current.maps.has(view.ast)) {
        rust.mapDeclarationProcess(view);
    } else if (isLazy(view.modelFile)) {
        deferField(view, 'key', () => withBatch(current, buildKey));
        deferField(view, 'value', () => withBatch(current, buildValue));
        return;
    }
    view.key = buildKey();
    view.value = buildValue();
}

/** `MapKeyType.process`'s type: from the view snapshot, else the binding. */
function mapKeyTypeProcess(view: any): string {
    const type = batchOf(view.modelFile)?.mapTypes.get(view.ast);
    return type !== undefined ? type : rust.mapKeyTypeProcess(view);
}

/** `MapValueType.process`'s type: from the view snapshot, else the binding. */
function mapValueTypeProcess(view: any): string {
    const type = batchOf(view.modelFile)?.mapTypes.get(view.ast);
    return type !== undefined ? type : rust.mapValueTypeProcess(view);
}

/** Builds every deferred part of a lazy file, for the fuzz harness. */
/* istanbul ignore next: called by the fuzz harness's hook only (migration/fuzz/lib/lazy-views-check.js) */
function buildDeferredParts(modelFile: any): void {
    const touch = (element: any, keys: string[]) => {
        for (const key of keys) {
            // eslint-disable-next-line no-unused-expressions
            element[key];
        }
    };
    touch(modelFile, ['decorators']);
    for (const declaration of modelFile.declarations) {
        touch(declaration, ['decorators', 'validator', 'key', 'value']);
        if (declaration.key) {
            touch(declaration.key, ['decorators']);
        }
        if (declaration.value) {
            touch(declaration.value, ['decorators']);
        }
        for (const property of declaration.properties ?? []) {
            touch(property, ['decorators', 'validator', 'sizeValidator']);
        }
    }
}

export {
    buildDeferredParts,
    builtDeclaration,
    decoratorFactories,
    deferDeclarations,
    deferDecorators,
    deferField,
    inLazyFile,
    installLazyField,
    installLazyViewsCheck,
    installedLazyViewsCheck,
    localType,
    mapDeclarationProcess,
    mapKeyTypeProcess,
    mapValueTypeProcess,
    materialise,
    numberValidatorFromSnapshot,
    sizeValidatorFromSnapshot,
    stringValidatorFromSnapshot,
};
