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

import { rust } from './index';
import { EngineFastPathUnsupported, encodeValue, decodeValue, checkString, checkJsonText } from './serializer-codec';
import Factory from '../factory';

// Types needed for TypeScript generation.
/* eslint-disable no-unused-vars */
import type BaseModelManager from '../basemodelmanager';
import type { SerializerOptions } from '../types';
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
}

const handles = new WeakMap<BaseModelManager, CachedHandle>();

/**
 * A `ModelManagerHandle` (concerto-wasm) with every model `modelManager`
 * currently holds, reused across calls while the model set is unchanged.
 * @param {BaseModelManager} modelManager the model manager to mirror
 * @return {object} the handle
 */
function handleFor(modelManager: BaseModelManager): any {
    // A model manager built with an alternative regular expression engine
    // (`new ModelManager({ regExp })`, e.g. XRegExp) validates `regex=`
    // string fields with that engine (introspect/stringvalidator.ts
    // `regExpHook`), which the engine-side ModelManager built below cannot
    // call: it would validate with its own ECMAScript dialect instead and
    // could accept or reject different strings. Fall back to the visitor
    // path, which honours the hook.
    if ((modelManager as any).options?.regExp) {
        throw new EngineFastPathUnsupported('model-manager-regExp-option');
    }
    const modelFiles = modelManager.getModelFiles(false);
    const cached = handles.get(modelManager);
    if (cached && cached.modelFiles.length === modelFiles.length && cached.modelFiles.every((mf, i) => mf === modelFiles[i])) {
        return cached.handle;
    }
    const ModelManagerHandle = (rust as any).ModelManagerHandle;
    const handle = new ModelManagerHandle();
    for (const modelFile of modelFiles) {
        // A lone surrogate in the AST (a string default, a regex) or in the
        // file name cannot cross unchanged (serializer-codec.ts
        // `checkJsonText`): fall back to the visitor path.
        const name = modelFile.getName();
        if (typeof name === 'string') {
            checkString(name);
        }
        handle.addModel(checkJsonText(JSON.stringify(modelFile.getAst())), name);
    }
    handles.set(modelManager, { handle, modelFiles });
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
