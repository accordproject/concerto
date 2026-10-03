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
// P5-37 (T7, accordproject/concerto-rust#347; I-16 of the P5-26 report on
// #330): the engine calls go to the model manager's own `rustHandle`, the
// live concerto-wasm ModelManagerHandle `BaseModelManager` keeps mirroring
// its `modelFiles` (P4-08, P5-34). There is no second handle: a model
// change costs this module no `addModel` crossing and no `JSON.stringify`
// of any AST. While the manager's own mutators have written `modelFiles`
// ahead of `rustHandle` (`_mirrorPending`, the batch `addModelFiles`), and
// for a model manager without a rustHandle, the visitor path runs instead.
// The class lookups the fast path's results need (`TypeCache`) are still
// cached per model manager, until the set of `ModelFile` *instances* or
// the rustHandle changes.

import { rust } from './index';
import { EngineFastPathUnsupported, encodeValue, decodeValue, decodeParsed, materializeCompact, newTypeCache } from './serializer-codec';
import Factory from '../factory';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type BaseModelManager from '../basemodelmanager';
import type { SerializerOptions } from '../types';
import type { TypeCache } from './serializer-codec';
import type { EngineHandle } from './bindings';
/* eslint-enable no-unused-vars */

interface CachedHandle {
    // The model manager's `rustHandle`.
    handle: EngineHandle;
    // P5-16: the class lookups `materializeTyped` makes for the fast path's
    // results (`TypeCache` in serializer-codec.ts), valid exactly as long
    // as the model files they came from are registered.
    types: TypeCache;
}

/**
 * The model manager's `rustHandle` (concerto-wasm `ModelManagerHandle`),
 * which mirrors every model it holds.
 * @param {BaseModelManager} modelManager the model manager
 * @return {object} the handle
 */
function handleFor(modelManager: BaseModelManager): EngineHandle {
    return cachedHandleFor(modelManager).handle;
}

/**
 * `handleFor`'s answer, with the `TypeCache` that goes with it (P5-16),
 * kept in the manager's engine state (`EngineState.serializerCache`) for
 * its current model version (P5-100, F-3: every change of the manager's
 * model files, or of its rustHandle, moves the version, so the cache no
 * longer compares the ModelFile instances on every call).
 * @param {BaseModelManager} modelManager the model manager
 * @return {object} the cache entry
 */
function cachedHandleFor(modelManager: BaseModelManager): CachedHandle {
    // P5-52 (BC-28, R1): `options.regExp` is ignored, so a model manager
    // built with one no longer leaves the fast path.
    const handle = modelManager.rustHandle;
    if (!handle || typeof handle.serializerToJson !== 'function') {
        throw new EngineFastPathUnsupported('no-rust-handle');
    }
    // The batch `addModelFiles` registers its files in `modelFiles` before
    // it mirrors them (P5-34): until then rustHandle is behind.
    if (modelManager._mirrorPending) {
        throw new EngineFastPathUnsupported('mirror-pending');
    }
    const state = modelManager._engine;
    if (state === undefined) {
        // Not a BaseModelManager's own state: nothing is kept.
        return { handle, types: newTypeCache() };
    }
    const cached = state.serializerCache as (CachedHandle & { version: number }) | undefined;
    if (cached !== undefined && cached.version === state.version && cached.handle === handle) {
        return cached;
    }
    const entry = { version: state.version, handle, types: newTypeCache() };
    state.serializerCache = entry;
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
 * `validateMetaModel(input)` (introspect/metamodel.ts) in one engine call
 * (P5-11, accordproject/concerto-rust#287): validates the metamodel
 * instance `input` as `Serializer.fromJSON` does for a Serializer over
 * `newMetaModelManager()`, without building that model manager, its Factory
 * and its Serializer on every call. P5-102 (F-7,
 * accordproject/concerto-rust#456): the engine runs it on its one resident
 * metamodel manager (`validateMetaModelInstance`, with the `'serializer'`
 * preset: a Serializer's own defaults), so this module keeps no metamodel
 * handle of its own. Throws what the fast path throws, and
 * `EngineFastPathUnsupported` for an input it cannot cross, which the
 * caller then validates through its TS body.
 * @param {object} input the metamodel instance in JSON
 */
function validateMetaModel(input: unknown): void {
    const env = {
        newId: () => Factory.newId(),
        nowMs: () => Date.now(),
    };
    try {
        rust.validateMetaModelInstance(JSON.stringify(encodeValue(input)), 'serializer', env);
    } catch (err) {
        throw asUnsupported(err);
    }
}

// `handleFor` is also used by validate-resource.ts (P5-12c), so instance
// validation uses the same rustHandle.
export { asUnsupported, fastFromJson, fastToJson, handleFor, validateMetaModel };
