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

/* istanbul ignore file */
// Serializer.fromJSON/toJSON's fast path (P4-10; PORTING.md section 5 row
// 6, D7): a single call into the WASM engine's `ModelManagerHandle.
// serializerFromJson`/`serializerToJson` (concerto-wasm/src/lib.rs) rather
// than per field through the TS visitors (JSONPopulator, JSONGenerator,
// ResourceValidator), which keep their shells and stay the fallback path
// (plan §3) -- `serializer.ts` calls this module first and falls back to
// its own body on `EngineFastPathUnsupported`, or on any error the engine
// reports for a shape it cannot cross (`unsupportedValueError` below).
//
// `ModelFile`/`BaseModelManager` are still TS views (P4-08 is not done
// yet), so there is no live Rust ModelManager mirroring the caller's model
// manager to reuse. This module builds one itself, from the model
// manager's own `getModelFiles()` ASTs, and caches it on the model manager
// (a WeakMap) until the set of `ModelFile` *instances* it was built from
// changes -- either because a namespace was added/removed, or because
// `updateModelFile` (or a clear() plus re-add) replaced a `ModelFile`
// object under the same namespace. This is the same cheap-to-check
// invalidation the rest of the engine uses `generation()` for, here done
// by hand since a plain `BaseModelManager` exposes no generation counter
// of its own.

import { MetaModelUtil } from '@accordproject/concerto-metamodel';
import { rust } from './index';
import { EngineFastPathUnsupported, encodeValue, decodeValue, decodeParsed, materializeCompact, newTypeCache, checkString, checkJsonText } from './serializer-codec';
import Factory from '../factory';
import Serializer from '../serializer';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type BaseModelManager from '../basemodelmanager';
import type { SerializerOptions } from '../types';
import type { TypeCache } from './serializer-codec';
/* eslint-enable no-unused-vars */

interface CachedHandle {
    handle: any;
    // The exact ModelFile *instances* (not just their namespaces) the
    // handle was built from, in `getModelFiles()` order. `updateModelFile`
    // (and a clear() plus re-add under the same namespaces) replaces the
    // object in `BaseModelManager#modelFiles` in place, keeping the
    // namespace list identical -- so identity of the ModelFile instances,
    // not just of the namespace strings, is what "declaration count [or
    // content] changed" has to mean here. A plain reference-equality check
    // over the array is as cheap as the namespace check it replaces.
    modelFiles: unknown[];
    // P5-16: the class lookups `materializeTyped` makes for the fast path's
    // results (`TypeCache` in serializer-codec.ts), valid exactly as long
    // as the handle is, since both come from the same ModelFile instances.
    types: TypeCache;
}

const handles = new WeakMap<BaseModelManager, CachedHandle>();

/**
 * A `ModelManagerHandle` (concerto-wasm) with every model `modelManager`
 * currently holds, reused across calls while the model set is unchanged.
 * @param {BaseModelManager} modelManager the model manager to mirror
 * @return {object} the handle
 */
function handleFor(modelManager: BaseModelManager): any {
    return cachedHandleFor(modelManager).handle;
}

/**
 * `handleFor`'s cache entry: the handle and the `TypeCache` that goes with
 * it (P5-16).
 * @param {BaseModelManager} modelManager the model manager to mirror
 * @return {object} the cache entry
 */
