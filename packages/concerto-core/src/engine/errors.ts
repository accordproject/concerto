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
// Maps the engine's error payload to the TS exception class (PORTING.md 2.3;
// P4-02). Every ErrorKind concerto-rust's error/mod.rs defines has an entry
// here, so no converted member (from the original P0-04b trial units of
// ModelUtil, NumberValidator and ScalarDeclaration through to the full
// conversion at P5-02) is ever left throwing the "unknown engine error kind"
// fallback.
//
// The payload is {kind, code, params, message, location, errorType,
// modelFile}. `message` is the raw rendered message: each TS constructor
// decorates it exactly as it does for the TS code path.

import { BaseException } from '@accordproject/concerto-util';
import IllegalModelException from '../introspect/illegalmodelexception';
import TypeNotFoundException from '../typenotfoundexception';
import ValidationException from '../serializer/validationexception';
import MetamodelException from '../metamodelexception';

/**
 * The error payload the engine hands to the factory.
 */
interface ErrorPayload {
    kind: string;
    code: string;
    params: Record<string, string>;
    message: string;
    location?: unknown;
    errorType?: string;
    modelFile?: unknown;
    // P5-89 (accordproject/concerto#1325): an error about an instance
    // (`Serializer.fromJSON`, `validateInstance*`) carries its diagnostics,
    // `{code, path, expected?, severity, message}`.
    details?: unknown[];
    // Whether the engine's own contract (concerto-wasm `throw`, mirroring
    // concerto-core's `attach_model_file`) considers this `IllegalModel`
    // error one that TS attaches a model file to at all. False for the
    // handful of checks TS never attaches a file to (e.g.
    // `ModelFile.validate`'s duplicate-class-name scan) even though a caller
    // that owns a `ModelFile` (`this`) is available to attach — see
    // `ModelFile.validate()` (modelfile.ts), the only caller that consults
    // this, since `p.modelFile` above is never populated for that binding.
    needsModelFile?: boolean;
}

/**
 * P5-69 (BC-19-b): the codes of BC-19's AST shape check (concerto-rust
 * `instance::check_ast_shape`, with BC-17 and BC-20), all
 * `IllegalModelException`s.
 */
const AST_SHAPE_CODES = new Set([
    'modelfile-load-astshape',
    'modelfile-load-decoratorsnotarray',
    'modelfile-load-supertypename',
    'modelfile-load-namenotstring',
    'modelfile-load-nodenotobject',
]);

/**
 * The engine's internal signals on an `IllegalModelException` it built, for
 * its own callers (`ModelFile.validate()`, engine/views.ts `stageModelFile`):
 * not part of the exception's public shape.
 */
interface EngineErrorFlags {
    /** The payload's `needsModelFile` (see {@link ErrorPayload}). */
    needsModelFile?: boolean;
    /** P5-61: an AST the engine's typed read cannot read. */
    unreadableAst?: boolean;
    /** P5-69 (BC-19-b): an error of BC-19's AST shape check. */
    astShape?: boolean;
}

/**
 * Sets one of the engine's internal flags on `err` as a non-enumerable own
 * property (P5-98, E-12), so an engine-thrown exception has the same
 * enumerable shape (what `JSON.stringify`, `Object.keys` or a deep equality
 * sees) as the one TS 5.0.0 throws, as `details` below already is.
 * @param {Error} err the exception
 * @param {string} key the flag
 * @param {boolean} value its value
 */
function setInternalFlag<K extends keyof EngineErrorFlags>(err: Error, key: K, value: EngineErrorFlags[K]): void {
    Object.defineProperty(err, key, { value, enumerable: false, writable: true, configurable: true });
}

const FACTORIES: Record<string, (p: ErrorPayload) => Error> = {
    IllegalModel: (p) => {
        const err = new IllegalModelException(p.message, p.modelFile, p.location);
        // Carried through as a plain property (not a constructor argument):
        // `IllegalModelException`'s constructor is public API TS callers
        // construct directly too, and does not itself need this internal
        // engine-to-caller signal.
        if (p.needsModelFile !== undefined) {
            setInternalFlag(err, 'needsModelFile', p.needsModelFile);
        }
        // A validator error found while the model loads (BC-39) keeps its
        // errorType (`DefaultValidatorException`, `RegexValidatorException`).
        if (p.errorType) {
            err.errorType = p.errorType;
        }
        // P5-61: an AST the engine's typed read cannot read
        // (`modelfile-load-unreadable`), which the ModelFile constructor
        // throws when the shape check is off (engine/views.ts
        // `stageModelFile`).
        if (p.code === 'modelfile-load-unreadable') {
            setInternalFlag(err, 'unreadableAst', true);
        }
        // P5-69 (BC-19-b): an error of BC-19's AST shape check, which the
        // engine's folded load (`stageModelFileChecked`) throws before any
        // other, and the ModelFile constructor throws as the check's
        // (engine/views.ts `stageModelFile`).
        if (AST_SHAPE_CODES.has(p.code)) {
            setInternalFlag(err, 'astShape', true);
        }
        return err;
    },
    // `TypeNotFoundException(typeName, message)`: `typeName` travels in
    // `params.typeName` (concerto-rust error/mod.rs `ContractError::type_not_found`),
    // separately from the rendered `message` the constructor would otherwise
    // recompute a default for.
    TypeNotFound: (p) => new TypeNotFoundException(p.params.typeName, p.message),
    // `ValidationException(message)` (error/mod.rs `ErrorKind::Validation`
    // doc): thrown by `ResourceValidator`'s `report*` methods, and by the
    // populator/generator/validator per-field delegation the P4-10 fast
    // path and views call into (concerto-core/src/instance/populator.rs
    // `validation()`).
    // An instance value that fails a validator (BC-39) keeps its errorType.
    Validation: (p) => {
        const err = new ValidationException(p.message);
        if (p.errorType) {
            err.errorType = p.errorType;
        }
        return err;
    },
    // Not raised since BC-39 (concerto-rust error/mod.rs `ErrorKind::Validator`);
    // kept for an engine that still sends it.
    Validator: (p) => new BaseException(p.message, undefined, p.errorType),
    Error: (p) => new Error(p.message),
    JsTypeError: (p) => new TypeError(p.message),
    // error/mod.rs `ErrorKind::JsRangeError` (task accordproject/concerto-rust#151,
    // P2-08b): a JS `RangeError(message)`, the same relationship JsTypeError
    // above has to TypeError.
    JsRangeError: (p) => new RangeError(p.message),
    // `MetamodelException(message)` (P4-08b): thrown by
    // `BaseModelManager.validateAst`.
    Metamodel: (p) => new MetamodelException(p.message),
};

/**
 * Builds the TS exception for an engine error payload.
 * @param {ErrorPayload} payload the payload
 * @return {Error} the exception to throw
 */
function makeError(payload: ErrorPayload): Error {
    const factory = FACTORIES[payload.kind];
    if (!factory) {
        return new Error(`Unknown engine error kind ${payload.kind}: ${payload.message}`);
    }
    const err = factory(payload);
    // P5-89 (accordproject/concerto#1325): the structured, value-free
    // details of an instance error, additively. Not enumerable, so the
    // exception's own enumerable shape (what `JSON.stringify` or a deep
    // equality sees) is unchanged.
    if (Array.isArray(payload.details)) {
        Object.defineProperty(err, 'details', { value: payload.details, enumerable: false, writable: true, configurable: true });
    }
    return err;
}

export { makeError };
export type { EngineErrorFlags };
