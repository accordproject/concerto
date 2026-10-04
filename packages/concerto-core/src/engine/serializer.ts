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

// Serializer.fromJSON/toJSON's fast path: one engine call on the manager's
// `rustHandle` rather than the TS visitors (JSONPopulator, JSONGenerator,
// ResourceValidator), which stay the fallback on `EngineFastPathUnsupported`:
// a value the wire cannot carry, a manager without a rustHandle, or one
// whose mirror is behind (`_mirrorPending`). The result's class lookups
// (`TypeCache`) are cached per model version.

import { rust } from './index';
import { encodeValue, encodeBytes, decodeParsed, materializeCompact, newTypeCache } from './serializer-codec';
import { EngineFastPathUnsupported, isFastPathUnsupported } from './util';
import Factory from '../factory';

/* eslint-disable no-unused-vars */
import type BaseModelManager from '../basemodelmanager';
import type { SerializerOptions } from '../types';
import type { TypeCache } from './serializer-codec';
import type { EngineHandle } from './bindings';
/* eslint-enable no-unused-vars */

interface CachedHandle {
    handle: EngineHandle;
    // Valid while the model files they came from are registered.
    types: TypeCache;
}

/** The manager's `rustHandle`, which mirrors every model it holds. */
function handleFor(modelManager: BaseModelManager): EngineHandle {
    return cachedHandleFor(modelManager).handle;
}

/** `handleFor` with its `TypeCache`, kept in the engine state for the current model version. */
function cachedHandleFor(modelManager: BaseModelManager): CachedHandle {
    // BC-28: `options.regExp` is ignored, so it does not leave the fast path.
    const handle = modelManager.rustHandle;
        // A non-BaseModelManager (the Serializer accepts any duck type) has no
        // engine mirror: the visitor path serves it.
    if (!handle) {
        throw new EngineFastPathUnsupported('no-rust-handle');
    }
    // `addModelFiles` registers its files before it mirrors them.
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
 * An engine error as `EngineFastPathUnsupported` when it is a fallback
 * signal (`isFastPathUnsupported`), else `err` unchanged.
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

/** The `env` of every `serializerFromJson` call: id and clock stay with the caller. Shared. */
const fromJsonEnv = {
    newId: () => Factory.newId(),
    nowMs: () => Date.now(),
};

/** Each options object `optionsText` encoded, with its own keys, values and wire text. */
const encodedOptions = new WeakMap<object, { keys: string[]; values: unknown[]; text: string }>();

/**
 * `JSON.stringify(encodeValue(options))`, reused while `options` is the same
 * object with the same own keys and primitive values.
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
        // Compact binary where it can be, else text.
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
        // Cached options text lets the engine reuse its serializer for them.
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
 * `validateMetaModel(input)` in one engine call, validate-only: throws what
 * `Serializer.fromJSON` over `newMetaModelManager()` throws, with the same
 * class. Throws `EngineFastPathUnsupported` for an input it cannot cross.
 */
function validateMetaModel(input: unknown): void {
    try {
        rust.validateMetaModelInstance(JSON.stringify(encodeValue(input)), 'serializer');
    } catch (err) {
        throw asUnsupported(err);
    }
}

export { asUnsupported, fastFromJson, fastToJson, handleFor, optionsText, validateMetaModel };
