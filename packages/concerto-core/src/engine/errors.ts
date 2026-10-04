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

// Maps the engine's error payload to the TS exception class. Every
// ErrorKind the engine sends has an entry; concerto-wasm maps any other kind
// to `Error`. `message` is raw, and each TS constructor decorates it as TS
// 5.0.0 does.

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
    // An instance error's diagnostics (accordproject/concerto#1325).
    details?: unknown[];
    // Whether TS attaches a model file to this `IllegalModel` error at all.
    needsModelFile?: boolean;
    // The wire codec could not carry the value: the caller runs its TS path.
    fastPathUnsupported?: boolean;
}

/** The codes of BC-19's AST shape check (with BC-17, BC-20), all `IllegalModelException`s. */
const AST_SHAPE_CODES = new Set([
    'modelfile-load-astshape',
    'modelfile-load-decoratorsnotarray',
    'modelfile-load-supertypename',
    'modelfile-load-namenotstring',
    'modelfile-load-nodenotobject',
]);

/** The engine's internal signals on an `IllegalModelException`, not part of its public shape. */
interface EngineErrorFlags {
    needsModelFile?: boolean;
    /** An AST the engine's typed read cannot read. */
    unreadableAst?: boolean;
    /** An error of BC-19's AST shape check. */
    astShape?: boolean;
    /** An error of `validateAst`'s metamodel check, set by the engine. */
    metamodelCheck?: boolean;
}

/** Sets an internal flag as a non-enumerable property, so the enumerable shape matches TS 5.0.0. */
function setInternalFlag<K extends keyof EngineErrorFlags>(err: Error, key: K, value: EngineErrorFlags[K]): void {
    Object.defineProperty(err, key, { value, enumerable: false, writable: true, configurable: true });
}

const FACTORIES: Record<string, (p: ErrorPayload) => Error> = {
    IllegalModel: (p) => {
        const err = new IllegalModelException(p.message, p.modelFile, p.location);
        // A property, not a constructor argument: the constructor is public API.
        if (p.needsModelFile !== undefined) {
            setInternalFlag(err, 'needsModelFile', p.needsModelFile);
        }
        // BC-39: a validator error at model load keeps its errorType.
        if (p.errorType) {
            err.errorType = p.errorType;
        }
        // Thrown by the ModelFile constructor when the shape check is off.
        if (p.code === 'modelfile-load-unreadable') {
            setInternalFlag(err, 'unreadableAst', true);
        }
        // BC-19: thrown before any other error by the folded load.
        if (AST_SHAPE_CODES.has(p.code)) {
            setInternalFlag(err, 'astShape', true);
        }
        return err;
    },
    TypeNotFound: (p) => new TypeNotFoundException(p.params.typeName, p.message),
    // BC-39: an instance value failing a validator keeps its errorType.
    Validation: (p) => {
        const err = new ValidationException(p.message);
        if (p.errorType) {
            err.errorType = p.errorType;
        }
        return err;
    },
    Error: (p) => new Error(p.message),
    JsTypeError: (p) => new TypeError(p.message),
    Metamodel: (p) => new MetamodelException(p.message),
};

/** Builds the TS exception for an engine error payload. */
function makeError(payload: ErrorPayload): Error {
    // concerto-wasm sends only these kinds, and is pinned in lockstep.
    const err = FACTORIES[payload.kind](payload);
    // Non-enumerable, so the exception's enumerable shape is unchanged.
    if (Array.isArray(payload.details)) {
        Object.defineProperty(err, 'details', { value: payload.details, enumerable: false, writable: true, configurable: true });
    }
    // Branded, so no caller decides by the message text.
    if (payload.fastPathUnsupported === true) {
        Object.defineProperty(err, FAST_PATH_UNSUPPORTED, { value: true, enumerable: false, writable: true, configurable: true });
    }
    return err;
}

export { makeError };
export type { EngineErrorFlags };
