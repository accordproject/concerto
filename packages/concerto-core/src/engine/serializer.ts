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
// (a WeakMap) until its declaration count changes -- the same
// cheap-to-check invalidation the rest of the engine uses `generation()`
// for, here done by hand since a plain `BaseModelManager` exposes no
// generation counter of its own.

import { rust } from './index';
import { EngineFastPathUnsupported, encodeValue, decodeValue } from './serializer-codec';
import Factory from '../factory';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type BaseModelManager from '../basemodelmanager';
import type { SerializerOptions } from '../types';
/* eslint-enable no-unused-vars */

interface CachedHandle {
    handle: any;
    namespaces: string[];
}

const handles = new WeakMap<BaseModelManager, CachedHandle>();

/**
 * The namespaces `modelManager` currently has loaded, excluding the system
 * one (`ModelManagerHandle::new` already loads that).
 * @param {BaseModelManager} modelManager the model manager
 * @return {string[]} its user model files' namespaces, in `getModelFiles()` order
 */
function namespacesOf(modelManager: BaseModelManager): string[] {
    return modelManager.getModelFiles(false).map((modelFile) => modelFile.getNamespace());
}

/**
 * A `ModelManagerHandle` (concerto-wasm) with every model `modelManager`
 * currently holds, reused across calls while the model set is unchanged.
 * @param {BaseModelManager} modelManager the model manager to mirror
 * @return {object} the handle
 */
function handleFor(modelManager: BaseModelManager): any {
    const namespaces = namespacesOf(modelManager);
    const cached = handles.get(modelManager);
    if (cached && cached.namespaces.length === namespaces.length && cached.namespaces.every((ns, i) => ns === namespaces[i])) {
        return cached.handle;
    }
    const ModelManagerHandle = (rust as any).ModelManagerHandle;
    const handle = new ModelManagerHandle();
    for (const modelFile of modelManager.getModelFiles(false)) {
        handle.addModel(JSON.stringify(modelFile.getAst()), modelFile.getName());
    }
    handles.set(modelManager, { handle, namespaces });
    return handle;
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
 * `Serializer.fromJSON`'s fast path.
 * @param {BaseModelManager} modelManager the model manager
 * @param {object} jsonObject the JSON object to populate
 * @param {SerializerOptions} options the merged options
 * @return {object} the populated resource
 */
function fastFromJson(modelManager: BaseModelManager, jsonObject: unknown, options: SerializerOptions) {
    const handle = handleFor(modelManager);
    const env = {
        // D7: the identifier and the clock stay with the caller
        // (`Factory.newResource`'s own `uuid.v4()`/`dayjs.utc()`).
        newId: () => Factory.newId(),
        nowMs: () => Date.now(),
    };
    let text;
    try {
        text = handle.serializerFromJson(
            JSON.stringify(encodeValue(jsonObject)),
            JSON.stringify(encodeValue(options)),
            env,
        );
    } catch (err) {
        throw asUnsupported(err);
    }
    const node = JSON.parse(text);
    return decodeValue(node, modelManager);
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

export { fastFromJson, fastToJson };
