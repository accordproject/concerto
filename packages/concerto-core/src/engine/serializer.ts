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

// Serializer.fromJSON/toJSON's fast path: one engine call
// (`serializerFromJsonCompact`/`serializerToJson`) on the model manager's own
// `rustHandle`, rather than per field through the TS visitors
// (JSONPopulator, JSONGenerator, ResourceValidator), which stay the fallback.
// `serializer.ts` falls back on `EngineFastPathUnsupported`: for a value the
// wire cannot carry, a model manager without a rustHandle, or one whose
// mutators have written `modelFiles` ahead of it (`_mirrorPending`). The
// class lookups the results need (`TypeCache`) are cached per model version.

import { rust } from './index';
import { encodeValue, encodeBytes, decodeParsed, materializeCompact, newTypeCache } from './serializer-codec';
import { EngineFastPathUnsupported, isFastPathUnsupported } from './util';
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
    // The class lookups `materializeTyped` makes for the results, valid as
    // long as the model files they came from are registered.
    types: TypeCache;
}

/**
 * The model manager's `rustHandle` (concerto-wasm `ModelManagerHandle`),
 * which mirrors every model it holds.
 */
function handleFor(modelManager: BaseModelManager): EngineHandle {
    return cachedHandleFor(modelManager).handle;
}

/**
 * `handleFor`'s answer with its `TypeCache`, kept in the manager's engine
 * state (`EngineState.serializerCache`) for its current model version.
 */
function cachedHandleFor(modelManager: BaseModelManager): CachedHandle {
    // BC-28: `options.regExp` is ignored, so it does not leave the fast
    // path.
    const handle = modelManager.rustHandle;
        // A model manager that is not a BaseModelManager (the Serializer
        // accepts any object with the methods it calls) has no engine
        // mirror: the visitor path serves it.
    if (!handle) {
        throw new EngineFastPathUnsupported('no-rust-handle');
    }
    // The batch `addModelFiles` registers its files in `modelFiles` before
    // it mirrors them: until then rustHandle is behind.
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
 * An engine call's error as `EngineFastPathUnsupported` when it is a
 * fallback signal (`isFastPathUnsupported`: the codec's own throws, or the
 * engine's flag for a value its wire codec could not decode).
 * @param {*} err the error the engine call threw
 * @return {Error} an `EngineFastPathUnsupported` to fall back on, or `err` unchanged
 */
function asUnsupported(err) {
    if (err instanceof EngineFastPathUnsupported) {
        return err;
    }
    if (isFastPathUnsupported(err)) {
        return new EngineFastPathUnsupported(err.message);
    }
    return err;
}

/**
 * The `env` of every `serializerFromJson` call: the identifier and clock stay
 * with the caller (`Factory.newId`, `Date.now`). Stateless, so shared.
 */
const fromJsonEnv = {
    newId: () => Factory.newId(),
    nowMs: () => Date.now(),
};

/**
 * The options objects `optionsText` has encoded: each one's own keys and
 * values at the time, and its wire text. A WeakMap, so it never keeps a
 * caller's options object alive.
 */
const encodedOptions = new WeakMap<object, { keys: string[]; values: unknown[]; text: string }>();

/**
 * `JSON.stringify(encodeValue(options))`, reused while `options` is the same
 * object with the same own keys and primitive values (`Serializer.fromJSON`
 * passes its `defaultOptions` object when a call gives none). An object with
 * a non-primitive value is encoded every call.
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

/** `Serializer.fromJSON`'s fast path. */
function fastFromJson(modelManager: BaseModelManager, jsonObject: unknown, options: SerializerOptions) {
    const cached = cachedHandleFor(modelManager);
    const { handle } = cached;
    let text;
    try {
        // The document in the compact binary layout where it can be, else
        // as text.
        const bytes = encodeBytes(jsonObject);
        text = bytes !== undefined
            ? handle.serializerFromJsonCompactBytes(bytes, optionsText(options), fromJsonEnv)
            : handle.serializerFromJsonCompact(JSON.stringify(encodeValue(jsonObject)), optionsText(options), fromJsonEnv);
    } catch (err) {
        throw asUnsupported(err);
    }
        // Decoded in place: the parsed text is ours alone.
    return materializeCompact(JSON.parse(text), modelManager, cached.types);
}

/** `Serializer.toJSON`'s fast path. */
function fastToJson(modelManager: BaseModelManager, resource: unknown, options: SerializerOptions) {
    const cached = cachedHandleFor(modelManager);
    const { handle } = cached;
    let text;
    try {
        // The options' wire text is cached (`optionsText`), so the engine
        // reuses the serializer it built for them.
        const bytes = encodeBytes(resource);
        text = bytes !== undefined
            ? handle.serializerToJsonBytes(bytes, optionsText(options))
            : handle.serializerToJson(JSON.stringify(encodeValue(resource)), optionsText(options));
    } catch (err) {
        throw asUnsupported(err);
    }
    // Decoded in place, as fromJSON's result is.
    return decodeParsed(JSON.parse(text), modelManager, cached.types);
}

/**
 * `validateMetaModel(input)` (introspect/metamodel.ts) in one engine call,
 * on the engine's resident metamodel manager with the Serializer's default
 * options, validate-only: it throws what `Serializer.fromJSON` over
 * `newMetaModelManager()` throws, in the same cases and with the same class,
 * without building the resource. Throws `EngineFastPathUnsupported` for an
 * input it cannot cross; the caller then validates through its visitor path.
 */
function validateMetaModel(input: unknown): void {
    try {
        rust.validateMetaModelInstance(JSON.stringify(encodeValue(input)), 'serializer');
    } catch (err) {
        throw asUnsupported(err);
    }
}

// validate-resource.ts uses `handleFor` too, so instance validation shares
// the rustHandle.
export { asUnsupported, fastFromJson, fastToJson, handleFor, validateMetaModel };
