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
import {
    EngineFastPathUnsupported, encodeValue, decodeValue, checkString, checkJsonText,
    encodePlainObjectText, encodeTypedText, encodeValidatorText, materializeLean, modelClasses,
    isPlainDataGraph,
} from './serializer-codec';
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

// D7: the identifier and the clock stay with the caller
// (`Factory.newResource`'s own `uuid.v4()`/`dayjs.utc()`).
const ENV = {
    newId: () => Factory.newId(),
    nowMs: () => Date.now(),
};

/**
 * `Serializer.fromJSON`'s fast path.
 * @param {BaseModelManager} modelManager the model manager
 * @param {object} jsonObject the JSON object to populate
 * @param {SerializerOptions} options the merged options
 * @return {object} the populated resource
 */
function fastFromJson(modelManager: BaseModelManager, jsonObject: unknown, options: SerializerOptions) {
    const handle = handleFor(modelManager);
    // P5-06b: a plain object (what `JSON.parse` gives) crosses as its own
    // `JSON.stringify` text where it can, and the resource comes back as
    // the lean recipe `materializeLean` reads (concerto-wasm
    // `serializerFromJsonLean`: the same call, the same errors).
    const plain = encodePlainObjectText(jsonObject);
    if (plain) {
        let reply;
        try {
            reply = handle.serializerFromJsonLean(plain.text, JSON.stringify(encodeValue(options)), ENV);
        } catch (err) {
            throw asUnsupported(err);
        }
        return materializeLean(JSON.parse(reply), plain.values, modelManager);
    }
    let text;
    try {
        text = handle.serializerFromJson(
            JSON.stringify(encodeValue(jsonObject)),
            JSON.stringify(encodeValue(options)),
            ENV,
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

/**
 * `ValidatedResource.validate()`'s fast path (P5-06b): one engine call
 * (concerto-wasm `resourceValidateFast`) that answers whether the resource
 * is valid with nothing for the visitor to write. `true` means
 * `validate()` is done; `false` means the caller runs its own visitor path,
 * which then raises any error and makes any write exactly as it always has.
 * Throws `EngineFastPathUnsupported` for a resource the engine cannot take.
 *
 * It is only taken when the engine would validate what the visitor would:
 * the resource's own `$validator` is a plain `ResourceValidator` (whose two
 * relationship options cross with the call), and its model manager still
 * resolves its type to the very declaration it holds.
 *
 * Nor is it taken, before anything of the resource is read, unless every
 * object the walk would reach holds only enumerable own data properties and
 * is not a Proxy (serializer-codec.ts `isPlainDataGraph`): the encoders list
 * fields with `Object.keys`, where the visitor uses
 * `Object.getOwnPropertyNames`, and reading a getter or a Proxy trap before
 * a fallback would run it again in the visitor.
 * @param {object} resource the ValidatedResource
 * @return {boolean} whether the resource is valid and nothing is left to do
 */
function fastValidate(resource): boolean {
    if (!isPlainDataGraph(resource)) {
        return false;
    }
    const { ResourceValidator } = modelClasses();
    const validator = resource.$validator;
    if (!validator || Object.getPrototypeOf(validator) !== ResourceValidator.prototype) {
        return false;
    }
    const modelManager = resource.getModelManager();
    let declaration;
    try {
        declaration = modelManager.getType(resource.getFullyQualifiedType());
    } catch (err) {
        return false;
    }
    if (declaration !== resource.getClassDeclaration()) {
        return false;
    }
    const options = validator.options;
    if (!options || typeof options !== 'object') {
        return false;
    }
    const handle = handleFor(modelManager);
    const convert = !!options.convertResourcesToRelationships;
    const permit = !!options.permitResourcesForRelationships;
    // A resource of plain fields crosses already in the validator's shape;
    // the one write the walk makes (`obj.$identifier = obj.getIdentifier()`)
    // is checked here to be a no-op.
    const idField = resource.$identifierFieldName;
    if (typeof idField === 'string' &&
        Object.prototype.hasOwnProperty.call(resource, '$identifier') &&
        Object.is(resource.$identifier, resource[idField])) {
        const text = encodeValidatorText(resource);
        if (text !== null) {
            return handle.resourceValidateSimple(text, resource.getFullyQualifiedIdentifier(), convert, permit);
        }
    }
    return handle.resourceValidateFast(
        encodeTypedText(resource),
        convert,
        permit,
    );
}

export { fastFromJson, fastToJson, fastValidate };
