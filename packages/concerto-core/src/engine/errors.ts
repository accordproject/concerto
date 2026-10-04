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

// Maps the engine's error payload, {kind, code, params, message, location,
// errorType, modelFile}, to the TS exception class. Every ErrorKind the
// engine sends has an entry here; concerto-wasm maps any other kind to
// `Error`. `message` is the raw rendered message, which each TS constructor
// decorates as TS 5.0.0 does.

import IllegalModelException from '../introspect/illegalmodelexception';
import TypeNotFoundException from '../typenotfoundexception';
import ValidationException from '../serializer/validationexception';
import MetamodelException from '../metamodelexception';
import { FAST_PATH_UNSUPPORTED } from '../engineutil';

/** The error payload the engine hands to the factory. */
interface ErrorPayload {
    kind: string;
    code: string;
    params: Record<string, string>;
    message: string;
    location?: unknown;
    errorType?: string;
    modelFile?: unknown;
    // An instance error's diagnostics (accordproject/concerto#1325):
    // `{code, path, expected?, severity, message}`.
    details?: unknown[];
    // Whether TS attaches a model file to this `IllegalModel` error at all:
    // false for checks TS never attaches one to (e.g. `ModelFile.validate`'s
    // duplicate-class-name scan). Read only by `ModelFile.validate()`.
    needsModelFile?: boolean;
    // The fast path's wire codec could not carry the value: the caller runs
    // its TS path instead.
    fastPathUnsupported?: boolean;
}

/**
 * The codes of BC-19's AST shape check (with BC-17 and BC-20), all
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
    /** An AST the engine's typed read cannot read. */
    unreadableAst?: boolean;
    /** An error of BC-19's AST shape check. */
    astShape?: boolean;
    /**
     * An error of `validateAst`'s metamodel check, run by
     * `validateAndCommitStagedModelFile` (set by the engine itself).
     */
    metamodelCheck?: boolean;
}

/**
 * Sets an internal flag on `err` as a non-enumerable property, so the
 * exception's enumerable shape matches TS 5.0.0's.
 */
function setInternalFlag<K extends keyof EngineErrorFlags>(err: Error, key: K, value: EngineErrorFlags[K]): void {
    Object.defineProperty(err, key, { value, enumerable: false, writable: true, configurable: true });
}

const FACTORIES: Record<string, (p: ErrorPayload) => Error> = {
    IllegalModel: (p) => {
        const err = new IllegalModelException(p.message, p.modelFile, p.location);
        // A plain property, not a constructor argument: the constructor is
        // public API.
        if (p.needsModelFile !== undefined) {
            setInternalFlag(err, 'needsModelFile', p.needsModelFile);
        }
        // A validator error found while the model loads (BC-39) keeps its
        // errorType (`DefaultValidatorException`, `RegexValidatorException`).
        if (p.errorType) {
            err.errorType = p.errorType;
        }
        // An AST the engine's typed read cannot read, which the ModelFile
        // constructor throws when the shape check is off.
        if (p.code === 'modelfile-load-unreadable') {
            setInternalFlag(err, 'unreadableAst', true);
        }
        // BC-19: an AST shape check error, thrown before any other by the
        // folded load and by the ModelFile constructor as the check's.
        if (AST_SHAPE_CODES.has(p.code)) {
            setInternalFlag(err, 'astShape', true);
        }
        return err;
    },
    // `typeName` travels in `params.typeName`, separately from the rendered
    // message.
    TypeNotFound: (p) => new TypeNotFoundException(p.params.typeName, p.message),
    // An instance value that fails a validator (BC-39) keeps its errorType.
    Validation: (p) => {
        const err = new ValidationException(p.message);
        if (p.errorType) {
            err.errorType = p.errorType;
        }
        return err;
    },
    Error: (p) => new Error(p.message),
    JsTypeError: (p) => new TypeError(p.message),
    // Thrown by `BaseModelManager.validateAst`.
    Metamodel: (p) => new MetamodelException(p.message),
};

/** Builds the TS exception for an engine error payload. */
function makeError(payload: ErrorPayload): Error {
    // concerto-wasm sends only these kinds, and is pinned in lockstep with
    // this shim.
    const err = FACTORIES[payload.kind](payload);
    // An instance error's structured, value-free details
    // (accordproject/concerto#1325), not enumerable, so the exception's
    // enumerable shape is unchanged.
    if (Array.isArray(payload.details)) {
        Object.defineProperty(err, 'details', { value: payload.details, enumerable: false, writable: true, configurable: true });
    }
    // A value the fast path cannot carry: a fallback signal, branded so no
    // caller decides by the message text.
    if (payload.fastPathUnsupported === true) {
        Object.defineProperty(err, FAST_PATH_UNSUPPORTED, { value: true, enumerable: false, writable: true, configurable: true });
    }
    return err;
}

export { makeError };
export type { EngineErrorFlags };