function cachedHandleFor(modelManager: BaseModelManager): CachedHandle {
    // P5-52 (BC-28, R1): `options.regExp` is ignored, so a model manager
    // built with one no longer leaves the fast path.
    const modelFiles = modelManager.getModelFiles(false);
    const cached = handles.get(modelManager);
    if (cached && cached.modelFiles.length === modelFiles.length && cached.modelFiles.every((mf, i) => mf === modelFiles[i])) {
        return cached;
    }
    const ModelManagerHandle = (rust as any).ModelManagerHandle;
    const handle = new ModelManagerHandle();
    for (const modelFile of modelFiles) {
        // A lone surrogate in the AST (a string default, a regex) or in the
        // file name cannot cross unchanged (serializer-codec.ts
        // `checkJsonText`): fall back to the visitor path.
        //
        // `getName()` is not guaranteed to be a string: `ModelFile`'s
        // constructor only rejects a *truthy* non-string `fileName`
        // (introspect/modelfile.ts), so a falsy non-string -- `0`, `false`,
        // `NaN` -- is stored and returned as-is (2ab40c9f7, #294). This
        // `handle.addModel` call takes concerto-wasm's `file_name:
        // Option<String>` the same as every other forward guarded there;
        // send only a genuine string, `undefined` otherwise, matching
        // v5.0.0 (which makes no wasm call for a falsy fileName at all).
        const rawName = modelFile.getName();
        const name = typeof rawName === 'string' ? rawName : undefined;
        if (name !== undefined) {
            checkString(name);
        }
        handle.addModel(checkJsonText(JSON.stringify(modelFile.getAst())), name);
    }
    const entry = { handle, modelFiles, types: newTypeCache() };
    handles.set(modelManager, entry);
    return entry;
}

/**
 * An engine call's thrown error as `EngineFastPathUnsupported`, when it
 * names the catalogue's "pre-port" code the codec's own decode errors use
 * for a wire shape it does not recognise (the codec's own throws already
 * are one; this also catches the engine's own `pre-port` throws for a
 * value it could not decode on its side).
 * @param {*} err the error the engine call threw
 * @return {Error} an `EngineFastPathUnsupported` to fall back on, or `err` unchanged
 */
function asUnsupported(err) {
    if (err instanceof EngineFastPathUnsupported) {
        return err;
    }
    if (err && typeof err.message === 'string' && /wire (value|number|map)|typed wire value/.test(err.message)) {
        return new EngineFastPathUnsupported(err.message);
    }
    return err;
}

/**
 * The `env` every `serializerFromJson` call gets (D7: the identifier and
 * the clock stay with the caller, `Factory.newResource`'s own
 * `uuid.v4()`/`dayjs.utc()`). It holds no per-call state, so one object
 * serves every call (P5-16).
 */
const fromJsonEnv = {
    newId: () => Factory.newId(),
    nowMs: () => Date.now(),
};

/**
 * The options objects `optionsText` has encoded: each one's own keys and
 * values at the time, and its wire text (P5-16). A WeakMap, so it never
 * keeps a caller's options object alive.
 */
const encodedOptions = new WeakMap<object, { keys: string[]; values: unknown[]; text: string }>();

/**
 * `JSON.stringify(encodeValue(options))`, reused while `options` is the
 * same object with the same own keys and the same primitive values (P5-16):
 * `Serializer.fromJSON` passes its `defaultOptions` object itself whenever
 * a call gives no options of its own. An options object with a non-primitive
 * value is encoded on every call, since what it holds can change unseen.
 * @param {SerializerOptions} options the merged options
 * @return {string} the options' wire text
 */
function optionsText(options: SerializerOptions): string {
    const isObject = options !== null && typeof options === 'object';
    const last = isObject ? encodedOptions.get(options) : undefined;
    if (last) {
        const keys = Object.keys(options);
        if (keys.length === last.keys.length && keys.every((k, i) => k === last.keys[i] && Object.is(options[k], last.values[i]))) {
            return last.text;
        }
    }
    const text = JSON.stringify(encodeValue(options));
    if (isObject) {
        const keys = Object.keys(options);
        const values = keys.map((k) => options[k]);
        if (values.every((v) => v === null || (typeof v !== 'object' && typeof v !== 'function'))) {
            encodedOptions.set(options, { keys, values, text });
        } else {
            encodedOptions.delete(options);
        }
    }
    return text;
}

/**
 * `Serializer.fromJSON`'s fast path.
 * @param {BaseModelManager} modelManager the model manager
 * @param {object} jsonObject the JSON object to populate
 * @param {SerializerOptions} options the merged options
 * @return {object} the populated resource
 */
function fastFromJson(modelManager: BaseModelManager, jsonObject: unknown, options: SerializerOptions) {
    const cached = cachedHandleFor(modelManager);
    const { handle } = cached;
    // P5-16: the compact result shape where the engine has it (an engine
    // built before it only has `serializerFromJson`).
    const compact = typeof handle.serializerFromJsonCompact === 'function';
    let text;
    try {
        const jsonText = JSON.stringify(encodeValue(jsonObject));
        text = compact
            ? handle.serializerFromJsonCompact(jsonText, optionsText(options), fromJsonEnv)
            : handle.serializerFromJson(jsonText, optionsText(options), fromJsonEnv);
    } catch (err) {
        throw asUnsupported(err);
    }
    // P5-16: decoded in place (the parsed text is ours alone), with the
    // class lookups kept next to the handle.
    const node = JSON.parse(text);
    return compact
        ? materializeCompact(node, modelManager, cached.types)
        : decodeParsed(node, modelManager, cached.types);
}

/**
 * `Serializer.toJSON`'s fast path.
 * @param {BaseModelManager} modelManager the model manager
 * @param {object} resource the resource to serialize
 * @param {SerializerOptions} options the merged options
 * @return {object} the plain JSON object
 */
function fastToJson(modelManager: BaseModelManager, resource: unknown, options: SerializerOptions) {
    const handle = handleFor(modelManager);
    let text;
    try {
        text = handle.serializerToJson(
            JSON.stringify(encodeValue(resource)),
            JSON.stringify(encodeValue(options)),
        );
    } catch (err) {
        throw asUnsupported(err);
    }
    const node = JSON.parse(text);
    return decodeValue(node, modelManager);
}

/**
 * The engine-side model manager `validateMetaModel` validates against: the
 * metamodel alone, as `newMetaModelManager()` holds it (P5-11,
 * accordproject/concerto-rust#287). Built on first use and kept: the
 * metamodel is fixed, and `serializerFromJson` does not change a handle.
 */
let metaModelHandle: any;

/**
 * The options `validateMetaModel`'s Serializer uses: a Serializer's own
 * defaults (`new Serializer(factory, modelManager)` with no options).
 */
let metaModelOptions: unknown;

/**
 * `validateMetaModel(input)` (introspect/metamodel.ts) in one engine call
 * (P5-11, accordproject/concerto-rust#287): validates the metamodel
 * instance `input` as `Serializer.fromJSON` does for a Serializer over
 * `newMetaModelManager()`, without building that model manager, its Factory
 * and its Serializer on every call. Throws what the fast path throws, and
 * `EngineFastPathUnsupported` for an input it cannot cross, which the
 * caller then validates through its TS body.
 * @param {object} input the metamodel instance in JSON
 */
function validateMetaModel(input: unknown): void {
    if (!metaModelHandle) {
        const handle = new (rust as any).ModelManagerHandle();
        handle.addModel(checkJsonText(JSON.stringify(MetaModelUtil.metaModelAst)), 'concerto.metamodel');
        metaModelHandle = handle;
    }
    if (metaModelOptions === undefined) {
        // Serializer's constructor only checks that both are given.
        metaModelOptions = new Serializer({} as any, {} as any).defaultOptions;
    }
    const env = {
        newId: () => Factory.newId(),
        nowMs: () => Date.now(),
    };
    try {
        metaModelHandle.serializerFromJson(
            JSON.stringify(encodeValue(input)),
            JSON.stringify(encodeValue(metaModelOptions)),
            env,
        );
    } catch (err) {
        throw asUnsupported(err);
    }
}

// `handleFor` is also used by validate-resource.ts (P5-12c), so instance
// validation shares the Serializer's cached handle.
export { fastFromJson, fastToJson, handleFor, validateMetaModel };
